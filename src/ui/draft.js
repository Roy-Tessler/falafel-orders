const DRAFT_KEY = 'draft';
export const PAY_MODES = ['unpaid', 'paybox', 'cash', 'split'];

export function emptyDraft() {
	return { customerName: '', note: '', lines: [], payMode: 'unpaid', split: { paybox: '', cash: '' } };
}

export function loadDraft() {
	try {
		const saved = JSON.parse(localStorage.getItem(DRAFT_KEY));
		if (!saved || !Array.isArray(saved.lines)) {
			return emptyDraft();
		}
		const base = emptyDraft();
		return {
			...base,
			...saved,
			payMode: PAY_MODES.includes(saved.payMode) ? saved.payMode : base.payMode,
			split: { ...base.split, ...(saved.split || {}) },
		};
	} catch {
		return emptyDraft();
	}
}

export function storeDraft(draft) {
	try {
		localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
	} catch {
		// Storage can be unavailable; the draft is only a convenience.
	}
}

export function clearDraft() {
	try {
		localStorage.removeItem(DRAFT_KEY);
	} catch {
		// See storeDraft.
	}
}
