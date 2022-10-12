import { Request, Response } from "express"

export const Text = async (req: Request, res: Response) => {
    const data = await WhatsAppInstances.get(req.query.key as string)!!.sendTextMessage(
        req.body.id,
        req.body.message
    )
    return res.status(201).json({ error: false, data: data })
}

export const Image = async (req: Request, res: Response) => {
    const data = await WhatsAppInstances.get(req.query.key as string)!!.sendMediaFile(
        req.body.id,
        (req as any).file,
        'image',
        req.body?.caption
    )
    return res.status(201).json({ error: false, data: data })
}

export const Video = async (req: Request, res: Response) => {
    const data = await WhatsAppInstances.get(req.query.key as string)!.sendMediaFile(
        req.body.id,
        req.file,
        'video',
        req.body?.caption
    )
    return res.status(201).json({ error: false, data: data })
}

export const Audio = async (req: Request, res: Response) => {
    const data = await WhatsAppInstances.get(req.query.key as string)!.sendMediaFile(
        req.body.id,
        req.file,
        'audio'
    )
    return res.status(201).json({ error: false, data: data })
}

export const Document = async (req: Request, res: Response) => {
    const data = await WhatsAppInstances.get(req.query.key as string)!.sendMediaFile(
        req.body.id,
        req.file,
        'document',
        '',
        req.body.filename
    )
    return res.status(201).json({ error: false, data: data })
}

export const Mediaurl = async (req: Request, res: Response) => {
    const data = await WhatsAppInstances.get(req.query.key as string)!.sendUrlMediaFile(
        req.body.id,
        req.body.url,
        req.body.type,
        req.body.mimetype, 
        req.body.caption
    )
    return res.status(201).json({ error: false, data: data })
}

// export const Button = async (req: Request, res: Response) => {
//     // console.log(res.body)
//     const data = await WhatsAppInstances.get(req.query.key as string)!.sendButtonMessage(
//         req.body.id,
//         req.body.btndata
//     )
//     return res.status(201).json({ error: false, data: data })
// }

// export const Contact = async (req: Request, res: Response) => {
//     const data = await WhatsAppInstances.get(req.query.key as string)!.sendContactMessage(
//         req.body.id,
//         req.body.vcard
//     )
//     return res.status(201).json({ error: false, data: data })
// }

// export const List = async (req: Request, res: Response) => {
//     const data = await WhatsAppInstances.get(req.query.key as string)!.sendListMessage(
//         req.body.id,
//         req.body.msgdata
//     )
//     return res.status(201).json({ error: false, data: data })
// }

// export const MediaButton = async (req: Request, res: Response) => {
//     const data = await WhatsAppInstances.get(req.query.key as string)!.sendMediaButtonMessage(
//         req.body.id,
//         req.body.btndata
//     )
//     return res.status(201).json({ error: false, data: data })
// }

// export const SetStatus = async (req: Request, res: Response) => {
//     const presenceList = [
//         'unavailable',
//         'available',
//         'composing',
//         'recording',
//         'paused',
//     ]
//     if (presenceList.indexOf(req.body.status) === -1) {
//         return res.status(400).json({
//             error: true,
//             message:
//                 'status parameter must be one of ' + presenceList.join(', '),
//         })
//     }

//     const data = await WhatsAppInstances.get(req.query.key as string)!?.setStatus(
//         req.body.status,
//         req.body.id
//     )
//     return res.status(201).json({ error: false, data: data })
// }
