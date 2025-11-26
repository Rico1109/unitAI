# Settlement Fails Component - Complete Documentation

## Component Overview
- **Script:** `fed/nyfed_settlement_fails.py`
- **Purpose:** Monitor Treasury settlement failures as collateral scarcity indicator
- **LCI Contribution:** 40% of Market Plumbing Index (10% of total LCI)
- **Data Source:** NY Fed Primary Dealer Statistics API
- **Output:** `outputs/fed/nyfed_settlement_fails.csv`
- **Historical Depth:** January 2022 to present (202+ weeks)

## Core Concept: Settlement Fails

### Definition
- **Fail to Deliver (FTD):** Seller cannot deliver Treasury security at settlement
- **Fail to Receive (FTR):** Buyer cannot receive expected Treasury delivery
- **Total Fails:** Aggregate of FTD + FTR across all Treasury types and maturities

### Economic Significance
- **Root Cause:** Collateral scarcity (specific security hard to source)
- **Market Context:** Intense short-selling, high repo demand, or Fed QE absorbing supply
- **Stress Indicator:** Large/sustained fails = market plumbing dysfunction

### Why Primary Dealers?
- **Market Makers:** 24 firms authorized to trade directly with NY Fed
- **Central Role:** Heart of Treasury market, handle bulk of volume
- **Data Quality:** Most reliable, granular, and timely fails data
- **Systemic Importance:** If dealers can't settle, market is truly stressed

## Data Structure: 22 Time Series

### Coverage by Maturity
1. **2-Year Nominal**
2. **3-Year Nominal**
3. **5-Year Nominal**
4. **7-Year Nominal**
5. **10-Year Nominal**
6. **20-Year Nominal**
7. **30-Year Nominal**

### Coverage by Type
- **Nominal Treasuries** (standard coupon bonds)
- **Floating Rate Notes (FRN)** (2-year maturity)
- **Treasury Inflation-Protected Securities (TIPS)** (various maturities)

### Series Nomenclature in API
- **Format:** `PDFTS_TD_<TYPE>_<MATURITY>`
- **Example:** `PDFTS_TD_NOMINAL_2YR` (2Y Nominal Treasury Fails to Deliver)
- **Components:** 
  - `TD` = Total Delivers (FTD)
  - `TR` = Total Receives (FTR)

### Aggregation Strategy
- **Method:** Sum all 22 series into single "Total Fails" metric
- **Rationale:** System-wide view more important than maturity-specific
- **Granularity:** Individual series preserved in output for drill-down analysis

## Key Metrics Calculated

### 1. Total Fails
- **Formula:** Sum(FTD + FTR) across all 22 series
- **Units:** Billions of dollars (par value)
- **Typical Range:** $2B - $15B
- **Interpretation:** Primary indicator of collateral scarcity

### 2. Stress Thresholds
- **Normal:** < $5B
- **Elevated:** $5B - $10B (yellow flag)
- **Severe:** > $10B (red flag)
- **Extreme:** > $20B (crisis level, rare)

### 3. Moving Averages
- **MA5:** 5-week moving average (tactical)
- **MA20:** 20-week moving average (strategic)
- **Purpose:** Filter weekly volatility, identify trend

### 4. Z-Score
- **Formula:** (Current - Mean) / Std Dev
- **Purpose:** Statistical measure of anomaly
- **Interpretation:**
  - Z < 1: Normal
  - 1 < Z < 2: Elevated
  - Z > 2: Statistically significant stress (97.5th percentile)
  - Z > 3: Extreme event

## Technical Implementation

### Multi-Series API Fetch
- **Challenge:** 22 separate API calls required
- **Implementation:** Loop through series list
- **Code Pattern:**
```python
series_list = [
    'PDFTS_TD_NOMINAL_2YR', 'PDFTS_TR_NOMINAL_2YR',
    'PDFTS_TD_NOMINAL_3YR', 'PDFTS_TR_NOMINAL_3YR',
    # ... 18 more
]
for series in series_list:
    data = nyfed_client.fetch(series)
    all_data.append(data)
```

