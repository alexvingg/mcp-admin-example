import { z } from "zod";
import { customerRepository, type CustomerInput } from "./customer.repository.js";
import { Conflict, NotFound, BadRequest } from "../../errors/httpError.js";

export const customerCreateSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(255),
  status: z.enum(["active", "inactive"]).optional(),
});

export const customerUpdateSchema = customerCreateSchema.partial();

export const customerService = {
  list: () => customerRepository.list(),

  get: async (id: string) => {
    const c = await customerRepository.findById(id);
    if (!c) throw NotFound("Customer not found");
    return c;
  },

  create: async (input: unknown) => {
    const parsed = customerCreateSchema.safeParse(input);
    if (!parsed.success) throw BadRequest("Invalid payload", parsed.error.flatten());

    const existing = await customerRepository.findByEmail(parsed.data.email);
    if (existing) throw Conflict("Customer with this email already exists");

    return customerRepository.create(parsed.data as CustomerInput);
  },

  update: async (id: string, input: unknown) => {
    const parsed = customerUpdateSchema.safeParse(input);
    if (!parsed.success) throw BadRequest("Invalid payload", parsed.error.flatten());

    const existing = await customerRepository.findById(id);
    if (!existing) throw NotFound("Customer not found");

    if (parsed.data.email && parsed.data.email !== existing.email) {
      const dup = await customerRepository.findByEmail(parsed.data.email);
      if (dup) throw Conflict("Another customer with this email exists");
    }

    return customerRepository.update(id, parsed.data);
  },

  remove: async (id: string) => {
    const existing = await customerRepository.findById(id);
    if (!existing) throw NotFound("Customer not found");
    await customerRepository.remove(id);
  },
};
