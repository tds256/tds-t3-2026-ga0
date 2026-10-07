import http from "node:http";
import handler from "./index.js";

const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
  handler(req, res);
});

server.listen(PORT, () => {
  console.log(`GA1 Solver Local Server running on http://localhost:${PORT}`);
});
