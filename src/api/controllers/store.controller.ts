import { Response } from "express"

export const allChats = async (req: any, res: Response) => {
    const data = await WhatsAppInstances.get(req.query.key)!.getAllChats()

    return res.status(201).json({ error: false, data: data })
}


export const allMessages = async (req: any, res: Response) => {
    const id = req.params.id

    const data = await WhatsAppInstances.get(req.query.key)!.getAllMessages(id, req.query.limit)

    return res.status(201).json({ error: false, data: data })
}