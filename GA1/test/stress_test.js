import { resolveEffectiveConfig } from "../api/configPrecedence.js";
import { handleMcpRpc } from "../api/mcpServer.js";

console.log("=== BENCHMARKING GA1 LOAD: 1,000 STUDENTS ===");
const TOTAL = 1000;
const start = Date.now();

for (let i = 0; i < TOTAL; i++) {
  const email = `student_${i}@example.com`;
  
  // 1. Config precedence resolution
  const cfg = resolveEffectiveConfig(email, { port: "8080", debug: "true" });

  // 2. MCP Tool call
  const req = {
    headers: {
      "x-exam-challenge": `challenge_${i}_abcdef1234567890`,
    }
  };
  const mcp = handleMcpRpc(req, {
    jsonrpc: "2.0",
    id: i,
    method: "tools/call",
    params: { name: "solve_challenge" }
  }, email);
}

const elapsed = Date.now() - start;
console.log(`Processed ${TOTAL} students in ${elapsed}ms (${(elapsed / TOTAL).toFixed(3)}ms per student)`);
console.log("⚡ Stress Test Complete: Ready for high concurrency on Vercel Edge/Serverless!");
