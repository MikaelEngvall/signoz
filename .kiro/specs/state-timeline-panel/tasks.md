# Implementation Plan: State Timeline Panel

## Overview

This plan implements the `state_timeline` panel type for SigNoz dashboards. The approach starts with panel type registration (enums, constants), then builds pure data transformation utilities (testable in isolation), followed by rendering components (StateTimelinePanel, SwimLaneRow, StateSegment), supporting UI (LabelColumn, TimeAxis, Tooltip), virtualization via react-virtuoso, and finally wiring into the panel editor and selector menu. Property-based tests using fast-check validate correctness properties defined in the design.

## Tasks

- [x] 1. Register State Timeline panel type in enums and constants
  - [x] 1.1 Add STATE_TIMELINE to PANEL_TYPES enum and PanelDisplay enum
    - Add `STATE_TIMELINE = 'state_timeline'` to `PANEL_TYPES` enum in `frontend/src/constants/queryBuilder.ts`
    - Add `STATE_TIMELINE = 'State Timeline'` to `PanelDisplay` enum in `frontend/src/constants/queryBuilder.ts`
    - Add `[PANEL_TYPES.STATE_TIMELINE]: initialQueriesMap.metrics` to `PANEL_TYPES_INITIAL_QUERY` in the same file
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 1.2 Add STATE_TIMELINE entries to all RightContainer constants maps
    - In `frontend/src/container/NewWidget/RightContainer/constants.ts`, add `[PANEL_TYPES.STATE_TIMELINE]` entry to every typed record:
      - `panelTypeVsThreshold`: `true`
      - `panelTypeVsSoftMinMax`: `false`
      - `panelTypeVsDragAndDrop`: `false`
      - `panelTypeVsFillSpan`: `true`
      - `panelTypeVsLogScale`: `false`
      - `panelTypeVsYAxisUnit`: `false`
      - `panelTypeVsCreateAlert`: `true`
      - `panelTypeVsBucketConfig`: `false`
      - `panelTypeVsPanelTimePreferences`: `true`
      - `panelTypeVsColumnUnitPreferences`: `false`
      - `panelTypeVsStackingChartPreferences`: `false`
      - `panelTypeVsLegendPosition`: `true`
      - `panelTypeVsLegendColors`: `false`
      - `panelTypeVsContextLinks`: `true`
      - `panelTypeVsDecimalPrecision`: `false`
      - `panelTypeVsLineInterpolation`: `false`
      - `panelTypeVsLineStyle`: `false`
      - `panelTypeVsFillMode`: `false`
      - `panelTypeVsShowPoints`: `false`
      - `panelTypeVsSpanGaps`: `false`
    - _Requirements: 1.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 10.4, 10.5_

  - [x] 1.3 Add STATE_TIMELINE to PropsTypePropsMap and getComponentForPanelType
    - In `frontend/src/container/GridPanelSwitch/types.ts`, add `[PANEL_TYPES.STATE_TIMELINE]: null` to `PropsTypePropsMap`
    - In `frontend/src/constants/panelTypes.ts`, add `[PANEL_TYPES.STATE_TIMELINE]: null` to `componentsMap` inside `getComponentForPanelType` (rendering handled by PanelWrapper, not GridPanelSwitch)
    - Ensure `AVAILABLE_EXPORT_PANEL_TYPES` does NOT include `PANEL_TYPES.STATE_TIMELINE`
    - _Requirements: 1.5, 1.6, 10.1_

