# YFinance Unified Architecture - System Baseline

**Project:** YFinance Futures Data Repository  
**Version:** 2.0 (Unified Architecture)  
**Last Updated:** 2025-12-07  
**Purpose:** Comprehensive baseline documentation for consolidated database system

---

## 🎯 Executive Summary

The YFinance system is a fully automated, containerized data collection and analysis platform for futures market data. As of December 2025, the system has been consolidated from 12 database scripts and 3 Docker services to 4 core scripts and 2 Docker services, reducing code by 67% while maintaining 100% functionality.

**Core Capability:** Parallel collection of 5-minute and hourly OHLCV data for 17 futures contracts with automated volatility analytics.

**Technology Stack:**
- TimescaleDB (PostgreSQL + time-series extension)
- Docker Compose (multi-service orchestration)
- Python 3.10+ (yfinance, pandas, psycopg2)
- Multithreaded parallel processing

---

## 🏗️ System Architecture

### Container Architecture (2 Services)

```
┌────────────────────────────────────────────────────────────┐
│                     Docker Compose                         │
│                                                            │
│  ┌──────────────────────┐      ┌───────────────────────┐  │
│  │   data-feed          │      │   analytics-feed      │  │
│  │  (yfinance-data-feed)│      │ (yfinance-analytics)  │  │
│  │                      │      │                       │  │
│  │  unified_import.py   │      │  volatility_suite.py  │  │
│  │  ┌────────┐ ┌──────┐│      │                       │  │
│  │  │5m thrd │ │1h th.││      │  Daily calculation    │  │
│  │  │300s ⟳  │ │3600s││      │  at market close      │  │
│  │  └────────┘ └──────┘│      │                       │  │
│  └──────────┬───────────┘      └───────────┬───────────┘  │
│             │                              │              │
│             └──────────────┬───────────────┘              │
│                            │                              │
│                   ┌────────▼─────────────┐                │
│                   │   timescaledb        │                │
│                   │                      │                │
│                   │  ┌────────────────┐  │                │
│                   │  │ candles_5m     │  │                │
│                   │  │ (hypertable)   │  │                │
│                   │  ├────────────────┤  │                │
│                   │  │ hourly_candles │  │                │
│                   │  │ (hypertable)   │  │                │
│                   │  ├────────────────┤  │                │
│                   │  │ daily_vol      │  │                │
│                   │  │ _metrics       │  │                │
│                   │  └────────────────┘  │                │
│                   │                      │                │
│                   │  Auto-migrations via │                │
│                   │  run_migrations.py   │                │
│                   └──────────────────────┘                │
└────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Container Startup:
   docker-entrypoint.sh → run_migrations.py → create tables

2. Data Collection (data-feed):
   yfinance API → unified_import.py → [5m thread + 1h thread]
   ↓
   Parallel UPSERT to candles_5m + hourly_candles
   ↓
   Automatic backfill on startup (fills gaps since last run)
   ↓
   Continuous updates (5m every 300s, 1h every 3600s)

3. Analytics Generation (analytics-feed):
   Daily cron → volatility_suite.py → read candles_5m
   ↓
   Calculate metrics (tick compression, volatility pulse, regime)
   ↓
   UPSERT to daily_volatility_metrics

4. Data Access:
   External tools → psycopg2 → TimescaleDB (port 5433)
```

---

## 📂 Core Components (4 Scripts)

### 1. unified_import.py (⭐ Main Data Collector)

**Purpose:** Single script for parallel collection of both 5-minute and hourly data.

**Location:** `scripts/database/unified_import.py`

**Key Features:**
- Multithreaded parallel processing (one thread per interval)
- Automatic backfill on startup (detects gaps since last run)
- Configurable interval selection via CLI (`--interval 5m|1h`)
- UPSERT logic (INSERT ... ON CONFLICT UPDATE)
- Graceful shutdown handling (SIGTERM, SIGINT)
- Dry-run mode for testing (`--dry-run`)
- Symbol override via CLI (`--symbols ES=F NQ=F`)

**Usage:**
```bash
# Both intervals (default)
python unified_import.py

# Specific interval
python unified_import.py --interval 5m
python unified_import.py --interval 1h

# Test mode
python unified_import.py --dry-run

# Custom symbols
python unified_import.py --symbols ES=F ZN=F
```

