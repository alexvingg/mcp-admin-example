import { customerTools } from "./customers.js";
import { productTools } from "./products.js";
import { identityTools } from "./identity.js";
import type { Tool } from "./types.js";

export const allTools: Tool[] = [
  ...identityTools,
  ...customerTools,
  ...productTools,
];

export type { Tool };
