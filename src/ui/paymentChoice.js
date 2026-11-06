import { METHOD, validatePayments } from '../logic/payments.js';
import { h, formatMoney } from '../dom.js';

const MODES = [
	['unpaid', 'לא שולם'],
	['paybox', 'פייבוקס'],
	['cash', 'מזומן'],
	['split', 'מפוצל / חלקי'],
];

function parseAmount(text) {
	const trimmed = String(text).trim();
	return trimmed === '' ? 0 : Number(trimmed);
}

export function draftPayments(state, total) {
	if (state.payMode === 'paybox') {
		return [{ method: METHOD.PAYBOX, amount: total }];
	}
	if (state.payMode === 'cash') {
		return [{ method: METHOD.CASH, amount: total }];
	}
	if (state.payMode === 'split') {
		return [
			{ method: METHOD.PAYBOX, amount: parseAmount(state.split.paybox) },
			{ method: METHOD.CASH, amount: parseAmount(state.split.cash) },
		];
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
	} }, label));

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
		amountField('פייבוקס ₪', METHOD.PAYBOX, state, () => { updateRemaining(); onChange(); }),
		amountField('מזומן ₪', METHOD.CASH, state, () => { updateRemaining(); onChange(); }),
		remainingLine,
	);
	refresh();
	const element = h('div', {}, h('div', { class: 'payment-choice four', role: 'group', 'aria-label': 'תשלום' }, buttons), splitBox);
	return { element, refresh, updateRemaining };
}
