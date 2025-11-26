# System Architecture and Data Flow - Complete Documentation

## High-Level Architecture

### System Type
- **Pattern:** Modular ETL (Extract-Transform-Load) pipeline
- **Execution:** Batch processing (not real-time service)
- **Output:** Time-series CSV files + terminal reports
- **Language:** Python 3.8+
- **Paradigm:** Procedural scripts with shared utility libraries

### Architectural Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE LAYER                      │
│   (Bash orchestration scripts, Terminal output)             │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   ORCHESTRATION LAYER                        │
│   run_all_analysis.sh, run_quick_analysis.sh                │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌───────────────────┬─────────────────────┬──────────────────┐
│   FISCAL PILLAR   │   MONETARY PILLAR   │ PLUMBING PILLAR  │
│  fiscal_analysis  │  fed_liquidity      │ nyfed_operations │
│                   │  repo_market        │ settlement_fails │
└───────────────────┴─────────────────────┴──────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   INTEGRATION LAYER                          │
│          liquidity_composite_index.py (LCI)                  │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    SHARED UTILITIES                          │
│  api_client.py, ofr_client.py, data_loader.py,              │
│  report_generator.py, config.py                              │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL DATA SOURCES                     │
│  FRED API, Treasury API, NY Fed API, OFR API                │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure (Post-Refactoring)

```
/home/dawid/Projects/treasury-API-interface/
├── README.md                          # Main project documentation
├── requirements.txt                   # Python dependencies
├── .gitignore                         # Excludes outputs/, .venv, etc.
│
├── fiscal/                            # Fiscal analysis pillar
│   ├── __init__.py
│   └── fiscal_analysis.py             # Main fiscal impulse script
│
├── fed/                               # Federal Reserve analysis pillar
│   ├── __init__.py
│   ├── config.py                      # Centralized configuration
│   ├── fed_liquidity.py               # Fed balance sheet analysis
│   ├── nyfed_operations.py            # Repo/RRP operations
│   ├── nyfed_reference_rates.py       # Money market rates
│   ├── nyfed_settlement_fails.py      # Settlement fails (22 series)
│   ├── repo_market_analysis.py        # OFR repo data analysis
│   ├── liquidity_composite_index.py   # LCI aggregation (CAPSTONE)
│   │
│   └── utils/                         # Shared utilities
│       ├── __init__.py
│       ├── api_client.py              # FRED + NY Fed clients
│       ├── ofr_client.py              # OFR API client
│       ├── data_loader.py             # File loading utilities
│       └── report_generator.py        # Report formatting
│
├── outputs/                           # Generated data (gitignored)
│   ├── fiscal/
│   │   └── fiscal_analysis_full.csv
│   └── fed/
│       ├── fed_liquidity_full.csv
│       ├── nyfed_repo_ops.csv
│       ├── nyfed_rrp_ops.csv
│       ├── nyfed_reference_rates.csv
│       ├── nyfed_settlement_fails.csv
│       └── repo_market_analysis.csv
│
├── liquidity_composite_index.csv      # Final LCI output (root)
│
├── data/                              # Reference data, audit DB
│   └── audit.sqlite                   # Audit/logging database
│
├── docs/                              # Narrative documentation
│   ├── FED_LIQUIDITY.md
│   ├── FISCAL_ANALYSIS.md
│   ├── LIQUIDITY_COMPOSITE_INDEX.md
│   ├── NY_FED_OPERATIONS.md
│   ├── SETTLEMENT_FAILS.md
│   └── dev/                           # Developer notes
│       ├── SETTLEMENT_FAILS_GUIDE.md
│       └── SETTLEMENT_FAILS_SUCCESS.md
│
├── run_all_analysis.sh                # Full pipeline orchestration
├── run_quick_analysis.sh              # Quick essential analysis
│
└── .venv/                             # Python virtual environment (gitignored)
```

## Data Flow Diagram

### Sequential Execution Flow

