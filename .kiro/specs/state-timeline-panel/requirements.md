# Requirements Document

## Introduction

This feature introduces a new `state_timeline` panel type to SigNoz dashboards that renders grouped time-series data as horizontal swim-lane rows with color-coded segments based on configurable value thresholds. Unlike the existing Time Series (graph) panel that plots lines/areas on a Y-axis, the State Timeline panel maps each distinct series (produced via group-by queries) to its own horizontal row. Each row is divided into colored rectangles representing the state of that series across time intervals. This enables users to monitor the status of many services simultaneously in a single compact panel — replacing scenarios where 20+ individual graph panels are needed to visualize binary pass/fail or multi-state status per service.

The panel reuses the existing time-series query data format (same aggregation, group-by, and filter options as the current graph panel) and requires no backend changes.

## Glossary

- **State_Timeline_Panel**: A new dashboard panel type (`state_timeline`) that renders grouped time-series data as horizontal swim-lane rows with color-coded state segments
- **Swim_Lane_Row**: A single horizontal row within the State_Timeline_Panel representing one grouped series (e.g., one service), drawn as a sequence of colored rectangles
- **State_Segment**: A colored rectangular section within a Swim_Lane_Row spanning the time interval between two adjacent data points, colored according to the threshold rules
- **Threshold_Rule**: A user-configured mapping of a value condition (operator + value) to a display color and optional label, used to determine the color of each State_Segment
- **Series_Label**: The display name for a Swim_Lane_Row, derived from the query legend template or the group-by label values (e.g., "aca", "jenkins", "sonarqube")
- **Label_Column**: The vertical column on the left side of the panel displaying Series_Labels for each Swim_Lane_Row
- **Time_Axis**: The horizontal axis at the bottom of the panel showing timestamps aligned with the dashboard's selected time range
- **Hover_Tooltip**: A popup element that appears when the user hovers over a State_Segment, showing the timestamp, series name, state label, raw value, and duration
- **Panel_Editor**: The widget configuration interface (NewWidget) where users create and edit dashboard panels
- **PANEL_TYPES_Enum**: The TypeScript enum in `constants/queryBuilder.ts` that defines all valid panel type identifiers
- **PanelTypeVsPanelWrapper**: The mapping in `container/PanelWrapper/constants.ts` that associates each panel type with its rendering component
- **QueryDataV3**: The API response format containing series data with labels and timestamped values used by all panel types
- **Dashboard_Widget**: A visual element on a SigNoz dashboard defined by the `Widgets` interface, containing an `id`, `panelTypes`, `title`, `description`, `query`, and `thresholds`

## Requirements

### Requirement 1: Register State Timeline Panel Type in the System

**User Story:** As a developer, I want the state timeline panel type to be registered in the existing panel type system, so that the application recognizes it as a valid panel option throughout the codebase.

#### Acceptance Criteria

1. THE PANEL_TYPES_Enum SHALL include a `STATE_TIMELINE` member with the string value `state_timeline`
2. THE PanelDisplay enum SHALL include a `STATE_TIMELINE` member with the display string `State Timeline`
3. THE PanelTypeVsPanelWrapper mapping SHALL include an entry for `PANEL_TYPES.STATE_TIMELINE` that maps to the StateTimelinePanel rendering component
4. THE PANEL_TYPES_INITIAL_QUERY record SHALL include an entry for `PANEL_TYPES.STATE_TIMELINE` that maps to the default metrics initial query (`initialQueriesMap.metrics`)
5. THE GridPanelSwitch component SHALL include `PANEL_TYPES.STATE_TIMELINE` in the `PropsTypePropsMap` type definition
6. THE getComponentForPanelType function SHALL return the State_Timeline_Panel component when called with `PANEL_TYPES.STATE_TIMELINE`
7. WHEN a new member is added to the PANEL_TYPES_Enum, THEN all typed records indexed by `[key in PANEL_TYPES]` in the RightContainer constants file SHALL include a corresponding entry for `PANEL_TYPES.STATE_TIMELINE` to maintain TypeScript compilation