- [x] 2. Implement data transformation utilities
  - [x] 2.1 Create legendResolver utility
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/utils/legendResolver.ts`
    - Implement `resolveLegendTemplate(template: string, labels: Record<string, string>): string` — replaces `{{key}}` placeholders with label values, leaves unmatched placeholders as-is
    - Implement `resolveSeriesLabel(series: SeriesItem, legendTemplate?: string): string` — resolves legend template or falls back to `key=value` join
    - Export both functions
    - _Requirements: 7.2, 7.3_

  - [x] 2.2 Write property test for legend resolution (Property 7)
    - **Property 7: Legend template resolution**
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/utils/__tests__/legendResolver.property.test.ts`
    - Use fast-check to generate random template strings and label maps
    - Assert: each `{{key}}` with a matching label entry is replaced; unmatched placeholders remain
    - **Validates: Requirements 7.3**

  - [x] 2.3 Create transformData utility
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/utils/transformData.ts`
    - Define interfaces: `SwimLaneModel`, `SwimLaneRowData`, `SegmentData`, `TimeRange`
    - Implement `transformSeriesToSwimLanes(queryData: QueryDataV3[], timeRange: TimeRange, thresholds: ThresholdProps[], isDarkMode: boolean, legendTemplate?: string): SwimLaneModel`
    - Pipeline: extract series → resolve labels → sort alphabetically (case-insensitive) → build segments → evaluate thresholds
    - Handle edge cases: empty series → empty rows; single data point → full-width segment; null/NaN values → `value = null`
    - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7, 3.8, 7.1, 7.2, 7.4, 7.5, 7.7_

  - [x] 2.4 Write property tests for data transformation (Properties 1, 2, 3)
    - **Property 1: Data transformation preserves series count and labels**
    - **Property 2: Swim-lane rows are sorted alphabetically**
    - **Property 3: Segment boundaries are continuous and span the full time range**
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/utils/__tests__/transformData.property.test.ts`
    - Use fast-check to generate random QueryDataV3 with 0-50 series, random labels, random sorted timestamp arrays
    - Assert: row count equals series count; rows sorted case-insensitively; segments continuous with no gaps, first segment starts at first timestamp, last ends at timeRange.end
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6, 4.7, 7.2, 7.4**

- [x] 3. Implement threshold evaluation utility
  - [x] 3.1 Create evaluateThreshold utility
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/utils/evaluateThreshold.ts`
    - Implement `evaluateThreshold(value: number | null, thresholds: ThresholdProps[], defaultColor: string): ThresholdEvalResult`
    - Implement `evaluateOperator(value: number, operator: ThresholdOperators, threshold: number): boolean`
    - Support operators: `>`, `<`, `>=`, `<=`, `=`
    - First-match semantics: return color/label of the first matching rule
    - Handle null/NaN → return defaultColor
    - Skip rules with missing operator or value
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 3.2 Write property test for threshold evaluation (Property 4)
    - **Property 4: Threshold evaluation applies first-match semantics with correct operator evaluation**
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/utils/__tests__/evaluateThreshold.property.test.ts`
    - Use fast-check to generate random numeric values and random ordered threshold rule sets
    - Assert: result matches the first rule that satisfies the operator condition; no match → default color
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 4. Checkpoint - Ensure utilities compile and pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement core rendering components
  - [x] 5.1 Create StateSegment component
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/StateSegment.tsx`
    - Render a `<div>` with `position: absolute`, `left` and `width` computed from segment time proportion
    - Apply `backgroundColor` from `segment.color`
    - Accept `onMouseEnter` and `onMouseLeave` handlers for tooltip
    - No visible gaps between adjacent segments (continuous bar)
    - _Requirements: 3.5, 4.7_

  - [x] 5.2 Create SwimLaneRow component
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/SwimLaneRow.tsx`
    - Render a container `<div>` with `position: relative` and the full available width
    - Map `row.segments` to `StateSegment` components with calculated positions
    - Implement `getSegmentWidth` and `getSegmentLeft` using time proportion math from design
    - Pass hover events up to parent for tooltip management
    - _Requirements: 3.5, 3.6, 3.7, 4.7, 9.4_

  - [x] 5.3 Create StateTimelinePanel main component
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/StateTimelinePanel.tsx`
    - Orchestrate layout: LabelColumn (left) + SwimLaneContainer (right) + TimeAxis (bottom)
    - Compute row height: `max(floor(availableHeight / rowCount), 20)`
    - Show "No Data" message when `swimLaneModel.rows.length === 0`
    - Show warning banner when rows > 100
    - Manage tooltip state (position, content, visibility)
    - Apply dark/light mode theming via CSS classes
    - _Requirements: 3.1, 3.8, 9.3, 9.7, 11.5_

  - [x] 5.4 Write property test for row height layout (Property 8)
    - **Property 8: Row height layout respects minimum and triggers overflow**
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/__tests__/layout.property.test.ts`
    - Use fast-check to generate random panel heights and row counts
    - Assert: computed height is `max(floor(H/N), 20)`; overflow flag set when `N * 20 > H`
    - **Validates: Requirements 9.3, 9.5**

