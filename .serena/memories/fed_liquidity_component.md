# Fed Liquidity Component - Complete Documentation

## Component Overview
- **Script:** `fed/fed_liquidity.py`
- **Purpose:** Monitor Federal Reserve balance sheet and calculate Net Liquidity
- **LCI Contribution:** 35% (Monetary Liquidity Index)
- **Data Sources:** FRED API (H.4.1 weekly + daily rates)
- **Output:** `outputs/fed/fed_liquidity_full.csv`

## Core Concept: Net Liquidity

**Definition:** Net Liquidity = Fed Total Assets - TGA Balance - RRP Usage

**Economic Rationale:**
- Fed Assets = Total "high-powered money" created
- TGA = Locked at Fed, not circulating in markets
- RRP = Parked at Fed by money markets, not actively deployed
- **Net Liquidity = Money actively available to financial system**

## Key Metrics Calculated

### 1. QE/QT Regime Detection
- **Method:** Rate of change in Total Assets over 3-6 month window
- **Classification:**
  - Expanding balance sheet → Quantitative Easing (QE)
  - Contracting balance sheet → Quantitative Tightening (QT)
- **Key Insight:** VELOCITY matters more than absolute level
- **Example:** Rapid QT can cause market stress (Sept 2019 repo crisis)

### 2. SOFR-IORB Spread
- **Components:**
  - SOFR: Secured Overnight Financing Rate (cost to borrow with Treasury collateral)
  - IORB: Interest on Reserve Balances (Fed pays banks on reserves)
- **Normal State:** SOFR ≈ IORB (tight spread)
- **Stress Signal:** SOFR > IORB and widening
- **Meaning:** Banks desperate for reserves, scarcity pricing
- **Historical Reference:** 2019 repo crisis saw 250+ bp spike

### 3. Reverse Repo Facility (RRP) Monitoring
- **High RRP Balance:** Excess liquidity in system
- **Declining RRP:** Liquidity being absorbed
- **Critical Threshold:** Rapid drop to zero = QT "biting"
- **Market Impact:** RRP cushion depletion increases volatility

### 4. Net Liquidity Trend
- **Calculation:** Total Assets - TGA - RRP
- **Direction:**
  - Increasing = Accommodative, bullish for risk assets
  - Decreasing = Restrictive, bearish for risk assets
- **Comparison:** Track vs. equity market indices for correlation

### 5. Yield Curve Dynamics
- **Monitored Spread:** 2s10s (2Y vs 10Y Treasury)
- **Liquidity Link:** Curve shape reflects liquidity expectations
- **Inversion:** Often precedes liquidity crunch/recession

### 6. Breakeven Inflation Expectations
- **Metric:** Market-implied inflation (TIPS spread)
- **Liquidity Link:** Excess liquidity → higher inflation expectations
- **Fed Response Function:** High breakevens may trigger faster QT

## Methodology Details

### Data Integration ("Mosaic Analysis")
- **Weekly Data:** Fed H.4.1 report (balance sheet, every Thursday)
- **Daily Data:** SOFR, IORB, RRP from FRED
- **Challenge:** Align different frequencies
- **Solution:** Forward fill weekly data, merge on date index

### NaN Handling (Critical Bug Fix - Commit e2b3945)
- **Problem:** NaN propagation in joins between daily/weekly data
- **Solution:** 
  - `dropna()` applied in `api_client.py` at data fetch
  - `ffill()` in main script to propagate last valid weekly values
- **Result:** Dense, aligned dataset for analysis

## Technical Implementation

### FRED API Integration
- **Client:** `FREDClient` in `fed/utils/api_client.py`
- **API Key:** Required in `fed/config.py`
- **Series Downloaded:**
  - WALCL: Total Fed Assets
  - WDTGAL: Treasury General Account
  - RRPONTSYD: Reverse Repo
  - SOFR: Secured Overnight Financing Rate
  - IORB: Interest on Reserve Balances
  - DGS2, DGS10: Treasury yields
  - T5YIE, T10YIE: Breakeven inflation

### TGA Data Dependency
- **Source:** Output from `fiscal/fiscal_analysis.py`
- **File:** `outputs/fiscal/fiscal_analysis_full.csv`
- **Requirement:** Fiscal analysis must run BEFORE fed liquidity
- **Field Used:** TGA balance column

### Calculation Pipeline
1. Fetch Fed balance sheet (weekly)
2. Fetch daily rates (SOFR, IORB)
3. Load TGA from fiscal output
4. Align all series to common daily index
5. Calculate Net Liquidity = Assets - TGA - RRP
6. Compute spreads and derivatives
7. Detect QE/QT regime from asset trend
8. Generate report and save CSV

