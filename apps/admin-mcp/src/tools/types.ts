/**
 * Type comum pra todas as tools — name, description, schema e handler.
 * O server.ts itera por essa lista pra registrar via SDK MCP.
 */
export interface Tool {
  name: string;
  description: string;
  /** JSON Schema do input (passado direto pro Claude). */
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}
