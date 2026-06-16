# Requirements Document

## Introduction

This specification covers the remaining operational and feature work needed to finalize the SigNoz dashboard deployment for EPOS monitoring. The EPOS monitoring system runs Standalone Acceptance Tests (SAT) every ~60 seconds inside a k3d cluster, producing `cicd_pipeline_test_verdict` metrics that should flow through the OpenTelemetry Collector into ClickHouse for visualization in SigNoz dashboards.

Currently, a critical data flow issue exists: metrics stopped reaching ClickHouse 18+ hours ago despite the SAT pod running and the OTel Collector being healthy. The metric-pushing mechanism (a Java `monitoring.jar`) may be silently failing. Additionally, mock data from development needs to be cleaned from ClickHouse, table panel sorting needs verification, the text panel editor needs a proper content editing UI, and all changes need to be committed and pushed.

## Glossary

- **Metric_Pusher**: The component responsible for reading SAT test results and pushing `cicd_pipeline_test_verdict` metrics via OTLP HTTP to the OTel Collector. Currently implemented as `monitoring.jar` (Java) with a Python `signoz_exporter.py` backup available.
- **SAT_Pod**: The `epos-standalonetest` pod running in the k3d `epos` namespace that executes automated acceptance tests every ~60 seconds and produces test verdict results.
- **OTel_Collector**: The OpenTelemetry Collector service accepting metrics on port 4318 (HTTP) and forwarding them to ClickHouse for storage.
- **ClickHouse**: The columnar database storing all SigNoz metrics data, accessible via TCP on port 9000 and HTTP on port 8123.
- **Monitoring_Jar**: The Java application (`monitoring.jar`) at `~/repo/epos/monitoring.jar` that pushes metrics to SigNoz using flags `-DenableSignozPush=true` and `-DsignozOtlpEndpoint`.
- **Python_Exporter**: The backup Python script (`signoz_exporter.py.bak`) at `~/repo/epos/standalonetest/src/` that reads SAT results and pushes metrics via OTLP HTTP.
- **Run_Monitoring_Script**: The shell script at `~/repo/SigNoz/signoz/run-monitoring-pusher.sh` that manages the Monitoring_Jar process lifecycle.
- **Mock_Data**: Test data previously inserted into ClickHouse during development that references a non-existent `AuthService` and needs removal.
- **Table_Panel**: A SigNoz dashboard panel type that displays metric data in a tabular format with configurable sorting.
- **Text_Panel**: A SigNoz dashboard panel type that displays static markdown or text content for informational purposes.
- **Host_Bridge_IP**: The IP address `172.17.0.1` used by pods inside k3d to reach services running on the host machine.
- **Feature_Branch**: The Git branch `feature/state-timeline-panel` on the fork `MikaelEngvall/signoz` where all changes are tracked.

## Requirements

### Requirement 1: Restore Metric Data Flow to ClickHouse

**User Story:** As a dashboard operator, I want metrics from the SAT pod to reliably reach ClickHouse, so that the EPOS monitoring dashboards display current, real data instead of stale or missing values.

#### Acceptance Criteria

1. WHEN the Metric_Pusher is started via the Run_Monitoring_Script, THE Metric_Pusher SHALL write output to `/tmp/epos-monitoring-pusher.log` that includes a timestamp and a status keyword of either "SUCCESS" or "FAILURE" for each push attempt, along with the OTel_Collector endpoint URL targeted
2. IF the Run_Monitoring_Script detects no new `cicd_pipeline_test_verdict` data points in ClickHouse for more than 5 minutes or errors containing "connection refused" or "timeout" in the log file, THEN THE Run_Monitoring_Script SHALL output a failure status message that includes the time since the last successful push and the nature of the error
3. THE Metric_Pusher SHALL push `cicd_pipeline_test_verdict` gauge metrics to the OTel_Collector endpoint at `http://localhost:4318/v1/metrics` using the OTLP HTTP protocol at an interval of no more than 300 seconds between consecutive pushes
4. WHEN new metrics are pushed, THE OTel_Collector SHALL forward them to ClickHouse such that they appear in the `signoz_metrics.samples_v4` table within 60 seconds of ingestion
5. IF no new `cicd_pipeline_test_verdict` data points appear in the ClickHouse `signoz_metrics.samples_v4` table for more than 10 minutes despite the Monitoring_Jar process running and the OTel_Collector health endpoint (`localhost:13133`) returning healthy, THEN THE Python_Exporter SHALL be restored from its `.bak` backup and configured as the active metric-pushing mechanism
6. THE Python_Exporter SHALL read SAT test results from the SAT_Pod and push `cicd_pipeline_test_verdict` gauge metrics with labels `cicd_test_case_service`, `cicd_test_case_name`, and `cicd_pipeline_test_verdict_value` via OTLP HTTP to the OTel_Collector, where the metric value is a float64 of 1.0 for pass and 0.0 for fail
7. THE Metric_Pusher (whether Java or Python) SHALL be reachable from inside the k3d cluster to the host OTel_Collector using the Host_Bridge_IP (`172.17.0.1:4318`)
8. WHEN at least one successful push cycle completes after the Metric_Pusher is started or restarted, THE ClickHouse `signoz_metrics.samples_v4` table SHALL contain new `cicd_pipeline_test_verdict` data points with timestamps within the last 5 minutes
9. IF the OTel_Collector endpoint is unreachable from the Metric_Pusher, THEN THE Metric_Pusher SHALL log an error indicating the connection failure and retry on the next push interval without terminating the process

### Requirement 2: Remove Mock Data from ClickHouse

**User Story:** As a dashboard operator, I want all mock/test data removed from ClickHouse, so that the dashboards only display real metrics from actual SAT test runs and are not polluted with fake development data.

