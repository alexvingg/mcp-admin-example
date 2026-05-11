import { z } from "zod";
import { productRepository, type ProductInput } from "./product.repository.js";
import { NotFound, BadRequest } from "../../errors/httpError.js";

export const productCreateSchema = z.object({
  name: z.string().min(1).max(120),
  // aceita number ou string numérica; converte para string com 2 casas
  price: z.union([z.number().nonnegative(), z.string().regex(/^\d+(\.\d{1,2})?$/)]),
  status: z.enum(["active", "inactive"]).optional(),
});

export const productUpdateSchema = productCreateSchema.partial();

export const productService = {
  list: () => productRepository.list(),

  get: async (id: string) => {
    const p = await productRepository.findById(id);
    if (!p) throw NotFound("Product not found");
    return p;
  },

  create: async (input: unknown) => {
    const parsed = productCreateSchema.safeParse(input);
    if (!parsed.success) throw BadRequest("Invalid payload", parsed.error.flatten());
    return productRepository.create(parsed.data as ProductInput);
  },

  update: async (id: string, input: unknown) => {
    const parsed = productUpdateSchema.safeParse(input);
    if (!parsed.success) throw BadRequest("Invalid payload", parsed.error.flatten());

    const existing = await productRepository.findById(id);
    if (!existing) throw NotFound("Product not found");

    return productRepository.update(id, parsed.data as Partial<ProductInput>);
  },

  remove: async (id: string) => {
    const existing = await productRepository.findById(id);
    if (!existing) throw NotFound("Product not found");
    await productRepository.remove(id);
  },
};