### Requirement 2: Add State Timeline Panel to Panel Type Selection UI

**User Story:** As a dashboard user, I want to see the state timeline panel as an available option when creating a new panel, so that I can choose it to visualize multi-service status over time.

#### Acceptance Criteria

1. THE Panel_Editor SHALL display a `State Timeline` option with a dedicated icon consistent in size and color with the other panel type icons in the panel type selection menu
2. WHEN the user selects the `State Timeline` option, THE Panel_Editor SHALL navigate to the panel editor with the graph type set to `state_timeline` and display the query builder interface
3. THE State_Timeline_Panel option SHALL appear after the existing Histogram panel type in the selection menu
4. IF the user opens the panel type selection modal and the `State Timeline` option fails to render, THEN THE Panel_Editor SHALL still display all other existing panel type options without error

### Requirement 3: Swim-Lane Row Rendering

**User Story:** As a dashboard user, I want each grouped series to appear as its own horizontal swim-lane row, so that I can see the status of all services simultaneously in one panel.

#### Acceptance Criteria

1. WHEN the State_Timeline_Panel receives QueryDataV3 series data with N distinct grouped series, THE State_Timeline_Panel SHALL render exactly N Swim_Lane_Rows stacked vertically
2. THE State_Timeline_Panel SHALL sort Swim_Lane_Rows alphabetically by Series_Label in ascending order by default
3. THE State_Timeline_Panel SHALL display a Label_Column on the left side showing the Series_Label text for each Swim_Lane_Row
4. THE Label_Column SHALL have a fixed width that accommodates the longest Series_Label without truncation, up to a maximum of 200 pixels, after which labels SHALL be truncated with an ellipsis
5. WHEN a series contains timestamped values, THE State_Timeline_Panel SHALL render State_Segments spanning the time interval between each pair of consecutive data points
6. THE last State_Segment in each Swim_Lane_Row SHALL extend from the last data point to the end of the visible time range
7. IF a series contains only a single data point, THEN THE State_Timeline_Panel SHALL render a single State_Segment spanning the entire visible time range for that row
8. IF the query returns zero series, THEN THE State_Timeline_Panel SHALL display a "No Data" message centered within the panel area

### Requirement 4: Color-Coded State Segments via Thresholds

**User Story:** As a dashboard user, I want state segments colored according to my threshold configuration, so that I can instantly identify pass/fail/warning states for each service at each point in time.

#### Acceptance Criteria

1. WHEN a State_Segment value matches a Threshold_Rule condition, THE State_Timeline_Panel SHALL fill that segment with the color specified by the matching Threshold_Rule
2. THE State_Timeline_Panel SHALL evaluate Threshold_Rules in their configured order (top to bottom) and apply the color of the first matching rule
3. IF no Threshold_Rule matches a State_Segment value, THEN THE State_Timeline_Panel SHALL fill that segment with a neutral gray color
4. THE State_Timeline_Panel SHALL support the existing threshold operators: `>`, `<`, `>=`, `<=`, and `=`
5. THE State_Timeline_Panel SHALL support a minimum of 2 and a maximum of 20 Threshold_Rules per panel
6. WHEN the user configures thresholds in the Panel_Editor, THE State_Timeline_Panel preview SHALL update to reflect the new color mapping within 500 milliseconds
7. THE State_Timeline_Panel SHALL render State_Segments with no visible gap between adjacent segments within the same Swim_Lane_Row, creating a continuous colored bar

### Requirement 5: Time Axis Display

**User Story:** As a dashboard user, I want a time axis displayed below the swim-lane rows, so that I can correlate state changes with specific timestamps.

#### Acceptance Criteria

