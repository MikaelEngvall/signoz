# Requirements Document

## Introduction

This feature introduces a new `text` panel type to SigNoz dashboards that renders user-provided markdown or plain text content. Unlike existing panel types (Time Series, Value, Table, etc.) that execute data queries, the text panel is a static content panel that displays formatted text without any query execution. This enables users to add documentation, annotations, instructions, and contextual notes directly within their dashboards.

## Glossary

- **Text_Panel**: A new dashboard panel type (`text`) that renders user-provided markdown or plain text content without executing data queries
- **Markdown_Renderer**: The component responsible for parsing markdown syntax and rendering it as formatted HTML within the Text_Panel
- **Panel_Editor**: The widget configuration interface (NewWidget) where users create and edit dashboard panels
- **Panel_Type_Selector**: The UI component that allows users to choose between available panel types (Time Series, Value, Table, List, Bar, Pie, Histogram, and Text)
- **Dashboard_Widget**: A visual element on a SigNoz dashboard defined by the `Widgets` interface, containing an `id`, `panelTypes`, `title`, `description`, and `query`
- **PANEL_TYPES_Enum**: The TypeScript enum in `constants/queryBuilder.ts` that defines all valid panel type identifiers
- **PanelTypeVsPanelWrapper**: The mapping in `container/PanelWrapper/constants.ts` that associates each panel type with its rendering component

## Requirements

### Requirement 1: Register Text Panel Type in the System

**User Story:** As a developer, I want the text panel type to be registered in the existing panel type system, so that the application recognizes it as a valid panel option throughout the codebase.

#### Acceptance Criteria

1. THE PANEL_TYPES enum SHALL include a `TEXT` member with the string value `text`
2. THE PanelDisplay enum SHALL include a `TEXT` member with the display string `Text/Markdown`
3. THE PanelTypeVsPanelWrapper mapping SHALL include an entry for `PANEL_TYPES.TEXT` that maps to the TextPanelWrapper rendering component
4. THE PANEL_TYPES_INITIAL_QUERY record SHALL include an entry for `PANEL_TYPES.TEXT` that maps to the default metrics initial query (`initialQueriesMap.metrics`)
5. THE GridPanelSwitch component SHALL include `PANEL_TYPES.TEXT` in the `PropsTypePropsMap` type definition with type value `null`
6. THE panelTypeVsThreshold constant SHALL include `PANEL_TYPES.TEXT` with value `false`
7. THE panelTypeVsSoftMinMax constant SHALL include `PANEL_TYPES.TEXT` with value `false`
8. THE panelTypeVsFillSpan constant SHALL include `PANEL_TYPES.TEXT` with value `false`
9. THE panelTypeVsLogScale constant SHALL include `PANEL_TYPES.TEXT` with value `false`
10. THE panelTypeVsDragAndDrop constant SHALL include `PANEL_TYPES.TEXT` with value `false`
11. WHEN a new member is added to the PANEL_TYPES enum, THEN all typed records indexed by `[key in PANEL_TYPES]` in the RightContainer constants file SHALL include a corresponding entry for `PANEL_TYPES.TEXT` with value `false` to maintain TypeScript compilation

### Requirement 2: Add Text Panel to Panel Type Selection UI

**User Story:** As a dashboard user, I want to see the text panel as an available option when creating a new panel, so that I can choose it to add documentation to my dashboard.

#### Acceptance Criteria

1. THE Panel_Type_Selector SHALL display a `Text/Markdown` option with a dedicated icon consistent in size (16px) and color with the other panel type icons in the panel type selection menu
2. WHEN the user selects the `Text/Markdown` option, THE Panel_Editor SHALL navigate to the panel editor route with the graph type set to the text panel type and display the text/markdown content editing interface within 2 seconds
3. THE Text_Panel option SHALL appear as the last entry, after the existing panel types (Time Series, Number, Table, List, Bar, Pie, Histogram) in the selection menu
4. IF the user opens the panel type selection modal and the `Text/Markdown` option fails to render, THEN THE Panel_Type_Selector SHALL still display all other existing panel type options without error

