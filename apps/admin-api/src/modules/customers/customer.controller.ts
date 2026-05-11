import type { RequestHandler } from "express";
import { customerService } from "./customer.service.js";

export const customerController = {
  list: (async (_req, res) => {
    res.json(await customerService.list());
  }) as RequestHandler,

  get: (async (req, res) => {
    res.json(await customerService.get(req.params.id));
  }) as RequestHandler,

  create: (async (req, res) => {
    const created = await customerService.create(req.body);
    res.status(201).json(created);
  }) as RequestHandler,

  update: (async (req, res) => {
    res.json(await customerService.update(req.params.id, req.body));
  }) as RequestHandler,

  remove: (async (req, res) => {
    await customerService.remove(req.params.id);
    res.status(204).send();
  }) as RequestHandler,
};