1. THE State_Timeline_Panel SHALL display a Time_Axis at the bottom of the panel showing timestamp labels aligned with the dashboard's currently selected time range
2. THE Time_Axis SHALL display tick marks at evenly spaced intervals appropriate to the visible time range (e.g., hourly ticks for a 24-hour range, daily ticks for a 7-day range)
3. THE Time_Axis labels SHALL use the same date/time format as other SigNoz panel types for the given time range granularity
4. WHEN the dashboard time range changes, THE State_Timeline_Panel SHALL re-render with the new time boundaries within 2 seconds of receiving the updated query response
5. THE Time_Axis SHALL align horizontally with the State_Segments such that the left edge of the first segment corresponds to the start of the time range and the right edge of the last segment corresponds to the end of the time range

### Requirement 6: Hover Tooltip

**User Story:** As a dashboard user, I want to hover over a state segment and see details about that specific time period, so that I can investigate when a service changed state and how long it remained in that state.

#### Acceptance Criteria

1. WHEN the user hovers over a State_Segment, THE State_Timeline_Panel SHALL display a Hover_Tooltip within 200 milliseconds of the mouse entering the segment
2. THE Hover_Tooltip SHALL display the following information: the timestamp of the data point that starts the segment, the Series_Label (service name), the raw numeric value at that data point, the state label from the matching Threshold_Rule (if configured), and the duration of the segment
3. THE Hover_Tooltip duration SHALL be calculated as the time difference between the current data point timestamp and the next data point timestamp (or the end of the visible time range for the last segment)
4. WHEN the user moves the mouse away from a State_Segment, THE Hover_Tooltip SHALL disappear within 100 milliseconds
5. THE Hover_Tooltip SHALL be positioned near the mouse cursor without overflowing the panel boundaries, adjusting placement to remain fully visible within the viewport
6. WHEN the user hovers over a segment where no Threshold_Rule matches, THE Hover_Tooltip SHALL display the raw value without a state label

### Requirement 7: Query Data Consumption

**User Story:** As a dashboard user, I want the state timeline panel to work with the existing query builder (same metric, aggregation, group-by, and filter options as the graph panel), so that I can reuse my existing queries without modification.

#### Acceptance Criteria

1. THE State_Timeline_Panel SHALL accept QueryDataV3 series data in the same format as the Time Series (graph) panel
2. THE State_Timeline_Panel SHALL derive Swim_Lane_Rows from the `series` array in QueryDataV3, using each SeriesItem's `labels` to produce the Series_Label
3. WHEN the query uses a legend template (e.g., `{{cicd_test_case_service}}`), THE State_Timeline_Panel SHALL use the resolved legend string as the Series_Label
4. WHEN the query uses group-by on one or more attributes, THE State_Timeline_Panel SHALL create one Swim_Lane_Row per unique combination of group-by label values
5. THE State_Timeline_Panel SHALL extract timestamped values from each SeriesItem's `values` array (where each entry is `{ timestamp: number, value: string }`) to determine State_Segment boundaries and colors
6. THE State_Timeline_Panel SHALL support queries from all existing data sources (metrics, logs, traces) that produce time-series results
7. IF the query response contains null or missing values at certain timestamps, THEN THE State_Timeline_Panel SHALL treat those intervals as having no data and render the segment with the neutral gray color

### Requirement 8: Panel Configuration Options

**User Story:** As a dashboard user, I want relevant configuration options available for the state timeline panel, so that I can customize its appearance and behavior.

#### Acceptance Criteria