### Requirement 3: Text Panel Editing Experience

**User Story:** As a dashboard user, I want a text input area where I can write markdown or plain text content for my panel, so that I can author the content I want to display.

#### Acceptance Criteria

1. WHEN the text panel type is selected, THE Panel_Editor SHALL display a multi-line text input area for markdown content entry
2. WHEN the text panel type is selected, THE Panel_Editor SHALL hide the query builder section since no data queries are needed
3. THE text input area SHALL accept any valid UTF-8 text including markdown syntax up to a maximum of 10,000 characters
4. WHEN the user types in the text input area, THE Text_Panel preview SHALL update to reflect the rendered content within 500 milliseconds of the last keystroke
5. WHEN the user saves the panel, THE Panel_Editor SHALL persist the text content as part of the Dashboard_Widget data
6. IF the text input area content is empty when the user saves, THEN THE Panel_Editor SHALL allow saving and THE Text_Panel SHALL render as a blank panel

### Requirement 4: Markdown Rendering

**User Story:** As a dashboard user, I want my markdown content rendered with proper formatting, so that I can use headings, lists, links, code blocks, and other markdown features in my dashboard panels.

#### Acceptance Criteria

1. THE Markdown_Renderer SHALL render headings (h1 through h6) from markdown `#` syntax
2. THE Markdown_Renderer SHALL render bold text from `**text**` or `__text__` syntax
3. THE Markdown_Renderer SHALL render italic text from `*text*` or `_text_` syntax
4. THE Markdown_Renderer SHALL render unordered lists from `-` or `*` list item syntax, including nested list items indented by 2 or more spaces up to 4 levels of nesting depth
5. THE Markdown_Renderer SHALL render ordered lists from numbered `1.` syntax, including nested list items indented by 2 or more spaces up to 4 levels of nesting depth
6. THE Markdown_Renderer SHALL render inline code from backtick syntax preserving whitespace and literal characters within the backticks
7. THE Markdown_Renderer SHALL render fenced code blocks from triple-backtick syntax with syntax highlighting when a language identifier is specified after the opening backticks
8. THE Markdown_Renderer SHALL render hyperlinks from `[text](url)` syntax, opening links in a new browser tab
9. THE Markdown_Renderer SHALL render blockquotes from `>` syntax, including nested blockquotes using multiple `>` characters
10. THE Markdown_Renderer SHALL render horizontal rules from `---` or `***` syntax
11. WHEN plain text without any markdown syntax is provided, THE Markdown_Renderer SHALL display the text as plain paragraphs
12. THE Markdown_Renderer SHALL render tables from pipe-delimited markdown table syntax including a header row, a delimiter row, and one or more data rows
13. THE Markdown_Renderer SHALL sanitize rendered output by stripping inline script tags, event handler attributes, and javascript: URIs to prevent cross-site scripting
14. IF markdown content contains incomplete or malformed syntax (such as an unclosed bold marker or an unterminated link), THEN THE Markdown_Renderer SHALL render the malformed portion as plain text without producing a rendering error
15. THE Markdown_Renderer SHALL support nested inline formatting within block elements, such that bold, italic, inline code, and links are correctly rendered when used inside list items, blockquotes, or table cells

### Requirement 5: No Query Execution for Text Panel

**User Story:** As a dashboard user, I want the text panel to load instantly without waiting for data queries, so that my documentation panels display immediately.

#### Acceptance Criteria

