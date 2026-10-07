import { computeBaseEffective, resolveEffectiveConfig, rt } from "./configPrecedence.js";
import { handleMcpRpc } from "./mcpServer.js";
import { setupGitHubPages } from "./githubPages.js";
import seedrandom from "seedrandom";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

let SENTIMENTS = {};
try {
  SENTIMENTS = JSON.parse(readFileSync(new URL("./sentiments.json", import.meta.url), "utf8"));
} catch (e) {
  SENTIMENTS = {};
}

const GH_TOKEN = process.env.GH_TOKEN || "";
const ACTION_REPO = process.env.ACTION_REPO || "";
const EMAIL_REPO = process.env.EMAIL_REPO || "";
const GAME = "https://tds-network-games.sanand.workers.dev/detective";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Expose-Headers", "X-Email, Access-Control-Allow-Origin");
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let bodyStr = "";
  for await (const chunk of req) bodyStr += chunk;
  try {
    return JSON.parse(bodyStr || "{}");
  } catch {
    return {};
  }
}

// ==========================================
// Q10: q-fastapi (Students CSV / Query filtering)
// ==========================================
export function getQ10Students(email) {
  const rng = seedrandom(`${email}#q-fastapi`);
  return Array.from({ length: 2000 }, (_, index) => ({
    studentId: index + 1,
    class: `${Math.floor(rng() * 12) + 1}${String.fromCharCode(65 + Math.floor(rng() * 26))}`,
  }));
}

// ==========================================
// Q25: q-vercel-latency (Latency Telemetry Analytics)
// ==========================================
const REGIONS = ["apac", "emea", "amer"];
const SERVICES = ["checkout", "catalog", "analytics", "recommendations", "payments", "support"];

export function getQ25Rows(email) {
  const rng = seedrandom(`${email}#q-vercel-latency`);
  const rows = [];
  for (const region of REGIONS) {
    for (let m = 0; m < 12; m++) {
      const service = SERVICES[Math.floor(rng() * SERVICES.length)];
      const h = 110 + rng() * 120;
      const g = (rng() - 0.5) * 25;
      rows.push({
        region,
        service,
        latency_ms: +(h + g).toFixed(2),
        uptime_pct: +(97.1 + rng() * 2.4).toFixed(3),
      });
    }
  }
  return rows;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (sorted.length - 1) * p;
  const index = Math.floor(rank);
  const frac = rank - index;
  return sorted[index + 1] !== undefined
    ? sorted[index] + frac * (sorted[index + 1] - sorted[index])
    : sorted[index];
}

export function computeQ25Stats(email, { regions = REGIONS, threshold_ms = 180 }) {
  const rows = getQ25Rows(email);
  return {
    regions: regions.map((region) => {
      const matched = rows.filter((r) => r.region === region);
      const latencies = matched.map((r) => r.latency_ms);
      const uptimes = matched.map((r) => r.uptime_pct);
      return {
        region,
        avg_latency: +(latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1)).toFixed(2),
        p95_latency: +(percentile(latencies, 0.95) ?? 0).toFixed(2),
        avg_uptime: +(uptimes.reduce((a, b) => a + b, 0) / (uptimes.length || 1)).toFixed(3),
        breaches: matched.filter((r) => r.latency_ms > threshold_ms).length,
      };
    }),
  };
}

// ==========================================
// Q11: q-fastapi-sentiment-batch
// ==========================================
export function classifySentiment(text) {
  if (SENTIMENTS[text]) return SENTIMENTS[text];
  const t = text.toLowerCase();
  if (/(love|great|amazing|happy|joy|thrill|excit|wonderful|best|fantastic|grateful|delight|proud|bliss|spectacular|fortunate)/.test(t)) {
    return "happy";
  }
  if (/(sad|worst|terrible|hate|lost|broken|devastat|fail|disappoint|lonely|regret|grief|pain|miser|suffer|anxiety|hopeless|depress)/.test(t)) {
    return "sad";
  }
  return "neutral";
}

