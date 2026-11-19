export function normalizeName(name) {
	return name.trim().replace(/\s+/g, ' ');
}

export function recentNames(namesNewestFirst, limit) {
	return [...new Set(namesNewestFirst.map(normalizeName).filter(Boolean))].slice(0, limit);
}

export function nameSuggestions(namesNewestFirst, text, limit) {
	const query = normalizeName(text).toLowerCase();
	if (!query) {
		return [];
	}
	return recentNames(namesNewestFirst, Infinity)
		.filter(name => {
			const lower = name.toLowerCase();
			return lower !== query && (lower.startsWith(query) || lower.split(' ').some(word => word.startsWith(query)));
		})
		.slice(0, limit);
}
