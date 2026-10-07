import { createHash } from "node:crypto";

const GH_TOKEN = process.env.GH_TOKEN || "";
const PAGES_REPO = "tds256/tds-t3-2026-ga1-pages";

/**
 * Creates or updates an HTML page with <!--email_off-->email<!--/email_off--> on GitHub Pages repo
 * Returns the exact public GitHub Pages URL: https://tds256.github.io/tds-t3-2026-ga1-pages/p/<hash>/
 */
export async function setupGitHubPages(email) {
  if (!email) throw new Error("Email is required");
  const normalizedEmail = email.trim().toLowerCase();
  const hash = createHash("sha256").update(normalizedEmail).digest("hex").slice(0, 12);
  const path = `p/${hash}/index.html`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TDS GA1 Portfolio - ${hash}</title>
</head>
<body>
  <h1>TDS GA1 Portfolio</h1>
  <p>Student Identifier: <!--email_off-->${normalizedEmail}<!--/email_off--></p>
</body>
</html>`;

  const contentBase64 = Buffer.from(html).toString("base64");

  if (!GH_TOKEN) {
    // If running in local test mode without token
    return {
      url: `https://tds256.github.io/tds-t3-2026-ga1-pages/p/${hash}/`,
      hash,
      email: normalizedEmail,
      status: "mock_created",
    };
  }

  // Check if file already exists to get SHA for update
  let sha = undefined;
  try {
    const getRes = await fetch(`https://api.github.com/repos/${PAGES_REPO}/contents/${path}`, {
      headers: {
        Authorization: `token ${GH_TOKEN}`,
        "User-Agent": "tds256",
        Accept: "application/vnd.github.v3+json",
      },
    });
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha;
    }
  } catch (err) {
    // Ignore error, will create new file
  }

  const putRes = await fetch(`https://api.github.com/repos/${PAGES_REPO}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      "User-Agent": "tds256",
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `Setup portfolio for ${normalizedEmail}`,
      content: contentBase64,
      branch: "main",
      ...(sha ? { sha } : {}),
    }),
  });

  if (!putRes.ok) {
    const errData = await putRes.json().catch(() => ({}));
    throw new Error(`Failed to commit portfolio to GitHub: ${errData.message || putRes.statusText}`);
  }

  return {
    url: `https://tds256.github.io/tds-t3-2026-ga1-pages/p/${hash}/`,
    hash,
    email: normalizedEmail,
    status: "published",
  };
}
