# unitAI Smart Workflows Refactoring - Documentation Index (REVISED)

**Created**: 2026-01-28
**Status**: REVISED - Conservative Approach
**Philosophy**: Enhance the toolbox, don't consolidate it.

---

## 📋 Document Overview

This folder contains the complete **REVISED** analysis and implementation plan for refactoring the unitAI smart workflows system. After a detailed analysis of the actual workflow implementations, we have adopted a new conservative strategy.

**Key Insight** (from Gemini analysis):
> "The unitAI workflows are well-differentiated, each serving a distinct purpose... The current modular 'toolbox' approach is effective, and **merging workflows is not recommended**."

---

## 📁 Core Documents

### 1. **README.md** ⭐ **START HERE**
Quick summary of the **REVISED** strategy.

**Contains**:
- Executive summary: "Enhance, don't eliminate"
- Full inventory of 13 workflows (10 existing + 3 new)
- Skills & Plugins classification
- Updated 3-phase implementation roadmap

---

### 2. **REVISED_refactoring_plan_CONSERVATIVE_2026-01-28.md** 📘 **MAIN PLAN**
The new comprehensive implementation roadmap, focused on enhancement.

**Sections**:
- Analysis of all 10 existing workflows (why they are distinct)
- Design of 3 NEW workflows:
  - 🧠 **Overthinker** (Planning + TDD)
  - 🔧 **Implementor** (Execution + CCS delegation)
  - 🔍 **Explorer** (Codebase mapping)
- Plan to ENHANCE existing workflows (init-session, etc.)
- Skills & Plugins conversion plan
- Parallel dispatch architecture
- Interactive menus (AskUserQuestion)
- Token efficiency patterns
- Revised 3-phase roadmap (Enhancement → New Capabilities → Optimization)

---

### 3. **workflow_transformation_diagram_REVISED.md** 🎨 **VISUAL GUIDE**
Visual diagrams showing the **REVISED** "Enhance & Integrate" architecture.

**Diagrams**:
- Current state (10 distinct workflows)
- Target state (13 workflows with clear interactions)
- Skills & plugins system
- Interactive menus mockups
- Token efficiency comparison

---

## 📊 Analysis Artifacts

### workflow_specialization_analysis.json
Raw analysis output from Gemini proving workflows are distinct.

**Contains**:
- Detailed analysis of each of the 10 existing workflows
- Core specialization, key differentiators, and use cases for each
- Final recommendation: "Merging workflows is not recommended"

**Usage**: Justification for the revised strategy

---

### refactoring_analysis.json (Deprecated)
Original aggressive analysis. Kept for historical context.

---

## 🔑 Key Takeaways of the REVISED Plan

### Strategy Shift
- ❌ **Old**: Consolidate 9 → 5 workflows
- ✅ **New**: Enhance all 10 existing workflows + add 3 new ones

### What We're Building
- **3 New Workflows**: Overthinker, Explorer, Implementor
- **3 New Skills**: `/validate-commit`, `/remediate`, `/overthink`
- **1 New Plugin**: Pre-commit validation hook
- **Enhancements for ALL workflows**:
  - Serena LSP integration (90-97.5% token savings)
  - CCS delegation for context gathering
  - Interactive menus
  - Parallel dispatch for speed

### Expected Impact
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Capabilities | 9 workflows | 13 workflows + 3 skills | +77% more tools |
| Token per task | 20-25k | 5-7k | -75% |
| Parallel speedup | 1x | 3-4x | +300% |

---

## ✅ Next Actions

1. **Review & Approve**: The **REVISED** conservative plan
2. **Phase 1 Start**: Begin with enhancements (init-session, token efficiency, menus)
3. **Measure**: Baseline token usage on current workflows
4. **Iterate**: Build new capabilities (Overthinker, Explorer, Implementor)