**Architecture:**
```python
INTERVAL_CONFIGS = {
    "5m": {
        "table": "candles_5m",
        "update_seconds": 300,
        "period": "60d"
    },
    "1h": {
        "table": "hourly_candles", 
        "update_seconds": 3600,
        "period": "730d"
    }
}

def interval_worker(interval_key, symbols):
    """Worker thread for a specific interval"""
    while running:
        fetch_and_upsert_data(interval_key, symbols)
        sleep_until_next_update(interval_key)
```

**Replaces:** `live_import.py`, `hourly_live_import.py`, `import_data.py`, `hourly_import.py`

---

### 2. run_migrations.py (⭐ Schema Manager)

**Purpose:** Consolidated migration runner that executes all database schema changes in dependency order.

**Location:** `scripts/database/run_migrations.py`

**Migrations Managed:**
1. `candles_5m` hypertable (5-minute OHLCV data)
2. `hourly_candles` hypertable (1-hour OHLCV data)
3. `daily_volatility_metrics` table (analytics results)

**Execution:**
- **Automatic:** Runs on container startup via `docker-entrypoint.sh`
- **Manual:** `python scripts/database/run_migrations.py`
- **Idempotent:** Safe to run multiple times (CREATE TABLE IF NOT EXISTS)

**Schema Details:**
```sql
-- candles_5m (5-minute bars)
CREATE TABLE candles_5m (
    timestamp TIMESTAMPTZ NOT NULL,
    symbol TEXT NOT NULL,
    open DOUBLE PRECISION,
    high DOUBLE PRECISION,
    low DOUBLE PRECISION,
    close DOUBLE PRECISION,
    volume BIGINT,
    PRIMARY KEY (timestamp, symbol)
);
SELECT create_hypertable('candles_5m', 'timestamp', if_not_exists => TRUE);

-- hourly_candles (1-hour bars)
CREATE TABLE hourly_candles (
    timestamp TIMESTAMPTZ NOT NULL,
    symbol TEXT NOT NULL,
    open DOUBLE PRECISION,
    high DOUBLE PRECISION,
    low DOUBLE PRECISION,
    close DOUBLE PRECISION,
    volume BIGINT,
    PRIMARY KEY (timestamp, symbol)
);
SELECT create_hypertable('hourly_candles', 'timestamp', if_not_exists => TRUE);

-- daily_volatility_metrics (analytics)
CREATE TABLE daily_volatility_metrics (
    symbol TEXT NOT NULL,
    calculation_date DATE NOT NULL,
    tick_compression DOUBLE PRECISION,
    volatility_pulse DOUBLE PRECISION,
    regime TEXT,
    volume_flow DOUBLE PRECISION,
    oi_flow DOUBLE PRECISION,
    PRIMARY KEY (symbol, calculation_date)
);
```

**Replaces:** `migrate_schema.py`, `create_hourly_candles.py`, `create_analytics_table.py`

---

### 3. instruments.py (⭐ Symbol Configuration)

**Purpose:** Central configuration for all tracked futures contracts.

**Location:** `scripts/database/instruments.py`

**Default Instruments (17 Contracts):**
```python
DEFAULT_INSTRUMENTS = [
    # Equity Index Futures
    "ES=F",   # S&P 500 E-mini
    "NQ=F",   # NASDAQ 100 E-mini
    "YM=F",   # Dow Jones E-mini
    
    # Treasury Futures
    "ZB=F",   # 30-Year T-Bond
    "ZN=F",   # 10-Year T-Note
    "ZF=F",   # 5-Year T-Note
    "ZT=F",   # 2-Year T-Note
    
    # STIR Futures
    "SR3=F",  # 3-Month SOFR
    "SR1=F",  # 1-Month SOFR
    
    # Energy Futures
    "CL=F",   # Crude Oil WTI
    "NG=F",   # Natural Gas
    
    # Metals Futures
    "GC=F",   # Gold
    "SI=F",   # Silver
    
    # Currency Futures
    "6J=F",   # Japanese Yen
    "6S=F",   # Swiss Franc
    "6E=F",   # Euro
    "6B=F",   # British Pound
]
```

**Usage Pattern:**
```python
from scripts.database.instruments import DEFAULT_INSTRUMENTS

# All scripts import from here
symbols = DEFAULT_INSTRUMENTS
```

