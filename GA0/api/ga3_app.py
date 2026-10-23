from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import os
import sys

# Ensure current directory is in path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)

import q9
import q10
import q11

app = FastAPI(title="TDS GA3 / GA5 Native Python Services", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Mount Q10 (A2A 1.0 Delegate)
app.include_router(q10.router)

# Mount Q9 (Safe AI Mailroom)
app.include_router(q9.router)

# Mount Q11 (Observable Incident Triage)
app.include_router(q11.router)

@app.get("/healthz")
@app.get("/health")
def health():
    return {"status": "ok", "service": "GA3-Agent-Suite"}
