CREATE TABLE IF NOT EXISTS hits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  honeypot TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  client_ip TEXT,
  asn INTEGER,
  asn_org TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  latitude REAL,
  longitude REAL,
  user_agent TEXT,
  headers TEXT,
  body TEXT,
  attempted_username TEXT,
  attempted_password TEXT,
  is_known_scanner INTEGER
);

CREATE INDEX IF NOT EXISTS idx_hits_ts ON hits(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_hits_honeypot ON hits(honeypot);
CREATE INDEX IF NOT EXISTS idx_hits_asn ON hits(asn);
CREATE INDEX IF NOT EXISTS idx_hits_country ON hits(country);
CREATE INDEX IF NOT EXISTS idx_hits_scanner ON hits(is_known_scanner);
