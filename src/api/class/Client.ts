import { Boom } from '@hapi/boom';
import makeWASocket, {
	DisconnectReason,
	WAMessage,
	Chat,
	makeCacheableSignalKeyStore
} from '@adiwajshing/baileys';

// import type Handler from './CommandHandler';

import { logger } from '../utils';
import { v4 as uuidv4 } from 'uuid';

import { makeMongoStore } from '../store';
import { makeMongoAuthState } from '../state';
import { Db } from 'mongodb';


export default class Client {
	key = '';
	store!: Awaited<ReturnType<typeof makeMongoStore>>;
	// socket: ReturnType<typeof makeWASocket> | null;
	events: { event: string; on: () => void }[];
	// handler: Handler | undefined;

	instance: { key: string, socket: ReturnType<typeof makeWASocket> | null } = {
		key: this.key,
		socket: null
	}

	constructor(key?: any) {
		this.key = key ? key : uuidv4()
		// this.handler = handler;
		this.instance.socket = null;
		this.events = [];
	}

	async init(mongoDB: Db) {
		const authCollection = mongoDB.collection(`auth-${this.key}`)
		const { state, saveCreds } = await makeMongoAuthState(authCollection)
		this.store = await makeMongoStore(mongoDB, this.key);

		this.instance.socket = makeWASocket({
			auth: {
				creds: state.creds,
				keys: makeCacheableSignalKeyStore(state.keys, logger)
			},
			logger: logger,
			printQRInTerminal: true
		});

		this.store.bind(this.instance.socket.ev);

		this.instance.socket.ev.on('messages.upsert', ({ messages, type }) => {
			if (type !== 'notify') return
			for (const m of messages) {
				if (m.key.fromMe) return
				if ((m.message?.conversation || m.message?.extendedTextMessage?.text) === 'PING') {
					this.instance.socket?.readMessages([m.key])
					this.instance.socket?.sendMessage(m.key.remoteJid!, { text: 'PONG' })
				}
			}
		})

		this.instance.socket.ev.on('connection.update', (update) => {
			const { connection, lastDisconnect, receivedPendingNotifications } = update;

			// if (receivedPendingNotifications && process.env.OWNER) {
			// 	this.instance.socket!.sendMessage(process.env.OWNER, {
			// 		text: `*Bot is ready!*\n` +
			// 			`Received all notifications!\n` +
			// 			`Commands loaded: ${this.handler.commands.length}`
			// 	});
			// }

			if (connection === 'close') {
				if ((lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
					this.init(mongoDB);
					return;
				} else {
					throw new Error(`Connection closed due to: Logged Out`);
				}
			}
		});

		this.instance.socket.ev.on('creds.update', saveCreds);
		this.events.map((event) => {
			event.on();
			logger.debug({ event: event.event }, 'listening for Event');
		});

		return this

	}

	async sendTextMessage(to: string, message: string) {
		const socket = this.instance.socket

		await socket?.sendMessage(to, { text: message })

	}

	onMessage(callback: (message: WAMessage) => void) {
		this.events.push({
			event: 'messages.upsert',
			on: () => {
				this.instance.socket?.ev.on('messages.upsert', (data) => {
					const { messages, type } = data;
					if (type !== 'notify') return;

					for (const _msg of messages) {
						callback(_msg);
					}
				});
			}
		});
	}

	onChatUpdate(callback: (message: Chat) => void) {
		this.events.push({
			event: 'chats.upsert',
			on: () => {
				this.instance.socket?.ev.on('chats.upsert', (data) => {
					for (const _chat of data) {
						callback(_chat);
					}
				});
			}
		});
	}
}