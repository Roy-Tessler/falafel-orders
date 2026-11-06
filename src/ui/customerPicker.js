import { customerSuggestions, lastOrderOf, repeatLines } from '../logic/customers.js';
import { orderSummary } from '../logic/model.js';
import { h, setChildren } from '../dom.js';

const MAX_SUGGESTIONS = 5;

export function customerPicker(orders, menu, handlers) {
	const box = h('div', { class: 'customer-picker' });

	function repeatButton(name) {
		const last = lastOrderOf(orders, name);
		const lines = last ? repeatLines(last.lines, menu) : [];
		if (lines.length === 0) {
			return null;
		}
		return h('button', { class: 'repeat-button', onclick: () => handlers.onRepeat(lines) },
			h('strong', {}, 'כמו בפעם הקודמת: '), orderSummary(lines));
	}
	function update(text) {
		const chips = customerSuggestions(orders, text, MAX_SUGGESTIONS).map(name => h('button', {
			class: 'customer-chip',
			onclick: () => {
				handlers.onPick(name);
				update(name);
			},
		}, name));
		setChildren(box,
			chips.length > 0 ? h('div', { class: 'chips' }, chips) : null,
			text.trim() ? repeatButton(text) : null,
		);
	}
	return { element: box, update };
}