- [x] 6. Implement LabelColumn component
  - [x] 6.1 Create LabelColumn component
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/LabelColumn.tsx`
    - Render vertical list of labels aligned with swim-lane rows
    - Measure text width to determine column width: `min(maxLabelWidth + padding, 200)px`
    - Truncate labels exceeding column width with CSS `text-overflow: ellipsis`
    - Synchronize scroll position with the swim-lane container
    - Support `legendPosition` prop to show/hide the column
    - _Requirements: 3.3, 3.4, 8.8_

  - [x] 6.2 Write property test for label column width clamping (Property 11)
    - **Property 11: Label column width clamping**
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/__tests__/labelColumn.property.test.ts`
    - Use fast-check to generate random label strings of varying lengths
    - Assert: computed width ≤ 200px; labels exceeding width get ellipsis
    - **Validates: Requirements 3.4**

- [x] 7. Implement TimeAxis component
  - [x] 7.1 Create timeAxisUtils utility and TimeAxis component
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/utils/timeAxisUtils.ts`
    - Implement `computeTickInterval(timeRangeSeconds: number): number` — snaps to human-friendly intervals
    - Implement `generateTicks(timeRange: TimeRange, width: number, timezone: string): TickMark[]` — produces evenly spaced tick marks
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/TimeAxis.tsx`
    - Render tick marks with formatted labels using dayjs timezone formatting consistent with SigNoz conventions
    - Align left edge with timeRange.start, right edge with timeRange.end
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [x] 7.2 Write property test for time axis ticks (Property 5)
    - **Property 5: Time axis ticks are evenly spaced and aligned with segment boundaries**
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/utils/__tests__/timeAxisUtils.property.test.ts`
    - Use fast-check to generate random time ranges and panel widths
    - Assert: ticks are evenly spaced; axis boundaries equal timeRange start/end
    - **Validates: Requirements 5.2, 5.5**

- [x] 8. Implement Tooltip component
  - [x] 8.1 Create StateTimelineTooltip component
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/StateTimelineTooltip.tsx`
    - Display: timestamp, series label, raw value, threshold label (if present), segment duration
    - Calculate duration as `segment.endTime - segment.startTime`
    - Position near cursor without overflowing panel boundaries (adjust placement direction)
    - Show within 200ms of hover, hide within 100ms of mouse leave (CSS transitions)
    - When no threshold matches, display raw value without state label
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 8.2 Write property tests for tooltip (Properties 6, 10)
    - **Property 6: Tooltip content includes all required fields with correct duration**
    - **Property 10: Tooltip positioning within panel bounds**
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/__tests__/tooltip.property.test.ts`
    - Use fast-check to generate random segments, row data, mouse positions, and panel dimensions
    - Assert: tooltip contains all fields; duration = endTime - startTime; tooltip stays within panel bounds
    - **Validates: Requirements 6.2, 6.3, 6.5**

- [x] 9. Checkpoint - Ensure all components compile and render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Integrate virtualization with react-virtuoso
  - [x] 10.1 Add react-virtuoso to SwimLaneContainer for row virtualization
    - Update `StateTimelinePanel.tsx` to wrap swim-lane rows in a `<Virtuoso>` component
    - Configure overscan of 5 rows above and below the visible viewport
    - Synchronize LabelColumn scroll with the Virtuoso scroll position
    - Render only visible rows plus buffer to the DOM
    - Handle dynamic row heights if panel is resized
    - _Requirements: 11.1, 11.2, 11.4, 9.3, 9.5_

  - [x] 10.2 Write property test for virtualization rendering (Property 9)
    - **Property 9: Virtualization renders only visible rows plus buffer**
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/__tests__/virtualization.property.test.ts`
    - Use fast-check to generate random scroll positions and row counts
    - Assert: only visible rows plus 5 buffer rows above/below are rendered
    - **Validates: Requirements 11.4**

