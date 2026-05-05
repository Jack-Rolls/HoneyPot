interface Env {
  DB: D1Database;
  AI: Ai;
}

interface CountRow {
  count: number;
}

interface HoneypotCountRow {
  honeypot: string;
  count: number;
}

interface CountryCountRow {
  country: string;
  count: number;
}

interface AsnOrgCountRow {
  asn_org: string;
  count: number;
}

interface CredentialCountRow {
  value: string;
  count: number;
}

interface RecentHitRow {
  id: number;
  timestamp: number;
  honeypot: string;
  method: string;
  path: string;
  client_ip: string | null;
  asn: number | null;
  asn_org: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  user_agent: string | null;
  is_known_scanner: boolean;
}

interface MapRow {
  latitude: number;
  longitude: number;
  country: string | null;
  count: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "GET") {
      return jsonResponse({ error: "method_not_allowed" }, 405, {
        allow: "GET"
      });
    }

    if (url.pathname === "/api/overview") {
      return getOverview(env);
    }

    if (url.pathname === "/api/map") {
      return getMap(env);
    }

    if (url.pathname === "/api/insights") {
      return getInsights(env);
    }

    return jsonResponse({ error: "not_found" }, 404);
  }
};

async function getOverview(env: Env): Promise<Response> {
  try {
    const since = Date.now() - ONE_DAY_MS;

    const [
      totalHits,
      knownScannerHits,
      hitsLast24h,
      hitsByHoneypot,
      topCountries,
      topAsnOrgs,
      topPasswords,
      topUsernames,
      recentHits
    ] = await Promise.all([
      getCount(env, "SELECT COUNT(*) AS count FROM hits"),
      getCount(env, "SELECT COUNT(*) AS count FROM hits WHERE is_known_scanner = 1"),
      getCount(env, "SELECT COUNT(*) AS count FROM hits WHERE timestamp >= ?", [since]),
      getAll<HoneypotCountRow>(
        env,
        `SELECT honeypot, COUNT(*) AS count
         FROM hits
         GROUP BY honeypot
         ORDER BY count DESC`
      ),
      getAll<CountryCountRow>(
        env,
        `SELECT COALESCE(country, 'Unknown') AS country, COUNT(*) AS count
         FROM hits
         GROUP BY COALESCE(country, 'Unknown')
         ORDER BY count DESC
         LIMIT 10`
      ),
      getAll<AsnOrgCountRow>(
        env,
        `SELECT COALESCE(asn_org, 'Unknown') AS asn_org, COUNT(*) AS count
         FROM hits
         GROUP BY COALESCE(asn_org, 'Unknown')
         ORDER BY count DESC
         LIMIT 10`
      ),
      getAll<CredentialCountRow>(
        env,
        `SELECT attempted_password AS value, COUNT(*) AS count
         FROM hits
         WHERE attempted_password IS NOT NULL AND attempted_password != ''
         GROUP BY attempted_password
         ORDER BY count DESC
         LIMIT 20`
      ),
      getAll<CredentialCountRow>(
        env,
        `SELECT attempted_username AS value, COUNT(*) AS count
         FROM hits
         WHERE attempted_username IS NOT NULL AND attempted_username != ''
         GROUP BY attempted_username
         ORDER BY count DESC
         LIMIT 20`
      ),
      getAll<RecentHitRow>(
        env,
        `SELECT id, timestamp, honeypot, method, path, client_ip, asn, asn_org, country, region, city, user_agent, is_known_scanner
         FROM hits
         ORDER BY timestamp DESC
         LIMIT 50`
      )
    ]);

    return jsonResponse({
      totals: {
        total_hits: totalHits,
        known_scanner_hits: knownScannerHits,
        known_scanner_percentage: percentage(knownScannerHits, totalHits),
        hits_last_24h: hitsLast24h
      },
      hits_by_honeypot: hitsByHoneypot,
      top_countries: topCountries,
      top_asn_orgs: topAsnOrgs,
      top_attempted_passwords: topPasswords,
      top_attempted_usernames: topUsernames,
      recent_hits: recentHits.map(normalizeRecentHit)
    });
  } catch (error) {
    return jsonResponse({
      error: "dashboard_query_failed",
      message: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
}

async function getMap(env: Env): Promise<Response> {
  try {
    const rows = await getAll<MapRow>(
      env,
      `SELECT latitude, longitude, COALESCE(country, 'Unknown') AS country, COUNT(*) AS count
       FROM hits
       WHERE latitude IS NOT NULL AND longitude IS NOT NULL
       GROUP BY latitude, longitude, COALESCE(country, 'Unknown')
       ORDER BY count DESC
       LIMIT 500`
    );

    return jsonResponse({ points: rows });
  } catch (error) {
    return jsonResponse({
      error: "map_query_failed",
      message: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
}

async function getInsights(env: Env): Promise<Response> {
  try {
    const since = Date.now() - ONE_DAY_MS;

    const [
      totalHits,
      topHoneypots,
      topCountries,
      topAsnOrgs,
      topUsernames,
      topPasswords,
      topPaths
    ] = await Promise.all([
      getCount(env, "SELECT COUNT(*) AS count FROM hits WHERE timestamp >= ?", [since]),
      getAll<HoneypotCountRow>(env, "SELECT honeypot, COUNT(*) AS count FROM hits WHERE timestamp >= ? GROUP BY honeypot ORDER BY count DESC LIMIT 5", [since]),
      getAll<CountryCountRow>(env, "SELECT COALESCE(country, 'Unknown') AS country, COUNT(*) AS count FROM hits WHERE timestamp >= ? GROUP BY COALESCE(country, 'Unknown') ORDER BY count DESC LIMIT 5", [since]),
      getAll<AsnOrgCountRow>(env, "SELECT COALESCE(asn_org, 'Unknown') AS asn_org, COUNT(*) AS count FROM hits WHERE timestamp >= ? GROUP BY COALESCE(asn_org, 'Unknown') ORDER BY count DESC LIMIT 5", [since]),
      getAll<CredentialCountRow>(env, "SELECT COALESCE(attempted_username, 'Unknown') AS value, COUNT(*) AS count FROM hits WHERE timestamp >= ? AND attempted_username IS NOT NULL GROUP BY COALESCE(attempted_username, 'Unknown') ORDER BY count DESC LIMIT 5", [since]),
      getAll<CredentialCountRow>(env, "SELECT COALESCE(attempted_password, 'Unknown') AS value, COUNT(*) AS count FROM hits WHERE timestamp >= ? AND attempted_password IS NOT NULL GROUP BY COALESCE(attempted_password, 'Unknown') ORDER BY count DESC LIMIT 5", [since]),
      getAll<CredentialCountRow>(env, "SELECT path, COUNT(*) AS count FROM hits WHERE timestamp >= ? GROUP BY path ORDER BY count DESC LIMIT 10", [since])
    ]);

    const dataSummary = `Total hits: ${totalHits}. Top honeypots: ${topHoneypots.map(h => `${h.honeypot} (${h.count})`).join(', ')}. Top countries: ${topCountries.map(c => `${c.country} (${c.count})`).join(', ')}. Top ASN orgs: ${topAsnOrgs.map(a => `${a.asn_org} (${a.count})`).join(', ')}. Top usernames: ${topUsernames.map(u => `${u.value} (${u.count})`).join(', ')}. Top passwords: ${topPasswords.map(p => `${p.value} (${p.count})`).join(', ')}. Top paths: ${topPaths.map(p => `${p.value} (${p.count})`).join(', ')}.`;

    let summary = "No AI insights available. " + dataSummary;

    try {
      const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: 'You are a security analyst. Generate a concise one-paragraph threat intelligence summary based on honeypot data.' },
          { role: 'user', content: `Based on the following honeypot data from the last 24 hours, generate a concise one-paragraph security threat intelligence summary: ${dataSummary}` }
        ]
      });
      summary = aiResponse.response as string;
    } catch (aiError) {
      console.error('AI failed:', aiError);
    }

    return jsonResponse({
      summary,
      generated_at: new Date().toISOString(),
      source_window_hours: 24
    });
  } catch (error) {
    return jsonResponse({
      error: "insights_query_failed",
      message: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
}

async function getCount(env: Env, query: string, values: unknown[] = []): Promise<number> {
  const statement = bindValues(env.DB.prepare(query), values);
  const row = await statement.first<CountRow>();
  return Number(row?.count ?? 0);
}

async function getAll<T>(env: Env, query: string, values: unknown[] = []): Promise<T[]> {
  const statement = bindValues(env.DB.prepare(query), values);
  const result = await statement.all<T>();
  return result.results ?? [];
}

function bindValues(statement: D1PreparedStatement, values: unknown[]): D1PreparedStatement {
  if (values.length === 0) {
    return statement;
  }

  return statement.bind(...values);
}

function normalizeRecentHit(hit: RecentHitRow): RecentHitRow & { is_known_scanner: boolean } {
  return {
    ...hit,
    is_known_scanner: Boolean(hit.is_known_scanner)
  };
}

function percentage(part: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.round((part / total) * 1000) / 10;
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}
