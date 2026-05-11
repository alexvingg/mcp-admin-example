import { prisma } from "../../lib/prisma.js";
import type { CustomerStatus } from "@prisma/client";

export interface CustomerInput {
  name: string;
  email: string;
  status?: CustomerStatus;
}

export const customerRepository = {
  list: () => prisma.customer.findMany({ orderBy: { createdAt: "desc" } }),

  findById: (id: string) => prisma.customer.findUnique({ where: { id } }),

  findByEmail: (email: string) => prisma.customer.findUnique({ where: { email } }),

  create: (data: CustomerInput) => prisma.customer.create({ data }),

  update: (id: string, data: Partial<CustomerInput>) =>
    prisma.customer.update({ where: { id }, data }),

  remove: (id: string) => prisma.customer.delete({ where: { id } }),
};
