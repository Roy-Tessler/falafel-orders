const DAY_NAMES = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];
const PROPERTY_KEYS = new Set(['value', 'disabled', 'checked']);

export function h(tag, props = {}, ...children) {
	const el = document.createElement(tag);
	for (const [key, value] of Object.entries(props || {})) {
		if (value === undefined || value === null || value === false) {
			continue;
		}
		if (key.startsWith('on') && typeof value === 'function') {
			el.addEventListener(key.slice(2).toLowerCase(), value);
		} else if (key === 'class') {
			el.className = value;
		} else if (PROPERTY_KEYS.has(key)) {
			el[key] = value;
		} else {
			el.setAttribute(key, value === true ? '' : String(value));
		}
	}
	for (const child of children.flat()) {
		if (child === null || child === undefined || child === false) {
			continue;
		}
		el.append(child instanceof Node ? child : document.createTextNode(String(child)));
	}
	return el;
}

export function formatMoney(amount) {
	return `₪${amount.toLocaleString('en-US')}`;
}

export function formatTime(iso) {
	const d = new Date(iso);
	return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDate(date) {
	const [y, m, d] = date.split('-').map(Number);
	const day = new Date(y, m - 1, d).getDay();
	return `${DAY_NAMES[day]} ${d}.${m}`;
}

export function confirmPanel(message, yesLabel, onYes, onNo) {
	const panel = h('div', { class: 'card confirm', role: 'alertdialog' },
		h('p', {}, message),
		h('div', { class: 'row' },
			h('button', { class: 'danger', onclick: () => { panel.remove(); onYes(); } }, yesLabel),
			h('button', { onclick: () => { panel.remove(); if (onNo) { onNo(); } } }, 'ביטול'),
		),
	);
	return panel;
}

export const SAVE_FAILED = 'השמירה נכשלה, נסו שוב';

export function showToast(message, isError = false) {
	const toast = h('div', { class: isError ? 'toast toast-error' : 'toast', role: 'status' }, message);
	document.body.append(toast);
	setTimeout(() => toast.remove(), 2000);
}
