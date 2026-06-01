<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { pushToast } from '$lib/stores/toasts.svelte';
	import { appConfirm } from '$lib/stores/confirm.svelte';

	interface Teacher {
		id: number;
		username: string;
		role: 'admin' | 'teacher';
		created_at: number;
	}

	let teachers = $state<Teacher[]>([]);
	let meId = $state<number | null>(null);
	let adding = $state(false);
	let form = $state({ username: '', password: '', role: 'teacher' as 'admin' | 'teacher' });

	let editId = $state<number | null>(null);
	let editName = $state('');
	let editRole = $state<'admin' | 'teacher'>('teacher');
	let editPwd = $state('');

	function fmtDt(ts: number) {
		return ts ? new Date(ts).toLocaleDateString('ru-RU') : '—';
	}

	async function load() {
		const [meR, listR] = await Promise.all([
			fetch('/api/teacher/me'),
			fetch('/api/teacher/admins')
		]);
		if (listR.status === 401) {
			window.location.href = '/teacher/login';
			return;
		}
		if (listR.status === 403) {
			window.location.href = '/teacher';
			return;
		}
		if (meR.ok) meId = (await meR.json()).id;
		teachers = await listR.json();
	}

	async function add() {
		const username = form.username.trim().toLowerCase();
		if (!username || !form.password) return;
		const r = await fetch('/api/teacher/admins', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username, password: form.password, role: form.role })
		});
		const d = await r.json();
		if (!r.ok) {
			pushToast('Ошибка', d.error || 'Не удалось создать учётку', 'danger');
			return;
		}
		adding = false;
		form = { username: '', password: '', role: 'teacher' };
		await load();
		pushToast('Учётка создана', username, 'success');
	}

	function startEdit(t: Teacher) {
		editId = t.id;
		editName = t.username;
		editRole = t.role;
		editPwd = '';
	}
	async function saveEdit(t: Teacher) {
		const r = await fetch('/api/teacher/admins/' + t.id, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				username: editName.trim().toLowerCase(),
				role: editRole,
				...(editPwd ? { password: editPwd } : {})
			})
		});
		const d = await r.json();
		if (!r.ok) {
			pushToast('Ошибка', d.error || 'Не удалось сохранить', 'danger');
			return;
		}
		editId = null;
		editPwd = '';
		await load();
	}
	async function del(t: Teacher) {
		if (
			!(await appConfirm(
				'Удалить учётку «' +
					t.username +
					'»? Будут безвозвратно удалены все его группы, студенты, вопросы и экзамены.'
			))
		)
			return;
		const r = await fetch('/api/teacher/admins/' + t.id, { method: 'DELETE' });
		const d = await r.json();
		if (!r.ok) {
			pushToast('Ошибка', d.error || 'Не удалось удалить', 'danger');
			return;
		}
		await load();
	}

	onMount(load);
</script>

<div class="container py-4">
	<div class="flex items-center justify-between mb-4">
		<h1>Преподаватели</h1>
		<button class="btn btn-primary" onclick={() => (adding = !adding)}>+ Добавить учётку</button>
	</div>

	{#if adding}
		<div class="card mb-4" style="border:1px solid var(--primary)">
			<h2 class="mb-3">Новая учётка</h2>
			<div class="form-row">
				<div class="form-group">
					<label for="nu">Логин</label>
					<input id="nu" type="text" bind:value={form.username} placeholder="ivanov" />
				</div>
				<div class="form-group">
					<label for="np">Пароль</label>
					<input id="np" type="text" bind:value={form.password} placeholder="пароль" />
				</div>
			</div>
			<div class="form-group" style="max-width:220px">
				<label for="nr">Роль</label>
				<select id="nr" bind:value={form.role}>
					<option value="teacher">Преподаватель</option>
					<option value="admin">Администратор</option>
				</select>
			</div>
			<div class="flex gap-2 justify-end">
				<button
					class="btn btn-secondary"
					onclick={() => {
						adding = false;
						form = { username: '', password: '', role: 'teacher' };
					}}>Отмена</button
				>
				<button
					class="btn btn-primary"
					onclick={add}
					disabled={!form.username.trim() || !form.password}>Добавить</button
				>
			</div>
		</div>
	{/if}

	<div class="card" style="padding:0;overflow:hidden">
		<div class="table-wrap">
			<table style="table-layout:fixed;width:100%">
				<colgroup>
					<col style="width:40px" />
					<col />
					<col style="width:200px" />
					<col style="width:120px" />
					<col style="width:110px" />
				</colgroup>
				<thead>
					<tr>
						<th style="width:40px">#</th>
						<th>Логин</th>
						<th>Роль</th>
						<th class="text-center">Создан</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each teachers as t, idx (t.id)}
						<tr>
							<td class="text-muted">{idx + 1}</td>
							<td>
								{#if editId === t.id}
									<input
										type="text"
										bind:value={editName}
										style="width:100%;box-sizing:border-box"
									/>
								{:else}
									<span class="font-semibold">{t.username}</span>
									{#if t.id === meId}<span class="badge badge-gray" style="margin-left:.4rem"
											>вы</span
										>{/if}
								{/if}
							</td>
							<td>
								{#if editId === t.id}
									<select bind:value={editRole} style="width:100%;box-sizing:border-box">
										<option value="teacher">Преподаватель</option>
										<option value="admin">Администратор</option>
									</select>
								{:else}
									<span class="badge {t.role === 'admin' ? 'badge-green' : 'badge-gray'}"
										>{t.role === 'admin' ? 'админ' : 'преподаватель'}</span
									>
								{/if}
							</td>
							<td class="text-sm text-muted text-center">
								{#if editId === t.id}
									<input
										type="text"
										bind:value={editPwd}
										placeholder="новый пароль"
										style="width:100%;box-sizing:border-box"
									/>
								{:else}
									{fmtDt(t.created_at)}
								{/if}
							</td>
							<td>
								<div class="flex gap-1 justify-end">
									{#if editId === t.id}
										<button class="btn-icon" onclick={() => saveEdit(t)} title="Сохранить">
											<Icon name="check" />
										</button>
										<button class="btn-icon" onclick={() => (editId = null)} title="Отмена">
											<Icon name="x" />
										</button>
									{:else}
										<button class="btn-icon" onclick={() => startEdit(t)} title="Редактировать">
											<Icon name="pencil" />
										</button>
										{#if t.id !== meId}
											<button
												class="btn-icon btn-icon-danger"
												onclick={() => del(t)}
												title="Удалить"
											>
												<Icon name="trash" />
											</button>
										{/if}
									{/if}
								</div>
							</td>
						</tr>
					{/each}
					{#if teachers.length === 0}
						<tr><td colspan="5" class="text-center text-muted py-4">Нет учёток</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	</div>
	<div class="text-xs text-muted mt-2">
		В строке редактирования поле «Создан» заменяется на ввод нового пароля (пусто — не менять).
	</div>
</div>