**Modification Workflow:**
1. Edit `instruments.py` (add/remove symbols)
2. Run `python scripts/database/validate_tick_sizes.py --update`
3. Verify tick sizes are correct
4. Restart services: `docker compose restart data-feed`

---

### 4. validate_tick_sizes.py (Data Integrity Utility)

**Purpose:** Ensures all instruments have accurate tick sizes for volatility calculations.

**Location:** `scripts/database/validate_tick_sizes.py`

**Features:**
- Validates `instruments.py` against `data/tick_sizes.json`
- Auto-detects tick sizes via yfinance API
- Falls back to sensible defaults (ES=0.25, ZN=0.015625, etc.)
- Can auto-update `tick_sizes.json` with `--update` flag
- Pre-commit git hook integration

**Built-in Defaults:**
```python
TICK_SIZES = {
    # Index Futures
    "ES": 0.25, "NQ": 0.25, "YM": 1.0,
    
    # Treasuries
    "ZN": 0.015625, "ZB": 0.03125, "ZF": 0.0078125, "ZT": 0.0078125,
    
    # SOFR
    "SR3": 0.0025, "SR1": 0.0025,
    
    # Energy
    "CL": 0.01, "NG": 0.001,
    
    # Metals
    "GC": 0.1, "SI": 0.005,
    
    # Currencies
    "6E": 0.00005, "6J": 0.0000005, "6S": 0.0001, "6B": 0.0001
}
```

**Usage:**
```bash
# Check for missing tick sizes
python validate_tick_sizes.py

# Auto-update with best-effort detection
python validate_tick_sizes.py --update

# Check only (no suggestions)
python validate_tick_sizes.py --check-only
```

---

## 🐳 Docker Services

### Service 1: data-feed (Unified Importer)

**Container Name:** `yfinance-data-feed`

**Image:** Built from `Dockerfile` (multi-stage build)

**Command:** `["unified"]` (handled by `docker-entrypoint.sh`)

**What It Does:**
1. On startup: Runs `run_migrations.py` to ensure schema exists
2. Starts `unified_import.py` with both 5m + 1h intervals
3. Each interval runs in separate thread
4. Continuous loop: fetch → upsert → sleep → repeat

**Health Check:**
- Interval: Every 60 seconds
- Timeout: 10 seconds
- Retries: 3
- Start Period: 30 seconds

**Restart Policy:** `unless-stopped` (always restart except manual stop)

**Environment:**
- `DB_HOST=timescaledb`
- `DB_PORT=5432` (internal)
- `DB_NAME=yfinance_data`
- `DB_USER=postgres`
- `DB_PASSWORD=postgres`

**Depends On:** `timescaledb` (health check must pass)

---

### Service 2: analytics-feed (Volatility Calculator)

**Container Name:** `yfinance-analytics-feed`

**Image:** Same as data-feed (shared Dockerfile)

**Command:** `["analytics"]` (handled by `docker-entrypoint.sh`)

**What It Does:**
1. Runs `volatility_suite.py` daily
2. Calculates metrics for all instruments with sufficient data
3. Persists to `daily_volatility_metrics` table

**Schedule:** Daily at market close (configurable)

**Metrics Calculated:**
- **Smart Tick Compression:** Equity x4 logic, high-vol damping
- **Volatility Pulse:** Annualized realized volatility
- **Market Regime:** Compressed/Expanded classification
- **Volume/OI Flow:** With weekend handling

**Restart Policy:** `unless-stopped`

**Depends On:** `timescaledb`

---

### Service 3: timescaledb (Database)

**Container Name:** `timescaledb`

**Image:** `timescale/timescaledb:latest-pg15`

**Port Mapping:** `5433:5432` (host:container)

**Volume:** `timescaledb_data:/var/lib/postgresql/data`

**Health Check:**
- Command: `pg_isready -U postgres`
- Interval: 10 seconds
- Timeout: 5 seconds
- Retries: 5

**Persistence:** 
- Data survives `docker compose down`
- Data survives container restart
- Data survives host reboot
- Data deleted only with `docker compose down -v`

---

## 🔧 Key Design Decisions

### Why Unified Import?

**Problem:** `live_import.py` (5m) and `hourly_live_import.py` (1h) had 90%+ duplicate code.

