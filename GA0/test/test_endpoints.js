import assert from "node:assert";
import { getQ10Students, computeQ25Stats, classifySentiment } from "../api/index.js";

async function runTests() {
  console.log("=== Running GA0 Unit & Endpoint Tests ===");

  const testEmail = "testuser@example.com";

  // Test Q10 Students
  const students = getQ10Students(testEmail);
  assert.strictEqual(students.length, 2000, "Should generate 2000 students");
  assert.strictEqual(students[0].studentId, 1, "First student id should be 1");
  assert(students[0].class.length >= 2, "Class should have grade + section");
  console.log("✅ Q10 (Students Data generation): Passed");

  // Test Q11 Sentiment Batch
  const happyText = "I absolutely love this product, it changed my life!";
  const sadText = "This is the worst experience I've ever had.";
  const neutralText = "The meeting is scheduled for 3 PM.";
  assert.strictEqual(classifySentiment(happyText), "happy");
  assert.strictEqual(classifySentiment(sadText), "sad");
  assert.strictEqual(classifySentiment(neutralText), "neutral");
  console.log("✅ Q11 (Sentiment Batch classifier): Passed");

  // Test Q25 Latency Stats
  const stats = computeQ25Stats(testEmail, {
    regions: ["apac", "amer"],
    threshold_ms: 150,
  });
  assert.strictEqual(stats.regions.length, 2);
  const apac = stats.regions.find((r) => r.region === "apac");
  assert(apac.avg_latency > 0);
  assert(apac.p95_latency >= apac.avg_latency);
  assert(apac.avg_uptime >= 90);
  assert(typeof apac.breaches === "number");
  console.log("✅ Q25 (Vercel Latency Stats calculation): Passed");

  console.log("\nAll GA0 Core logic tests passed successfully! 🎉");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
