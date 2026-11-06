import { DEFAULT_MENU } from './logic/model.js';

const DB_NAME = 'falafel-orders';
const DB_VERSION = 1;

function promisify(request) {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function done(tx) {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}

function upgrade(db) {
	db.createObjectStore('menu', { keyPath: 'id' });
	const orders = db.createObjectStore('orders', { keyPath: 'id' });
	orders.createIndex('eveningDate', 'eveningDate');
	db.createObjectStore('meta', { keyPath: 'key' });
}

class Store {
	constructor(db) {
		this.m_db = db;
	}

	async getAll(storeName) {
		return promisify(this.m_db.transaction(storeName).objectStore(storeName).getAll());
	}

	async put(storeName, value) {
		const tx = this.m_db.transaction(storeName, 'readwrite');
		tx.objectStore(storeName).put(value);
		return done(tx);
	}

	async getMenu() {
		const menu = await this.getAll('menu');
		return menu.sort((a, b) => a.position - b.position);
	}

	async saveMenuItem(item) {
		return this.put('menu', item);
	}

	async getOrders() {
		return this.getAll('orders');
	}

	async getOrdersByDate(date) {
		const index = this.m_db.transaction('orders').objectStore('orders').index('eveningDate');
		const orders = await promisify(index.getAll(date));
		return orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	}

	async getOrder(id) {
		return promisify(this.m_db.transaction('orders').objectStore('orders').get(id));
	}

	async saveOrder(order) {
		return this.put('orders', order);
	}

	async deleteOrder(id) {
		const tx = this.m_db.transaction('orders', 'readwrite');
		tx.objectStore('orders').delete(id);
		return done(tx);
	}

	async getMeta(key) {
		const row = await promisify(this.m_db.transaction('meta').objectStore('meta').get(key));
		return row ? row.value : undefined;
	}

	async setMeta(key, value) {
		return this.put('meta', { key, value });
	}

	async replaceAll(data) {
		const tx = this.m_db.transaction(['menu', 'orders'], 'readwrite');
		const menu = tx.objectStore('menu');
		const orders = tx.objectStore('orders');
		const finished = done(tx);
		try {
			menu.clear();
			orders.clear();
			data.menu.forEach(item => menu.put(item));
			data.orders.forEach(order => orders.put(order));
		} catch (error) {
			tx.abort();
			await finished.catch(() => {});
			throw error;
		}
		return finished;
	}

	async seedMenuIfEmpty() {
		const menu = await this.getAll('menu');
		if (menu.length > 0) {
			return;
		}
		const tx = this.m_db.transaction('menu', 'readwrite');
		DEFAULT_MENU.forEach((item, position) => {
			tx.objectStore('menu').put({ id: crypto.randomUUID(), name: item.name, price: item.price, position, active: true });
		});
		await done(tx);
	}
}

export async function openStore() {
	const request = indexedDB.open(DB_NAME, DB_VERSION);
	request.onupgradeneeded = () => upgrade(request.result);
	const store = new Store(await promisify(request));
	await store.seedMenuIfEmpty();
	return store;
}

export async function requestPersistence() {
	if (!navigator.storage || !navigator.storage.persist) {
		return false;
	}
	try {
		return await navigator.storage.persist();
	} catch {
		return false;
	}
}
