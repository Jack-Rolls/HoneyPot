export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
}

export interface LoggerEnv {
  DB: D1Database;
}

export interface LogHitOptions {
  honeypot: string;
  attemptedUsername?: string | null;
  attemptedPassword?: string | null;
  bodyPreview?: string | null;
}

interface CloudflareRequestMetadata {
  asn?: number;
  asOrganization?: string;
  country?: string;
  region?: string;
  city?: string;
  latitude?: string;
  longitude?: string;
}

const KNOWN_SCANNER_PATTERNS = [
  /masscan/i,
  /nmap/i,
  /zgrab/i,
  /shodan/i,
  /censys/i,
  /nuclei/i,
  /sqlmap/i,
  /nikto/i,
  /gobuster/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /go-http-client/i
];

const MAX_BODY_PREVIEW_LENGTH = 1000;

export async function logHit(
  request: Request,
  env: LoggerEnv,
  options: LogHitOptions
): Promise<void> {
  try {
    const url = new URL(request.url);
    const cf = getCloudflareMetadata(request);
    const headersJson = JSON.stringify(Object.fromEntries(request.headers.entries()));
    const userAgent = request.headers.get("user-agent") || "";
    const clientIp = request.headers.get("cf-connecting-ip") || null;
    const bodyPreview = options.bodyPreview ?? await getBodyPreview(request);
    const isKnownScanner = detectKnownScanner(userAgent) ? 1 : 0;

    await env.DB.prepare(
      `INSERT INTO hits (
        timestamp,
        honeypot,
        method,
        path,
        client_ip,
        asn,
        asn_org,
        country,
        region,
        city,
        latitude,
        longitude,
        user_agent,
        headers,
        body,
        attempted_username,
        attempted_password,
        is_known_scanner
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        Date.now(),
        options.honeypot,
        request.method,
        `${url.pathname}${url.search}`,
        clientIp,
        cf.asn ?? null,
        cf.asOrganization ?? null,
        cf.country ?? null,
        cf.region ?? null,
        cf.city ?? null,
        parseCoordinate(cf.latitude),
        parseCoordinate(cf.longitude),
        userAgent || null,
        headersJson,
        bodyPreview,
        options.attemptedUsername ?? null,
        options.attemptedPassword ?? null,
        isKnownScanner
      )
      .run();
  } catch {
    // Logging should never break the bait response. Honeypots should keep responding even if D1 fails.
  }
}

function getCloudflareMetadata(request: Request): CloudflareRequestMetadata {
  return (request as Request & { cf?: CloudflareRequestMetadata }).cf ?? {};
}

async function getBodyPreview(request: Request): Promise<string | null> {
  if (!["POST", "PUT", "PATCH"].includes(request.method)) {
    return null;
  }

  try {
    const body = await request.clone().text();
    return truncate(body, MAX_BODY_PREVIEW_LENGTH);
  } catch {
    return null;
  }
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...[truncated]`;
}

function detectKnownScanner(userAgent: string): boolean {
  return KNOWN_SCANNER_PATTERNS.some((pattern) => pattern.test(userAgent));
}

function parseCoordinate(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
