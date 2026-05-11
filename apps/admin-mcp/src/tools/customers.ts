/**
 * Tools de Customer (5): list, get, create, update, delete.
 *
 * `get_customer` orquestra o pattern de grant em runtime que o backend exige:
 *   1. POST /api/customers/:id/access-request  (admin é bypassado pelo backend)
 *   2. GET  /api/customers/:id                 (com grant ativo)
 * Se o user não tiver entitlement, o POST falha com 403 "no_entitlement"
 * antes mesmo do GET — propaga pro Claude com mensagem clara.
 */
import { apiFetch } from "../api/client.js";
import type { Tool } from "./types.js";

interface Customer {
  id: string;
  name: string;
  email: string;
  status: "active" | "inactive";
  createdAt: string;
}

export const customerTools: Tool[] = [
  {
    name: "list_customers",
    description:
      "List all customers. Visible to anyone with read:customers permission. " +
      "Returns array with id, name, email, status, createdAt.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => apiFetch<Customer[]>("/api/customers"),
  },

  {
    name: "get_customer",
    description:
      "Get full details of a specific customer by id. The detail endpoint requires an active " +
      "runtime grant (Tier 2 ABAC); this tool transparently issues an access-request first " +
      "(which checks the user's entitlement) and then fetches the detail. Admin role bypasses " +
      "both checks. If the logged-in user has no entitlement for the requested id, returns a " +
      "403 'no_entitlement' error from the access-request step.",
    inputSchema: {
      type: "object",
      required: ["id"],
      additionalProperties: false,
      properties: {
        id: {
          type: "string",
          description: "Customer ID (cuid format, e.g. cmow1yxwx0000p86ii31r8vcx)",
        },
      },
    },
    handler: async (args) => {
      const id = String(args.id);
      // Step 1: request grant (entitlement check)
      await apiFetch<{ expiresAt: string }>(
        `/api/customers/${encodeURIComponent(id)}/access-request`,
        { method: "POST", body: "{}" },
      );
      // Step 2: fetch detail (Tier 2 grant check)
      return apiFetch<Customer>(`/api/customers/${encodeURIComponent(id)}`);
    },
  },

  {
    name: "create_customer",
    description:
      "Create a new customer. Requires write:customers permission (admin only). " +
      "Returns the created customer with assigned id.",
    inputSchema: {
      type: "object",
      required: ["name", "email"],
      additionalProperties: false,
      properties: {
        name: { type: "string", maxLength: 120, minLength: 1 },
        email: { type: "string", format: "email" },
        status: { type: "string", enum: ["active", "inactive"] },
      },
    },
    handler: async (args) =>
      apiFetch<Customer>("/api/customers", {
        method: "POST",
        body: JSON.stringify(args),
      }),
  },

  {
    name: "update_customer",
    description:
      "Update an existing customer (partial). Requires write:customers (admin only). " +
      "Any subset of {name, email, status} can be provided.",
    inputSchema: {
      type: "object",
      required: ["id"],
      additionalProperties: false,
      properties: {
        id: { type: "string" },
        name: { type: "string", maxLength: 120, minLength: 1 },
        email: { type: "string", format: "email" },
        status: { type: "string", enum: ["active", "inactive"] },
      },
    },
    handler: async (args) => {
      const { id, ...patch } = args as { id: string; [k: string]: unknown };
      return apiFetch<Customer>(`/api/customers/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      });
    },
  },

  {
    name: "delete_customer",
    description:
      "Delete a customer permanently. Requires delete:customers (admin only). Returns no content.",
    inputSchema: {
      type: "object",
      required: ["id"],
      additionalProperties: false,
      properties: { id: { type: "string" } },
    },
    handler: async (args) => {
      const id = String(args.id);
      await apiFetch<void>(`/api/customers/${encodeURIComponent(id)}`, { method: "DELETE" });
      return { deleted: id };
    },
  },
];