```
START
  │
  ├─► fiscal_analysis.py
  │   ├─ Fetch: Treasury Daily Statement (DTS API)
  │   ├─ Fetch: GDP data (FRED API)
  │   ├─ Calculate: Fiscal impulse, TGA balance
  │   ├─ Calculate: MA20, YoY, 3Y baseline
  │   └─ Output: outputs/fiscal/fiscal_analysis_full.csv
  │        └─► Contains: TGA_Balance (needed by fed_liquidity)
  │
  ├─► fed_liquidity.py
  │   ├─ Fetch: Fed H.4.1 data (FRED API) - weekly
  │   ├─ Fetch: SOFR, IORB, RRP (FRED API) - daily
  │   ├─ Load: TGA from fiscal output ◄──┐
  │   ├─ Calculate: Net Liquidity = Assets - TGA - RRP
  │   ├─ Calculate: SOFR-IORB spread, regime detection
  │   └─ Output: outputs/fed/fed_liquidity_full.csv
  │
  ├─► nyfed_operations.py
  │   ├─ Fetch: Repo/RRP operations (NY Fed API)
  │   ├─ Calculate: Submission ratio, aggregation
  │   ├─ Calculate: MA5, MA20 on accepted amounts
  │   └─ Output: outputs/fed/nyfed_repo_ops.csv, nyfed_rrp_ops.csv
  │
  ├─► nyfed_reference_rates.py
  │   ├─ Fetch: SOFR, EFFR, BGCR, TGCR, OBFR (NY Fed API)
  │   ├─ Calculate: Spreads between rates
  │   └─ Output: outputs/fed/nyfed_reference_rates.csv
  │
  ├─► nyfed_settlement_fails.py
  │   ├─ Fetch: 22 series (Primary Dealer Stats API)
  │   ├─ Handle: Suppressed data (*) → NaN
  │   ├─ Calculate: Total Fails, MA5, MA20, Z-score
  │   └─ Output: outputs/fed/nyfed_settlement_fails.csv
  │
  ├─► repo_market_analysis.py
  │   ├─ Fetch: Granular repo data (OFR API)
  │   ├─ Calculate: Repo Stress Index, collateral shares
  │   ├─ Calculate: Effective Policy Stance
  │   └─ Output: outputs/fed/repo_market_analysis.csv
  │
  └─► liquidity_composite_index.py (FINAL)
      ├─ Load: fiscal_analysis_full.csv
      ├─ Load: fed_liquidity_full.csv
      ├─ Load: nyfed_repo_ops.csv, settlement_fails.csv
      ├─ Load: repo_market_analysis.csv
      ├─ Calculate: Z-scores for each component
      ├─ Calculate: Weighted LCI (40/35/25 weights)
      ├─ Calculate: MA5, MA20, regime classification
      └─ Output: liquidity_composite_index.csv (ROOT)
           └─► FINAL PRODUCT for users
  │
END
```

### Data Dependencies Graph

```
Treasury DTS API ────┐
FRED (GDP) ──────────┤
                     ├──► fiscal_analysis.py ──┬──► fiscal_analysis_full.csv
                     │                         │
                     │                         └──────┐
                     │                                │
FRED (H.4.1) ───────┐                                │
FRED (SOFR/IORB) ───┤                                │
                    ├──► fed_liquidity.py ◄──────────┤
                    │         │                      │
                    │         └──► fed_liquidity_full.csv
                    │                                │
NY Fed (Repo/RRP) ──┤                                │
                    ├──► nyfed_operations.py ────────┤
                    │         │                      │
                    │         └──► nyfed_*_ops.csv   │
                    │                                │
NY Fed (Rates) ─────┤                                │
                    ├──► nyfed_reference_rates.py ───┤
                    │         │                      │
                    │         └──► nyfed_reference_rates.csv
                    │                                │
NY Fed (PD Stats) ──┤                                │
                    ├──► nyfed_settlement_fails.py ──┤
                    │         │                      │
                    │         └──► nyfed_settlement_fails.csv
                    │                                │
OFR API ────────────┤                                │
                    ├──► repo_market_analysis.py ────┤
                    │         │                      │
                    │         └──► repo_market_analysis.csv
                    │                                │
                    │                                │
                    └────────────────────────────────┴──► liquidity_composite_index.py
                                                              │
                                                              └──► LCI.csv
```

## Shared Utilities Architecture

### Purpose of Utilities (DRY Principle)
- **Before Refactoring:** Each script had duplicated API fetch, file I/O, report formatting
- **After Refactoring:** Shared utilities eliminate 40-43% of code per script

### Utility Modules

#### 1. config.py
**Location:** `fed/config.py`
**Purpose:** Centralized configuration management
**Contents:**
- FRED API key
- Date ranges for historical data fetch
- LCI component weights (40/35/25)
- File paths (outputs directory)
- API endpoints (if hardcoded)

