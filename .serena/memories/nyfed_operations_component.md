# NY Fed Operations Component - Complete Documentation

## Component Overview
- **Scripts:** 
  - `fed/nyfed_operations.py` (Repo/RRP operations)
  - `fed/nyfed_reference_rates.py` (Money market rates)
- **Purpose:** Monitor NY Fed market operations and reference rates
- **LCI Contribution:** 60% of Market Plumbing Index (15% of total LCI)
- **Data Source:** NY Fed Markets Data API
- **Outputs:** 
  - `outputs/fed/nyfed_repo_ops.csv`
  - `outputs/fed/nyfed_rrp_ops.csv`
  - `outputs/fed/nyfed_reference_rates.csv`

## Core Facilities Monitored

### Standing Repo Facility (SRF)
- **Function:** Emergency liquidity backstop for banks
- **Mechanism:** Banks exchange Treasury collateral for cash
- **Normal State:** Minimal to zero usage
- **Stress Signal:** Elevated usage indicates cash shortage
- **Historical:** Created after Sept 2019 repo crisis

### Reverse Repo Program (RRP)
- **Function:** Absorb excess cash from money markets
- **Mechanism:** Money market funds park cash at Fed, receive Treasury collateral
- **Normal State:** High usage = excess liquidity in system
- **Stress Signal:** Rapid decline = liquidity being deployed/exhausted
- **Policy Role:** Establishes floor for short-term rates

## Key Metric: Submission Ratio

### Definition
**Submission Ratio = Total Amount Submitted / Operation Limit**

### Interpretation
- **< 0.5:** Low demand, ample liquidity
- **0.5 - 0.8:** Moderate demand, watch carefully
- **0.8 - 1.0:** High demand, stress building
- **> 1.0:** Demand exceeds capacity, SEVERE STRESS

### Why It Matters
- **Early Warning:** More sensitive than absolute usage
- **Pre-Crisis Indicator:** Elevated ratio precedes crises
- **Historical Example:** Sept 2019 spike to 10%+ → Fed emergency intervention

### Implementation in Script
```python
submission_ratio = totalAmtSubmitted / operationLimit
```
- Calculated daily for each repo operation
- Aggregated if multiple operations same day
- Moving averages (MA5, MA20) smooth volatility

## Reference Rates Monitored

### 1. SOFR (Secured Overnight Financing Rate)
- **Definition:** Cost to borrow overnight with Treasury collateral
- **Importance:** Benchmark replacing LIBOR
- **Usage:** Most liquid secured rate
- **Normal Range:** Close to IORB

### 2. BGCR (Broad General Collateral Rate)
- **Definition:** Weighted median of GC repo transactions
- **Scope:** Broader than SOFR (includes more collateral types)
- **Relationship:** SOFR usually slightly higher than BGCR

### 3. TGCR (Tri-Party General Collateral Rate)
- **Definition:** Rate for tri-party repo market
- **Scope:** Subset of BGCR
- **Infrastructure:** Tri-party = BNY/JPM as clearing agents

### 4. EFFR (Effective Federal Funds Rate)
- **Definition:** Weighted average of unsecured interbank lending
- **Policy Link:** Target rate for Fed policy
- **Comparison:** SOFR vs EFFR spread shows secured/unsecured basis

### 5. OBFR (Overnight Bank Funding Rate)
- **Definition:** Weighted average of overnight borrowing by banks
- **Scope:** Fed funds + Eurodollar
- **Broader Than:** EFFR (includes foreign banks)

## Key Spreads and Signals

### SOFR - BGCR Spread
- **Normal:** ~2-5 basis points
- **Widening:** Treasury scarcity (SOFR specific securities)
- **Trading Signal:** GC vs special repo arbitrage

### SOFR - IORB Spread (Critical - Also in fed_liquidity.py)
- **Normal:** -5 to +5 bp
- **Stress:** >10 bp positive
- **Severe Stress:** >25 bp positive
- **Meaning:** Banks willing to pay premium over IORB floor = reserve scarcity

### EFFR - SOFR Spread (Secured vs Unsecured)
- **Normal:** EFFR slightly above SOFR (unsecured premium)
- **Inverted (SOFR > EFFR):** Collateral shortage overwhelming credit risk
- **Rare Event:** Seen during acute stress

## Data Collection and Processing

### NY Fed API Integration
- **Client:** `NYFedClient` in `fed/utils/api_client.py`
- **Endpoints:**
  - `/markets/repo/data/repo-operations.json`
  - `/markets/repo/data/rrp-operations.json`
  - `/markets/reference-rates/data/rates.json`
- **Authentication:** Public API, no key required
- **Rate Limit:** Respect NY Fed guidelines

### Daily Aggregation Logic
- **Challenge:** Multiple operations can occur same day
- **Solution:** `groupby('date')` with appropriate aggregation
  - Numeric fields (amounts): SUM
  - String fields (operation type): FIRST
- **Code Pattern:**
```python
df_agg = df.groupby('date').agg({
    'totalAmtAccepted': 'sum',
    'totalAmtSubmitted': 'sum',
    'operationLimit': 'first'  # same for all ops in day
})
```

### Moving Averages Calculation
- **MA5:** 5-day moving average for tactical signals
- **MA20:** 20-day moving average for strategic trend
- **Applied To:** 
  - Repo accepted amounts
  - Submission ratios
  - RRP balances

## Execution

```bash
source venv/bin/activate
python fed/nyfed_operations.py
python fed/nyfed_reference_rates.py
```

