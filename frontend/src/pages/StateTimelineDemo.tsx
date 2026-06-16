/**
 * Standalone demo page for the State Timeline panel.
 * Access at: http://localhost:3302/state-timeline-demo
 *
 * This bypasses the dashboard grid and panel editor to render
 * the StateTimelinePanel component directly with mock data.
 */
import { useMemo, useState } from 'react';
import { useIsDarkMode } from 'hooks/useDarkMode';
import { LegendPosition } from 'types/api/dashboard/getAll';

import StateTimelinePanel from 'container/DashboardContainer/visualization/panels/StateTimelinePanel/StateTimelinePanel';
import { transformSeriesToSwimLanes } from 'container/DashboardContainer/visualization/panels/StateTimelinePanel/utils/transformData';
import { SwimLaneModel } from 'container/DashboardContainer/visualization/panels/StateTimelinePanel/utils/transformData';
import { ThresholdProps } from 'container/NewWidget/RightContainer/Threshold/types';
import { PANEL_TYPES } from 'constants/queryBuilder';

// Generate mock data simulating BOS services
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function generateMockQueryData() {
	const services = [
		'aca',
		'arm',
		'codechecker',
		'dpraf',
		'elasticsearch',
		'eridoc',
		'evms',
		'ews',
		'fossa',
		'git',
		'gitca',
		'jenkins',
		'jira',
		'mimer',
		'hydra',
		'kronos',
		'malwarescan',
		'pki',
		'plmws',
		'scas',
		'sonarqube',
		'spinnaker',
		'wallix',
	];

	const now = Math.floor(Date.now() / 1000);
	const twoDaysAgo = now - 2 * 86400;
	const stepInterval = 300; // 5 minutes

	const series = services.map((service) => {
		const values = [];
		for (let t = twoDaysAgo; t <= now; t += stepInterval) {
			const isFlaky = ['jenkins', 'sonarqube', 'hydra'].includes(service);
			const isIntermittent = ['evms', 'arm', 'gitca', 'elasticsearch'].includes(
				service,
			);
			let value = '1'; // pass
			if (isFlaky && Math.random() < 0.3) {
				value = '0'; // fail
			} else if (isFlaky && Math.random() < 0.2) {
				value = '0.5'; // intermittent
			}
			if (isIntermittent && Math.random() < 0.15) {
				value = '0.5'; // intermittent
			}
			if (service === 'wallix' && t > now - 3600) {
				value = '0'; // wallix failed in the last hour
			}
			values.push({ timestamp: t, value });
		}
		return {
			labels: { cicd_test_case_service: service },
			labelsArray: [{ cicd_test_case_service: service }],
			values,
		};
	});

	return [
		{
			series,
			list: null,
			queryName: 'A',
		},
	];
}

