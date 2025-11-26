# Fiscal Analysis Component - Complete Documentation

## Component Overview
- **Script:** `fiscal/fiscal_analysis.py`
- **Purpose:** Monitor daily US Treasury cash flows to assess fiscal liquidity impact on markets
- **LCI Contribution:** 40% (largest single component)
- **Data Source:** Treasury Daily Statement (DTS) API
- **Output:** `outputs/fiscal/fiscal_analysis_full.csv`

## Core Concept: Fiscal Impulse

**Definition:** Fiscal Impulse = Total Government Spending - Total Taxation

**Economic Significance:**
- Positive impulse → Injects liquidity into private sector
- Negative impulse → Drains liquidity from private sector
- Direct impact on bank reserves and money market conditions

## Key Metrics Calculated

### 1. Total Impulse
- **Formula:** Total Spending - Total Taxes
- **Purpose:** Measure net cash flow between public and private sectors
- **Interpretation:** Primary driver of daily reserve changes

### 2. Household Impulse
- **Purpose:** Isolate flows to/from households
- **Use Case:** Understand consumer liquidity separately from corporate/financial sector

### 3. Treasury General Account (TGA) Balance
- **Inverse Indicator:** TGA decrease = liquidity injection, TGA increase = liquidity drain
- **Why Critical:** TGA drawdown can offset Fed QT
- **Monitoring:** End-of-day balance at Federal Reserve

### 4. Moving Averages
- **MA20 (20-day):** Smooth daily volatility, identify underlying trend
- **Purpose:** Filter noise from weekend gaps and irregular government operations
- **LCI Use:** MA20 of impulse feeds into Fiscal Liquidity Index

### 5. Comparative Metrics
- **Year-over-Year (YoY):** Distinguish seasonal patterns from policy changes
- **3-Year Baseline:** Normalize against anomalies (e.g., pandemic stimulus)
- **Purpose:** Context for "normal" vs "unusual" fiscal activity

## Methodology Details

### High-Frequency Analysis
- **Frequency:** Daily data (vs. traditional monthly/quarterly)
- **Advantage:** Captures real-time volatility and market impact
- **Challenge:** Weekend/holiday gaps require careful handling

### Fiscal Week Alignment
- **Definition:** Wednesday-to-Wednesday cycle
- **Reason:** Aligns with Treasury operational rhythm
- **Benefit:** Avoids weekend distortions in weekly aggregates

### GDP Estimation Model
- **Need:** Current GDP data unavailable for normalization
- **Solution:** Estimation model in script
- **Use:** Context for size of fiscal impulse (% of GDP)

## Technical Implementation

### API Integration
- **Source:** Treasury Daily Statement API
- **Pagination:** Script handles multi-page historical data retrieval
- **Fields Retrieved:**
  - Total receipts (taxes)
  - Total withdrawals (spending)
  - TGA balance
  - Granular categories (individual, corporate taxes, etc.)

### Fiscal Year Handling
- **US Fiscal Year:** October 1 - September 30
- **Challenge:** Different from calendar year
- **Solution:** Script logic correctly aligns fiscal year periods

### Missing Data Management
- **Weekends/Holidays:** No DTS publications
- **Strategy:** Forward fill last valid observation
- **Validation:** Cross-check with known holiday calendar

### Dependencies
- `fed/config.py` - Date range configuration
- `fed/utils/api_client.py` - May use shared components (though DTS has separate endpoint)
- Python libraries: `pandas`, `requests`, `numpy`

## Execution

```bash
source venv/bin/activate
python fiscal/fiscal_analysis.py
```

**Runtime:** ~30-60 seconds (depends on date range)
**Output:** Terminal report + CSV file

## Interpretation Guide

### Positive Fiscal Impulse
- **Meaning:** Government spending exceeds tax revenue
- **Market Impact:** Generally bullish for risk assets
- **Liquidity Effect:** Increases bank reserves
- **Example Scenario:** Large spending bill, tax refund season

### Negative Fiscal Impulse
- **Meaning:** Tax revenue exceeds government spending
- **Market Impact:** Generally bearish for risk assets
- **Liquidity Effect:** Decreases bank reserves
- **Example Scenario:** Tax collection dates (April 15, quarterly estimates)

### TGA Drawdown (Balance Decreasing)
- **Meaning:** Treasury spending down its Fed account
- **Effect:** EXPANSIVE - injects reserves into banking system
- **Strategic Importance:** Can offset Fed QT
- **Policy Tool:** Treasury can manage TGA tactically

### TGA Buildup (Balance Increasing)
- **Meaning:** Treasury accumulating cash at Fed
- **Effect:** RESTRICTIVE - drains reserves from banking system
- **Market Concern:** Compounds Fed QT impact

## Integration with LCI

### Contribution Details
- **Weight:** 40% of Liquidity Composite Index
- **Input Metric:** MA20 of Total Impulse
- **Normalization:** Z-score against historical distribution
- **Rationale for Weight:** Primary source of net liquidity creation

### Interaction with Other Components
- **With Monetary (35%):** TGA data used in Fed's Net Liquidity calculation
- **With Plumbing (25%):** Large fiscal flows can stress repo/settlement systems
- **Synergy:** Fiscal expansion + Fed QE = maximum liquidity

## Seasonal Patterns to Recognize

### April Tax Season
- **Pattern:** Surge in tax receipts → negative impulse
- **Duration:** Mid-April concentrated, extends through month
- **Market Impact:** Predictable liquidity drain

### Quarterly Tax Dates
- **Pattern:** Corporate estimated tax payments
- **Dates:** Jan 15, Apr 15, Jun 15, Sep 15
- **Impact:** Moderate negative impulse spikes

### End of Fiscal Year (September)
- **Pattern:** Departments rush to spend allocated budgets
- **Effect:** Often positive impulse surge
- **Implication:** Use 3-year baseline to identify true anomalies

## Historical Context and Use Cases

### Use Case 1: Monitoring Debt Ceiling Events
- **Application:** TGA drawdown accelerates as ceiling approaches
- **Signal:** Rapid TGA decline = forced fiscal expansion
- **Market Effect:** Liquidity injection despite political crisis

### Use Case 2: Assessing Policy Stance
- **Method:** Compare current MA20 impulse to 3-year baseline
- **Interpretation:** Above baseline = more expansive than "normal"
- **Context:** Essential during transition periods (post-stimulus normalization)

### Use Case 3: Reserve Management Forecasting
- **Combine:** Fiscal impulse + Fed operations forecast
- **Output:** Predict reserve level changes
- **Users:** Bank treasury departments, money market traders

## Limitations and Considerations

1. **Lag in GDP Data:** Estimates used for real-time normalization
2. **Extraordinary Events:** Pandemic-era data may skew baselines
3. **Policy Unpredictability:** Sudden legislation can cause structural breaks
4. **Accounting vs. Economic:** DTS reflects accounting flows, not economic impact timing

## File Locations
- **Script:** `/fiscal/fiscal_analysis.py`
- **Config:** `/fed/config.py` (date ranges)
- **Output:** `/outputs/fiscal/fiscal_analysis_full.csv`
- **Documentation:** `/docs/FISCAL_ANALYSIS.md`

## Related Components
- `fed/fed_liquidity.py` - Uses TGA data from this component
- `fed/liquidity_composite_index.py` - Consumes MA20 impulse for LCI calculation