- [x] 11. Wire panel into PanelWrapper and dashboard rendering
  - [x] 11.1 Create StateTimelinePanelWrapper and register in PanelTypeVsPanelWrapper
    - Create `frontend/src/container/PanelWrapper/StateTimelinePanelWrapper.tsx`
    - Extract `queryResponse` data, widget thresholds, time range, legend template from props
    - Call `transformSeriesToSwimLanes` to produce `SwimLaneModel`
    - Pass model to `StateTimelinePanel` component
    - Handle loading/error states (defer to PanelWrapper parent)
    - In `frontend/src/container/PanelWrapper/constants.ts`, import `StateTimelinePanelWrapper` and add `[PANEL_TYPES.STATE_TIMELINE]: StateTimelinePanelWrapper`
    - _Requirements: 1.3, 1.6, 7.1, 9.1, 9.2, 9.6_

  - [x] 11.2 Create index barrel file and styles
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/index.ts` to export main components
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/StateTimelinePanel.styles.scss` with panel layout styles, segment styling, dark/light mode variants
    - _Requirements: 9.7_

- [x] 12. Add State Timeline to panel type selection menu
  - [x] 12.1 Add State Timeline option to PanelTypesWithData menu
    - In `frontend/src/container/DashboardContainer/PanelTypeSelectionModal/menuItems.tsx`:
      - Import an appropriate icon (e.g., `Rows` or similar from `@signozhq/icons`, or use `BarChart` rotated)
      - Add a new entry after the Histogram item: `{ name: PANEL_TYPES.STATE_TIMELINE, icon: <IconComponent size={16} color={Color.BG_ROBIN_400} />, display: PanelDisplay.STATE_TIMELINE }`
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 13. Checkpoint - Full integration test
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Unit tests for registration and component rendering
  - [x] 14.1 Write unit tests for panel type registration
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/__tests__/registration.test.ts`
    - Verify `PANEL_TYPES.STATE_TIMELINE` exists with value `'state_timeline'`
    - Verify it exists in all RightContainer constants maps with correct boolean values
    - Verify `PanelTypeVsPanelWrapper` includes `STATE_TIMELINE` entry
    - Verify `AVAILABLE_EXPORT_PANEL_TYPES` does NOT include `STATE_TIMELINE`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 10.1_

  - [x] 14.2 Write unit tests for StateTimelinePanel rendering
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/__tests__/StateTimelinePanel.test.tsx`
    - Test: renders correct number of swim-lane rows for given data
    - Test: shows "No Data" message when series array is empty
    - Test: shows warning when > 100 series
    - Test: applies dark mode class when `isDarkMode` is true
    - Test: single data point renders full-width segment
    - _Requirements: 3.1, 3.8, 9.7, 11.5_

  - [x] 14.3 Write unit tests for tooltip interaction
    - Create `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/__tests__/StateTimelineTooltip.test.tsx`
    - Test: tooltip appears on segment hover with correct content fields
    - Test: tooltip disappears on mouse leave
    - Test: tooltip shows raw value without label when no threshold matches
    - _Requirements: 6.1, 6.2, 6.4, 6.6_

- [x] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The `fast-check` library must be installed (`pnpm add -D fast-check`) before running property-based tests
- All components live under `frontend/src/container/DashboardContainer/visualization/panels/StateTimelinePanel/`
- The panel reuses existing ThresholdProps types and the existing threshold configuration UI — no new threshold editor needed

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "3.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "3.2"] },
    { "id": 4, "tasks": ["2.4", "5.1"] },
    { "id": 5, "tasks": ["5.2", "6.1", "7.1", "8.1"] },
    { "id": 6, "tasks": ["5.3", "5.4", "6.2", "7.2", "8.2"] },
    { "id": 7, "tasks": ["10.1", "10.2"] },
    { "id": 8, "tasks": ["11.1", "11.2"] },
    { "id": 9, "tasks": ["12.1"] },
    { "id": 10, "tasks": ["14.1", "14.2", "14.3"] }
  ]
}
```
