import { ThresholdProps } from 'container/NewWidget/RightContainer/Threshold/types';
import { QueryDataV3, SeriesItem } from 'types/api/widgets/getQuery';

import {
	evaluateThreshold,
	ThresholdEvalResult,
} from './evaluateThreshold';
import { resolveSeriesLabel } from './legendResolver';

// ===== Interfaces =====

export interface TimeRange {
	start: number; // epoch seconds
	end: number; // epoch seconds
}

export interface SegmentData {
	startTime: number; // epoch seconds
	endTime: number; // epoch seconds
	value: number | null;
	color: string; // hex color from threshold evaluation
	thresholdLabel?: string; // optional label from matching threshold rule
}

export interface SwimLaneRowData {
	label: string;
	segments: SegmentData[];
	seriesLabels: Record<string, string>; // original labels for context links
}

export interface SwimLaneModel {
	rows: SwimLaneRowData[];
	timeRange: TimeRange;
}

// ===== Constants =====

const DEFAULT_COLOR_LIGHT = '#9CA3AF';
const DEFAULT_COLOR_DARK = '#6B7280';

// ===== Helper Functions =====

/**
 * Parses a string value to a number, returning null for non-numeric or empty values.
 */
function parseValue(value: string): number | null {
	if (value === '' || value === 'null' || value === 'undefined') {
		return null;
	}
	const parsed = parseFloat(value);
	if (Number.isNaN(parsed)) {
		return null;
	}
	return parsed;
}

/**
 * Builds segments from a series' values array. Each segment spans from one
 * data point to the next. The last segment extends to timeRange.end.
 * A single data point produces one segment spanning the full time range.
 * Series with no values produce an empty segments array.
 */
function buildSegments(
	values: { timestamp: number; value: string }[],
	timeRange: TimeRange,
	thresholds: ThresholdProps[],
	defaultColor: string,
): SegmentData[] {
	if (values.length === 0) {
		return [];
	}

	// Normalize timestamps: if values are in ms (>1e12) but timeRange is in seconds, convert
	const firstTs = values[0].timestamp;
	const tsNeedsConversion = firstTs > 1e12 && timeRange.start < 1e12;
	const normalizeTs = (ts: number): number => tsNeedsConversion ? ts / 1000 : ts;

	if (values.length === 1) {
		const numericValue = parseValue(values[0].value);
		const evalResult: ThresholdEvalResult = evaluateThreshold(
			numericValue,
			thresholds,
			defaultColor,
		);
		return [
			{
				startTime: normalizeTs(values[0].timestamp),
				endTime: timeRange.end,
				value: numericValue,
				color: evalResult.color,
				thresholdLabel: evalResult.label,
			},
		];
	}

	const segments: SegmentData[] = [];

	for (let i = 0; i < values.length; i++) {
		const numericValue = parseValue(values[i].value);
		const evalResult: ThresholdEvalResult = evaluateThreshold(
			numericValue,
			thresholds,
			defaultColor,
		);

		const startTime = normalizeTs(values[i].timestamp);
		const endTime =
			i < values.length - 1 ? normalizeTs(values[i + 1].timestamp) : timeRange.end;

		segments.push({
			startTime,
			endTime,
			value: numericValue,
			color: evalResult.color,
			thresholdLabel: evalResult.label,
		});
	}

	// Merge consecutive segments with the same color (same state)
	// This produces wider segments like Grafana does
	return mergeConsecutiveSegments(segments);
}

/**
 * Merges consecutive segments that have the same color/state into a single
 * wider segment. This makes the tooltip show the actual duration the service
 * remained in that state, rather than the individual data point interval.
 */
function mergeConsecutiveSegments(segments: SegmentData[]): SegmentData[] {
	if (segments.length <= 1) return segments;

	const merged: SegmentData[] = [segments[0]];

	for (let i = 1; i < segments.length; i++) {
		const current = segments[i];
		const last = merged[merged.length - 1];

		if (current.color === last.color) {
			// Same state — extend the previous segment
			last.endTime = current.endTime;
		} else {
			// Different state — start a new segment
			merged.push({ ...current });
		}
	}

	return merged;
}

// ===== Main Transform Function =====

/**
 * Transforms QueryDataV3 series data into a SwimLaneModel for rendering.
 *
 * Pipeline:
 * 1. Extract series from all query data
 * 2. Resolve labels (legend template or key=value fallback)
 * 3. Sort alphabetically (case-insensitive)
 * 4. Build segments from timestamp values
 * 5. Evaluate thresholds for segment colors
 *
 * Edge cases:
 * - Empty series → empty rows
 * - Single data point → full-width segment (startTime to timeRange.end)
 * - null/NaN values → value = null, colored with default gray
 * - Series with zero values → skipped (not rendered)
 */
export function transformSeriesToSwimLanes(
	queryData: QueryDataV3[],
	timeRange: TimeRange,
	thresholds: ThresholdProps[],
	isDarkMode: boolean,
	legendTemplate?: string,
): SwimLaneModel {
	const defaultColor = isDarkMode ? DEFAULT_COLOR_DARK : DEFAULT_COLOR_LIGHT;

	// Step 1: Extract all series from all query data entries
	const allSeries: { series: SeriesItem; legend?: string }[] = [];

	for (const qd of queryData) {
		if (!qd.series || qd.series.length === 0) {
			continue;
		}
		for (const series of qd.series) {
			allSeries.push({ series, legend: qd.legend });
		}
	}

	// Step 2: Resolve labels and build rows
	const rows: SwimLaneRowData[] = [];

	for (const { series, legend } of allSeries) {
		// Skip series with no values
		if (!series.values || series.values.length === 0) {
			continue;
		}

		// Resolve label: use provided legendTemplate, then query-level legend, then fallback
		const effectiveTemplate = legendTemplate || legend;
		const label = resolveSeriesLabel(series, effectiveTemplate);

		// Step 4 & 5: Build segments with threshold evaluation
		const segments = buildSegments(
			series.values,
			timeRange,
			thresholds,
			defaultColor,
		);

		rows.push({
			label,
			segments,
			seriesLabels: { ...series.labels },
		});
	}

	// Step 3: Sort alphabetically (case-insensitive)
	rows.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));

	return {
		rows,
		timeRange,
	};
}
