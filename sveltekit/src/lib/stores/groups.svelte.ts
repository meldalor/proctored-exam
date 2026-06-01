import { appConfirm } from './confirm.svelte';

export interface Group {
	id: number;
	name: string;
	students?: number;
	questions?: number;
}

export const groups = $state<{
	list: Group[];
	currentId: number | null;
	dropdownOpen: boolean;
	modalOpen: boolean;
	newName: string;
	editId: number | null;
	editName: string;
}>({
	list: [],
	currentId: null,
	dropdownOpen: false,
	modalOpen: false,
	newName: '',
	editId: null,
	editName: ''
});

export function currentGroup(): Group | null {
	return groups.list.find((g) => g.id === groups.currentId) ?? null;
}

export async function loadGroups(): Promise<void> {
	const r = await fetch('/api/teacher/groups');
	if (r.status === 401) {
		window.location.href = '/teacher/login';
		return;
	}
	const d = await r.json();
	groups.list = d.groups;
	groups.currentId = d.current_id;
}

export async function selectGroup(id: number): Promise<void> {
	if (id !== groups.currentId) {
		await fetch('/api/teacher/groups/' + id + '/select', { method: 'POST' });
		window.location.reload();
		return;
	}
	groups.dropdownOpen = false;
	groups.modalOpen = false;
}

export function openGroupModal(): void {
	groups.dropdownOpen = false;
	groups.modalOpen = true;
	loadGroups();
}

export function closeGroupModal(): void {
	groups.modalOpen = false;
	groups.editId = null;
	groups.newName = '';
}

export async function createGroup(): Promise<void> {
	const name = groups.newName.trim();
	if (!name) return;
	await fetch('/api/teacher/groups', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name })
	});
	groups.newName = '';
	await loadGroups();
}

export function startEditGroup(g: Group): void {
	groups.editId = g.id;
	groups.editName = g.name;
}

export async function saveEditGroup(): Promise<void> {
	const name = groups.editName.trim();
	if (!name || groups.editId == null) return;
	await fetch('/api/teacher/groups/' + groups.editId, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name })
	});
	groups.editId = null;
	await loadGroups();
}

export async function deleteGroup(g: Group): Promise<void> {
	const ok = await appConfirm(
		'Удалить группу «' +
			g.name +
			'»? Будут удалены все её студенты, вопросы и экзамены. Это действие нельзя отменить.'
	);
	if (!ok) return;
	await fetch('/api/teacher/groups/' + g.id, { method: 'DELETE' });
	if (g.id === groups.currentId) {
		window.location.reload();
		return;
	}
	await loadGroups();
}
