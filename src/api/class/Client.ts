import { Boom } from '@hapi/boom';
import makeWASocket, {
	DisconnectReason,
	WAMessage,
	Chat,
	makeCacheableSignalKeyStore,
	AnyMessageContent,
	AnyMediaMessageContent
} from '@adiwajshing/baileys';

// import type Handler from './CommandHandler';

import QRCode from 'qrcode'
import config from '../../config/config';


import { logger } from '../utils';
import { v4 as uuidv4 } from 'uuid';

import { makeMongoStore } from '../store';
import { makeMongoAuthState } from '../state';
import { Collection, Db } from 'mongodb';
import { io } from '../../config/express';


export default class Client {
	key = '';
	store!: Awaited<ReturnType<typeof makeMongoStore>>;
	events: { event: string; on: () => void }[];
	collection!: Collection
	// handler: Handler | undefined;

	instance: { key: string, socket: ReturnType<typeof makeWASocket> | null, qr: string, qrRetry: number, online: boolean } = {
		key: this.key,
		qr: '',
		qrRetry: 0,
		socket: null,
		online: false
	}

	constructor(key?: any) {
		this.key = key ? key : uuidv4()
		// this.handler = handler;
		this.instance.socket = null;
		this.events = [];
	}

	async init(mongoDB: Db) {
		const authCollection = mongoDB.collection(`auth-${this.key}`)
		this.collection = authCollection
		const { state, saveCreds } = await makeMongoAuthState(authCollection)
		this.store = await makeMongoStore(mongoDB, this.key);

		this.instance.socket = makeWASocket({
			auth: {
				creds: state.creds,
				keys: makeCacheableSignalKeyStore(state.keys, logger)
			},
			logger: logger,
			browser: [config.browser.browser, config.browser.platform, config.browser.version],
			printQRInTerminal: true
		});

		this.store.bind(this.instance.socket.ev);

		this.instance.socket.ev.on('messages.upsert', ({ messages, type }) => {
			io.emit(`new-message-${this.key}`, messages[0])
			if (type !== 'notify') return
			for (const m of messages) {
				if (m.key.fromMe) return
				if ((m.message?.conversation || m.message?.extendedTextMessage?.text) === 'PING') {
					this.instance.socket?.readMessages([m.key])
					this.instance.socket?.sendMessage(m.key.remoteJid!, { text: 'PONG' })
				}
			}
		})

		this.instance.socket.ev.on("message-receipt.update", (test) =>
			logger.debug(test, 'TESTSETST')
		)

		this.instance.socket.ev.on('connection.update', (update) => {
			const { connection, lastDisconnect, receivedPendingNotifications, qr } = update;

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
					mongoDB.collection(`messages-${this.key}`).drop().then(
						() => {
							this.collection.drop().then(() => {
								this.instance.online = false

								logger.info('STATE: Dropped collection')
							})
						}
					)
				}
			} else if (connection === 'open') {
				this.instance.online = true
			}

			if (qr) {
				QRCode.toDataURL(qr).then((url) => {
					this.instance.qr = url
					this.instance.qrRetry++
					if (this.instance.qrRetry >= config.instance.maxRetryQr) {
						// close WebSocket connection
						this.instance.socket!.ws.close()
						// remove all events
						this.instance.socket!.ev.removeAllListeners('connection.update')
						this.instance.socket!.ev.removeAllListeners('creds.update')
						this.instance.socket!.ev.removeAllListeners('messages.upsert')
						this.instance.qr = ' '
						logger.info('socket connection terminated')
					}
				})
			}

		});

		this.instance.socket.ev.on('creds.update', saveCreds);
		this.events.map((event) => {
			event.on();
			logger.debug({ event: event.event }, 'listening for Event');
		});

		return this

	}


	getWhatsAppId(id: string) {
		if (id.includes('@g.us') || id.includes('@s.whatsapp.net')) return id
		return id.includes('-') ? `${id}@g.us` : `${id}@s.whatsapp.net`
	}

	async verifyId(id: string) {
		if (id.includes('@g.us')) return true
		let exists: boolean = false;
		(await this.instance.socket?.onWhatsApp(id))?.map(r => exists = r.exists)

		if (exists) return true
		throw new Error('no account exists')
	}

	async sendTextMessage(to: string, message: string) {
		const socket = this.instance.socket

		await this.verifyId(this.getWhatsAppId(to))

		const data = await socket?.sendMessage(this.getWhatsAppId(to), { text: message })

		return data

	}

	async sendMediaFile(to: string, file: any, type: string, caption = '', filename?: string) {
		await this.verifyId(this.getWhatsAppId(to))
		const data = await this.instance.socket?.sendMessage(
			this.getWhatsAppId(to),
			//@ts-ignore
			{
				[type]: file.buffer,
				mimetype: file.mimetype,
				caption: caption,
				ptt: type === 'audio' ? true : false,
				fileName: filename ? filename : file.originalname
			}
		)
		return data
	}

	async sendUrlMediaFile(to: string, url: string, type: any, mimeType: string, caption = '') {
		await this.verifyId(this.getWhatsAppId(to))

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
		)
		return data
	}

	async getInstanceDetail(key: string) {
		return {
			instance_key: key,
			phone_connected: this.instance?.online,
			user: this.instance?.online ? this.instance.socket?.user : {},
		}
	}

	async getAllChats() {
		return await this.store.getAllMessagesJids()
	}

	async getAllMessages(id: string, limit: number) {
		return await this.store.loadAllMessage(id, limit)
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