import http from "node:http";
import handler from "./index.js";
import { spawn } from "node:child_process";

const PORT = process.env.PORT || 8000;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // Route /q5/code-interpreter or /code-interpreter to local Python executor for local testing
  if (url.pathname === "/q5/code-interpreter" || url.pathname === "/code-interpreter") {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      }).end();
      return;
    }

    if (req.method === "POST") {
      let bodyStr = "";
      for await (const chunk of req) bodyStr += chunk;
      let code = "";
      try {
        code = JSON.parse(bodyStr || "{}").code || "";
      } catch {
        code = "";
      }

      // Execute code via python child process
      const pythonProc = spawn("python", ["-c", `
import json, re, sys, traceback
from io import StringIO

code = sys.stdin.read()
old = sys.stdout
sys.stdout = StringIO()
try:
    exec(code, {"__name__": "__main__"})
    ok, out = True, sys.stdout.getvalue()
except Exception:
    ok, out = False, traceback.format_exc()
finally:
    sys.stdout = old

lines = [int(m) for m in re.findall(r'File "<string>", line (\\d+)', out)]
err = lines[-1:] if lines else []
print(json.dumps({"error": [] if ok else err, "result": out}))
`]);

      let pyOut = "";
      pythonProc.stdout.on("data", (d) => { pyOut += d; });
      pythonProc.stderr.on("data", (d) => { pyOut += d; });
      pythonProc.stdin.write(code);
      pythonProc.stdin.end();

      pythonProc.on("close", () => {
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(pyOut.trim() || JSON.stringify({ error: [], result: "" }));
      });
      return;
    }
  }

  // Default handler
  await handler(req, res);
});

server.listen(PORT, () => {
  console.log(`GA0 Local Server listening on http://localhost:${PORT}`);
});
