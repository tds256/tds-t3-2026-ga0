# TDS GA0 Unified Solver Service

Self-contained serverless backend for **TDS GA0** exam questions, configured for deployment on **Vercel** and local testing.

---

## 🚀 Supported Exam Endpoints & Questions

| Question | Exam Task | HTTP Method & Route | What to Submit in Exam |
|---|---|---|---|
| **Q5** | Code Interpreter with AI Error Analysis | `POST /t3-2026/ga0/code-interpreter` or `/code-interpreter` | `https://<domain>/t3-2026/ga0/code-interpreter` |
| **Q10** | FastAPI Students Filter | `GET /t3-2026/ga0/<email>/api?class=...` or `/<email>/api` | `https://<domain>/t3-2026/ga0/<email>/api` |
| **Q11** | Batch Sentiment Analysis | `POST /t3-2026/ga0/sentiment` or `/sentiment` | `https://<domain>/t3-2026/ga0/sentiment` |
| **Q17** | Network Game Graph Detective | `GET /t3-2026/ga0/detective-graph?week=now` | Solver utility for network detective tokens |
| **Q18** | Local Ollama Endpoint | `GET /t3-2026/ga0/<email>/api/version` | `https://<domain>/t3-2026/ga0/<email>` |
| **Q25** | Vercel Telemetry Latency Stats | `POST /t3-2026/ga0/<email>` or `POST /t3-2026/ga0/<email>/latency` | `https://<domain>/t3-2026/ga0/<email>` |
| **Q13** | GitHub Action Trigger | `POST /t3-2026/ga0/gh-action` | Calls GitHub API to trigger workflow |
| **Q24** | GitHub Raw Email JSON | `POST /t3-2026/ga0/gh-email` | Creates `e/<hash>.json` on repository |

> 💡 **Tip for Q18 & Q25 on Vercel**:
> - Q18 requires the hostname to contain `ngrok`.
> - Q25 requires the hostname to end with `vercel.app`.
> If you name your Vercel project with `ngrok` in it (e.g., `tds-ga0-ngrok-solver.vercel.app`), **both Q18 and Q25 will be satisfied with the same Vercel URL!**

---

## 🧪 Local Testing

Run test suite:
```bash
npm test
```

Start local server:
```bash
npm start
```
Starts at `http://localhost:8000`.

---

## 🚢 Vercel Deployment

1. Inside the `GA0` folder:
   ```bash
   npx vercel
   ```
2. When prompted for project name, use e.g. `tds-ga0-ngrok-<yourname>`.
3. Set optional environment variables in Vercel if using Q13/Q24:
   - `GH_TOKEN`: GitHub Personal Access Token (repo + workflow scopes)
   - `ACTION_REPO`: GitHub repo with workflow (`<owner>/<repo>`)
   - `EMAIL_REPO`: GitHub repo to store `e/<hash>.json`
