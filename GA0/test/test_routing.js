import http from "node:http";
import handler from "../api/index.js";
import assert from "node:assert";

async function makeRequest(server, path, options = {}) {
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}${path}`, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
}

async function runRoutingTests() {
  console.log("=== Testing GA0 Scoped & Direct Routing ===");

  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const email = "student@example.com";

    // 1. Root /health vs /ga0/health
    const h1 = await makeRequest(server, "/health");
    assert.strictEqual(h1.status, 200);
    assert.strictEqual(h1.data.scope, "GA0");

    const h2 = await makeRequest(server, "/ga0/health");
    assert.strictEqual(h2.status, 200);
    assert.strictEqual(h2.data.scope, "GA0");

    // 2. Q10: /t3-2026/ga0/<email>/api vs /ga0/<email>/api vs /<email>/api
    const q10Root = await makeRequest(server, `/${email}/api?class=1A`);
    assert.strictEqual(q10Root.status, 200);
    assert(Array.isArray(q10Root.data.students));

    const q10Scoped = await makeRequest(server, `/ga0/${email}/api?class=1A`);
    assert.strictEqual(q10Scoped.status, 200);
    assert.strictEqual(q10Scoped.data.students.length, q10Root.data.students.length);

    const q10TermScoped = await makeRequest(server, `/t3-2026/ga0/${email}/api?class=1A`);
    assert.strictEqual(q10TermScoped.status, 200);
    assert.strictEqual(q10TermScoped.data.students.length, q10Root.data.students.length);

    // 3. Q11: /t3-2026/ga0/sentiment vs /ga0/sentiment vs /sentiment
    const q11Scoped = await makeRequest(server, "/t3-2026/ga0/sentiment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentences: ["I love this product!"] }),
    });
    assert.strictEqual(q11Scoped.status, 200);
    assert.strictEqual(q11Scoped.data.results[0].sentiment, "happy");

    // 4. Q18: /t3-2026/ga0/<email>/api/version vs /ga0/<email>/api/version
    const q18Scoped = await makeRequest(server, `/t3-2026/ga0/${email}/api/version`);
    assert.strictEqual(q18Scoped.status, 200);
    assert.strictEqual(q18Scoped.headers.get("x-email"), email);
    assert.strictEqual(q18Scoped.data.version, "0.12.6");

    // 5. Q25: /t3-2026/ga0/<email>/latency vs /ga0/<email>
    const q25Scoped = await makeRequest(server, `/t3-2026/ga0/${email}/latency`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regions: ["apac"], threshold_ms: 150 }),
    });
    assert.strictEqual(q25Scoped.status, 200);
    assert.strictEqual(q25Scoped.data.regions[0].region, "apac");

    console.log("✅ Namespaced and Direct GA0 routing tested & passed!");
  } finally {
    server.close();
  }
}

runRoutingTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