**Solution:** Single `unified_import.py` with configuration-driven intervals.

**Benefits:**
- Single codebase to maintain
- Parallel processing via threads
- Reduced Docker overhead (1 container vs 2)
- Easier testing and debugging
- Consistent error handling

### Why Automatic Migrations?

**Problem:** Manual migration steps were error-prone and required documentation.

**Solution:** `docker-entrypoint.sh` runs `run_migrations.py` on startup.

**Benefits:**
- Zero-config deployments (`docker compose up -d` just works)
- Idempotent migrations (safe to run multiple times)
- Consolidated migration logic in single file
- Clear dependency ordering

### Why Multithreading vs Multiprocessing?

**Decision:** Use `threading.Thread` instead of `multiprocessing.Process`.

**Rationale:**
- Intervals share same database connection pool
- Python GIL not a bottleneck (I/O bound, not CPU bound)
- Simpler signal handling (SIGTERM propagates to all threads)
- Lower memory overhead
- Easier debugging

### Why UPSERT Instead of INSERT-Only?

**Query Pattern:**
```sql
INSERT INTO {table} (timestamp, symbol, open, high, low, close, volume)
VALUES (%s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (timestamp, symbol) 
DO UPDATE SET 
    open = EXCLUDED.open,
    high = EXCLUDED.high,
    low = EXCLUDED.low,
    close = EXCLUDED.close,
    volume = EXCLUDED.volume;
```

**Rationale:**
- Handles duplicate fetches gracefully
- Enables data corrections (if yfinance updates historical bars)
- Prevents crash on primary key violation
- Supports backfill without complex deduplication

---

## 📋 Common Operations

### Deployment (Production)

```bash
# Fresh deployment
git clone <repo>
cd yfinance-test
docker compose up -d
# Wait for containers to start and auto-migrate
docker compose logs -f data-feed  # Verify both intervals running
```

### Adding New Symbols

```bash
# 1. Edit instruments.py
nano scripts/database/instruments.py
# Add "RTY=F" to DEFAULT_INSTRUMENTS

# 2. Validate tick sizes
python scripts/database/validate_tick_sizes.py --update
# Review suggested tick size, verify it's correct

# 3. Restart data feed
docker compose restart data-feed
# New symbol will backfill automatically
```

### Manual Data Backfill

```bash
# Scenario: Database was down for 3 days, need to backfill gap

# Option 1: Restart data-feed container (automatic)
docker compose restart data-feed
# unified_import.py detects gap and backfills on startup

# Option 2: Manual run with specific period
python scripts/database/unified_import.py --interval 5m --symbols ES=F
# Fetches max available history for 5m (60 days)
```

### Monitoring

```bash
# Check container status
docker compose ps

# View real-time logs (both intervals)
docker compose logs -f data-feed

# Check last update timestamps
docker compose logs data-feed | grep "Next update"

# Verify data in database
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d yfinance_data \
  -c "SELECT symbol, COUNT(*), MAX(timestamp) FROM candles_5m GROUP BY symbol;"
```

### Debugging

```bash
# Run unified import in dry-run mode
python scripts/database/unified_import.py --dry-run
# Shows what would be fetched without writing to DB

# Run specific interval locally
python scripts/database/unified_import.py --interval 5m --symbols ES=F
# Useful for testing single symbol/interval

# Check database schema
docker exec timescaledb psql -U postgres -d yfinance_data -c "\d candles_5m"

# View recent data
docker exec timescaledb psql -U postgres -d yfinance_data \
  -c "SELECT * FROM candles_5m WHERE symbol='ES=F' ORDER BY timestamp DESC LIMIT 10;"
```

### Disaster Recovery

```bash
# Scenario: Corrupted database, need to restore

# 1. Stop all services
docker compose down

# 2. Remove corrupted volume
docker volume rm yfinance-test_timescaledb_data

# 3. Restart (auto-migrates and backfills)
docker compose up -d
# Migrations create fresh schema
# unified_import.py backfills max available history
```

---

## 🛠️ Maintenance Guidelines

### Regular Maintenance

**Weekly:**
- Check container logs for errors: `docker compose logs --tail 100 data-feed`
- Verify data gaps: Query `MAX(timestamp)` per symbol
- Monitor disk usage: TimescaleDB volume size