/**
 * Generate a "Combined Status" series that averages all services at each timestamp.
 * This produces a single row showing the overall health across all services.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function generateCombinedQueryData(allServiceData: any[]) {
	const series = allServiceData[0].series;
	if (!series || series.length === 0) {
		return [{ series: null, list: null, queryName: 'A' }];
	}

	const numTimestamps = series[0].values.length;
	const combinedValues = [];

	for (let i = 0; i < numTimestamps; i++) {
		const timestamp = series[0].values[i].timestamp;
		// Average of all services at this timestamp
		let sum = 0;
		for (const s of series) {
			sum += parseFloat(s.values[i].value);
		}
		const avg = sum / series.length;
		combinedValues.push({ timestamp, value: String(avg) });
	}

	return [
		{
			series: [
				{
					labels: { service: 'All Services' },
					labelsArray: [{ service: 'All Services' }],
					values: combinedValues,
				},
			],
			list: null,
			queryName: 'A',
		},
	];
}

function StateTimelineDemo(): JSX.Element {
	const isDarkMode = useIsDarkMode();

	const queryData = useMemo(() => generateMockQueryData(), []);
	const combinedData = useMemo(
		() => generateCombinedQueryData(queryData),
		[queryData],
	);

	const now = Math.floor(Date.now() / 1000);
	const [timeRange, setTimeRange] = useState({
		start: now - 2 * 86400,
		end: now,
	});

	// Time range presets
	const timePresets = [
		{ label: '30m', seconds: 30 * 60 },
		{ label: '1h', seconds: 3600 },
		{ label: '6h', seconds: 6 * 3600 },
		{ label: '12h', seconds: 12 * 3600 },
		{ label: '1d', seconds: 86400 },
		{ label: '2d', seconds: 2 * 86400 },
		{ label: '7d', seconds: 7 * 86400 },
	];

	const noopMove = (): void => {};

	const thresholds: ThresholdProps[] = [
		{
			index: '0',
			keyIndex: 0,
			moveThreshold: noopMove,
			selectedGraph: PANEL_TYPES.STATE_TIMELINE,
			thresholdColor: '#73BF69', // Grafana's green
			thresholdFormat: 'Background',
			thresholdOperator: '>=',
			thresholdValue: 1,
			thresholdLabel: 'Passed',
		},
		{
			index: '1',
			keyIndex: 1,
			moveThreshold: noopMove,
			selectedGraph: PANEL_TYPES.STATE_TIMELINE,
			thresholdColor: '#FADE2A', // Grafana's yellow
			thresholdFormat: 'Background',
			thresholdOperator: '>',
			thresholdValue: 0,
			thresholdLabel: 'Intermittent',
		},
		{
			index: '2',
			keyIndex: 2,
			moveThreshold: noopMove,
			selectedGraph: PANEL_TYPES.STATE_TIMELINE,
			thresholdColor: '#F2495C', // Grafana's red
			thresholdFormat: 'Background',
			thresholdOperator: '<=',
			thresholdValue: 0,
			thresholdLabel: 'Failed',
		},
	];

	// Combined status uses different thresholds (average-based)
	const combinedThresholds: ThresholdProps[] = [
		{
			index: '0',
			keyIndex: 0,
			moveThreshold: noopMove,
			selectedGraph: PANEL_TYPES.STATE_TIMELINE,
			thresholdColor: '#73BF69', // green — all services passing
			thresholdFormat: 'Background',
			thresholdOperator: '>=',
			thresholdValue: 0.95,
			thresholdLabel: 'All Passed',
		},
		{
			index: '1',
			keyIndex: 1,
			moveThreshold: noopMove,
			selectedGraph: PANEL_TYPES.STATE_TIMELINE,
			thresholdColor: '#FADE2A', // yellow — some intermittent
			thresholdFormat: 'Background',
			thresholdOperator: '>=',
			thresholdValue: 0.7,
			thresholdLabel: 'Degraded',
		},
		{
			index: '2',
			keyIndex: 2,
			moveThreshold: noopMove,
			selectedGraph: PANEL_TYPES.STATE_TIMELINE,
			thresholdColor: '#F2495C', // red — significant failures
			thresholdFormat: 'Background',
			thresholdOperator: '<',
			thresholdValue: 0.7,
			thresholdLabel: 'Critical',
		},
	];

	const swimLaneModel: SwimLaneModel = useMemo(
		() =>
			transformSeriesToSwimLanes(
				queryData,
				timeRange,
				thresholds,
				isDarkMode,
				'{{cicd_test_case_service}}',
			),
		[queryData, timeRange, thresholds, isDarkMode],
	);

	const combinedModel: SwimLaneModel = useMemo(
		() =>
			transformSeriesToSwimLanes(
				combinedData,
				timeRange,
				combinedThresholds,
				isDarkMode,
				'{{service}}',
			),
		[combinedData, timeRange, combinedThresholds, isDarkMode],
	);

	const panelWidth = window.innerWidth - 50;

	// Drag-to-zoom: update local time range
	const handleDragSelect = (startMs: number, endMs: number): void => {
		setTimeRange({
			start: Math.floor(startMs / 1000),
			end: Math.floor(endMs / 1000),
		});
	};

	const handleResetZoom = (): void => {
		setTimeRange({ start: now - 2 * 86400, end: now });
	};

	const handleTimePreset = (seconds: number): void => {
		const currentNow = Math.floor(Date.now() / 1000);
		setTimeRange({ start: currentNow - seconds, end: currentNow });
	};

	return (
		<div
			style={{
				padding: '16px 24px',
				width: '100%',
				height: '100vh',
				backgroundColor: isDarkMode ? '#121317' : '#ffffff',
				color: isDarkMode ? '#e0e0e0' : '#1a1a1a',
				overflow: 'auto',
			}}
		>
			{/* Top bar with title and time picker */}
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					marginBottom: '12px',
				}}
			>
				<h1 style={{ fontSize: '18px', margin: 0, fontWeight: 600 }}>
					Health-Check Overview
				</h1>
				<div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
					{timePresets.map((preset) => (
						<button
							key={preset.label}
							onClick={(): void => handleTimePreset(preset.seconds)}
							style={{
								padding: '4px 10px',
								fontSize: '12px',
								backgroundColor:
									timeRange.end - timeRange.start === preset.seconds
										? '#3b82f6'
										: '#2c2d33',
								color: '#c8ccd4',
								border: '1px solid #3c3d43',
								borderRadius: '3px',
								cursor: 'pointer',
							}}
						>
							{preset.label}
						</button>
					))}
					<button
						onClick={handleResetZoom}
						style={{
							padding: '4px 10px',
							fontSize: '12px',
							backgroundColor: '#2c2d33',
							color: '#c8ccd4',
							border: '1px solid #3c3d43',
							borderRadius: '3px',
							cursor: 'pointer',
							marginLeft: '8px',
						}}
					>
						↺ Reset
					</button>
				</div>
			</div>
			{/* Combined Status History */}
			<div style={{ marginBottom: '12px' }}>
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						marginBottom: '6px',
					}}
				>
					<h2
						style={{ fontSize: '14px', fontWeight: 500, margin: 0, color: '#9ca3af' }}
					>
						Combined Status History
					</h2>
				</div>
				<div
					style={{
						width: '100%',
						height: '80px',
						border: `1px solid ${isDarkMode ? '#2c2d33' : '#e5e7eb'}`,
						borderRadius: '4px',
						overflow: 'hidden',
						backgroundColor: '#181b1f',
					}}
				>
					<StateTimelinePanel
						swimLaneModel={combinedModel}
						width={panelWidth}
						height={80}
						isDarkMode={isDarkMode}
						legendPosition={LegendPosition.BOTTOM}
						onDragSelect={handleDragSelect}
					/>
				</div>
			</div>

			{/* Per-Service Status History */}
			<div>
				<h2 style={{ fontSize: '16px', marginBottom: '8px', fontWeight: 500 }}>
					Status History
				</h2>
				<p style={{ fontSize: '12px', opacity: 0.6, marginBottom: '8px' }}>
					23 BOS services • Green = Passed (=1) • Yellow = Intermittent (0&lt;x&lt;1)
					• Red = Failed (≤0) • Last 2 days
				</p>
				<div
					style={{
						width: '100%',
						height: 'calc(100vh - 240px)',
						border: `1px solid ${isDarkMode ? '#2c2d33' : '#e5e7eb'}`,
						borderRadius: '4px',
						overflow: 'hidden',
						backgroundColor: '#181b1f',
					}}
				>
					<StateTimelinePanel
						swimLaneModel={swimLaneModel}
						width={panelWidth}
						height={window.innerHeight - 260}
						isDarkMode={isDarkMode}
						legendPosition={LegendPosition.BOTTOM}
						onDragSelect={handleDragSelect}
					/>
				</div>
			</div>
		</div>
	);
}

export default StateTimelineDemo;