1. WHEN the state timeline panel type is selected in the Panel_Editor, THE settings panel SHALL display threshold configuration options
2. WHEN the state timeline panel type is selected in the Panel_Editor, THE settings panel SHALL display the panel time preferences selector
3. WHEN the state timeline panel type is selected in the Panel_Editor, THE settings panel SHALL NOT display Y-axis unit selectors (the panel has no numeric Y-axis)
4. WHEN the state timeline panel type is selected in the Panel_Editor, THE settings panel SHALL NOT display soft min/max options
5. WHEN the state timeline panel type is selected in the Panel_Editor, THE settings panel SHALL NOT display line interpolation, line style, fill mode, or show points options (these are line-chart-specific)
6. WHEN the state timeline panel type is selected in the Panel_Editor, THE settings panel SHALL NOT display stacking or bucket configuration options
7. WHEN the state timeline panel type is selected in the Panel_Editor, THE settings panel SHALL NOT display log scale options
8. WHEN the state timeline panel type is selected in the Panel_Editor, THE settings panel SHALL display legend position options to control whether the Label_Column appears on the left (default) or is hidden
9. WHEN the state timeline panel type is selected in the Panel_Editor, THE settings panel SHALL display the fill span option to control how gaps in data are handled

### Requirement 9: Dashboard Grid Integration

**User Story:** As a dashboard user, I want the state timeline panel to integrate properly within the dashboard grid, so that I can resize, move, and arrange it alongside other panels.

#### Acceptance Criteria

1. THE State_Timeline_Panel SHALL be resizable within the dashboard grid layout using the same drag-to-resize handles as other panel types
2. THE State_Timeline_Panel SHALL be movable via drag-and-drop within the dashboard grid layout
3. WHEN the panel is resized vertically, THE State_Timeline_Panel SHALL adjust Swim_Lane_Row heights proportionally to fill the available space, with a minimum row height of 20 pixels
4. WHEN the panel is resized horizontally, THE State_Timeline_Panel SHALL expand or contract the Time_Axis and State_Segments to fill the available width
5. IF the number of Swim_Lane_Rows exceeds the panel height at minimum row height (20 pixels), THEN THE State_Timeline_Panel SHALL display a vertical scrollbar to access overflowing rows
6. THE State_Timeline_Panel SHALL display the configured panel title in the standard panel header area
7. THE State_Timeline_Panel SHALL apply the current dashboard theme (light or dark mode) to text colors, background colors, and segment colors such that the panel appearance is consistent with other panel types

### Requirement 10: Panel Export Exclusion

**User Story:** As a developer, I want the state timeline panel to be correctly excluded from data-export features that do not apply, so that users do not encounter errors from inapplicable operations.

#### Acceptance Criteria

1. THE State_Timeline_Panel SHALL NOT appear in the list of exportable panel types (AVAILABLE_EXPORT_PANEL_TYPES) until CSV export support is explicitly added
2. WHEN the state timeline panel type is selected in the Panel_Editor, THE settings panel SHALL display alert creation options since threshold-based alerting is applicable to the underlying metric data
3. THE State_Timeline_Panel SHALL support the existing context links feature, allowing users to configure drill-down links that navigate to filtered views when clicking on a State_Segment
4. THE panelTypeVsCreateAlert constant SHALL include `PANEL_TYPES.STATE_TIMELINE` with value `true`
5. THE panelTypeVsContextLinks constant SHALL include `PANEL_TYPES.STATE_TIMELINE` with value `true`

### Requirement 11: Performance with Many Series

**User Story:** As a dashboard user monitoring 20+ services, I want the state timeline panel to render efficiently, so that the panel loads quickly and remains responsive when displaying many swim-lane rows.

#### Acceptance Criteria

1. THE State_Timeline_Panel SHALL render up to 50 Swim_Lane_Rows without visible jank or frame drops during initial render
2. THE State_Timeline_Panel SHALL render the initial paint within 1 second of receiving query response data for panels with up to 50 series and 500 data points per series
3. WHEN the dashboard time range changes or the panel refreshes, THE State_Timeline_Panel SHALL not re-mount the entire component tree but instead update the existing rendered segments with new data
4. THE State_Timeline_Panel SHALL use virtualization or lazy rendering for Swim_Lane_Rows that overflow beyond the visible panel height, rendering only the rows currently in the viewport plus a buffer of 5 rows above and below
5. WHEN the panel contains more than 100 series, THE State_Timeline_Panel SHALL display a warning message suggesting the user add filters to reduce the number of series

