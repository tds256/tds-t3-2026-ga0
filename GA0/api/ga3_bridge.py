import asyncio
import os
import sys
from http.server import BaseHTTPRequestHandler

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)

import ga3_app

class handler(BaseHTTPRequestHandler):
    def _run_asgi(self, method: str):
        content_len = int(self.headers.get("content-length") or 0)
        body = self.rfile.read(content_len) if content_len > 0 else b""

        # Extract path and query
        full_path = self.path
        if "?" in full_path:
            path_part, query_part = full_path.split("?", 1)
        else:
            path_part, query_part = full_path, ""

        # Normalize incoming headers
        headers = []
        for k, v in self.headers.items():
            headers.append((k.lower().encode("latin1"), v.encode("latin1")))

        scope = {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": method,
            "path": path_part,
            "raw_path": path_part.encode("latin1"),
            "query_string": query_part.encode("latin1"),
            "headers": headers,
            "server": (self.server.server_name if hasattr(self.server, "server_name") else "localhost",
                       self.server.server_port if hasattr(self.server, "server_port") else 80),
        }

        response_status = 200
        response_headers = []
        response_body = []

        async def receive():
            return {
                "type": "http.request",
                "body": body,
                "more_body": False,
            }

        async def send(message):
            nonlocal response_status, response_headers, response_body
            if message["type"] == "http.response.start":
                response_status = message["status"]
                response_headers = message.get("headers", [])
            elif message["type"] == "http.response.body":
                response_body.append(message.get("body", b""))

        try:
            asyncio.run(ga3_app.app(scope, receive, send))
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error": "Internal Server Error"}')
            return

        self.send_response(response_status)
        for h_name, h_val in response_headers:
            self.send_header(h_name.decode("latin1"), h_val.decode("latin1"))
        self.end_headers()
        for chunk in response_body:
            self.wfile.write(chunk)

    def do_OPTIONS(self):
        self._run_asgi("OPTIONS")

    def do_GET(self):
        self._run_asgi("GET")

    def do_POST(self):
        self._run_asgi("POST")

    def do_PUT(self):
        self._run_asgi("PUT")

    def do_DELETE(self):
        self._run_asgi("DELETE")