**Monthly:**
- Review and update instruments.py if new contracts launched
- Validate tick sizes: `python validate_tick_sizes.py`
- Check yfinance API changes (library updates)

**Quarterly:**
- Database vacuum: `VACUUM ANALYZE candles_5m, hourly_candles;`
- Review TimescaleDB retention policies
- Update Docker images: `docker compose pull && docker compose up -d`

### Code Modification Patterns

**Adding a New Interval (e.g., 15-minute):**

1. Edit `unified_import.py`:
```python
INTERVAL_CONFIGS = {
    "5m": {...},
    "1h": {...},
    "15m": {  # NEW
        "table": "candles_15m",
        "update_seconds": 900,
        "period": "60d"
    }
}
```

2. Add migration in `run_migrations.py`:
```python
def create_candles_15m():
    # Similar to create_candles_5m()
```

3. Update docker-compose.yml if needed (default runs all intervals)

**Adding New Analytics:**

1. Edit `volatility_suite.py` to add new metric calculation
2. Update `daily_volatility_metrics` schema if needed
3. Restart analytics-feed: `docker compose restart analytics-feed`

### Breaking Changes to Avoid

**❌ Don't:**
- Change primary key columns in existing tables (requires migration + data export/import)
- Remove columns that analytics depend on
- Change INTERVAL_CONFIGS keys without updating docker-entrypoint.sh
- Modify instruments.py without running validate_tick_sizes.py

**✅ Do:**
- Add new columns with ALTER TABLE (backwards compatible)
- Add new intervals to INTERVAL_CONFIGS
- Add new symbols to instruments.py
- Add new analytics metrics as separate columns

---

## 🔍 Troubleshooting Patterns

### Data Feed Not Updating

**Symptoms:** No new data in `candles_5m` or `hourly_candles` for several hours.

**Diagnosis:**
```bash
# 1. Check container status
docker compose ps
# Ensure data-feed is "running" not "restarting"

# 2. View recent logs
docker compose logs data-feed | tail -50
# Look for errors: API timeouts, database connection refused, etc.

# 3. Check database connectivity from container
docker exec yfinance-data-feed python -c "import psycopg2; conn = psycopg2.connect('host=timescaledb dbname=yfinance_data user=postgres password=postgres'); print('OK')"
```

**Common Causes:**
- **Database down:** `docker compose restart timescaledb`
- **yfinance API rate limit:** Wait 5 minutes, will auto-retry
- **Network issues:** Check Docker network: `docker network inspect yfinance-test_default`

**Resolution:**
```bash
# Restart data feed (will backfill automatically)
docker compose restart data-feed
```

---

### Migrations Failing

**Symptoms:** Container crashes on startup with migration errors.

**Diagnosis:**
```bash
# View startup logs
docker compose logs timescaledb | grep -A 10 "ERROR"
docker compose logs data-feed | grep -A 10 "migration"
```

**Common Causes:**
- **Table already exists:** Safe to ignore if idempotent
- **TimescaleDB extension not loaded:** Check `docker compose logs timescaledb`
- **Permission errors:** Ensure `postgres` user has CREATE privileges

**Resolution:**
```bash
# Manual migration with verbose output
docker exec yfinance-data-feed python scripts/database/run_migrations.py
```

---

### Data Gaps

**Symptoms:** Missing data for certain timestamps or symbols.

**Diagnosis:**
```sql
-- Find gaps in ES=F 5-minute data
SELECT 
    timestamp,
    LEAD(timestamp) OVER (ORDER BY timestamp) as next_timestamp,
    LEAD(timestamp) OVER (ORDER BY timestamp) - timestamp as gap
FROM candles_5m
WHERE symbol = 'ES=F'
ORDER BY gap DESC NULLS LAST
LIMIT 10;
```

**Common Causes:**
- **Market holidays/weekends:** Expected gaps
- **Container downtime:** Will backfill on restart
- **yfinance API failures:** Check logs for errors during gap period

**Resolution:**
```bash
# Automatic backfill on restart
docker compose restart data-feed

# Or manual backfill with specific symbols
python scripts/database/unified_import.py --symbols ES=F --interval 5m
```

---

### High Memory Usage

**Symptoms:** Container using >1GB RAM, system slowdown.

