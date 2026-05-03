import { logHit, type LoggerEnv } from "./logger";

interface Env extends LoggerEnv {}

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

const HONEYPOT_NAME = "fake-env";

export default {
  async fetch(request: Request, env: Env, ctx: WorkerContext): Promise<Response> {
    ctx.waitUntil(logHit(request, env, { honeypot: HONEYPOT_NAME }));

    const url = new URL(request.url);

    if (url.pathname === "/.env") {
      return envFileResponse();
    }

    if (url.pathname === "/.git/config") {
      return gitConfigResponse();
    }

    return notFoundResponse();
  }
};

function envFileResponse(): Response {
  const body = [
    "APP_NAME=InternalAdmin",
    "APP_ENV=production",
    "APP_DEBUG=false",
    "APP_URL=https://admin.internal.example.com",
    "",
    "DB_CONNECTION=mysql",
    "DB_HOST=10.42.8.15",
    "DB_PORT=3306",
    "DB_DATABASE=customer_portal",
    "DB_USERNAME=portal_service",
    "DB_PASSWORD=example-password-do-not-use",
    "",
    "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE",
    "AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "AWS_DEFAULT_REGION=us-east-1",
    "S3_BUCKET=internal-customer-exports",
    "",
    "JWT_SECRET=example.jwt.secret.value.do.not.use",
    "STRIPE_SECRET_KEY=sk_live_EXAMPLE_DO_NOT_USE_123456789",
    ""
  ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function gitConfigResponse(): Response {
  const body = [
    "[core]",
    "\trepositoryformatversion = 0",
    "\tfilemode = true",
    "\tbare = false",
    "\tlogallrefupdates = true",
    "[remote \"origin\"]",
    "\turl = git@github.com:internal/customer-portal-admin.git",
    "\tfetch = +refs/heads/*:refs/remotes/origin/*",
    "[branch \"main\"]",
    "\tremote = origin",
    "\tmerge = refs/heads/main",
    ""
  ].join("\n");

  return new Response(body, {
    status: 200,
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
