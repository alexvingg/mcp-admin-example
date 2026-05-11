/**
 * Tools de Product — análogo a customers, mas SEM grant flow
 * (products usa só RBAC puro, não tem ABAC por instância).
 */
import { apiFetch } from "../api/client.js";
import type { Tool } from "./types.js";

interface Product {
  id: string;
  name: string;
  price: string;
  status: "active" | "inactive";
  createdAt: string;
}

export const productTools: Tool[] = [
  {
    name: "list_products",
    description: "List all products. Visible to anyone with read:products.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => apiFetch<Product[]>("/api/products"),
  },

  {
    name: "get_product",
    description: "Get full details of a specific product by id. Requires read:products.",
    inputSchema: {
      type: "object",
      required: ["id"],
      additionalProperties: false,
      properties: { id: { type: "string", description: "Product ID (cuid)" } },
    },
    handler: async (args) =>
      apiFetch<Product>(`/api/products/${encodeURIComponent(String(args.id))}`),
  },

  {
    name: "create_product",
    description: "Create a new product. Requires write:products (admin only).",
    inputSchema: {
      type: "object",
      required: ["name", "price"],
      additionalProperties: false,
      properties: {
        name: { type: "string", maxLength: 120, minLength: 1 },
        price: {
          oneOf: [
            { type: "number", minimum: 0 },
            { type: "string", pattern: "^\\d+(\\.\\d{1,2})?$" },
          ],
          description: "Decimal price (e.g. 99.90)",
        },
        status: { type: "string", enum: ["active", "inactive"] },
      },
    },
    handler: async (args) =>
      apiFetch<Product>("/api/products", {
        method: "POST",
        body: JSON.stringify(args),
      }),
  },

  {
    name: "update_product",
    description: "Update an existing product (partial). Requires write:products (admin only).",
    inputSchema: {
      type: "object",
      required: ["id"],
      additionalProperties: false,
      properties: {
        id: { type: "string" },
        name: { type: "string", maxLength: 120, minLength: 1 },
        price: {
          oneOf: [
            { type: "number", minimum: 0 },
            { type: "string", pattern: "^\\d+(\\.\\d{1,2})?$" },
          ],
        },
        status: { type: "string", enum: ["active", "inactive"] },
      },
    },
    handler: async (args) => {
      const { id, ...patch } = args as { id: string; [k: string]: unknown };
      return apiFetch<Product>(`/api/products/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      });
    },
  },

  {
    name: "delete_product",
    description: "Delete a product permanently. Requires delete:products (admin only).",
    inputSchema: {
      type: "object",
      required: ["id"],
      additionalProperties: false,
      properties: { id: { type: "string" } },
    },
    handler: async (args) => {
      const id = String(args.id);
      await apiFetch<void>(`/api/products/${encodeURIComponent(id)}`, { method: "DELETE" });
      return { deleted: id };
    },
  },
];
