import { isCustomLine } from './model.js';
import { normalizeName, nameSuggestions } from './names.js';

function newestFirst(orders) {
	return [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function customerSuggestions(orders, text, limit) {
	return nameSuggestions(newestFirst(orders).map(order => order.customerName), text, limit);
}

export function lastOrderOf(orders, name) {
	const target = normalizeName(name);
	return newestFirst(orders).find(o => normalizeName(o.customerName) === target);
}

export function repeatLines(lines, menu) {
	return lines.flatMap(line => {
		if (isCustomLine(line)) {
			return [{ ...line }];
		}
		const item = menu.find(m => m.id === line.itemId && m.active);
		return item ? [{ itemId: item.id, name: item.name, price: item.price, qty: line.qty }] : [];
	});
}
