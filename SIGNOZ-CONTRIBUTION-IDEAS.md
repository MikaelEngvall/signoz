# SigNoz Open Source Contribution Ideas

SigNoz is Apache 2.0 licensed: https://github.com/SigNoz/signoz

These are features we've identified as missing during our dashboard work that would benefit the SigNoz community.

---

## 1. State Timeline Panel Type

**Discussion:** https://github.com/SigNoz/signoz/discussions/11689

**Problem:** SigNoz has no equivalent to Grafana's "State Timeline" panel. When monitoring binary pass/fail status for multiple services, the only option is overlapping lines on a single graph (unreadable) or creating one panel per service (heavy, hard to maintain).

**Proposed solution:** A new panel type that renders each grouped series as a horizontal swim-lane row with color coding based on value thresholds.

**Visual:**
```
service-a  ████████████░░░░████████████
service-b  ████████████████████████████
service-c  ░░░░░░░░████████████████████
           |--- time axis ---|
           green=pass, red=fail
```

**Technical scope:**
- Frontend: New React component in `frontend/src/container/`
- Reuse existing query builder data (same aggregation, group-by)
- Register as `panelTypes: "state_timeline"`
- Backend: No changes needed — time-series data format already works

**Effort:** Medium (2-4 weeks)

---

## 2. Table Column Aliasing

**Discussion:** https://github.com/SigNoz/signoz/discussions/11690

**Problem:** Table panels display raw metric label names as column headers (e.g., `cicd_test_case_service`, `{{cicd_test_case_service}}`). There's no way to rename them to human-friendly names like "Service" or "Status".

**Proposed solution:** Add a `columnAliases` field to table widget configuration that maps label/column names to display names.

**Example config:**
```json
{
  "columnAliases": {
    "cicd_test_case_service": "Service",
    "A": "Status"
  }
}
```

**Technical scope:**
- Frontend: Read `columnAliases` in the table renderer, apply before display
- API: Accept the new field in widget JSON (already flexible schema)
- Backend: No changes needed

**Effort:** Small (days)

---

## 3. Table Panel Row Display Limit

**Discussion:** https://github.com/SigNoz/signoz/discussions/11691

**Problem:** Table panels display a maximum of 10 visible rows regardless of panel height or query limit settings. Users must scroll to see additional rows, even when the panel has plenty of vertical space to show all data.

**Proposed solution:** Allow configuration of visible row count (e.g., `visibleRows: 25` or `visibleRows: "all"`) so the table fills the available panel height without forcing internal scroll.

**Technical scope:**
- Frontend: Make the table's internal row rendering respect panel height or a configurable row count
- Currently hardcoded to ~10 rows in the virtualized table renderer
- API: Accept `visibleRows` field in widget config

**Effort:** Small-Medium (days)

---

## 4. Text / Markdown Panel Type

**Discussion:** https://github.com/SigNoz/signoz/discussions/11692

**Problem:** SigNoz has no text or markdown panel for displaying static labels, section headers, or descriptions within a dashboard. Grafana uses "Text" panels and "Row" panels for section titles like "Health-Check". In SigNoz, the only workaround is a value panel with a disabled query, which shows just the panel title in the header bar — not a clean large-text label.

**Proposed solution:** A simple panel type that renders user-provided text (plain or markdown) without any query or data fetching.

**Example use cases:**
- Section headers ("Health-Check", "Infrastructure", "API Performance")
- Dashboard instructions or notes
- Links to runbooks or documentation

**Technical scope:**
- Frontend: New simple panel component that renders markdown/text content from a `content` field
- Register as `panelTypes: "text"`
- No query execution needed
- Backend: No changes needed

**Effort:** Small (days)

---

## How to Contribute

1. Open a GitHub Discussion on `github.com/SigNoz/signoz` to gauge maintainer interest
2. If positive, open an Issue with the proposal
3. Fork, implement, submit PR
4. Reference the Discussion/Issue in PR description
