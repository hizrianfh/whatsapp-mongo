import { proto } from '@adiwajshing/baileys/WAProto'
import { Curve, signedKeyPair } from '@adiwajshing/baileys/lib/Utils/crypto'
import { generateRegistrationId } from '@adiwajshing/baileys/lib/Utils/generics'
import { randomBytes } from 'crypto'
import { AuthenticationCreds, AuthenticationState, SignalDataTypeMap } from '@adiwajshing/baileys'
import { Collection } from 'mongodb'
const initAuthCreds = () => {
    const identityKey = Curve.generateKeyPair()
    return {
        noiseKey: Curve.generateKeyPair(),
        signedIdentityKey: identityKey,
        signedPreKey: signedKeyPair(identityKey, 1),
        registrationId: generateRegistrationId(),
        advSecretKey: randomBytes(32).toString('base64'),
        processedHistoryMessages: [],
        nextPreKeyId: 1,
        firstUnuploadedPreKeyId: 1,
        accountSettings: {
            unarchiveChats: false,
        },
    }
}

const BufferJSON = {
    replacer: (k: any, value: any) => {
        if (
            Buffer.isBuffer(value) ||
            value instanceof Uint8Array ||
            value?.type === 'Buffer'
        ) {
            return {
                type: 'Buffer',
                data: Buffer.from(value?.data || value).toString('base64'),
            }
        }

        return value
    },

    reviver: (_: any, value: any) => {
        if (
            typeof value === 'object' &&
            !!value &&
            (value.buffer === true || value.type === 'Buffer')
        ) {
            const val = value.data || value.value
            return typeof val === 'string'
                ? Buffer.from(val, 'base64')
                : Buffer.from(val || [])
        }

        return value
    },
}

export default async (collection: Collection): Promise<{ state: AuthenticationState, saveCreds: () => Promise<any> }> => {
    const writeData = (data: any, id: string) => {
        return collection.replaceOne(
            { _id: id },
            JSON.parse(JSON.stringify(data, BufferJSON.replacer)),
            { upsert: true }
        )
    }
    const readData = async (id: string) => {
        try {
            const data = JSON.stringify(await collection.findOne({ _id: id }))
            return JSON.parse(data, BufferJSON.reviver)
        } catch (error) {
            return null
        }
    }
    const removeData = async (id: string) => {
        try {
            await collection.deleteOne({ _id: id })
        } catch (_a) { }
    }
    const creds: AuthenticationCreds = (await readData('creds')) || (initAuthCreds)()
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data: { [_: string]: SignalDataTypeMap[typeof type] } = {}
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}`)
                            if (type === 'app-state-sync-key') {
                                value =
                                    proto.Message.AppStateSyncKeyData.fromObject(data)
                            }
                            data[id] = value
                        })
                    )
                    return data
                },
                set: async (data: any) => {
                    const tasks = []
                    for (const category of Object.keys(data)) {
                        for (const id of Object.keys(data[category])) {
                            const value = data[category][id]
                            const key = `${category}-${id}`
                            tasks.push(
                                value ? writeData(value, key) : removeData(key)
                            )
                        }
                    }
                    await Promise.all(tasks)
                },
            },
        },
        saveCreds: () => {
            return writeData(creds, 'creds')
        },
    }
}
