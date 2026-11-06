const CACHE = 'falafel-v1';
const FILES = [
	'./',
	'./index.html',
	'./styles.css',
	'./manifest.webmanifest',
	'./icons/icon.svg',
	'./icons/icon-192.png',
	'./icons/icon-512.png',
	'./src/app.js',
	'./src/router.js',
	'./src/dom.js',
	'./src/store.js',
	'./src/logic/model.js',
	'./src/logic/stats.js',
	'./src/logic/backup.js',
	'./src/ui/home.js',
	'./src/ui/order.js',
	'./src/ui/payments.js',
	'./src/ui/debts.js',
	'./src/ui/menu.js',
	'./src/ui/stats.js',
	'./src/ui/backup.js',
];

self.addEventListener('install', event => {
	event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
	event.waitUntil(caches.keys()
		.then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
		.then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
	const request = event.request;
	if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
		return;
	}
	event.respondWith(caches.match(request, { ignoreSearch: true }).then(cached => cached || fetch(request)));
});
