import { Request, Response } from "express";

export const allChats = async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1
  const perPage = Number(req.query.perPage) || 20

  const data = await WhatsAppInstances.get(
    req.query.key as string
  )!.getAllChats(
    page,
    perPage
  );

  return res.status(201).json({ error: false, data: data });
};

export const allMessages = async (req: Request, res: Response) => {
  const id = req.params.id;

  const data = await WhatsAppInstances.get(
    req.query.key as string
  )!.getAllMessages(id, req.query.limit as unknown as number);

  return res.status(201).json({ error: false, data: data });
};
