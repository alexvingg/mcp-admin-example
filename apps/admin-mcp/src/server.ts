/**
 * MCP Server (stdio transport) — chamado pelo Claude Code como child process.
 *
 * Comunica via JSON-RPC pela stdin/stdout. Logs DEVEM ir pra stderr (nunca
 * stdout — atrapalha o protocolo).
 *
 * Registra todas as tools de `tools/index.ts`. O handler converte o resultado
 * em texto JSON pretty-printed (formato esperado pelo MCP `content`).
 *
 * Erros (incluindo NotLoggedInError, ApiError) viram mensagem de erro estruturada
 * pro Claude entender o que aconteceu — ex: "Not logged in. Run `mcp-admin login`."
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { allTools } from "./tools/index.js";
import { NotLoggedInError } from "./auth/index.js";
import { ApiError } from "./api/client.js";

// IMPORTA config pra falhar rápido se env tá inválido
import "./config.js";

const server = new Server(
  { name: "admin-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

// ListTools: descobre quais tools existem
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

// CallTool: executa a tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = allTools.find((t) => t.name === name);

  if (!tool) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    const result = await tool.handler(args ?? {});
    return {
      content: [
        {
          type: "text",
          text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    return formatError(err);
  }
});

function formatError(err: unknown) {
  if (err instanceof NotLoggedInError) {
    return {
      content: [
        {
          type: "text",
          text:
            "Not logged in. Run `mcp-admin login` from the terminal first " +
            "(this MCP requires an interactive Auth0 login session).",
        },
      ],
      isError: true,
    };
  }

  if (err instanceof ApiError) {
    const detail = JSON.stringify(err.body, null, 2);
    return {
      content: [
        {
          type: "text",
          text: `API error ${err.status}: ${err.message}\n\n${detail}`,
        },
      ],
      isError: true,
    };
  }

  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text", text: `Internal error: ${message}` }],
    isError: true,
  };
}

const transport = new StdioServerTransport();
await server.connect(transport);

// Log opcional pra stderr (não atrapalha protocolo)
console.error(`[admin-mcp] server connected via stdio (${allTools.length} tools registered)`);
