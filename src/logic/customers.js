function normalize(name) {
	return name.trim().replace(/\s+/g, ' ');
}

function newestFirst(orders) {
	return [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function customerSuggestions(orders, text, limit) {
	const query = normalize(text).toLowerCase();
	if (!query) {
		return [];
	}
	const names = [];
	for (const order of newestFirst(orders)) {
		const name = normalize(order.customerName);
		const lower = name.toLowerCase();
		const matches = lower.split(' ').some(word => word.startsWith(query)) || lower.startsWith(query);
		if (matches && lower !== query && !names.includes(name)) {
			names.push(name);
		}
	}
	return names.slice(0, limit);
}

export function lastOrderOf(orders, name) {
	const target = normalize(name);
	return newestFirst(orders).find(o => normalize(o.customerName) === target);
}

export function repeatLines(lines, menu) {
	return lines.flatMap(line => {
		const item = menu.find(m => m.id === line.itemId && m.active);
		return item ? [{ itemId: item.id, name: item.name, price: item.price, qty: line.qty }] : [];
	});
}
