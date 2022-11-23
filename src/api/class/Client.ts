import { rmSync } from "fs";
import { Boom } from "@hapi/boom";
import {
  Browsers,
  useMultiFileAuthState,
} from "@adiwajshing/baileys/lib/Utils";
import makeWASocket, {
  DisconnectReason,
  WAMessage,
  Chat,
  makeCacheableSignalKeyStore,
  AnyMessageContent,
  AnyMediaMessageContent,
  MessageRetryMap,
} from "@adiwajshing/baileys";

// import type Handler from './CommandHandler';
import { join } from "path";

import QRCode from "qrcode";
import config from "../../config/config";

import { logger } from "../utils";
import { v4 as uuidv4 } from "uuid";

import { makeMongoStore } from "../store";
import { makeMongoAuthState } from "../state";
import { Collection, Db, ObjectId } from "mongodb";
import { io } from "../../config/express";
import { groupHandler, msgHandler } from "../handler";

const sessionsDir = (sessionId = "") => {
  return join(__dirname, "..", "..", "..", "sessions", sessionId);
};

export default class Client {
  key = "";
  store!: Awaited<ReturnType<typeof makeMongoStore>>;
  events: { event: string; on: () => void }[];
  collection!: Collection<Document>;
  historyCount = 0;
  // handler: Handler | undefined;

  instance: {
    key: string;
    socket: ReturnType<typeof makeWASocket> | null;
    qr: string;
    qrRetry: number;
    online: boolean;
  } = {
    key: this.key,
    qr: "",
    qrRetry: 0,
    socket: null,
    online: false,
  };

  constructor(key?: any) {
    this.key = key ? key : uuidv4();
    // this.handler = handler;
    this.instance.socket = null;
    this.events = [];
  }