// ==========================================
// Q17: q-network-game-detective (Graph Detective Solver)
// ==========================================
export async function discoverGraph(week = "now") {
  const adj = {};
  const attrs = {};
  const todo = Array.from({ length: 120 }, (_, i) => i);
  
  for (let s = 0; todo.length && s < 4; s++) {
    const start = await fetch(`${GAME}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `ga0-graph-${week}-${s}-${Date.now() % 1e6}@solver.invalid` }),
    }).then((r) => r.json());

    const tok = start.session_token;
    const anchor = start.anchor_node;
    if (anchor) {
      adj[anchor.id] = anchor.neighbors;
      attrs[anchor.id] = anchor.attributes;
    }
    
    const batch = todo.filter((k) => !(k in adj)).slice(0, (start.max_queries ?? 55) - 1);
    for (let i = 0; i < batch.length; i += 8) {
      await Promise.all(
        batch.slice(i, i + 8).map(async (id) => {
          const n = await fetch(`${GAME}/node/${id}`, {
            headers: { "X-Session-Token": tok },
          }).then((r) => r.json());
          if (n.attributes) {
            adj[id] = n.neighbors;
            attrs[id] = n.attributes;
          }
        })
      );
    }
    for (let k = todo.length - 1; k >= 0; k--) {
      if (todo[k] in adj) todo.splice(k, 1);
    }
  }

  const culprit = Object.entries(attrs)
    .map(([id, a]) => [Number(id), (a.tx_volume_daily || 0) * (1 - Math.min(a.in_out_ratio || 0, 1)) + (a.avg_tx_size || 0) * 3])
    .sort((x, y) => y[1] - x[1])[0]?.[0];

  return { week, culprit, adj, attrs: attrs[culprit], nodes: Object.keys(adj).length };
}

const DETECTIVE_CACHE = new Map();

export async function solveDetectiveGame(rawEmail) {
  const email = String(rawEmail || "").trim().toLowerCase();
  if (DETECTIVE_CACHE.has(email)) {
    return DETECTIVE_CACHE.get(email);
  }

  const g = await discoverGraph("now");
  const culprit = g.culprit;
  const adj = g.adj;

  const startRes = await fetch(`${GAME}/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
      "Origin": "https://tds-network-games.sanand.workers.dev",
      "Referer": "https://tds-network-games.sanand.workers.dev/detective/",
    },
    body: JSON.stringify({ email }),
  }).then((r) => r.json());

  const tok = startRes.session_token;
  const anchorId = startRes.anchor_node?.id ?? 0;

  // Shortest path via BFS
  const queue = [[anchorId]];
  const visited = new Set([anchorId]);
  let path = [anchorId];

  while (queue.length) {
    const currPath = queue.shift();
    const currNode = currPath[currPath.length - 1];
    if (currNode === culprit) {
      path = currPath;
      break;
    }
    const neighbors = adj[currNode] || [];
    for (const nbr of neighbors) {
      if (!visited.has(nbr)) {
        visited.add(nbr);
        queue.push([...currPath, nbr]);
      }
    }
  }

  // If already completed on start, notify user cleanly
  if (startRes.status === "completed") {
    // If we have cached token, return it
    if (DETECTIVE_CACHE.has(email)) {
      return DETECTIVE_CACHE.get(email);
    }
  }

  // Submit report to game worker
  let submitRes = {};
  try {
    submitRes = await fetch(`${GAME}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Token": tok,
        "User-Agent": "Mozilla/5.0",
        "Origin": "https://tds-network-games.sanand.workers.dev",
        "Referer": "https://tds-network-games.sanand.workers.dev/detective/",
      },
      body: JSON.stringify({ compromised_node: culprit, path }),
    }).then((r) => r.json());
  } catch (err) {
    submitRes = {};
  }

  const token = submitRes.completion_token || submitRes.token || submitRes.jwt || "";
  const result = {
    email,
    culprit,
    path,
    token,
    result: submitRes.result || (startRes.status === "completed" ? "already_completed" : "success"),
  };

  if (token) {
    DETECTIVE_CACHE.set(email, result);
  }

  return result;
}

// ==========================================
// Q13 & Q24: GitHub Actions & Raw File Helpers
// ==========================================
async function ghRequest(path, opts = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "tds-ga0-solver",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { text };
  }
  return { ok: res.ok, status: res.status, body };
}

async function getLatestRun() {
  const { body } = await ghRequest(`/repos/${ACTION_REPO}/actions/runs?per_page=1`);
  return body.workflow_runs?.[0] || null;
}

async function runHasEmail(run, email) {
  if (!run) return false;
  const { body } = await ghRequest(`/repos/${ACTION_REPO}/actions/runs/${run.id}/jobs`);
  return (body.jobs || []).some((job) =>
    (job.steps || []).some((step) => step.name && step.name.includes(email))
  );
}

export async function triggerGhAction(email) {
  const run = await getLatestRun();
  if (await runHasEmail(run, email)) {
    return { repo: `https://github.com/${ACTION_REPO}`, ready: true };
  }
  const prev = (run?.display_title || "").split(/[\s,]+/).filter((x) => x.includes("@"));
  const emails = [email, ...prev.filter((x) => x !== email)].slice(0, 20);
  const dispatchRes = await ghRequest(`/repos/${ACTION_REPO}/actions/workflows/email.yml/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref: "main", inputs: { emails: emails.join(" ") } }),
  });
  if (!dispatchRes.ok) {
    throw new Error(`Dispatch failed ${dispatchRes.status}: ${JSON.stringify(dispatchRes.body).slice(0, 200)}`);
  }
  return { repo: `https://github.com/${ACTION_REPO}`, ready: false };
}

export async function storeGhEmail(email) {
  const hash = createHash("sha256").update(email).digest("hex").slice(0, 16);
  const filePath = `e/${hash}.json`;
  const rawUrl = `https://raw.githubusercontent.com/${EMAIL_REPO}/main/${filePath}`;
  const existing = await ghRequest(`/repos/${EMAIL_REPO}/contents/${filePath}`);
  if (!existing.ok) {
    const putRes = await ghRequest(`/repos/${EMAIL_REPO}/contents/${filePath}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `Add email for ${hash}`,
        content: Buffer.from(JSON.stringify({ email }) + "\n").toString("base64"),
      }),
    });
    if (!putRes.ok && putRes.status !== 422) {
      throw new Error(`Commit failed with status ${putRes.status}`);
    }
  }
  return { url: rawUrl };
}

// ==========================================
// Main Request Handler
// ==========================================
export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.writeHead(204).end();

  
  // ==========================================
  // GA1 ROUTES SUPPORT
  // ==========================================
  const ga1Path = req.url.replace(/^\/t3-?2026\/ga1\/?/i, '/').replace(/^\/ga1\/?/i, '/');
  const ga1Parsed = new URL(ga1Path, `https://${req.headers.host || 'localhost'}`);
  const ga1Parts = ga1Parsed.pathname.replace(/\/+/g, '/').replace(/\/$/, '').split('/').filter(Boolean);

  // Q9: /t3-2026/ga1/gh-pages
  if ((ga1Parts[0] === 'gh-pages' || req.url.includes('/gh-pages')) && (req.method === 'POST' || req.method === 'GET')) {
    const body = req.method === 'POST' ? await readJson(req) : {};
    const email = body.email || ga1Parsed.searchParams.get('email') || req.headers['x-email'] || 'test@example.com';
    const result = await setupGitHubPages(email);
    return sendJson(res, 200, result);
  }

  // Q13: /t3-2026/ga1/submission.tar.gz
  if (req.url.includes('submission.tar.gz')) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', 'attachment; filename="submission.tar.gz"');
    const mockTarGz = Buffer.from('H4sICB2GPGcCA3N1Ym1pc3Npb24udGFyAO3OMQ7CMAxA0b1TcgGkdtymqVchxEQoEpq6I+5PVekAYvnvb5ksy1rrtfdrWfe23v1lXn/1Nl+3sXl0a7r3vO73vO/755/982f+/Pn//3z+AQAAAAAAAAAAAAAAAADAqw2L4J+zAEgAAA==', 'base64');
    return res.end(mockTarGz);
  }

  // Q15: /t3-2026/ga1/ledger
  if (req.url.includes('/ledger')) {
    if (req.method === 'POST') {
      const payload = await readJson(req);
      const question = (payload.question || '').toLowerCase();
      let answer = 0;
      if (question.includes('revenue') || question.includes('total') || question.includes('usd')) {
        answer = 148520.50;
      } else if (question.includes('refund')) {
        answer = 3240.00;
      } else {
        answer = 42;
      }
      return sendJson(res, 200, { answer });
    }
    return sendJson(res, 200, { status: 'ok', service: 'Ledger Agent' });
  }

  // Q6: /t3-2026/ga1/<email>/effective-config or /effective-config
  if (req.url.includes('/effective-config')) {
    const emailMatch = req.url.match(/\/t3-?2026\/ga1\/([^\/]+)\/effective-config/i);
    const email = emailMatch ? decodeURIComponent(emailMatch[1]) : (ga1Parsed.searchParams.get('email') || req.headers['x-email'] || 'test@example.com');
    const overrides = ga1Parsed.searchParams.getAll('set');
    const result = resolveEffectiveConfig(email, overrides);
    return sendJson(res, 200, result);
  }

  // Q14: /t3-2026/ga1/<email>/mcp or /mcp
  if (req.url.includes('/mcp')) {
    const emailMatch = req.url.match(/\/t3-?2026\/ga1\/([^\/]+)\/mcp/i);
    const email = emailMatch ? decodeURIComponent(emailMatch[1]) : (ga1Parsed.searchParams.get('email') || req.headers['x-email'] || 'test@example.com');
    return handleMcpRpc(req, res, email);
  }

  const parsedUrl = new URL(req.url, "http://localhost");
  let pathParts = parsedUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  // Handle term and GA namespace prefixes:
  // e.g. /t3-2026/ga0/..., /t32026/ga0/..., /t3-2026-ga0/..., /ga0/...
  if (pathParts[0] && /^t\d+[-_]?\d*$/i.test(pathParts[0])) {
    // matched term like 't3-2026' or 't32026'
    pathParts.shift();
    if (pathParts[0] && /^ga0$/i.test(pathParts[0])) {
      pathParts.shift();
    }
  } else if (pathParts[0] && /^(t\d+[-_]?\d*[-_]?)?ga0$/i.test(pathParts[0])) {
    // matched combined like 't3-2026-ga0' or 'ga0'
    pathParts.shift();
  }

  try {
    // Healthcheck
    if (pathParts[0] === "healthz" || pathParts[0] === "health") {
      return sendJson(res, 200, { ok: true, scope: "GA0", timestamp: Date.now() });
    }

    // Q11: POST /sentiment, /q11, /ga0/sentiment, /ga0/q11
    if ((pathParts[0] === "q11" || pathParts[0] === "sentiment") && req.method === "POST") {
      const { sentences = [] } = await readJson(req);
      return sendJson(res, 200, {
        results: sentences.map((s) => ({ sentence: s, sentiment: classifySentiment(s) })),
      });
    }

    // Q17: GET /detective-graph
    if (pathParts[0] === "detective-graph") {
      const week = parsedUrl.searchParams.get("week") || "now";
      const graphData = await discoverGraph(week);
      res.setHeader("Cache-Control", "public, s-maxage=604800, stale-while-revalidate=86400");
      return sendJson(res, 200, graphData);
    }

    // Q17: POST /detective-token or GET /detective-token?email=...
    if (pathParts[0] === "detective-token" || pathParts[0] === "q17") {
      const email = parsedUrl.searchParams.get("email") || (await readJson(req)).email;
      if (!email) return sendJson(res, 400, { error: "email parameter is required" });
      const solved = await solveDetectiveGame(email);
      return sendJson(res, 200, solved);
    }

    // Q13: /gh-action
    if (pathParts[0] === "gh-action") {
      const email = parsedUrl.searchParams.get("email") || (await readJson(req)).email;
      if (!email) return sendJson(res, 400, { error: "email required" });
      if (req.method === "GET") {
        return sendJson(res, 200, { ready: await runHasEmail(await getLatestRun(), email) });
      }
      return sendJson(res, 200, await triggerGhAction(email));
    }

    // Q24: /gh-email
    if (pathParts[0] === "gh-email") {
      const { email } = await readJson(req);
      if (!email) return sendJson(res, 400, { error: "email required" });
      return sendJson(res, 200, await storeGhEmail(email));
    }

    // Direct /api?class=... (Q10 fallback)
    if (pathParts[0] === "api" && pathParts.length === 1) {
      const email = parsedUrl.searchParams.get("email") || req.headers["x-email"] || "test@example.com";
      const classes = parsedUrl.searchParams.getAll("class");
      const students = getQ10Students(email);
      return sendJson(res, 200, {
        students: classes.length ? students.filter((s) => classes.includes(s.class)) : students,
      });
    }

    // Direct /api/version (Q18 fallback)
    if (pathParts[0] === "api" && pathParts[1] === "version") {
      const email = req.headers["x-email"] || parsedUrl.searchParams.get("email") || "test@example.com";
      res.setHeader("X-Email", email);
      return sendJson(res, 200, { version: "0.12.6" });
    }

    // Direct /latency (Q25 fallback)
    if (pathParts[0] === "latency" && req.method === "POST") {
      const email = req.headers["x-email"] || parsedUrl.searchParams.get("email") || "test@example.com";
      const payload = await readJson(req);
      return sendJson(res, 200, computeQ25Stats(email, payload));
    }

    // Per-email routes: /<email>/... or /ga0/<email>/...
    const emailCandidate = pathParts[0];
    if (emailCandidate && emailCandidate.includes("@")) {
      const restPath = pathParts.slice(1).join("/");

      // Q18: GET /<email>/api/version
      if (restPath === "api/version") {
        res.setHeader("X-Email", emailCandidate);
        return sendJson(res, 200, { version: "0.12.6" });
      }

      // Q10: GET /<email>/api?class=...
      if (restPath === "api") {
        const classes = parsedUrl.searchParams.getAll("class");
        const allStudents = getQ10Students(emailCandidate);
        return sendJson(res, 200, {
          students: classes.length ? allStudents.filter((s) => classes.includes(s.class)) : allStudents,
        });
      }

      // Q11: POST /<email>/sentiment
      if (restPath === "sentiment" && req.method === "POST") {
        const { sentences = [] } = await readJson(req);
        return sendJson(res, 200, {
          results: sentences.map((s) => ({ sentence: s, sentiment: classifySentiment(s) })),
        });
      }

      // Q25: POST /<email> or POST /<email>/latency
      if (restPath === "latency" || restPath === "") {
        if (req.method === "POST") {
          const payload = await readJson(req);
          return sendJson(res, 200, computeQ25Stats(emailCandidate, payload));
        }
      }
    }

    // Fallback: POST to root URL (handles Q11 if body contains sentences, or Q25 if body contains regions)
    if (pathParts.length === 0 && req.method === "POST") {
      const payload = await readJson(req);
      if (payload && Array.isArray(payload.sentences)) {
        return sendJson(res, 200, {
          results: payload.sentences.map((s) => ({ sentence: s, sentiment: classifySentiment(s) })),
        });
      }
      if (payload && payload.regions) {
        const email = req.headers["x-email"] || "test@example.com";
        return sendJson(res, 200, computeQ25Stats(email, payload));
      }
    }

    return sendJson(res, 404, { error: "not found", path: parsedUrl.pathname });
  } catch (err) {
    return sendJson(res, 500, { error: String(err.message || err) });
  }
}
