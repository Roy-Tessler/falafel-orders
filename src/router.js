import { h } from './dom.js';

const ROUTES = [
	{ pattern: /^\/$/, module: './ui/home.js', keys: [] },
	{ pattern: /^\/order$/, module: './ui/order.js', keys: [] },
	{ pattern: /^\/order\/([^/]+)$/, module: './ui/order.js', keys: ['id'] },
	{ pattern: /^\/evening\/(\d{4}-\d{2}-\d{2})$/, module: './ui/payments.js', keys: ['date'] },
	{ pattern: /^\/debts$/, module: './ui/debts.js', keys: [] },
	{ pattern: /^\/menu$/, module: './ui/menu.js', keys: [] },
	{ pattern: /^\/stats$/, module: './ui/stats.js', keys: [] },
	{ pattern: /^\/stats\/(\d{4}-\d{2}-\d{2}|[a-z-]+)$/, module: './ui/stats.js', keys: ['date'] },
	{ pattern: /^\/backup$/, module: './ui/backup.js', keys: [] },
	{ pattern: /^\/demo$/, module: './ui/demo.js', keys: [] },
];

function match(path) {
	for (const route of ROUTES) {
		const found = route.pattern.exec(path);
		if (found) {
			const params = {};
			route.keys.forEach((key, i) => {
				params[key] = decodeURIComponent(found[i + 1]);
			});
			return { route, params };
		}
	}
	return null;
}

async function loadScreen(modulePath) {
	try {
		return await import(modulePath);
	} catch (error) {
		console.error(error);
		return { render: async () => h('p', {}, 'בקרוב') };
	}
}

function markActiveLink(path) {
	document.querySelectorAll('nav a').forEach(link => {
		const target = link.getAttribute('href').slice(1);
		link.classList.toggle('active', target === '/' ? path === '/' : path.startsWith(target));
	});
}

export function startRouter(store, root) {
	let renderCount = 0;
	async function show() {
		const path = location.hash.slice(1) || '/';
		const found = match(path);
		if (!found) {
			location.hash = '#/';
			return;
		}
		const current = ++renderCount;
		const screen = await loadScreen(found.route.module);
		const view = await screen.render(store, found.params);
		if (current !== renderCount) {
			return;
		}
		root.replaceChildren(view);
		markActiveLink(path);
		window.scrollTo(0, 0);
	}
	window.addEventListener('hashchange', show);
	show();
}