**Runtime:** ~10-30 seconds each
**Dependencies:** None (can run independently)

## Interpretation Patterns

### Pattern 1: End-of-Period Dynamics
- **Observation:** Spike in repo usage on month/quarter-end
- **Cause:** Bank regulatory reporting (balance sheet window dressing)
- **Action:** DO NOT interpret as systemic stress
- **Differentiation:** Returns to normal within 2-3 days

### Pattern 2: Sustained Submission Ratio Increase
- **Observation:** Submission ratio trending up over 2+ weeks
- **Meaning:** Structural liquidity tightening
- **Confirmation:** Check if RRP declining simultaneously
- **Action:** Raise alert, monitor Fed communications

### Pattern 3: RRP Rapid Decline
- **Dual Interpretation:**
  - **Positive:** Cash being deployed to higher-yielding assets (risk-on)
  - **Negative:** Liquidity cushion depleting (risk-off brewing)
- **Disambiguate:** Check equity markets and credit spreads
  - If markets up → positive interpretation
  - If markets stressed → negative interpretation

### Pattern 4: Early Warning Combination
- **Signal Set:**
  1. Submission ratio >0.7
  2. RRP down >$200B in 2 weeks
  3. SOFR-IORB spread >15bp
- **Meaning:** SEVERE STRESS developing
- **Historical:** This combination preceded 2019 crisis
- **Action:** Expect Fed intervention (emergency repo, pause QT)

## Integration with LCI

### Contribution to Plumbing Index
- **Weight:** 60% of Market Plumbing component
- **Metrics Used:**
  - Submission ratio (primary)
  - MA5/MA20 of repo accepted
  - Repo change (daily delta)
- **Normalization:** Z-score against historical distribution
- **Complementary:** Combined with 40% from settlement fails

### Why 60% Weight?
- **Frequency:** Daily data (more responsive than weekly fails)
- **Direct Policy Link:** Fed facility usage = direct measure
- **Leading Indicator:** Submission ratio leads settlement fails
- **Rationale:** Repo stress (cash) emerges before settlement stress (collateral)

## Use Cases

### Use Case 1: Money Market Fund Strategy
- **Application:** Determine allocation between RRP and private repo
- **Method:** Monitor RRP rate vs. repo rates spread
- **Decision:** If private repo offers >5bp over RRP → shift allocation

### Use Case 2: Bank Treasury Management
- **Application:** Forecast intraday liquidity needs
- **Method:** Track submission ratio trend + quarter-end calendar
- **Action:** Pre-position reserves before predictable stress dates

### Use Case 3: Macro Hedge Fund Positioning
- **Application:** Time entry/exit of leveraged trades
- **Method:** Submission ratio as financing cost proxy
- **Strategy:** De-lever when ratio >0.8, re-lever when <0.3

## Refactoring History (Important for Understanding Code)

### Phase 1 Refactoring (Commit 93586e51)
- **File:** `nyfed_reference_rates.py`
- **Change:** -40% LOC by using `api_client.py` utilities
- **Pattern:** Extraction of API fetch logic to shared client

### Phase 2 Refactoring (Commit 65f9f664)
- **File:** `nyfed_operations.py`
- **Change:** -43% LOC by using `ReportGenerator`
- **Pattern:** Standardized output formatting
- **New Feature:** Added `submission_ratio` calculation (critical metric)

### Bug Fix (Aggregation Logic)
- **Issue:** Multiple operations same day not properly consolidated
- **Fix:** Implemented proper `groupby` with numeric sum, string first
- **Impact:** Accurate daily metrics even with intraday operations

## Seasonal and Calendar Effects

### Known Pressure Dates (Not Stress)
- **Month-End:** T, T+1 (last day of month, next day)
- **Quarter-End:** T, T+1, T+2 (3-day effect)
- **Year-End:** T-5 to T+3 (longest effect, 8 days)
- **Tax Dates:** April 15, quarterly corporate dates

### True Stress Indicators
- **Duration:** Persists beyond calendar effects (>5 days)
- **Breadth:** Multiple metrics elevated (ratio + spreads + fails)
- **Fed Response:** Fed communications acknowledge tightness

## Technical Details

### Data Structures
- **Pandas DataFrame:** Primary structure for all time series
- **DatetimeIndex:** Ensures proper time alignment
- **Column Naming:** Standardized across all scripts
  - `date` - index
  - `totalAmtAccepted` - operation amount
  - `submission_ratio` - calculated metric
  - `MA5_*`, `MA20_*` - moving averages

### Error Handling
- **Missing Data:** Forward fill if gaps <5 days
- **API Errors:** Retry logic with exponential backoff (in api_client)
- **Data Validation:** Check for negative amounts, impossible ratios

## Related Components
- **Complement:** `fed/nyfed_settlement_fails.py` (other 40% of Plumbing)
- **Shared Metric:** SOFR also used in `fed/fed_liquidity.py`
- **Consumer:** `fed/liquidity_composite_index.py` aggregates into LCI
- **Utility:** `fed/utils/api_client.py` (NYFedClient class)

## File Locations
- **Scripts:** 
  - `/fed/nyfed_operations.py`
  - `/fed/nyfed_reference_rates.py`
- **Utilities:** `/fed/utils/api_client.py`
- **Outputs:** `/outputs/fed/nyfed_repo_ops.csv`, etc.
- **Documentation:** `/docs/NY_FED_OPERATIONS.md`
