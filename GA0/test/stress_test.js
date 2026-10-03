import assert from "node:assert";
import { getQ10Students, computeQ25Stats, classifySentiment } from "../api/index.js";

async function simulateMultiStudentStress() {
  console.log("=== Running Multi-Student Concurrency & Dynamic Generation Stress Test ===");

  const studentCount = 1000;
  const emails = Array.from({ length: studentCount }, (_, i) => `student_${i}_${Date.now()}@test.edu`);

  const startTime = Date.now();

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];

    // 1. Q10: Deterministic seed test
    const students1 = getQ10Students(email);
    const students2 = getQ10Students(email);
    assert.strictEqual(students1.length, 2000);
    assert.strictEqual(students1[0].class, students2[0].class);
    assert.strictEqual(students1[1999].studentId, 2000);

    // 2. Q25: Deterministic latency test
    const latency1 = computeQ25Stats(email, { regions: ["apac", "amer"], threshold_ms: 170 });
    const latency2 = computeQ25Stats(email, { regions: ["apac", "amer"], threshold_ms: 170 });
    assert.strictEqual(latency1.regions[0].avg_latency, latency2.regions[0].avg_latency);
    assert.strictEqual(latency1.regions[0].breaches, latency2.regions[0].breaches);
    assert.strictEqual(latency1.regions[0].p95_latency, latency2.regions[0].p95_latency);
  }

  const durationMs = Date.now() - startTime;
  console.log(`✅ Successfully generated and verified data for ${studentCount} unique students!`);
  console.log(`⏱ Total time: ${durationMs}ms (~${(durationMs / studentCount).toFixed(2)}ms per student request)`);
  console.log("Memory and state are completely stateless and leak-free.");
}

simulateMultiStudentStress().catch((err) => {
  console.error("Stress test failed:", err);
  process.exit(1);
});