#### Acceptance Criteria

1. WHEN the cleanup operation is executed, THE ClickHouse database SHALL remove all rows from `signoz_metrics.samples_v4` where the fingerprint corresponds to metrics with `metric_name='cicd_pipeline_test_verdict'` AND label `cicd_test_case_service='AuthService'`
2. WHEN the cleanup operation is executed, THE ClickHouse database SHALL remove all rows from `signoz_metrics.time_series_v4` where `metric_name='cicd_pipeline_test_verdict'` AND the labels JSON contains `cicd_test_case_service` with value `AuthService`
3. THE cleanup SQL statements SHALL use the `SETTINGS allow_nondeterministic_mutations=1` clause appended to each `ALTER TABLE ... DELETE` statement to enable the mutation on MergeTree tables
4. IF the cleanup operation fails due to a ClickHouse error, THEN THE system SHALL output the ClickHouse error code, error message, and the SQL statement that failed
5. WHEN the cleanup is complete, THE ClickHouse query `SELECT count() FROM signoz_metrics.time_series_v4 WHERE metric_name='cicd_pipeline_test_verdict' AND JSONExtractString(labels,'cicd_test_case_service')='AuthService'` SHALL return zero rows
6. THE cleanup operation SHALL NOT delete any rows where `cicd_test_case_service` has a value other than `AuthService`

### Requirement 3: Verify Table Panel Sorting Behavior

**User Story:** As a dashboard user, I want the table panels to sort results correctly (by value descending, then alphabetically by service name), so that the most critical information appears first and services are easy to find.

#### Acceptance Criteria

1. THE Table_Panel displaying "Latest Status" data SHALL sort rows by the "Status" column value in descending numeric order (1 before 0) as the primary sort criterion
2. THE Table_Panel displaying "Latest Status" data SHALL sort rows alphabetically (case-insensitive, A–Z) by the "Service" column in ascending order as the secondary sort criterion when rows have equal "Status" values
3. THE Table_Panel displaying "Availability % per Service" data SHALL sort rows by the "Availability %" column value in descending numeric order as the primary sort criterion
4. THE Table_Panel displaying "Availability % per Service" data SHALL sort rows alphabetically (case-insensitive, A–Z) by the "Service" column in ascending order as the secondary sort criterion when rows have equal "Availability %" values
5. WHEN new metric data arrives and the Table_Panel refreshes, THE Table_Panel SHALL re-apply the configured sort order to the updated data set without requiring user interaction
6. IF a Table_Panel query returns zero data rows, THEN THE Table_Panel SHALL display a "No Data" indicator in place of the table body
7. THE Table_Panel displaying "Latest Status" data SHALL show a maximum of 30 service rows, sorted according to criteria 1 and 2 before truncation

### Requirement 4: Text Panel Content Editor

**User Story:** As a dashboard editor, I want a proper content editor in the text panel settings, so that I can enter and edit markdown content without resorting to direct JSON manipulation of the dashboard configuration.

#### Acceptance Criteria

1. WHEN the Text_Panel type is selected in the panel editor settings, THE panel editor SHALL display a textarea input field for entering and editing text content
2. THE textarea input field SHALL have a minimum height of 200 pixels, SHALL expand vertically to accommodate the entered content up to a maximum height of 500 pixels, and SHALL display a vertical scrollbar when content exceeds the maximum height
3. THE textarea input field SHALL allow entry of markdown-formatted text including headings, bold, italic, lists, links, and code blocks without stripping or modifying any entered characters, up to a maximum of 100,000 characters
4. WHEN the user types content into the textarea, THE Text_Panel preview SHALL update to show the rendered markdown within 500 milliseconds
5. WHEN the user saves the panel configuration, THE Text_Panel content editor SHALL persist all whitespace and newlines exactly as entered by the user
6. WHEN the panel editor is opened for an existing Text_Panel that already has content, THE textarea SHALL be pre-populated with the existing content
7. IF the user clears all content from the textarea and saves, THEN THE Text_Panel SHALL display an empty panel without errors
8. IF the user enters content exceeding 100,000 characters, THEN THE textarea SHALL prevent further input and SHALL display an indication that the maximum content length has been reached

### Requirement 5: Commit and Push All Changes

**User Story:** As a developer, I want all accumulated frontend and operational changes committed and pushed to the feature branch, so that the work is preserved in version control and available for review.

#### Acceptance Criteria

1. WHEN the commit operation is performed, THE commit SHALL include all modified and new files in the SigNoz repository workspace that were added or changed as part of the dashboard finalization tasks, including frontend source files, configuration files, and documentation
2. THE commit SHALL be pushed to the Feature_Branch (`feature/state-timeline-panel`) on the `MikaelEngvall/signoz` fork remote
3. THE commit message SHALL use conventional commit format with a subject line of 50 characters or fewer, an empty line separator, a body with lines of 72 characters or fewer describing the changes, and a `Tracking-Id` footer in the format `Tracking-Id: JIRA-ID: <id-or-NONE> GEN:<NA|LOW|HIGH>`
4. THE commit SHALL NOT include any files matching patterns listed in the repository `.gitignore`, nor any files containing credentials, API keys, tokens, passwords, or `.env` files
5. IF the push operation fails due to remote conflicts, THEN THE system SHALL display an error message stating that the push was rejected due to divergent remote history and indicate that the operator must pull and rebase or merge before retrying
6. THE commit SHALL include operational scripts (`run-monitoring-pusher.sh`, `start-local-dev.sh`) and any restored or new metric-pushing scripts
7. WHEN the push operation completes successfully, THE system SHALL display a confirmation message including the remote branch name and the commit SHA that was pushed
