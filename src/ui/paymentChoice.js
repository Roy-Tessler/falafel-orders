import { METHOD, METHOD_LABELS, isMethod, validatePayments } from '../logic/payments.js';
import { h, icon, formatMoney } from '../dom.js';

const METHODS = Object.values(METHOD);
const MODES = [
	['unpaid', 'לא שולם'],
	...METHODS.map(method => [method, METHOD_LABELS[method]]),
	['split', 'מפוצל / חלקי'],
];

function parseAmount(text) {
	const trimmed = String(text).trim();
	return trimmed === '' ? 0 : Number(trimmed);
}

export function draftPayments(state, total) {
	if (isMethod(state.payMode)) {
		return [{ method: state.payMode, amount: total }];
	}
	if (state.payMode === 'split') {
		return METHODS.map(method => ({ method, amount: parseAmount(state.split[method]) }));
	}
	return [];
}

function amountField(label, method, state, onChange) {
	return h('label', { class: 'split-field' },
		h('span', {}, label),
		h('input', { inputmode: 'numeric', value: state.split[method], placeholder: '0', 'aria-label': label,
			oninput: e => { state.split[method] = e.target.value; onChange(); } }),
	);
}

export function paymentChoice(state, getTotal, onChange) {
	const remainingLine = h('div', { class: 'split-remaining' });
	const splitBox = h('div', { class: 'split-box' });
	const buttons = MODES.map(([mode, label]) => h('button', { class: `choice choice-${mode}`, onclick: () => {
		state.payMode = mode;
		refresh();
		onChange();
	} }, isMethod(mode) ? icon(mode, 'text-icon method-icon') : null, label));

	function updateRemaining() {
		const total = getTotal();
		const payments = draftPayments(state, total);
		const errors = validatePayments(payments, total);
		const paid = payments.reduce((sum, p) => sum + (Number.isInteger(p.amount) ? p.amount : 0), 0);
		remainingLine.className = errors.length > 0 ? 'split-remaining error' : 'split-remaining';
		remainingLine.textContent = errors.length > 0 ? errors[0] : `נשאר לשלם: ${formatMoney(Math.max(0, total - paid))}`;
	}
	function refresh() {
		buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(MODES[i][0] === state.payMode)));
		splitBox.hidden = state.payMode !== 'split';
		updateRemaining();
	}
	splitBox.append(
		...METHODS.map(method => amountField(`${METHOD_LABELS[method]} ₪`, method, state, () => { updateRemaining(); onChange(); })),
		remainingLine,
	);
	refresh();
	const element = h('div', {}, h('div', { class: 'payment-choice five', role: 'group', 'aria-label': 'תשלום' }, buttons), splitBox);
	return { element, refresh, updateRemaining };
}
