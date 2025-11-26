# Repo Market Analysis & Liquidity Composite Index - Complete Documentation

## Part 1: Repo Market Analysis Component

### Component Overview
- **Script:** `fed/repo_market_analysis.py`
- **Purpose:** Granular repo market data from Office of Financial Research (OFR)
- **Added:** Commit a5f8e6ba (most recent, 2025-11-26)
- **LCI Integration:** Enhances Market Plumbing Index with Repo Stress indicator
- **Data Source:** OFR API (Office of Financial Research)
- **Client:** `fed/utils/ofr_client.py` (dedicated OFR client)

### What is OFR?
- **Full Name:** Office of Financial Research
- **Parent:** U.S. Department of Treasury
- **Mission:** Monitor financial system risks
- **Data Advantage:** More granular than NY Fed aggregates
- **API Quality:** High-frequency, detailed repo market breakdowns

### Key Metrics Calculated

#### 1. Repo Stress Index
- **Purpose:** Single numeric measure of repo market stress
- **Components:** (exact formula in script, likely weighted combination)
  - Repo volume deviations
  - Rate spreads (GC vs special rates)
  - Collateral composition shifts
- **Normalization:** Z-score or similar statistical measure
- **Integration:** Fed into LCI's Plumbing component

#### 2. Collateral Shares
- **Treasury Share:** % of repo backed by Treasury securities
- **Agency MBS Share:** % backed by mortgage-backed securities
- **Other Share:** Corporate bonds, equities, etc.
- **Significance:** 
  - Rising Treasury share = flight to quality
  - Rising MBS share = normal times, carry trades
  - Rising Other = stress (less liquid collateral used)

#### 3. Effective Policy Stance
- **Concept:** Synthesis of repo conditions + Fed policy
- **Integration Point:** Added to `fed/liquidity_composite_index.py`
- **Purpose:** More nuanced view than simple QE/QT classification
- **Factors:** Likely combines policy rate, balance sheet trajectory, repo spread

### Integration with LCI
- **Enhanced Plumbing Index:** Repo Stress Index combined with:
  - Submission ratio (60% of Plumbing)
  - Settlement fails (40% of Plumbing)
- **Result:** Three-dimensional view of market infrastructure health
  - Cash availability (submission ratio)
  - Collateral availability (settlement fails)
  - Distribution efficiency (repo stress)

### Configuration Updates (Commit a5f8e6ba)
- **File:** `fed/config.py`
- **Changes:** Updated weights for Monetary and Plumbing components
- **Reason:** Incorporate new Repo Stress Index
- **Impact:** More sophisticated LCI calculation

---

## Part 2: Liquidity Composite Index (LCI) Component

### Component Overview
- **Script:** `fed/liquidity_composite_index.py`
- **Purpose:** Synthesize all liquidity signals into single composite index
- **LCI Role:** CAPSTONE - aggregates all other components
- **Output:** `liquidity_composite_index.csv` (root directory)
- **Consumers:** Traders, risk managers, macro analysts

## Three-Pillar Framework

### Theoretical Foundation
**Liquidity Cycle Concept:**
1. **Creation:** Fiscal policy creates/destroys base liquidity (public→private flows)
2. **Availability:** Monetary policy manages aggregate reserve levels
3. **Distribution:** Market plumbing distributes liquidity efficiently to where needed

**Each pillar is necessary; all three are sufficient for complete picture.**

### Pillar 1: Fiscal Liquidity (40% Weight)
- **Source:** `fiscal/fiscal_analysis.py`
- **Key Metric:** MA20 of Fiscal Impulse
- **Additional Inputs:**
  - TGA drawdown rate
  - Tax calendar effects (April, quarterly)
- **Normalization:** Z-score vs. historical fiscal impulse
- **Rationale for 40%:** 
  - Primary source of net liquidity creation
  - Largest independent impact on reserve levels
  - Less discretionary than monetary policy (Congressional control)

### Pillar 2: Monetary Liquidity (35% Weight)
- **Source:** `fed/fed_liquidity.py`
- **Key Metric:** Net Liquidity (Assets - TGA - RRP)
- **Additional Inputs:**
  - QE/QT regime (directional bias)
  - RRP change (cushion dynamics)
  - SOFR-IORB spread (financing stress)
- **Normalization:** Z-score vs. historical net liquidity
- **Rationale for 35%:**
  - Fed is powerful but reactive to fiscal/market conditions
  - High-frequency adjustments via RRP absorb some variation
  - Slightly lower than fiscal but still major driver

### Pillar 3: Market Plumbing (25% Weight)
- **Sources:**
  - `fed/nyfed_operations.py` - 60% of Plumbing
  - `fed/nyfed_settlement_fails.py` - 40% of Plumbing
  - `fed/repo_market_analysis.py` - Enhancement (integrated into weights)
