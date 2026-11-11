const CACHE = 'falafel-v25';
const FILES = [
	'./',
	'./index.html',
	'./styles.css',
	'./manifest.webmanifest',
	'./icons/icon.svg',
	'./icons/icon-192.png',
	'./icons/icon-512.png',
	'./images/falafel.svg',
	'./images/fries.svg',
	'./images/drink.svg',
	'./images/hotdog.svg',
	'./images/ball.svg',
	'./images/half.svg',
	'./images/hummus.svg',
	'./images/malabi.svg',
	'./src/app.js',
	'./src/photo.js',
	'./src/fontSize.js',
	'./src/logic/settings.js',
	'./src/logic/demo.js',
	'./src/logic/payments.js',
	'./src/logic/customers.js',
	'./src/ui/draft.js',
	'./src/ui/paymentChoice.js',
	'./src/ui/customerPicker.js',
	'./src/ui/demo.js',
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
	event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(url => new Request(url, { cache: 'reload' })))));
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
