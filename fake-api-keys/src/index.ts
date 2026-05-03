import { logHit, type LoggerEnv } from "./logger";

interface Env extends LoggerEnv {}

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

const HONEYPOT_NAME = "fake-api-keys";

export default {
  async fetch(request: Request, env: Env, ctx: WorkerContext): Promise<Response> {
    ctx.waitUntil(logHit(request, env, { honeypot: HONEYPOT_NAME }));

    if (request.method !== "GET" && request.method !== "HEAD") {
      return methodNotAllowedResponse();
    }

    return apiKeysResponse();
  }
};

function apiKeysResponse(): Response {
  const body = {
    service: "internal-key-registry",
    environment: "production",
    generated_at: new Date().toISOString(),
    keys: [
      {
        id: "key_01H7R8N9EXAMPLE",
        name: "billing-service-prod",
        provider: "stripe",
        key: "sk_live_EXAMPLE_DO_NOT_USE_billing_9f8a7b6c5d",
        scopes: ["customers:read", "invoices:write", "charges:read"],
        last_used: "2026-05-01T18:42:13Z",
        owner: "payments-platform"
      },
      {
        id: "key_01H7R8P2EXAMPLE",
        name: "customer-export-worker",
        provider: "aws",
        access_key_id: "AKIAIOSFODNN7EXAMPLE",
        secret_access_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        scopes: ["s3:GetObject", "s3:PutObject"],
        last_used: "2026-05-02T03:18:44Z",
        owner: "data-operations"
      },
      {
        id: "key_01H7R8Q4EXAMPLE",
        name: "crm-sync-prod",
        provider: "salesforce",
        client_id: "3MVG9EXAMPLECLIENTID",
        client_secret: "EXAMPLE_DO_NOT_USE_CLIENT_SECRET",
        scopes: ["api", "refresh_token"],
        last_used: "2026-05-02T21:07:09Z",
        owner: "revenue-systems"
      },
      {
        id: "key_01H7R8S7EXAMPLE",
        name: "alerting-webhook",
        provider: "slack",
        webhook_url: "https://hooks.slack.com/services/T00000000/B00000000/EXAMPLE_DO_NOT_USE",
        scopes: ["chat:write"],
        last_used: "2026-04-30T11:55:02Z",
        owner: "sre"
      }
    ]
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function methodNotAllowedResponse(): Response {
  return new Response(JSON.stringify({ error: "method_not_allowed" }), {
    status: 405,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "allow": "GET, HEAD",
      "cache-control": "no-store"
    }
  });
}
