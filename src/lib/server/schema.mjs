/** Tables for the dashboard. Shared by the app and the setup script. Safe to run repeatedly. */
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS credentials (
     id TEXT PRIMARY KEY, public_key BLOB NOT NULL, counter INTEGER NOT NULL, transports TEXT NOT NULL,
     label TEXT NOT NULL, created_at INTEGER NOT NULL, last_used_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS setup_tokens (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS challenges (id TEXT PRIMARY KEY, challenge TEXT NOT NULL, purpose TEXT NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (
     id_hash TEXT PRIMARY KEY, device TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL,
     fresh_until INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, event TEXT NOT NULL, device TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS daily_salts (day TEXT PRIMARY KEY, salt TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS visitors_today (day TEXT NOT NULL, visitor TEXT NOT NULL, PRIMARY KEY (day, visitor))`,
  `CREATE TABLE IF NOT EXISTS stats_daily (day TEXT PRIMARY KEY, views INTEGER NOT NULL DEFAULT 0, visitors INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS stats_pages (day TEXT NOT NULL, page TEXT NOT NULL, views INTEGER NOT NULL, PRIMARY KEY (day, page))`,
  `CREATE TABLE IF NOT EXISTS stats_referrers (day TEXT NOT NULL, host TEXT NOT NULL, views INTEGER NOT NULL, PRIMARY KEY (day, host))`,
  `CREATE TABLE IF NOT EXISTS stats_countries (day TEXT NOT NULL, country TEXT NOT NULL, views INTEGER NOT NULL, PRIMARY KEY (day, country))`,
  `CREATE TABLE IF NOT EXISTS stats_devices (day TEXT NOT NULL, device TEXT NOT NULL, views INTEGER NOT NULL, PRIMARY KEY (day, device))`,
];
