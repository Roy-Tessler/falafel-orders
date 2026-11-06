import { validateMenuItem } from '../logic/model.js';
import { h, confirmPanel, showToast, SAVE_FAILED } from '../dom.js';
import { photoToDataUrl } from '../photo.js';

function parsePrice(text) {
	const trimmed = text.trim();
	return trimmed === '' ? NaN : Number(trimmed);
}

function withImage(item, image) {
	const copy = { ...item };
	if (image === undefined) {
		delete copy.image;
	} else {
		copy.image = image;
	}
	return copy;
}

function imageControl(store, item) {
	const box = h('div', { class: 'image-control' });
	async function setImage(image) {
		const candidate = withImage(item, image);
		try {
			await store.saveMenuItem(candidate);
		} catch (error) {
			console.error(error);
			showToast(SAVE_FAILED, true);
			return;
		}
		delete item.image;
		Object.assign(item, candidate);
		refresh();
	}
	const input = h('input', { type: 'file', accept: 'image/*', class: 'file-input', onchange: async e => {
		const file = e.target.files[0];
		e.target.value = '';
		if (!file) {
			return;
		}
		try {
			await setImage(await photoToDataUrl(file));
		} catch (error) {
			console.error(error);
			showToast('לא ניתן לקרוא את התמונה', true);
		}
	} });
	function refresh() {
		box.replaceChildren(
			item.image ? h('img', { class: 'menu-thumb', src: item.image, alt: '' }) : h('div', { class: 'menu-thumb empty' }),
			h('label', { class: 'button small' }, item.image ? 'החלף תמונה' : 'הוסף תמונה', input),
			item.image ? h('button', { class: 'small', onclick: () => setImage(undefined) }, 'הסר תמונה') : null,
		);
	}
	refresh();
	return box;
}

function editableRow(store, item, actions) {
	const errorBox = h('div', { class: 'error' });
	const nameInput = h('input', { value: item.name, placeholder: 'שם הפריט', 'aria-label': 'שם הפריט' });
	const priceInput = h('input', { value: String(item.price), inputmode: 'numeric', class: 'price-input', 'aria-label': 'מחיר' });

	async function save() {
		const candidate = { ...item, name: nameInput.value.trim(), price: parsePrice(priceInput.value) };
		const errors = validateMenuItem(candidate);
		errorBox.replaceChildren(...errors.map(message => h('div', {}, message)));
		if (errors.length > 0 || (candidate.name === item.name && candidate.price === item.price)) {
			return;
		}
		try {
			await store.saveMenuItem(candidate);
		} catch (error) {
			console.error(error);
			errorBox.replaceChildren(h('div', {}, SAVE_FAILED));
			return;
		}
		Object.assign(item, candidate);
		showToast('נשמר');
	}
	for (const input of [nameInput, priceInput]) {
		input.addEventListener('blur', save);
		input.addEventListener('keydown', e => {
			if (e.key === 'Enter') {
				e.target.blur();
			}
		});
	}
	const row = h('div', { class: 'menu-row' },
		h('div', { class: 'row' },
			h('div', { class: 'grow' }, nameInput),
			h('span', {}, '₪'), priceInput,
			h('button', { class: 'small', 'aria-label': 'הזז למעלה', onclick: actions.up }, '▲'),
			h('button', { class: 'small', 'aria-label': 'הזז למטה', onclick: actions.down }, '▼'),
			h('button', { class: 'small danger', onclick: () => row.append(confirmPanel(
				`להסיר את ${item.name || 'הפריט'} מהתפריט? הזמנות קודמות לא ישתנו.`, 'כן, להסיר', actions.remove)) }, 'הסר'),
		),
		item.name ? imageControl(store, item) : null,
		errorBox,
	);
	return row;
}

function removedRow(item, onRestore) {
	return h('div', { class: 'row menu-row' },
		h('span', { class: 'grow muted' }, item.name),
		h('button', { class: 'small', onclick: onRestore }, 'החזר'),
	);
}

export async function render(store) {
	const menu = await store.getMenu();
	const view = h('section', {});
	const persist = item => (validateMenuItem(item).length === 0 ? store.saveMenuItem(item) : Promise.resolve());

	async function swap(active, index, offset) {
		const other = active[index + offset];
		if (!other) {
			return;
		}
		const item = active[index];
		[item.position, other.position] = [other.position, item.position];
		await Promise.all([persist(item), persist(other)]);
		menu.sort((a, b) => a.position - b.position);
		refresh();
	}
	async function setActive(item, active) {
		item.active = active;
		await persist(item);
		refresh();
	}
	function addItem() {
		const position = menu.reduce((max, i) => Math.max(max, i.position), -1) + 1;
		menu.push({ id: crypto.randomUUID(), name: '', price: 0, position, active: true });
		refresh();
		view.querySelector('.menu-row:last-of-type input')?.focus();
	}
	function refresh() {
		const active = menu.filter(i => i.active);
		const removed = menu.filter(i => !i.active && i.name);
		view.replaceChildren(
			h('h1', {}, 'תפריט ומחירים'),
			h('p', { class: 'muted' }, 'שינוי מחיר משפיע רק על הזמנות חדשות.'),
			h('div', { class: 'card' }, active.map((item, index) => editableRow(store, item, {
				up: () => swap(active, index, -1),
				down: () => swap(active, index, 1),
				remove: () => setActive(item, false),
			}))),
			h('button', { class: 'primary', onclick: addItem }, 'הוסף פריט'),
			removed.length > 0 ? h('h2', { class: 'removed-title' }, 'פריטים שהוסרו') : null,
			removed.length > 0 ? h('div', { class: 'card' }, removed.map(item => removedRow(item, () => setActive(item, true)))) : null,
		);
	}
	refresh();
	return view;
}
