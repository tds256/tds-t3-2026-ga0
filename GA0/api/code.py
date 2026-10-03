import json
import re
import sys
import traceback
from http.server import BaseHTTPRequestHandler
from io import StringIO


def execute_python_code(code: str):
    old_stdout = sys.stdout
    sys.stdout = StringIO()
    try:
        exec(code, {"__name__": "__main__"})
        return True, sys.stdout.getvalue()
    except Exception:
        return False, traceback.format_exc()
    finally:
        sys.stdout = old_stdout


def error_lines(tb: str):
    # Innermost frame inside the executed code string is where the error occurred
    lines = [int(m) for m in re.findall(r'File "<string>", line (\d+)', tb)]
    return lines[-1:] if lines else []


def interpret(code: str):
    ok, out = execute_python_code(code)
    return {
        "error": [] if ok else error_lines(out),
        "result": out
    }


class handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        content_len = int(self.headers.get("content-length") or 0)
        try:
            raw_data = self.rfile.read(content_len) if content_len > 0 else b"{}"
            code = json.loads(raw_data.decode("utf-8", errors="replace")).get("code", "")
        except Exception:
            code = ""
        
        result_payload = interpret(code)
        body = json.dumps(result_payload).encode("utf-8")
        
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