## Execution

```bash
source venv/bin/activate
python fiscal/fiscal_analysis.py  # MUST run first for TGA data
python fed/fed_liquidity.py
```

**Prerequisites:** 
- FRED API key in config
- Fiscal analysis output exists

## Interpretation Guide

### Scenario 1: Rising Net Liquidity
- **Drivers:** QE active, TGA drawdown, RRP decline
- **Market Impact:** Risk-on, equity rally, credit spread tightening
- **Asset Allocation:** Overweight equities, underweight cash/bonds

### Scenario 2: Falling Net Liquidity
- **Drivers:** QT active, TGA buildup, RRP stable
- **Market Impact:** Risk-off, equity pressure, credit spread widening
- **Asset Allocation:** Underweight equities, overweight quality/cash

### Scenario 3: SOFR-IORB Spread Widening
- **Signal:** Financing market stress, reserve scarcity
- **Urgency:** CRITICAL early warning
- **Historical:** Preceded Sept 2019 repo crisis, March 2020 COVID crash
- **Fed Response:** Likely emergency repo operations or pause QT

### Scenario 4: RRP Near Zero During QT
- **Signal:** Liquidity cushion exhausted
- **Risk:** System vulnerable to shocks
- **Market Behavior:** Increased volatility, fragility
- **Policy Implication:** Fed may need to slow/stop QT

## Integration with LCI

### Contribution to Monetary Index (35% of LCI)
- **Input Metrics:**
  - Net Liquidity level and trend
  - RRP change (rate of decline)
  - SOFR spread (stress indicator)
- **Normalization:** Z-scores vs. historical mean/std
- **Aggregation:** Weighted combination into single Monetary Index

### Interaction with Other LCI Components
- **With Fiscal (40%):** TGA is shared metric, links policies
- **With Plumbing (25%):** SOFR stress confirms repo market issues
- **Holistic View:** Monetary policy sets aggregate liquidity, Plumbing shows distribution

## QE vs QT Regimes - Historical Context

### QE Periods (Balance Sheet Expansion)
- **2020-2022:** COVID response, massive asset purchases
- **Characteristics:**
  - High RRP (excess liquidity)
  - Compressed spreads
  - Low volatility
- **Market:** Secular bull run

### QT Periods (Balance Sheet Contraction)
- **2017-2019:** First QT attempt (ended with repo crisis)
- **2022-Present:** Current QT cycle
- **Characteristics:**
  - Declining RRP
  - Potential spread widening
  - Higher volatility risk
- **Market:** Increased correction risk

## Advanced Use Cases

### Use Case 1: Forecasting Fed Policy Pivots
- **Method:** Monitor Net Liquidity trajectory + SOFR spread
- **Trigger:** Rapid Net Liquidity decline + spread >25bp
- **Prediction:** Fed likely to pause QT
- **Trading:** Position for dovish pivot

### Use Case 2: Liquidity-Adjusted Equity Valuation
- **Concept:** Equity valuations inversely correlated with liquidity
- **Application:** Adjust target P/E ratios based on Net Liquidity Z-score
- **Formula:** Fair P/E = Base P/E + (Liquidity Z-score × Sensitivity)

### Use Case 3: Cross-Asset Arbitrage
- **Observation:** Net Liquidity divergence from credit spreads
- **Strategy:** If liquidity expanding but spreads widening → buy credit
- **Rationale:** Liquidity will eventually dominate fundamentals

## Limitations and Considerations

1. **Weekly H.4.1 Lag:** Balance sheet data released Thursdays, covers Wed
2. **Policy Shocks:** Unexpected Fed announcements can invalidate models
3. **FX Impact:** Global dollar liquidity not captured (only domestic)
4. **Correlation ≠ Causation:** Liquidity correlated with markets but not deterministic

## Related Files and Dependencies
- **Script:** `/fed/fed_liquidity.py`
- **Utilities:** 
  - `/fed/utils/api_client.py` (FREDClient)
  - `/fed/config.py` (API key, date ranges)
- **Input:** `/outputs/fiscal/fiscal_analysis_full.csv` (TGA data)
- **Output:** `/outputs/fed/fed_liquidity_full.csv`
- **Documentation:** `/docs/FED_LIQUIDITY.md`

## Key Code Patterns
- Data alignment using pandas DatetimeIndex
- Forward fill (`ffill()`) for weekly → daily interpolation
- Z-score normalization for regime classification
- Defensive NaN handling to prevent calculation errors
