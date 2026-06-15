import { useCallback, useMemo } from 'react';
import { Input, Button } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { Typography } from '@signozhq/ui/typography';

import SettingsSection from '../../components/SettingsSection/SettingsSection';

interface ColumnAliasEntry {
	key: string;
	displayName: string;
}

interface ColumnAliasesSectionProps {
	customColTitles: Record<string, string>;
	setCustomColTitles: (titles: Record<string, string>) => void;
}

function ColumnAliasesSection({
	customColTitles,
	setCustomColTitles,
}: ColumnAliasesSectionProps): JSX.Element {
	const entries: ColumnAliasEntry[] = useMemo(
		() =>
			Object.entries(customColTitles || {}).map(([key, displayName]) => ({
				key,
				displayName,
			})),
		[customColTitles],
	);

	const handleAdd = useCallback((): void => {
		setCustomColTitles({
			...customColTitles,
			'': '',
		});
	}, [customColTitles, setCustomColTitles]);

	const handleRemove = useCallback(
		(keyToRemove: string): void => {
			const updated = { ...customColTitles };
			delete updated[keyToRemove];
			setCustomColTitles(updated);
		},
		[customColTitles, setCustomColTitles],
	);

	const handleKeyChange = useCallback(
		(oldKey: string, newKey: string): void => {
			const updated: Record<string, string> = {};
			for (const [k, v] of Object.entries(customColTitles || {})) {
				if (k === oldKey) {
					updated[newKey] = v;
				} else {
					updated[k] = v;
				}
			}
			setCustomColTitles(updated);
		},
		[customColTitles, setCustomColTitles],
	);

	const handleValueChange = useCallback(
		(key: string, newValue: string): void => {
			setCustomColTitles({
				...customColTitles,
				[key]: newValue,
			});
		},
		[customColTitles, setCustomColTitles],
	);

	return (
		<SettingsSection title="Column Aliases">
			<Typography.Text
				style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '8px', display: 'block' }}
			>
				Rename table column headers for display. Leave blank to use the raw name.
			</Typography.Text>

			{entries.map((entry, index) => (
				<div
					// eslint-disable-next-line react/no-array-index-key
					key={index}
					style={{
						display: 'flex',
						gap: '8px',
						marginBottom: '8px',
						alignItems: 'center',
					}}
				>
					<Input
						placeholder="Column key"
						value={entry.key}
						onChange={(e): void => handleKeyChange(entry.key, e.target.value)}
						style={{ flex: 1 }}
						size="small"
					/>
					<Input
						placeholder="Display name"
						value={entry.displayName}
						onChange={(e): void => handleValueChange(entry.key, e.target.value)}
						style={{ flex: 1 }}
						size="small"
					/>
					<Button
						type="text"
						size="small"
						icon={<DeleteOutlined />}
						onClick={(): void => handleRemove(entry.key)}
						danger
					/>
				</div>
			))}

			<Button
				type="dashed"
				size="small"
				icon={<PlusOutlined />}
				onClick={handleAdd}
				style={{ width: '100%' }}
			>
				Add Column Alias
			</Button>
		</SettingsSection>
	);
}

export default ColumnAliasesSection;
