import assert from "node:assert";
import { computeBaseEffective, resolveEffectiveConfig, rt } from "../api/configPrecedence.js";
import { handleMcpRpc } from "../api/mcpServer.js";

console.log("=== RUNNING GA1 TEST SUITE ===");

// 1. Test Config Precedence (q-config-precedence-server)
console.log("\n[1] Testing Config Precedence...");
const testEmail = "test_student@example.com";
const { baseEffective } = computeBaseEffective(testEmail);
console.log("Base effective config:", baseEffective);
assert(typeof baseEffective.port === "number", "port must be number");
assert(typeof baseEffective.workers === "number", "workers must be number");
assert(typeof baseEffective.debug === "boolean", "debug must be boolean");
assert(typeof baseEffective.log_level === "string", "log_level must be string");
assert(typeof baseEffective.api_key === "string", "api_key must be string");

// Test CLI overrides & Masking
const overrides = { port: "8888", debug: "true", log_level: "error" };
const resolved = resolveEffectiveConfig(testEmail, overrides);
console.log("Resolved with overrides:", resolved);
assert.strictEqual(resolved.port, 8888, "port should override to 8888");
assert.strictEqual(resolved.debug, true, "debug should override to true");
assert.strictEqual(resolved.log_level, "error", "log_level should override to error");
assert.strictEqual(resolved.api_key, "****", "api_key must be masked to ****");
console.log("✅ Config Precedence verified successfully!");

// 2. Test MCP Server (q-mcp-server-live-server)
console.log("\n[2] Testing MCP Server Handshake & Tool Call...");

// Test initialize
const initReq = { headers: {} };
const initRes = handleMcpRpc(initReq, { jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
assert.strictEqual(initRes.result.serverInfo.name, "tds-t3-2026-ga1-mcp-solver");
console.log("✅ MCP initialize verified");

// Test notifications/initialized
const notifRes = handleMcpRpc(initReq, { jsonrpc: "2.0", method: "notifications/initialized" });
assert.strictEqual(notifRes, null);
console.log("✅ MCP notifications/initialized verified");

// Test tools/list
const listRes = handleMcpRpc(initReq, { jsonrpc: "2.0", id: 2, method: "tools/list" });
const tools = listRes.result.tools;
assert(tools.some(t => t.name === "solve_challenge"), "solve_challenge tool must exist");
console.log("✅ MCP tools/list verified");

// Test tools/call
const testChallenge = "0123456789abcdef0123456789abcdef";
const callReq = {
  headers: {
    "x-exam-challenge": testChallenge
  }
};
const callRes = handleMcpRpc(callReq, {
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: { name: "solve_challenge", arguments: {} }
}, "learner@example.com");

console.log("MCP Call Result:", callRes.result.content[0].text);
assert.strictEqual(callRes.result.content[0].text, "bc50d1f5cefaf565", "Must match SHA-256 slice");
console.log("✅ MCP tools/call 16-hex hash verified!");

console.log("\n🎉 ALL GA1 TESTS PASSED SUCCESSFULLY!");
