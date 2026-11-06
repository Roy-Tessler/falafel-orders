import { DEFAULT_FONT_SIZE, fontSizePx } from './logic/settings.js';

const STORAGE_KEY = 'fontSize';

export function loadFontSize() {
	try {
		return localStorage.getItem(STORAGE_KEY) || DEFAULT_FONT_SIZE;
	} catch {
		return DEFAULT_FONT_SIZE;
	}
}

export function applyFontSize(key) {
	document.documentElement.style.fontSize = `${fontSizePx(key)}px`;
}

export function saveFontSize(key) {
	try {
		localStorage.setItem(STORAGE_KEY, key);
	} catch {
		// Without storage the size still applies until the app closes.
	}
	applyFontSize(key);
}