### Suppressed Data Handling
- **Issue:** API returns `*` for suppressed values (confidentiality)
- **Frequency:** Rare but occurs in low-volume series
- **Solution:** Convert `*` to `NaN` during parsing
- **Impact:** Robust calculation even with missing data
- **Code:**
```python
value = np.nan if value == '*' else float(value)
```

### Data Frequency and Lag
- **Frequency:** Weekly (published Thursdays)
- **Lag:** 1 week (data for week ending previous Wednesday)
- **Implication:** Slightly delayed vs. daily repo data
- **Comparison:** Less timely than submission ratio, more timely than monthly reports

## Execution

```bash
source venv/bin/activate
python fed/nyfed_settlement_fails.py
```

**Runtime:** ~60-90 seconds (22 API calls)
**Dependencies:** None (standalone)

## Interpretation Guide

### Scenario 1: Fails Spike > $10B
- **Check:** Is it quarter-end? (predictable spike)
- **If YES:** Monitor next week; should normalize
- **If NO:** 
  - Check Z-score (>2 confirms statistical anomaly)
  - Check submission ratio (confirms liquidity stress)
  - Check SOFR spread (confirms financing stress)
- **Action:** If all 3 elevated → SEVERE stress signal

### Scenario 2: Fails Sustained Above $7B for 4+ Weeks
- **Meaning:** Structural collateral scarcity
- **Causes:**
  - Fed QE absorbing float
  - Heavy short interest in specific issues
  - Regulatory demand for HQLA (High Quality Liquid Assets)
- **Market Impact:** Upward pressure on Treasury prices (scarcity premium)
- **Trading:** Long Treasury basis trade opportunity

### Scenario 3: Fails Concentrated in One Maturity
- **Detection:** Drill down into 22 series
- **Meaning:** Specific issue is "on special" in repo
- **Example:** 10Y fails spike = 10Y note squeezed
- **Repo Implication:** 10Y repo rate << GC repo rate
- **Trading:** Reverse repo on-the-run 10Y

### Scenario 4: Fails Declining Despite QT
- **Interpretation:** Collateral becoming more available
- **Possible Causes:**
  - Lower repo demand (risk-off)
  - Fed slowing QT pace
  - Decreased short selling
- **Market Impact:** Bearish for Treasuries (less scarcity premium)

## Historical Context and Patterns

### COVID Crisis (March 2020)
- **Peak Fails:** > $30B
- **Duration:** 2 weeks
- **Cause:** Violent unwind of leveraged positions + settlement disruptions
- **Fed Response:** Massive QE + emergency repo operations
- **Lesson:** Extreme fails = systemic breakdown

### 2008 Financial Crisis
- **Peak Fails:** > $100B (unprecedented)
- **Duration:** Months
- **Cause:** Lehman bankruptcy + frozen markets
- **Fed Response:** TARP, QE1, emergency lending facilities
- **Lesson:** Fails can signal core financial system failure

### "Normal" QT Periods (2018-2019, 2023-present)
- **Typical Range:** $3B - $8B
- **Pattern:** Gradual uptrend as QT progresses
- **Seasonal Spikes:** Quarter-ends ($10-15B briefly)
- **Concern Level:** Monitor for sustained breaks above $10B

## Seasonal Patterns to Recognize

### Quarter-End (Last Wednesday of Mar/Jun/Sep/Dec)
- **Pattern:** Spike to $10-15B
- **Duration:** 1 week (normalizes next week)
- **Cause:** Balance sheet window dressing, regulatory reporting
- **Action:** Ignore unless persists into 2nd week

### Year-End (December)
- **Pattern:** Largest spike, can reach $20B
- **Duration:** 2-3 weeks
- **Cause:** Strongest calendar effect
- **Action:** Use Z-score (vs. seasonal baseline) for true stress

