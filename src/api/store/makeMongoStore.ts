import {
  WAMessage,
  BaileysEventEmitter,
  jidNormalizedUser,
  updateMessageWithReaction,
} from "@adiwajshing/baileys";
import { logger } from "../utils";
import { Db, ObjectId } from "mongodb";

export default async (mongoDB: Db, key: string) => {
  if (!mongoDB) throw new Error("MongoDB URI is required.");
  const _logger = logger.child({ stream: "mongodb-store" });

  const db = mongoDB;

  const messagesCol = db.collection(`messages-${key}`);
  const chatsCol = db.collection(`chats-${key}`);

  const assertMessagesList = async (jid: string, message: WAMessage) => {
    const id = jidNormalizedUser(jid);
    const user = await messagesCol.findOne({ id });

    if (!user) {
      await messagesCol.insertOne({ id, messages: [], name: message.pushName });

      return await messagesCol.findOne({ id });
    }

    if (!user.name && !message.key.fromMe && message.pushName)
      await messagesCol.updateOne({ id }, { $set: { name: message.pushName } });

    return user;
  };

  const insertMessage = async (
    message: WAMessage,
    history: boolean = false
  ) => {
    const userDoc = await assertMessagesList(message.key.remoteJid!, message);

    message.messageTimestamp =
      typeof message.messageTimestamp === "object"
        ? message.messageTimestamp?.low
        : message.messageTimestamp;

    history
      ? userDoc!.messages.unshift(message)
      : userDoc!.messages.push(message);

    return await messagesCol.updateOne(
      { id: userDoc!.id },
      {
        $set: {
          messages: userDoc!.messages,
          lastMessageTimestamp:
            (message.messageTimestamp! > userDoc!.lastMessageTimestamp
              ? message.messageTimestamp!
              : userDoc!.lastMessageTimestamp) ?? message.messageTimestamp,
        },
      },
      { upsert: true }
    );
  };

  const bind = (ev: BaileysEventEmitter) => {
    // TODO: Implement others events
    // TODO: Auto delete messages from db after certain time

    ev.on("messaging-history.set", async ({ messages }) => {
      if ((await messagesCol.estimatedDocumentCount()) > 0) return;
      for (const msg of messages) {
        if (msg.message?.protocolMessage) return;
        await insertMessage(msg, true);
      }
      _logger.debug("Upserted history to store");
    });

    ev.on("messages.upsert", async ({ messages }) => {
      for (const msg of messages) {
        if (msg.message?.protocolMessage || !msg.message) return;
        const returnStatus = await insertMessage(msg);
        _logger.debug(returnStatus, "Upserted message to store");
      }
    });

    ev.on("messages.delete", async (item) => {
      if ("all" in item) {
        return await messagesCol.updateOne(
          { id: item.jid },
          { $set: { messages: [] } }
        );
      }

      const jid = item.keys[0].remoteJid;
      const listDoc = await messagesCol.findOne({ id: jid });

      if (listDoc) {
        const idSet = new Set(item.keys.map((k) => k.id));
        listDoc.messages.filter((m: WAMessage) => idSet.has(m.key.id));
        return await messagesCol.updateOne(
          { id: jid },
          { $set: { messages: listDoc.messages } }
        );
      }
    });

    ev.on("messages.reaction", async (reactions) => {
      for (const { key, reaction } of reactions) {
        const userDoc = await messagesCol.findOne({
          id: jidNormalizedUser(key.remoteJid!),
        });
        const messages = userDoc!.messages as WAMessage[];
        const msg = messages.find((_msg: WAMessage) => _msg.key.id === key.id);

        if (!msg) {
          return;
        }

        updateMessageWithReaction(msg, reaction);

        messages[messages.indexOf(msg)] = msg;

        messagesCol.updateOne({ id: userDoc!.id }, { $set: { messages } });
      }
    });

    ev.on("chats.upsert", async (updates) => {
      for (const update of updates) {
        await chatsCol.updateOne(
          { id: update.id },
          { $set: { ...update } },
          { upsert: true }
        );
      }
    });

    ev.on("chats.delete", async (deletions) => {
      for (const deletion of deletions) {
        await chatsCol.deleteOne({ id: jidNormalizedUser(deletion) });
      }
    });
  };

  const loadLastMessage = async (jid: string) => {
    const userDoc = await messagesCol.findOne({ id: jidNormalizedUser(jid) });
    if (!userDoc) throw new Error("Jid not found");
    const messages: WAMessage[] = userDoc.messages;

    return messages.pop();
  };

  const removeNulls = (obj: any) => {
    const isArray = Array.isArray(obj);
    for (const k of Object.keys(obj)) {
      if (obj[k] === null) {
        if (isArray) {
          //@ts-ignore
          obj.splice(k, 1);
        } else {
          delete obj[k];
        }
      } else if (typeof obj[k] === "object") {
        removeNulls(obj[k]);
      }
      //@ts-ignore
      if (isArray && obj.length === k) {
        removeNulls(obj);
      }
    }
    return obj;
  };

  return {
    bind,
    loadLastMessage,
    loadMessage: async (jid: string, id: string) => {
      const userDoc = await messagesCol.findOne({ id: jidNormalizedUser(jid) });
      if (!userDoc) throw new Error("Jid not found");

      const messages: WAMessage[] = userDoc.messages;

      const msg = messages.find((msg) => msg.key.id === id);

      return msg;
    },

    loadAllMessage: async (jid: string, limit: number = 0) => {
      const messageCol = await messagesCol.findOne({
        id: jidNormalizedUser(jid),
      });
      if (!messageCol) throw new Error("Jid not found");

      const messages: WAMessage[] = messageCol.messages.slice(limit * -1);

      return messages;
    },

    deleteAllMessagesFromContact: async (jid: string) => {
      const result = await messagesCol.deleteOne({
        id: jidNormalizedUser(jid),
      });

      _logger.debug({ jid, result }, "Deleted all messages from user");

      return result;
    },
    getAllMessagesJids: async (page: number, perPage: number) => {
      const offset = (page - 1) * perPage;
      const result = messagesCol
        .find()
        .sort({ lastMessageTimestamp: -1 })
        .skip(offset)
        .limit(perPage);
      const docCount = await messagesCol.estimatedDocumentCount();
      const lastPage = docCount <= offset + perPage;
      const nextPage = `${process.env.APP_URL}/store/chats?key=${key}&page=${
        page + 1
      }&perPage=${perPage}`;

      const docs: any[] = [];

      for await (const doc of result) {
        docs.push({
          id: doc.id,
          name: doc.name,
          lastMessage: await loadLastMessage(doc.id),
        });
      }

      return {
        docs,
        nextPage: lastPage ? null : nextPage,
        lastPage,
      };
    },
  };
};