  async init(mongoDB: Db) {
    let authCollection: Collection<Document>;
    try {
      authCollection = await mongoDB.createCollection(`auth-${this.key}`);
    } catch (error) {
      authCollection = mongoDB.collection(`auth-${this.key}`);
    }
    this.collection = authCollection;
    const { state, saveCreds } = await useMultiFileAuthState(
      sessionsDir(`auth-${this.key}`)
    );
    const msgRetryCounterMap: MessageRetryMap = {};
    this.store = await makeMongoStore(mongoDB, this.key);

    this.instance.socket = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger: logger,
      browser: Browsers.macOS("Desktop"),
      syncFullHistory: true,
      printQRInTerminal: true,
      msgRetryCounterMap,
      getMessage: async (key) => {
        if (this.store) {
          const msg = await this.store.loadMessage(key.remoteJid!, key.id!);
          return msg?.message || undefined;
        }

        // only if store is present
        return {
          conversation: "hello",
        };
      },
    });

    this.instance.socket.ev.on("messaging-history.set", async () => {
      if (this.historyCount === 0) {
        await mongoDB.collection(`messages-${this.key}`).drop();
        console.log('history dropped')
        this.historyCount++;
      }
    });

    this.store.bind(this.instance.socket.ev);

    this.instance.socket.ev.on("messages.upsert", ({ messages, type }) => {
      if (messages[0].key.remoteJid === "status@broadcast") return;
      io.emit(`new-message-${this.key}`, messages[0]);
      // if (type !== "notify") return;
      // for (const m of messages) {
      //   if (m.key.fromMe) return;

      //   if (m.key.remoteJid?.split("@")[1] === "s.whatsapp.net")
      //     return msgHandler(m, this.instance.socket!);
      //   else if (m.key.remoteJid?.split("@")[1] === "g.us")
      //     return groupHandler(m, this.instance.socket!);
      //   else return;
      // }
    });

    this.instance.socket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, receivedPendingNotifications, qr } =
        update;

      // if (receivedPendingNotifications && process.env.OWNER) {
      // 	this.instance.socket!.sendMessage(process.env.OWNER, {
      // 		text: `*Bot is ready!*\n` +
      // 			`Received all notifications!\n` +
      // 			`Commands loaded: ${this.handler.commands.length}`
      // 	});
      // }

      if (connection === "close") {
        logger.info(
          `Connection closed with code: ${
            (lastDisconnect?.error as Boom)?.output?.statusCode
          }`
        );
        if (
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut
        ) {
          logger.info(`Reconnecting...`);
          this.init(mongoDB);
          return;
        } else {
          const collectionArray = (
            await mongoDB.listCollections().toArray()
          ).filter((col) => col.name.includes(`auth-${this.key}`));

          for await (const col of collectionArray) {
            await mongoDB.collection(col.name).drop();
            logger.info(`Collection ${col.name} dropped.`);
          }

          this.instance.online = false;
          rmSync(sessionsDir(`auth-${this.key}`), { recursive: true });

          logger.info("STATE: Dropped collections success");
        }
      } else if (connection === "open") {
        this.instance.online = true;
      }

      if (qr) {
        QRCode.toDataURL(qr).then((url) => {
          this.instance.qr = url;
          this.instance.qrRetry++;
          if (this.instance.qrRetry >= config.instance.maxRetryQr) {
            // close WebSocket connection
            this.instance.socket!.ws.close();
            // remove all events
            this.instance.socket!.ev.removeAllListeners("connection.update");
            this.instance.socket!.ev.removeAllListeners("creds.update");
            this.instance.socket!.ev.removeAllListeners("messages.upsert");
            this.instance.qr = " ";
            logger.info("socket connection terminated");
          }
        });
      }
    });

    this.instance.socket.ev.on("creds.update", saveCreds);
    this.events.map((event) => {
      event.on();
      logger.debug({ event: event.event }, "listening for Event");
    });

    return this;
  }

  getWhatsAppId(id: string) {
    if (id.includes("@g.us") || id.includes("@s.whatsapp.net")) return id;
    return id.includes("-") ? `${id}@g.us` : `${id}@s.whatsapp.net`;
  }

  async verifyId(id: string) {
    if (id.includes("@g.us")) return true;
    let exists: boolean = false;
    (await this.instance.socket?.onWhatsApp(id))?.map(
      (r) => (exists = r.exists)
    );

    if (exists) return true;
    throw new Error("no account exists");
  }

  async sendTextMessage(to: string, message: string) {
    const socket = this.instance.socket;

    await this.verifyId(this.getWhatsAppId(to));

    const data = await socket?.sendMessage(this.getWhatsAppId(to), {
      text: message,
    });

    return data;
  }

  async sendMediaFile(
    to: string,
    file: any,
    type: string,
    caption = "",
    filename?: string
  ) {
    await this.verifyId(this.getWhatsAppId(to));
    const data = await this.instance.socket?.sendMessage(
      this.getWhatsAppId(to),
      //@ts-ignore
      {
        [type]: file.buffer,
        mimetype: file.mimetype,
        caption: caption,
        ptt: type === "audio" ? true : false,
        fileName: filename ? filename : file.originalname,
      }
    );
    return data;
  }

  async sendUrlMediaFile(
    to: string,
    url: string,
    type: any,
    mimeType: string,
    caption = ""
  ) {
    await this.verifyId(this.getWhatsAppId(to));

    const data = await this.instance.socket?.sendMessage(
      this.getWhatsAppId(to),
      //@ts-ignore
      {
        [type]: {
          url: url,
        },
        caption: caption,
        mimetype: mimeType,
      }
    );
    return data;
  }

  async getInstanceDetail(key: string) {
    return {
      instance_key: key,
      phone_connected: this.instance?.online,
      user: this.instance?.online ? this.instance.socket?.user : {},
    };
  }

  async getAllChats(page: number, perPage: number) {
    const jids = await this.store.getAllMessagesJids(page, perPage);
    for (const jid of jids.docs) {
      try {
        jid.ppUrl = await this.instance.socket?.profilePictureUrl(jid.id);
      } catch (error) {}
    }
    return jids;
  }

  async getAllMessages(id: string, limit: number) {
    return await this.store.loadAllMessage(id, limit);
  }

  onMessage(callback: (message: WAMessage) => void) {
    this.events.push({
      event: "messages.upsert",
      on: () => {
        this.instance.socket?.ev.on("messages.upsert", (data) => {
          const { messages, type } = data;
          if (type !== "notify") return;

          for (const _msg of messages) {
            callback(_msg);
          }
        });
      },
    });
  }

  onChatUpdate(callback: (message: Chat) => void) {
    this.events.push({
      event: "chats.upsert",
      on: () => {
        this.instance.socket?.ev.on("chats.upsert", (data) => {
          for (const _chat of data) {
            callback(_chat);
          }
        });
      },
    });
  }
}