1. WHEN a Text_Panel is rendered on the dashboard, THE Dashboard_Widget SHALL NOT execute any data query requests to the query range API
2. WHEN a Text_Panel is opened in edit mode, THE Panel_Editor SHALL NOT display the "Stage & Run Query" button or any query execution controls
3. THE Text_Panel SHALL render its content within 500 milliseconds of the dashboard layout being painted, without depending on query response data
4. WHEN the dashboard refreshes or the time range changes, THE Text_Panel SHALL NOT trigger any API calls to the query range API
5. IF the Text_Panel content is empty or undefined, THEN THE Text_Panel SHALL render an empty panel area without triggering any error or query fallback

### Requirement 6: Text Panel Dashboard Display

**User Story:** As a dashboard user, I want the text panel to display properly within the dashboard grid, so that it integrates seamlessly with my other dashboard panels.

#### Acceptance Criteria

1. THE Text_Panel SHALL be resizable within the dashboard grid layout using the same drag-to-resize handles as other panel types, with a minimum size of 1 grid column wide and 1 grid row tall
2. THE Text_Panel SHALL be movable via drag-and-drop within the dashboard grid layout
3. IF a title is configured for the Text_Panel, THEN THE Text_Panel SHALL display the title in the panel header area
4. IF no title is configured for the Text_Panel, THEN THE Text_Panel SHALL hide the panel header title area
5. WHEN the rendered markdown content exceeds the panel height, THE Text_Panel SHALL display a vertical scrollbar to access the overflowing content
6. THE Text_Panel SHALL apply the current dashboard theme (light or dark mode) such that text color, background color, and link color are consistent with the theme used by other panel types
7. IF the Text_Panel has no markdown content configured, THEN THE Text_Panel SHALL render the panel area as empty with no error displayed

### Requirement 7: Text Panel Content Security

**User Story:** As a platform administrator, I want markdown content to be rendered safely, so that malicious scripts cannot be injected through the text panel.

#### Acceptance Criteria

1. THE Markdown_Renderer SHALL sanitize all rendered HTML by stripping any elements not in the allowed set (headings, paragraphs, lists, inline formatting, code blocks, tables, blockquotes, and hyperlinks) to prevent cross-site scripting (XSS) attacks
2. THE Markdown_Renderer SHALL strip any inline `<script>`, `<iframe>`, `<object>`, `<embed>`, and `<form>` tags from the rendered output without producing an error or visible placeholder
3. THE Markdown_Renderer SHALL strip all event handler attributes (any attribute beginning with "on", including onclick, onerror, onload, onmouseover, and onfocus) from any HTML elements in the rendered output
4. WHEN a hyperlink is rendered, THE Markdown_Renderer SHALL open links whose href points to a different origin than the application host in a new tab with `rel="noopener noreferrer"` attribute
5. THE Markdown_Renderer SHALL remove or neutralize `javascript:`, `vbscript:`, and `data:` URI schemes from href and src attributes in the rendered output

### Requirement 8: Text Panel Exclusion from Data-Dependent Features

**User Story:** As a dashboard user, I want data-dependent features (export, alerts, thresholds) to be correctly disabled for text panels, so that I do not encounter errors from inapplicable operations.

#### Acceptance Criteria

1. THE Text_Panel SHALL NOT appear in the list of exportable panel types (AVAILABLE_EXPORT_PANEL_TYPES)
2. WHEN the text panel type is selected in the Panel_Editor, THE settings panel SHALL NOT display threshold configuration options
3. WHEN the text panel type is selected in the Panel_Editor, THE settings panel SHALL NOT display Y-axis unit selectors
4. WHEN the text panel type is selected in the Panel_Editor, THE settings panel SHALL NOT display fill span, log scale, or null value handling options
5. THE getComponentForPanelType function SHALL return the Text_Panel component when called with `PANEL_TYPES.TEXT`
6. WHEN the text panel type is selected in the Panel_Editor, THE settings panel SHALL NOT display alert creation options
7. WHEN the text panel type is selected in the Panel_Editor, THE settings panel SHALL NOT display soft min/max, stacking, bucket configuration, column unit, legend position, decimal precision, line interpolation, line style, fill mode, or show points options