## Integration with LCI

### Contribution to Plumbing Index
- **Weight:** 40% of Market Plumbing component
- **Metrics Used:**
  - Total Fails level
  - MA20 Total Fails (trend)
  - Z-score (anomaly detection)
- **Normalization:** Z-score inherently normalized
- **Complementary:** Combined with 60% from repo submission ratio

### Why 40% Weight (vs. 60% for Repo)?
- **Frequency:** Weekly vs. daily (less responsive)
- **Lag:** 1 week lag vs. real-time repo
- **Nature:** Consequence vs. cause (fails result from stress)
- **Rationale:** Confirms repo signals but secondary in timing

### Interaction with Other LCI Components
- **With Repo (Plumbing 60%):** Dual confirmation
  - Repo stress (cash scarcity) often precedes fails (collateral scarcity)
  - Both elevated = severe plumbing breakdown
- **With Fed Liquidity (Monetary 35%):** Causation link
  - Fed QE → absorbs collateral → higher fails
  - Fed QT → releases collateral → lower fails (with lag)
- **With Fiscal (40%):** Indirect
  - Large Treasury issuance can temporarily ease fails (more supply)

## Use Cases

### Use Case 1: Treasury Basis Trade Signal
- **Application:** Identify on-the-run securities trading special
- **Method:** Detect maturity-specific fails spike
- **Trade:** Buy cash Treasury, sell futures (basis compression)
- **Risk:** Fails persist longer than expected

### Use Case 2: Fed Policy Pivot Forecasting
- **Application:** Predict when Fed will slow/pause QT
- **Method:** Track fails trend during QT
- **Trigger:** Sustained fails >$12B + other stress indicators
- **Outcome:** Fed likely to adjust QT pace to ease collateral shortage

### Use Case 3: Risk-Off Signal Confirmation
- **Application:** Validate market stress readings
- **Method:** Combine fails with VIX, credit spreads
- **Signal:** Fails >$10B + VIX >25 + spreads widening = confirmed stress
- **Action:** De-risk portfolio, increase hedges

## Limitations and Considerations

1. **Weekly Lag:** Less timely than daily repo data
2. **Seasonal Noise:** Requires careful baseline adjustment
3. **Primary Dealer Focus:** Doesn't capture inter-dealer fails
4. **Suppressed Data:** Some series occasionally withheld (rare)
5. **Correlation vs Causation:** Fails symptom, not root cause

## Discovery and Integration (Historical Note)

### Original Discovery (Commit bf3e0ea)
- **Challenge:** NY Fed API endpoints not well-documented
- **Process:** Manual exploration of Primary Dealer Statistics
- **Breakthrough:** Found 22 separate series for fails data
- **Documentation:** `SETTLEMENT_FAILS_SUCCESS.md` chronicles discovery
- **Impact:** Completed Market Plumbing pillar of LCI

### API Endpoint Discovery
- **Base URL:** `https://markets.newyorkfed.org/api/pd/`
- **Series Format:** `get/PDFTS_TD_NOMINAL_2YR.json`
- **Parameters:** `startDate`, `endDate`
- **Authentication:** None (public API)

## Related Components
- **Complement:** `fed/nyfed_operations.py` (other 60% of Plumbing)
- **Consumer:** `fed/liquidity_composite_index.py` (aggregates into LCI)
- **Utility:** `fed/utils/api_client.py` (fetch_settlement_fails method)
- **Documentation:** 
  - `/docs/SETTLEMENT_FAILS.md` (methodology)
  - `/docs/dev/SETTLEMENT_FAILS_SUCCESS.md` (discovery story)

## File Locations
- **Script:** `/fed/nyfed_settlement_fails.py`
- **Output:** `/outputs/fed/nyfed_settlement_fails.csv`
- **Docs:** `/docs/SETTLEMENT_FAILS.md`
- **Historical:** `/docs/dev/SETTLEMENT_FAILS_SUCCESS.md`
