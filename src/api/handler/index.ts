import { WAMessage, WASocket } from "@adiwajshing/baileys";
import { autoResponder } from "./responder";
import api from "../utils/api";

export const msgHandler = async (m: WAMessage, socket: WASocket) => {
  const text = m.message?.conversation || m.message?.extendedTextMessage?.text;

  if (text?.startsWith("/s")) {
    let response;
    const token = text.split(" ")[1];

    if (!token)
      return await socket.sendMessage(m.key.remoteJid!, {
        text: "Token tidak valid",
      });

    try {
      response = await api.post("/checktoken", {
        token: token,
        waid: m.key.remoteJid,
      });
    } catch (error) {
      return await socket.sendMessage(m.key.remoteJid!, {
        text: "Ada masalah pada server, silahkan coba beberapa saat lagi.",
      });
    }

    let found = response.data.found;

    if (!found || !response)
      return await socket.sendMessage(m.key.remoteJid!, {
        text: "Token tidak valid!",
      });

    return await socket.sendMessage(m.key.remoteJid!, {
      text: `Berhasil terhubung dengan username: ${response.data.username}`,
    });
  }

  let responder = autoResponder.find((o) => o.key === text);
  if (!responder) {
    const reply = `id:${m.key.id}:${m.key.remoteJid}\n\nDari: ${m.pushName}\n\nPesan: ${text}`;
    return socket.sendMessage("120363042205341555@g.us", { text: reply });
  }
  await socket.readMessages([m.key]);
  await socket.sendPresenceUpdate("composing", m.key.remoteJid!);
  const answers = Array.isArray(responder.ans)
    ? responder.ans
    : [responder.ans];
  for await (const answer of answers) {
    if (typeof answer === "object") {
      for await (const msgObj of answers) {
        //@ts-ignore
        await socket.sendMessage(m.key.remoteJid!, {
          [msgObj.type]: msgObj.message,
        });
      }
      return;
    }
    await socket.sendMessage(m.key.remoteJid!, { text: answer });
  }
  await socket.sendPresenceUpdate("paused", m.key.remoteJid!);
};

export const groupHandler = async (m: WAMessage, socket: WASocket) => {
  const text = m.message?.conversation || m.message?.extendedTextMessage?.text;

  if (!text) return;
  if (text.startsWith("!ct") || text.startsWith("!createtoken")) {
    const response = await api.post("/generateToken");

    return await socket.sendMessage(
      m.key.remoteJid!,
      { text: response.data.token },
      { quoted: m }
    );
  }

  if (m?.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
    const id =
      m.message?.extendedTextMessage.contextInfo.quotedMessage.conversation!.split(
        /\r?\n/
      )[0];
    const jid = id.split(":")[2];
    if (!jid || !jid.endsWith("@s.whatsapp.net")) return;
    const key = {
      remoteJid: jid,
      id: id.split(":")[1],
      participant: jid,
    };
    await socket.readMessages([key]);

    await socket.sendMessage(jid, {
      text: m.message?.extendedTextMessage.text!,
    });

    return await socket.sendMessage(
      m.key.remoteJid!,
      { text: `Berhasil mengirim pesan.` },
      { quoted: m }
    );
  }
};
