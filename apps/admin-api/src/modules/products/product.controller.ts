import type { RequestHandler } from "express";
import { productService } from "./product.service.js";

export const productController = {
  list: (async (_req, res) => {
    res.json(await productService.list());
  }) as RequestHandler,

  get: (async (req, res) => {
    res.json(await productService.get(req.params.id));
  }) as RequestHandler,

  create: (async (req, res) => {
    const created = await productService.create(req.body);
    res.status(201).json(created);
  }) as RequestHandler,

  update: (async (req, res) => {
    res.json(await productService.update(req.params.id, req.body));
  }) as RequestHandler,

  remove: (async (req, res) => {
    await productService.remove(req.params.id);
    res.status(204).send();
  }) as RequestHandler,
};
