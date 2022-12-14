import WhatsAppInstance from '../class/Client'
import { NextFunction, Request, Response } from 'express'
import config from '../../config/config'

export const init = async (req: Request, res: Response) => {
    const key = req.query.key as string
    const webhook = !req.query.webhook ? false : req.query.webhook
    const webhookUrl = !req.query.webhookUrl ? null : req.query.webhookUrl
    const appUrl = config.appUrl || req.protocol + '://' + req.headers.host
    const instance = new WhatsAppInstance(key)
    const data = await instance.init(mongoClient)
    WhatsAppInstances.set(data.key, instance)
    res.json({
        error: false,
        message: 'Initializing successfully',
        key: data.key,
        webhook: {
            enabled: webhook,
            webhookUrl: webhookUrl,
        },
        qrcode: {
            url: appUrl + '/instance/qr?key=' + data.key,
        },
        browser: config.browser,
    })
}

// exports.qr = async (req: Request, res: Response) => {
//     try {
//         const qrcode = await WhatsAppInstances.get(req.query.key as string)?.instance.qr
//         res.render('qrcode', {
//             qrcode: qrcode,
//         })
//     } catch {
//         res.json({
//             qrcode: '',
//         })
//     }
// }

export const qrbase64 = async (req: Request, res: Response) => {
    try {
        const qrcode = await WhatsAppInstances.get(req.query.key as string)?.instance.qr
        res.json({
            error: false,
            message: 'QR Base64 fetched successfully',
            qrcode: qrcode,
        })
    } catch {
        res.json({
            qrcode: '',
        })
    }
}

export const info = async (req: Request, res: Response) => {
    const instance = WhatsAppInstances.get(req.query.key as string)!
    let data
    try {
        data = await instance.getInstanceDetail(req.query.key as string)
    } catch (error) {
        data = {}
    }
    return res.json({
        error: false,
        message: 'Instance fetched successfully',
        instance_data: data,
    })
}

// exports.restore = async (req: Request, res: Response, next: NextFunction) => {
//     try {
//         const session = new Session()
//         let restoredSessions = await session.restoreSessions()
//         return res.json({
//             error: false,
//             message: 'All instances restored',
//             data: restoredSessions,
//         })
//     } catch (error) {
//         next(error)
//     }
// }

export const logout = async (req: Request, res: Response) => {
    let errormsg
    try {
        await WhatsAppInstances.get(req.query.key as string)!.instance?.socket?.logout()
    } catch (error) {
        errormsg = error
    }
    return res.json({
        error: false,
        message: 'logout successfull',
        errormsg: errormsg ? errormsg : null,
    })
}

// exports.delete = async (req: Request, res: Response) => {
//     let errormsg
//     try {
//         await WhatsAppInstances.get(req.query.key as string).instance?.sock?.logout()
//         delete WhatsAppInstances.get(req.query.key as string)
//     } catch (error) {
//         errormsg = error
//     }
//     return res.json({
//         error: false,
//         message: 'Instance deleted successfully',
//         data: errormsg ? errormsg : null,
//     })
// }

export const list = async (req: Request, res: Response) => {
    if (req.query.active) {
        let instance = Object.keys(WhatsAppInstances).map(async (key) =>
            WhatsAppInstances.get(key)!.getInstanceDetail(key)
        )
        let data = await Promise.all(instance)
        return res.json({
            error: false,
            message: 'All active instance',
            data: data,
        })
    } else {
        let instance: string[] = []
        const db = mongoClient
        const result = await db.listCollections().toArray()
        result.forEach((collection) => {
            const colType = collection.name.split('-')
            if (colType[0] === 'auth') instance.push(colType.slice(1).join('-'))
        })

        return res.json({
            error: false,
            message: 'All instance listed',
            data: instance,
        })
    }
}