**Diagnosis:**
```bash
# Check container resource usage
docker stats yfinance-data-feed

# Check Python process inside container
docker exec yfinance-data-feed ps aux
```

**Common Causes:**
- **Too many symbols:** 17 symbols * 2 intervals * yfinance overhead
- **Large backfill:** Fetching 60 days * 288 bars/day * 17 symbols
- **Memory leak:** (unlikely, but check with long-running containers)

**Resolution:**
```bash
# Limit symbols via CLI
python unified_import.py --symbols ES=F ZN=F GC=F

# Or restart container (clears memory)
docker compose restart data-feed
```

---

## 📚 Reference Information

### File Dependencies

```
instruments.py (symbol config)
    ↓ imported by
unified_import.py (data collector)
validate_tick_sizes.py (data integrity)
volatility_suite.py (analytics)

run_migrations.py (schema manager)
    ↓ called by
docker-entrypoint.sh (on startup)

unified_import.py
    ↓ uses
INTERVAL_CONFIGS (5m, 1h)
    ↓ writes to
candles_5m, hourly_candles (tables)
    ↓ read by
volatility_suite.py
    ↓ writes to
daily_volatility_metrics (table)
```

### Environment Variables

**Required (set in docker-compose.yml):**
- `DB_HOST` - Database hostname (default: `timescaledb`)
- `DB_PORT` - Database port (default: `5432` internal, `5433` external)
- `DB_NAME` - Database name (default: `yfinance_data`)
- `DB_USER` - Database user (default: `postgres`)
- `DB_PASSWORD` - Database password (default: `postgres` for local dev)

**Optional:**
- `LOG_LEVEL` - Logging verbosity (default: INFO)
- `PYTHONUNBUFFERED` - Force unbuffered output (set to `1` in containers)

### CLI Arguments

**unified_import.py:**
- `--interval` - Specific interval to run (5m, 1h, or both if omitted)
- `--symbols` - Override symbols from instruments.py
- `--dry-run` - Test mode, no database writes

**run_migrations.py:**
- None (idempotent, always runs all migrations)

**validate_tick_sizes.py:**
- `--update` - Auto-update tick_sizes.json
- `--check-only` - Only check, no suggestions

### Database Tables

**candles_5m:**
- Size: ~1.5 GB per year for 17 symbols
- Retention: 60 days (yfinance limit for 5m data)
- Indexes: Primary key on (timestamp, symbol)

**hourly_candles:**
- Size: ~300 MB per year for 17 symbols
- Retention: 730 days (2 years)
- Indexes: Primary key on (timestamp, symbol)

**daily_volatility_metrics:**
- Size: ~50 MB per year for 17 symbols
- Retention: Unlimited (historical metrics)
- Indexes: Primary key on (symbol, calculation_date)

---

## 📝 Version History

**v2.0 (2025-12-07):** Unified Architecture
- Consolidated 12 scripts → 4 scripts
- Reduced 3 containers → 2 containers
- Implemented parallel multithreaded import
- Automatic migrations on startup
- 67% code reduction

**v1.x (2025-11):** Multi-Service Architecture
- Separate live_import.py and hourly_live_import.py
- Manual migrations with migrate_schema.py
- 3-container Docker Compose setup

---

## 🎯 Future Roadmap

**Planned Improvements:**
- **Historical analytics backfill:** Populate daily_volatility_metrics for all past dates
- **Real-time anomaly alerts:** Notify on volatility threshold breaches
- **REST API:** Flask/FastAPI for external data access
- **Grafana dashboard:** Real-time monitoring and visualization
- **Additional intervals:** 15m, daily, weekly data collection

**Potential Optimizations:**
- **Compression:** TimescaleDB native compression for old data
- **Retention policies:** Auto-delete data older than X days
- **Continuous aggregates:** Pre-computed hourly stats from 5m data
- **Read replicas:** Separate analytics queries from writes

---

**Document Maintenance:**
- Update this memory when adding new intervals
- Update when modifying INTERVAL_CONFIGS structure
- Update when adding new database tables
- Update when changing Docker architecture

**Related Memories:**
- `database-scripts-consolidation-2025-12-07` (refactoring details)
- `volatility_analytics_persistence` (analytics implementation)
- `automated_data_pipeline_implementation` (pipeline design)
