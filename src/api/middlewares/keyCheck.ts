import { NextFunction, Request, Response } from "express"

function keyVerification(req: Request, res: Response, next: NextFunction) {
    const key = req.query['key']?.toString()
    if (!key) {
        return res
            .status(403)
            .send({ error: true, message: 'no key query was present' })
    }
    const instance = WhatsAppInstances.get(key)
    if (!instance) {
        return res
            .status(403)
            .send({ error: true, message: 'invalid key supplied' })
    }
    next()
}

export default keyVerification