**Usage:**
```python
from fed.config import FRED_API_KEY, START_DATE
```

#### 2. api_client.py
**Location:** `fed/utils/api_client.py`
**Purpose:** Unified API clients for FRED and NY Fed
**Classes:**
- `FREDClient`: Handles FRED API requests
  - Methods: `fetch_series(series_id, start_date, end_date)`
  - Features: Rate limiting, retry logic, error handling
  - Returns: Pandas DataFrame with DatetimeIndex
- `NYFedClient`: Handles NY Fed Markets API
  - Methods: `fetch_operation_data()`, `fetch_reference_rates()`, etc.
  - Features: Pagination, JSON parsing, date formatting
  - Returns: Pandas DataFrame

**Key Features:**
- **NaN Handling:** `dropna()` applied at fetch to prevent downstream issues
- **Retry Logic:** Exponential backoff on API errors
- **Caching:** (If implemented) Local cache to reduce API calls

**Refactoring Impact:** Used by all fed/* scripts

#### 3. ofr_client.py
**Location:** `fed/utils/ofr_client.py`
**Purpose:** Dedicated client for OFR API
**Added:** Commit a5f8e6ba (latest enhancement)
**Reason for Separation:** OFR API structure different from FRED/NY Fed
**Methods:** (specific to OFR endpoints)
- Fetch repo market data
- Parse OFR-specific JSON formats

#### 4. data_loader.py
**Location:** `fed/utils/data_loader.py`
**Purpose:** Standardized file loading operations
**Functions:**
- `load_csv(file_path, index_col='date')`: Load time series CSV
- `get_output_path(filename)`: Construct output file paths
- `validate_data(df, required_columns)`: Check data integrity

**Features:**
- Consistent date parsing
- Missing file error handling
- Column validation

**Refactoring Impact:** Eliminates file I/O duplication

#### 5. report_generator.py
**Location:** `fed/utils/report_generator.py`
**Purpose:** Consistent terminal report formatting
**Class:** `ReportGenerator`
**Methods:**
- `print_header(title)`: Formatted section headers
- `print_metric(name, value, unit)`: Aligned metric display
- `print_table(dataframe)`: Tabular data output
- `format_number(num, decimals, prefix, suffix)`: Number formatting

**Features:**
- ANSI color codes for terminal (green/red/yellow)
- Consistent spacing and alignment
- Optional verbosity levels

**Refactoring Impact:** Standardized all terminal output (Phase 2, commit 65f9f664)

## Execution Patterns

### Manual Sequential Execution
```bash
source venv/bin/activate
python fiscal/fiscal_analysis.py
python fed/fed_liquidity.py
python fed/nyfed_operations.py
python fed/nyfed_reference_rates.py
python fed/nyfed_settlement_fails.py
python fed/repo_market_analysis.py
python fed/liquidity_composite_index.py
```

**Pros:** Full control, inspect intermediate outputs
**Cons:** Tedious, error-prone

### Automated Pipeline (Recommended)
```bash
./run_all_analysis.sh
```

**Features:**
- Automatic venv activation
- Color-coded output (green=success, red=error)
- Sequential execution with dependency awareness
- Error propagation (stops on first failure)
- Timestamp logging

**Contents of run_all_analysis.sh:**
```bash
#!/bin/bash
source venv/bin/activate
python fiscal/fiscal_analysis.py || exit 1
python fed/fed_liquidity.py || exit 1
python fed/nyfed_operations.py || exit 1
# ... (all scripts in order)
echo "✓ Full analysis pipeline complete"
```

### Quick Analysis
```bash
./run_quick_analysis.sh
```

**Difference:** Runs only essential scripts (fiscal + fed_liquidity + LCI)
**Use Case:** Daily monitoring without full suite
**Runtime:** ~50% faster than full pipeline

## Data Storage and Persistence

### CSV Output Format
- **Standard:** Date-indexed time series
- **Index Column:** `date` (datetime, daily or weekly)
- **Format:** ISO 8601 (YYYY-MM-DD)
- **Missing Data:** Represented as empty cells (pandas to_csv default)

### Audit Database
- **File:** `data/audit.sqlite`
- **Purpose:** (Based on file existence, likely used for:)
  - API call logging (timestamp, endpoint, success/failure)
  - Data quality metadata (null counts, outliers)
  - Execution history (script runs, duration)
- **Access:** SQLite3 (Python sqlite3 module)

### Output Lifecycle
- **Generation:** Each script run overwrites its output CSV
- **Retention:** Outputs/ directory in .gitignore (not version controlled)
- **Backup:** User responsibility (copy to external storage if needed)
- **Historical:** Full historical data re-fetched each run (no incremental updates)

## Error Handling Philosophy

### Script-Level
- **Fail Loudly:** Scripts raise exceptions on critical errors
- **No Silent Failures:** Avoid catching and suppressing errors
- **Informative Messages:** Print error context before raising

### API-Level (in api_client.py)
- **Retry Logic:** 3 attempts with exponential backoff
- **Timeout:** 30-second request timeout
- **HTTP Errors:** Raise custom exception with status code
- **Rate Limiting:** Respect API limits, sleep if needed

### Data-Level
- **Validation:** Check for required columns, expected date range
- **NaN Handling:** Drop at source (api_client), forward fill in scripts
- **Outlier Detection:** (If implemented) Flag statistical anomalies

## Performance Characteristics

### Execution Time (Approximate)
- `fiscal_analysis.py`: 30-60 sec (DTS pagination)
- `fed_liquidity.py`: 20-40 sec (multiple FRED series)
- `nyfed_operations.py`: 10-30 sec (simple API)
- `nyfed_reference_rates.py`: 10-20 sec
- `nyfed_settlement_fails.py`: 60-90 sec (22 API calls)
- `repo_market_analysis.py`: 30-60 sec (OFR data)
- `liquidity_composite_index.py`: 5-10 sec (local file processing)
**Total Pipeline:** ~3-5 minutes

### Bottlenecks
- **API Latency:** Primary bottleneck (network-bound)
- **Settlement Fails:** 22 sequential API calls (room for parallelization)
- **Pagination:** DTS API for long historical ranges

### Optimization Opportunities
1. **Parallel API Calls:** Use asyncio or threading for settlement fails
2. **Incremental Updates:** Only fetch new data since last run
3. **Local Caching:** Store API responses with TTL
4. **Batch Requests:** If APIs support multi-series requests

## Deployment Considerations

### Environment Setup
- **Python:** 3.8+ required
- **Virtual Environment:** Recommended (venv, conda)
- **Dependencies:** Listed in requirements.txt
  - pandas, numpy, requests (core)
  - matplotlib (if visualization added)

### Scheduled Execution
- **Cron Job:** Daily at market close (e.g., 5 PM ET)
```cron
0 17 * * 1-5 cd /path/to/project && ./run_all_analysis.sh >> logs/cron.log 2>&1
```
- **Considerations:**
  - NY Fed data published Thursdays (weekly)
  - DTS published daily
  - Weekend execution unnecessary

### API Key Management
- **FRED Key:** Required, free registration at research.stlouisfed.org
- **Storage:** `fed/config.py` (NOT in git, use .gitignore)
- **Best Practice:** Use environment variable
```python
import os
FRED_API_KEY = os.getenv('FRED_API_KEY', 'default_key')
```

### Monitoring and Alerting
- **Health Check:** Verify LCI output file updated daily
- **Data Quality:** Check for unexpected NaN counts
- **Alerting:** Email/Slack if script fails (wrap in shell with error notification)

## Extensibility and Future Enhancements

### Adding New Data Source
1. Create script in `fed/` (e.g., `ecb_liquidity.py`)
2. Add API client to `utils/` if needed
3. Output to `outputs/fed/`
4. Integrate into LCI by loading CSV and adding to pillar
5. Update `run_all_analysis.sh`

### Adding New Pillar
1. Create new directory (e.g., `global/`)
2. Develop analysis scripts
3. Add 4th pillar to LCI
4. Recalibrate weights (e.g., 30/30/20/20)

### Web Dashboard (Potential)
- **Framework:** Flask or Dash
- **Data Source:** Read CSV outputs
- **Features:** Interactive charts, regime timeline, downloadable reports
- **Deployment:** Local server or cloud (AWS/GCP)

## Related Documentation
- **Architecture Diagrams:** (Could be added to `docs/assets/`)
- **API Documentation:** See individual component memories
- **Historical Evolution:** See `project_evolution_and_history.md` memory