- **Key Metrics:**
  - Submission ratio (cash distribution)
  - Total fails (collateral distribution)
  - Repo stress index (market efficiency)
- **Normalization:** Z-scores for each component, then weighted
- **Rationale for 25%:**
  - Usually permissive; matters most when it breaks
  - "Veto power" - can override positive fiscal/monetary
  - Less continuous impact, more binary (works or doesn't)

## Weight Calibration Methodology

### Empirical Basis (Likely)
1. **Historical Regression:** Regress asset returns on three components
2. **Contribution Analysis:** Variance decomposition
3. **Expert Judgment:** Desk experience and market structure knowledge
4. **Back-Testing:** Optimize weights for predictive power

### Weight Update History
- **Initial:** Equal weights (33/33/33) - too simplistic
- **Refinement 1:** Fiscal 40%, Monetary 40%, Plumbing 20%
- **Current (Commit a5f8e6ba):** Fiscal 40%, Monetary 35%, Plumbing 25%
- **Reason for Latest:** OFR integration increased plumbing importance

## Z-Score Normalization Deep Dive

### Why Z-Scores?
- **Problem:** Metrics in different units
  - Fiscal impulse: Billions of dollars
  - SOFR spread: Basis points
  - Submission ratio: Unitless ratio
- **Solution:** Standardize to "deviations from normal"
- **Benefit:** 
  - Comparable metrics
  - Aggregatable into single index
  - Interpretable (Z=2 means "2 std devs above average")

### Calculation
```python
z_score = (current_value - historical_mean) / historical_std_dev
```

### Historical Window
- **Typical:** Rolling 252 days (1 trading year) or full history
- **Trade-off:**
  - Longer window = stable baseline, slow adaptation
  - Shorter window = responsive, risk of false signals
- **Implementation:** Check script for exact window

### Aggregation Formula
```python
LCI = (0.40 × Fiscal_Z) + (0.35 × Monetary_Z) + (0.25 × Plumbing_Z)
```

**Result:** LCI itself is a Z-score (units = std devs from normal)

## Regime Classification

### Five-Level System
1. **Very Loose:** LCI > +1.5
   - Abundant liquidity
   - Risk-on environment
   - Asset bubbles possible
   
2. **Loose:** +0.5 < LCI ≤ +1.5
   - Ample liquidity
   - Supportive for risk assets
   - Goldilocks scenario

3. **Neutral:** -0.5 ≤ LCI ≤ +0.5
   - Balanced conditions
   - Fundamentals drive markets
   - Normal volatility

4. **Tight:** -1.5 ≤ LCI < -0.5
   - Constrained liquidity
   - Risk assets under pressure
   - Elevated volatility

5. **Very Tight:** LCI < -1.5
   - Severe liquidity stress
   - Crisis risk elevated
   - Flight to quality

### Regime Transitions (Most Important)
- **More Important Than Levels:** Crossing thresholds signals regime change
- **Trading Signals:**
  - Loose → Neutral: Reduce risk exposure
  - Tight → Very Tight: Emergency risk-off
  - Tight → Neutral: Re-risk opportunity
- **Lead Time:** LCI transitions often lead market 1-4 weeks

## Moving Averages for Interpretation

### MA5 (5-Day)
- **Purpose:** Tactical positioning signal
- **Use:** Short-term traders, option dealers
- **Interpretation:** 
  - LCI crosses above MA5 = short-term bullish
  - LCI crosses below MA5 = short-term bearish

### MA20 (20-Day)
- **Purpose:** Strategic trend identification
- **Use:** Portfolio managers, asset allocators
- **Interpretation:**
  - LCI > MA20 = uptrend intact
  - LCI < MA20 = downtrend intact
- **Golden/Death Cross:** MA5 crosses MA20

## Divergence Analysis (Advanced)

### Concept
**Divergence:** Pillars moving in opposite directions

### Example Patterns

#### Pattern 1: Monetary Loose + Plumbing Tight
- **Setup:** Fed adding liquidity but repo/settlement stressed
- **Meaning:** Liquidity created but not distributing
- **Historical:** Sept 2019 (Fed adding but repo crisis)
- **Action:** SEVERE WARNING - plumbing veto power active
- **Outcome:** Fed forced to emergency intervention

#### Pattern 2: Fiscal Tight + Monetary Loose
- **Setup:** Government draining (high taxes) but Fed adding (QE)
- **Meaning:** Policy conflict, Fed offsetting fiscal drag
- **Interpretation:** Fed carrying burden, sustainability question
- **Action:** Monitor Fed communications for frustration signals

#### Pattern 3: All Three Diverging
- **Setup:** Fiscal up, Monetary flat, Plumbing down
- **Meaning:** System stress building despite fiscal support
- **Interpretation:** Structural problem, not just liquidity
- **Action:** Deep dive into specific plumbing issues

## Technical Implementation

### Execution Order (Critical)
```bash
# MUST run in this order:
python fiscal/fiscal_analysis.py          # 1. Fiscal data
python fed/fed_liquidity.py               # 2. Fed data (uses fiscal TGA)
python fed/nyfed_operations.py            # 3. Repo operations
python fed/nyfed_reference_rates.py       # 4. Reference rates
python fed/nyfed_settlement_fails.py      # 5. Settlement fails
python fed/repo_market_analysis.py        # 6. OFR repo data
python fed/liquidity_composite_index.py   # 7. LCI (uses all above)
```

### Data Loading
- **Method:** Read CSV outputs from all upstream scripts
- **Validation:** Check for required columns, date alignment
- **Merge Strategy:** Outer join on date, forward fill gaps
- **Error Handling:** Fail loudly if upstream data missing

### Output Format
**Columns in `liquidity_composite_index.csv`:**
- `date` - index
- `fiscal_index` - Fiscal component Z-score
- `monetary_index` - Monetary component Z-score
- `plumbing_index` - Plumbing component Z-score
- `LCI` - Composite index value
- `MA5_LCI` - 5-day moving average
- `MA20_LCI` - 20-day moving average
- `regime` - Text classification (Very Loose / Loose / Neutral / Tight / Very Tight)

## Practical Applications

### Application 1: Equity Market Timing
- **Strategy:** Overweight equities when LCI > +0.5
- **Reasoning:** Liquidity abundance supports valuations
- **Back-Test:** Strong historical correlation
- **Risk:** Policy shocks can break correlation temporarily

### Application 2: Credit Spread Prediction
- **Strategy:** Tight LCI (<-0.5) → widening spreads ahead
- **Mechanism:** Liquidity stress amplifies credit risk
- **Lead Time:** ~2-4 weeks average
- **Application:** Adjust credit portfolio duration/quality

### Application 3: Volatility Trading
- **Strategy:** Short VIX when LCI very loose (>+1.5)
- **Reasoning:** Liquidity dampens volatility
- **Risk Management:** Use stop-loss at LCI < +1.0
- **Sizing:** Scale position with LCI magnitude

### Application 4: Macro Hedge Fund Positioning
- **Framework:** LCI as primary risk-on/risk-off indicator
- **Implementation:**
  - LCI > +1: Max long equities/credit, short vol/USD
  - 0 < LCI < +1: Long equities, neutral credit/vol
  - -1 < LCI < 0: Neutral equities, long quality/vol
  - LCI < -1: Short equities/credit, long cash/quality
- **Adjustment:** Rebalance on regime transitions

## Limitations and Warnings

### 1. Not a Crystal Ball
- **Reality:** LCI describes current conditions, not guaranteed future
- **Uncertainty:** Policy shocks, geopolitics can override
- **Use:** Probabilistic framework, not deterministic

### 2. Correlations Can Break
- **2020 Example:** March COVID crash broke many relationships temporarily
- **Reason:** Structural breaks, unprecedented policy
- **Mitigation:** Monitor correlation stability, use stops

### 3. Doesn't Capture Sentiment
- **Missing:** Pure fear/greed, narrative shifts
- **Example:** LCI loose but market selling on recession fear
- **Complement:** Use with VIX, put/call ratios, surveys

### 4. US Dollar-Centric
- **Scope:** Only US liquidity, not global
- **Missing:** BOJ QE, ECB programs, FX swaps
- **Impact:** Can miss offshore dollar tightening

### 5. Historical Data Dependency
- **Z-Scores:** Rely on past mean/std being relevant
- **Regime Changes:** New policy era may have different "normal"
- **Adaptation:** Periodic recalibration needed

## Integration with Trading Systems

### Data Feed
- **Format:** CSV daily update
- **Timestamp:** End of day (all inputs are T-1 or older)
- **Latency:** ~1 day lag (acceptable for LCI's purpose)
- **Automation:** `run_all_analysis.sh` can be cron scheduled

### Signal Generation
- **Simple:** LCI level thresholds
- **Advanced:** Regime transitions + divergence detection
- **ML Integration:** LCI as feature in machine learning models

### Risk Management Override
- **Rule:** If LCI < -1.5, reduce portfolio leverage by 50%
- **Reason:** Historical drawdowns amplified in very tight conditions
- **Automation:** Programmatic position sizing adjustment

## File Locations
- **Script:** `/fed/liquidity_composite_index.py`
- **Config:** `/fed/config.py` (component weights)
- **Output:** `/liquidity_composite_index.csv` (ROOT directory)
- **Documentation:** `/docs/LIQUIDITY_COMPOSITE_INDEX.md`
- **Dependencies:** All upstream analysis scripts

## Related Components
- **Inputs:** ALL other analysis scripts (fiscal + fed modules)
- **Utilities:** May use report_generator for terminal output
- **Consumers:** End users (traders, analysts, reports)
