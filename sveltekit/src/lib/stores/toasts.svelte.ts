export interface Toast {
	id: number;
	title: string;
	body: string;
	cls: string;
	icon: string;
	href?: string;
}

const icons: Record<string, string> = {
	warning: '[!]',
	danger: '[!!]',
	info: '[i]',
	success: '[ok]'
};

export const toasts = $state<{ list: Toast[] }>({ list: [] });

export function pushToast(title: string, body: string, cls = 'info', href?: string): void {
	const t: Toast = {
		id: Date.now() + Math.random(),
		title,
		body,
		cls,
		icon: icons[cls] || '[i]',
		href
	};
	toasts.list.push(t);
	setTimeout(() => {
		const i = toasts.list.findIndex((x) => x.id === t.id);
		if (i !== -1) toasts.list.splice(i, 1);
	}, 5000);
}

export function dismissToast(id: number): void {
	const i = toasts.list.findIndex((x) => x.id === id);
	if (i !== -1) toasts.list.splice(i, 1);
}
