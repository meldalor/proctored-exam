import type { Action } from 'svelte/action';

export const clickOutside: Action<HTMLElement, () => void> = (node, callback) => {
	let cb = callback;
	const handler = (e: MouseEvent) => {
		if (!node.contains(e.target as Node)) cb();
	};
	document.addEventListener('click', handler, true);
	return {
		update(next: () => void) {
			cb = next;
		},
		destroy() {
			document.removeEventListener('click', handler, true);
		}
	};
};
