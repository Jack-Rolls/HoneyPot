import { logHit, type LoggerEnv } from "./logger";

interface Env extends LoggerEnv {}

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface Credentials {
  username: string | null;
  password: string | null;
  bodyPreview: string | null;
}

const HONEYPOT_NAME = "fake-phpmyadmin";

export default {
  async fetch(request: Request, env: Env, ctx: WorkerContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/index.php") {
      const credentials = await extractPhpMyAdminCredentials(request);
      ctx.waitUntil(logHit(request, env, {
        honeypot: HONEYPOT_NAME,
        attemptedUsername: credentials.username,
        attemptedPassword: credentials.password,
        bodyPreview: credentials.bodyPreview
      }));

      return phpMyAdminLoginPage("Cannot log in to the MySQL server");
    }

    ctx.waitUntil(logHit(request, env, { honeypot: HONEYPOT_NAME }));

    if (url.pathname === "/" || url.pathname === "/index.php" || url.pathname === "/phpmyadmin/" || url.pathname === "/phpMyAdmin/") {
      return phpMyAdminLoginPage();
    }

    return notFoundResponse();
  }
};

async function extractPhpMyAdminCredentials(request: Request): Promise<Credentials> {
  const bodyPreview = await safeBodyPreview(request);

  try {
    const formData = await request.clone().formData();
    return {
      username: formValue(formData.get("pma_username")),
      password: formValue(formData.get("pma_password")),
      bodyPreview
    };
  } catch {
    return {
      username: null,
      password: null,
      bodyPreview
    };
  }
}

async function safeBodyPreview(request: Request): Promise<string | null> {
  try {
    return await request.clone().text();
  } catch {
    return null;
  }
}

function formValue(value: FormDataEntryValue | null): string | null {
  if (value === null) {
    return null;
  }

  return String(value);
}

function phpMyAdminLoginPage(errorMessage = ""): Response {
  const errorHtml = errorMessage
    ? `<div class="error"><strong>Error</strong><br>${escapeHtml(errorMessage)}</div>`
    : "";

  const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>phpMyAdmin</title>
  <style>
    body {
      background: #f5f5f5;
      color: #222;
      font-family: Verdana, Arial, sans-serif;
      font-size: 13px;
      margin: 0;
    }
    .topbar {
      background: linear-gradient(#fefefe, #dcdcdc);
      border-bottom: 1px solid #aaa;
      padding: 10px 16px;
    }
    .brand {
      color: #235a81;
      font-size: 28px;
      font-weight: bold;
      letter-spacing: -1px;
    }
    .wrap {
      margin: 48px auto;
      max-width: 430px;
    }
    .panel {
      background: #fff;
      border: 1px solid #aaa;
      border-radius: 4px;
      box-shadow: 0 1px 2px rgba(0,0,0,.12);
      overflow: hidden;
    }
    .panel h1 {
      background: linear-gradient(#f6f6f6, #e7e7e7);
      border-bottom: 1px solid #aaa;
      font-size: 16px;
      font-weight: bold;
      margin: 0;
      padding: 10px 12px;
    }
    form {
      padding: 18px;
    }
    .row {
      display: grid;
      grid-template-columns: 110px 1fr;
      gap: 10px;
      align-items: center;
      margin-bottom: 12px;
    }
    label {
      font-weight: bold;
      text-align: right;
    }
    input[type="text"],
    input[type="password"],
    select {
      border: 1px solid #aaa;
      border-radius: 3px;
      box-sizing: border-box;
      font-size: 13px;
      padding: 6px;
      width: 100%;
    }
    .actions {
      border-top: 1px solid #ddd;
      margin-top: 16px;
      padding-top: 14px;
      text-align: right;
    }
    button {
      background: linear-gradient(#fefefe, #dcdcdc);
      border: 1px solid #888;
      border-radius: 3px;
      cursor: pointer;
      font-weight: bold;
      padding: 6px 14px;
    }
    .error {
      background: #fbe3e4;
      border: 1px solid #fbc2c4;
      border-radius: 4px;
      color: #8a1f11;
      margin-bottom: 14px;
      padding: 10px;
    }
    .notice {
      color: #555;
      font-size: 12px;
      margin: 14px 0 0;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="brand">phpMyAdmin</div>
  </div>
  <main class="wrap">
    ${errorHtml}
    <section class="panel">
      <h1>Log in</h1>
      <form method="post" action="/index.php?route=/">
        <div class="row">
          <label for="input_username">Username:</label>
          <input type="text" name="pma_username" id="input_username" value="" autocomplete="username">
        </div>
        <div class="row">
          <label for="input_password">Password:</label>
          <input type="password" name="pma_password" id="input_password" value="" autocomplete="current-password">
        </div>
        <div class="row">
          <label for="server">Server choice:</label>
          <select name="server" id="server">
            <option value="1">MySQL</option>
          </select>
        </div>
        <div class="actions">
          <button type="submit">Log in</button>
        </div>
      </form>
    </section>
    <p class="notice">Cookies must be enabled past this point.</p>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function notFoundResponse(): Response {
  return new Response("Not Found\n", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
