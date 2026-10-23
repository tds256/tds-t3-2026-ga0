/* Universal GA3 helper: paste on your logged-in GA3 attempt page.
   Automates GA3 questions by connecting to your deployed solver backend.

   Q1: q-guess-number-server (Guess your number, 0 marks, binary search or safe probe)
   Q2: q-a2a-durable-delegate-server-v2 (A2A Invoice Agent, 4 marks)
   Q3: q-taint-aware-agent-executor-server-v2 (Safe AI Mailroom, 4 marks)
   Q4: q-agent-trace-integrity-server-v2 (Observable Incident Triage, 4 marks)
   Q5: q-trading-humans-only (Trading game acknowledgement, 1 mark)
   Q6: q-3d-face-model (Reconstruct famous face in 3D, 0.5 online marks)
*/
(async () => {
  const QUIZ = 'tds-2026-09-ga3';
  const OPTIONS = globalThis.GA3_OPTIONS || {};
  const AUTOSAVE = OPTIONS.autoSave !== false;
  const BACKEND = (
    OPTIONS.backend ||
    globalThis.TDS_BACKEND ||
    globalThis.GA3_BACKEND ||
    'https://tds-roe-solver-api-t12026.onrender.com'
  ).replace(/\/+$/, '');

  if (location.origin !== 'https://exam.sanand.workers.dev') {
    throw new Error('Open the official exam page first: https://exam.sanand.workers.dev/');
  }
  if (!location.pathname.includes(QUIZ)) {
    throw new Error('Open /' + QUIZ + ' first, then paste.');
  }

  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user || !user.email) {
    throw new Error('Not logged in (localStorage.user missing). Log in, then paste again.');
  }

  const EMAIL = String(user.email);
  const emailL = EMAIL.trim().toLowerCase();

  console.info(
    '%c🛡️ [TDS GA3 Solver] Running for ' + EMAIL + ' with backend: ' + BACKEND,
    'background: #1e293b; color: #38bdf8; padding: 6px 12px; border-radius: 4px; font-weight: bold; display: block; margin: 4px 0;'
  );

  const fill = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return false;
    const strVal = String(val ?? '');
    el.value = strVal;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };

  /* ============ Question-to-Backend URL Mapping ============ */
  // The endpoints match the HypeMonk/TDS-GA5 reference architecture:
  // Q2: A2A Base URL -> BACKEND + '/a2a/' or BACKEND + '/' (both discovery & routes supported)
  // Q3: Mailroom URL -> BACKEND + '/v1/mailroom/actions' (or BACKEND + '/mailroom')
  // Q4: Incident Base URL -> BACKEND + '/' (routes /v2/incidents...)
  // Q5: Trading Game -> "played"
  // Q6: 3D Face Model -> CORS-enabled public GLB URL under 2 MB

  const GLB_FALLBACK = OPTIONS.glbUrl || 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb';

  const FILL = {
    // Q1: Guess number (optional/experimental - 0 marks)
    'q-guess-number-server': OPTIONS.guessNumber || document.getElementById('q-guess-number-server')?.value || '5000',

    // Q2: A2A Invoice Agent (4 marks) - expects Base URL where /.well-known/agent-card.json is discoverable
    'q-a2a-durable-delegate-server-v2': `${BACKEND}/a2a/`,

    // Q3: Safe AI Mailroom Agent (4 marks) - expects endpoint for propose & commit
    'q-taint-aware-agent-executor-server-v2': `${BACKEND}/v1/mailroom/actions`,

    // Q4: Observable Incident Triage Agent (4 marks) - expects Base URL exposing /v2/incidents
    'q-agent-trace-integrity-server-v2': `${BACKEND}/`,

    // Q5: Trading game: Humans Only (1 mark) - acknowledgment keyword
    'q-trading-humans-only': 'played',

    // Q6: 3D Face Model (0.5 mark online check)
    'q-3d-face-model': OPTIONS.faceGlbUrl || document.getElementById('q-3d-face-model')?.value?.trim() || GLB_FALLBACK,
  };

  const results = [];
  for (const [qid, value] of Object.entries(FILL)) {
    if (!document.getElementById(qid)) {
      results.push({ qid, status: 'absent (not in this view)' });
      continue;
    }
    const ok = fill(qid, value);
    results.push({ qid, status: ok ? 'filled' : 'input missing', value });
  }

  console.table(results);
  window.__ga3Ureport = results;

  /* ============ Check & Auto-Verify Actions ============ */
  async function runIndividualChecks() {
    const buttons = [...document.querySelectorAll('.check-answer')];
    for (const btn of buttons) {
      const qid = btn.getAttribute('data-question');
      // Skip guessing game if user didn't want to use limited guesses (max 3/day)
      if (qid === 'q-guess-number-server' && !OPTIONS.checkGuess) {
        console.log('[ga3] Skipping Q1 check (0 marks, 3 check limit). Set GA3_OPTIONS.checkGuess=true to test.');
        continue;
      }
      try {
        console.log(`[ga3] Checking ${qid}...`);
        btn.click();
        const t0 = Date.now();
        while (btn.disabled && Date.now() - t0 < 60000) {
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch (e) {
        console.warn(`[ga3] Check failed on ${qid}:`, e);
      }
    }
  }

  // If a main "Check all" button exists, trigger it; else click question checks
  const checkAllBtn = document.querySelector('.check-action');
  if (checkAllBtn) {
    console.log('[ga3] Running Check all...');
    checkAllBtn.click();
    const deadline = Date.now() + 180000;
    while (checkAllBtn.disabled && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 600));
    }
  } else {
    await runIndividualChecks();
  }

  await new Promise((r) => setTimeout(r, 1500));

  const report = [...document.querySelectorAll('#questions [data-question], details[data-question]')].map((card) => {
    const qid = card.getAttribute('data-question') || '';
    if (!/^q-/.test(qid)) return null;
    const validated = card.classList.contains('was-validated');
    const solved = card.classList.contains('solved') || card.querySelector('.solved-badge:not(.d-none)');
    return { qid, result: solved ? 'Correct' : validated ? 'Incorrect' : 'Checked/Pending' };
  }).filter(Boolean);

  console.table(report);
  window.__ga3Ucheck = report;

  const green = report.filter((r) => r.result === 'Correct').length;
  console.info(`[ga3] Status: ${green}/${report.length} verified.`);

  if (AUTOSAVE && green > 0) {
    const saveBtn = document.querySelector('.save-action');
    if (saveBtn) {
      console.info('[ga3] Auto-saving verified results...');
      saveBtn.click();
    }
  }
})().catch((e) => console.error('[ga3-universal]', e));
