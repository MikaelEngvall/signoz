import { MarkdownRenderer } from 'components/MarkdownRenderer/MarkdownRenderer';

import { PanelWrapperProps } from './panelWrapper.types';

function TextPanelWrapper({ widget }: PanelWrapperProps): JSX.Element {
	const content = (widget as any).textContent || widget.description || '';

	return (
		<div
			style={{
				width: '100%',
				height: '100%',
				padding: '12px 16px',
				overflow: 'auto',
				display: 'flex',
				alignItems: 'center',
			}}
		>
			<MarkdownRenderer
				markdownContent={content}
				variables={{}}
				className="text-panel-content"
			/>
		</div>
	);
}

export default TextPanelWrapper;
