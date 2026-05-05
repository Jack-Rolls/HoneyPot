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

const HONEYPOT_NAME = "fake-admin";
const FAKE_ADMIN_LOGIN_PATHS = new Set([
  "/",
  "/wp-login.php",
  "/wp-login.php/",
  "/xmlrpc.php",
  "/wp-config.php",
  "/admin",
  "/admin/",
  "/administrator",
  "/administrator/",
  "/login",
  "/login/"
]);

export default {
  async fetch(request: Request, env: Env, ctx: WorkerContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/wp-login.php") {
      const credentials = await extractWordPressCredentials(request);
      ctx.waitUntil(logHit(request, env, {
        honeypot: HONEYPOT_NAME,
        attemptedUsername: credentials.username,
        attemptedPassword: credentials.password,
        bodyPreview: credentials.bodyPreview
      }));

      return wordpressLoginPage("Error: The username or password you entered is incorrect.");
    }

    ctx.waitUntil(logHit(request, env, { honeypot: HONEYPOT_NAME }));

    if (FAKE_ADMIN_LOGIN_PATHS.has(url.pathname.toLowerCase())) {
      return wordpressLoginPage();
    }

    if (url.pathname === "/wp-admin/" || url.pathname === "/wp-admin") {
      return redirectToLogin();
    }

    if (url.pathname === "/xmlrpc.php") {
      return xmlRpcResponse();
    }

    if (url.pathname === "/wp-config.php") {
      return forbiddenResponse();
    }

    return notFoundResponse();
  }
};

async function extractWordPressCredentials(request: Request): Promise<Credentials> {
  const bodyPreview = await safeBodyPreview(request);

  try {
    const formData = await request.clone().formData();
    return {
      username: formValue(formData.get("log")),
      password: formValue(formData.get("pwd")),
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

function wordpressLoginPage(errorMessage = ""): Response {
  const errorHtml = errorMessage
    ? `<div id="login_error"><strong>Error:</strong> ${escapeHtml(errorMessage)}</div>`
    : "";

  const html = `<!doctype html>
<html lang="en-US">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Log In &lsaquo; Site Admin</title>
  <style>
    body {
      background: #f0f0f1;
      color: #3c434a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
    }
    #login {
      width: 320px;
      padding: 8% 0 0;
      margin: auto;
    }
    .logo {
      text-align: center;
      color: #1d2327;
      font-size: 30px;
      font-weight: 500;
      margin-bottom: 24px;
    }
    form {
      background: #fff;
      border: 1px solid #c3c4c7;
      box-shadow: 0 1px 3px rgba(0,0,0,.04);
      padding: 26px 24px 34px;
    }
    label {
      display: block;
      font-size: 14px;
      margin-bottom: 6px;
    }
    input[type="text"],
    input[type="password"] {
      border: 1px solid #8c8f94;
      border-radius: 4px;
      box-shadow: 0 0 0 transparent;
      box-sizing: border-box;
      font-size: 24px;
      line-height: 1.3;
      margin: 0 0 16px;
      min-height: 40px;
      padding: 3px 8px;
      width: 100%;
    }
    .submit {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      margin-top: 10px;
    }
    button {
      background: #2271b1;
      border: 1px solid #2271b1;
      border-radius: 3px;
      color: #fff;
      cursor: pointer;
      font-size: 13px;
      min-height: 32px;
      padding: 0 12px;
    }
    #login_error {
      background: #fff;
      border-left: 4px solid #d63638;
      box-shadow: 0 1px 1px rgba(0,0,0,.04);
      margin: 0 0 16px;
      padding: 12px;
      font-size: 13px;
    }
    .links {
      color: #50575e;
      font-size: 13px;
      margin-top: 18px;
    }
    .links a {
      color: #50575e;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <main id="login">
    <div class="logo">Site Admin</div>
    ${errorHtml}
    <form name="loginform" id="loginform" action="/wp-login.php" method="post">
      <p>
        <label for="user_login">Username or Email Address</label>
        <input type="text" name="log" id="user_login" autocomplete="username" value="" size="20">
      </p>
      <p>
        <label for="user_pass">Password</label>
        <input type="password" name="pwd" id="user_pass" autocomplete="current-password" value="" size="20">
      </p>
      <p class="submit">
        <button type="submit" name="wp-submit" id="wp-submit">Log In</button>
      </p>
    </form>
    <p class="links"><a href="/wp-login.php?action=lostpassword">Lost your password?</a></p>
  </main>
</body>
</html>`;

  return htmlResponse(html, 200);
}

function redirectToLogin(): Response {
  return new Response(null, {
    status: 302,
    headers: {
      "location": "/wp-login.php?redirect_to=/wp-admin/",
      "cache-control": "no-store"
    }
  });
}

function xmlRpcResponse(): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<methodResponse>
  <fault>
    <value>
      <struct>
        <member>
          <name>faultCode</name>
          <value><int>405</int></value>
        </member>
        <member>
          <name>faultString</name>
          <value><string>XML-RPC services are disabled on this site.</string></value>
        </member>
      </struct>
    </value>
  </fault>
</methodResponse>`;

  return new Response(xml, {
    status: 405,
    headers: {
      "content-type": "text/xml; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function forbiddenResponse(): Response {
  return new Response("Forbidden\n", {
    status: 403,
    headers: {
      "content-type": "text/plain; charset=utf-8",
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

function htmlResponse(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
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
