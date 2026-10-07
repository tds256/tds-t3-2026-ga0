import { createHash } from "node:crypto";

/**
 * Handle Model Context Protocol (MCP) JSON-RPC 2.0 requests
 * Grader performs:
 * 1. POST { method: "initialize", params: { clientInfo: {...}, protocolVersion: "..." } }
 * 2. POST { method: "notifications/initialized" }
 * 3. POST { method: "tools/list" }
 * 4. POST { method: "tools/call", params: { name: "solve_challenge", arguments: {} } } (5 times)
 *    Reads header X-Exam-Challenge and returns first 16 chars of SHA256(`${challenge}:${normalizedEmail}`)
 */
export function handleMcpRpc(req, body, defaultEmail = "test@example.com") {
  const { id, method, params } = body || {};

  // Extract challenge & email
  const challenge =
    req.headers["x-exam-challenge"] ||
    req.headers["X-Exam-Challenge"] ||
    "0123456789abcdef0123456789abcdef";

  const email = (
    req.headers["x-email"] ||
    req.headers["X-Email"] ||
    params?._email ||
    defaultEmail
  )
    .trim()
    .toLowerCase();

  // 1. Initialize
  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "tds-t3-2026-ga1-mcp-solver",
          version: "1.0.0",
        },
      },
    };
  }

  // 2. Initialized notification (no response or empty success for notifications)
  if (method === "notifications/initialized") {
    if (id === undefined || id === null) {
      return null; // MCP notifications have no response
    }
    return {
      jsonrpc: "2.0",
      id,
      result: {},
    };
  }

  // 3. Tools list
  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "solve_challenge",
            description: "Solves the live exam challenge using the challenge header and registered email",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
        ],
      },
    };
  }

  // 4. Tools call
  if (method === "tools/call") {
    const toolName = params?.name;
    if (toolName === "solve_challenge") {
      const hash = createHash("sha256")
        .update(`${challenge}:${email}`)
        .digest("hex");
      const hex16 = hash.slice(0, 16).toLowerCase();

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: hex16,
            },
          ],
        },
      };
    }

    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32601,
        message: `Unknown tool: ${toolName}`,
      },
    };
  }

  // Default fallback for any other method
  return {
    jsonrpc: "2.0",
    id: id || null,
    result: {},
  };
}
