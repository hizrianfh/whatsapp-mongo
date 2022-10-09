/* eslint-disable no-unsafe-optional-chaining */
import WhatsAppInstance from '../class/Client'
import { logger } from '../utils';

class Session {
    async restoreSessions() {
        let restoredSessions = new Array()
        let allCollections: string[] = []
        try {
            const db = mongoClient
            const result = await db.listCollections().toArray()
            result.forEach((collection) => {
                const type = collection.name.split('-')[0]
                if (type === 'auth') allCollections.push(collection.name.split('-').slice(1).join('-'))
            })

            allCollections.map((key) => {
                const query = {}
                db.collection(key)
                    .find(query)
                    .toArray(async (err, result) => {
                        if (err) throw err
                        const instance = new WhatsAppInstance(
                            key
                        )
                        await instance.init(db)
                        WhatsAppInstances[key] = instance
                    })
                restoredSessions.push(key)
            })
        } catch (e) {
            logger.error('Error restoring sessions')
            logger.error(e)
        }
        return restoredSessions
    }
}

export { Session }
