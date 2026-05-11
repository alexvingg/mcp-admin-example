import { prisma } from "../../lib/prisma.js";
import type { ProductStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export interface ProductInput {
  name: string;
  price: Prisma.Decimal | string | number;
  status?: ProductStatus;
}

export const productRepository = {
  list: () => prisma.product.findMany({ orderBy: { createdAt: "desc" } }),

  findById: (id: string) => prisma.product.findUnique({ where: { id } }),

  create: (data: ProductInput) => prisma.product.create({ data }),

  update: (id: string, data: Partial<ProductInput>) =>
    prisma.product.update({ where: { id }, data }),

  remove: (id: string) => prisma.product.delete({ where: { id } }),
};
