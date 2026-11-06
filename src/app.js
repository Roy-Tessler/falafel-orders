import { openStore, requestPersistence } from './store.js';
import { startRouter } from './router.js';
import { h } from './dom.js';
import { loadFontSize, applyFontSize } from './fontSize.js';

async function start() {
	const root = document.getElementById('app');
	try {
		const store = await openStore();
		requestPersistence();
		startRouter(store, root);
	} catch (error) {
		console.error(error);
		root.replaceChildren(h('p', { class: 'error' }, 'לא ניתן לפתוח את שמירת הנתונים במכשיר. נסו לרענן את הדף.'));
	}
}

function registerServiceWorker() {
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('./sw.js').catch(error => console.error(error));
	}
}

applyFontSize(loadFontSize());
registerServiceWorker();
start();
