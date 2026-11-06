export const FONT_SIZES = Object.freeze([
	{ key: 'normal', label: 'רגיל', px: 20 },
	{ key: 'large', label: 'גדול', px: 23 },
	{ key: 'xlarge', label: 'גדול מאוד', px: 26 },
]);

export const DEFAULT_FONT_SIZE = 'normal';

export function fontSizePx(key) {
	const size = FONT_SIZES.find(s => s.key === key) || FONT_SIZES.find(s => s.key === DEFAULT_FONT_SIZE);
	return size.px;
}
