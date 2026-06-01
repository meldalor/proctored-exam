<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let selectedGroup = $state('');
	let students = $state<Array<{ id: number; name: string }>>([]);
	let selectedId = $state('');
	let pin = $state('');
	let loading = $state(false);
	let error = $state('');

	async function onGroupChange() {
		selectedId = '';
		students = [];
		if (!selectedGroup) return;
		try {
			const r = await fetch('/api/students?group_id=' + encodeURIComponent(selectedGroup));
			students = await r.json();
		} catch {
			error = 'Не удалось загрузить список студентов';
		}
	}

	async function login() {
		if (!selectedId || !pin) return;
		loading = true;
		error = '';
		try {
			const r = await fetch('/api/auth/student', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ student_id: Number(selectedId), pin })
			});
			const d = await r.json();
			if (!r.ok) {
				error = d.error || 'Ошибка входа';
				loading = false;
				return;
			}
			window.location.href = '/exam';
		} catch {
			error = 'Ошибка соединения с сервером';
			loading = false;
		}
	}
</script>

<div class="login-wrapper">
	<div class="login-card card">
		<h1>Экзамен</h1>
		<p class="login-subtitle">Выберите себя в списке и введите PIN</p>

		{#if error}<div class="alert alert-error">{error}</div>{/if}

		<div class="form-group">
			<label for="grp">Группа</label>
			<select id="grp" bind:value={selectedGroup} onchange={onGroupChange} disabled={loading}>
				<option value="">— Выберите группу —</option>
				{#each data.groups as g (g.id)}
					<option value={g.id}>{g.name}</option>
				{/each}
			</select>
		</div>

		<div class="form-group">
			<label for="sel">Студент</label>
			<select id="sel" bind:value={selectedId} disabled={loading || !selectedGroup}>
				<option value="">— Выберите из списка —</option>
				{#each students as s (s.id)}
					<option value={s.id}>{s.name}</option>
				{/each}
			</select>
		</div>

		<div class="form-group">
			<label for="pin">PIN-код</label>
			<input
				id="pin"
				type="password"
				bind:value={pin}
				onkeydown={(e) => {
					if (e.key === 'Enter') login();
				}}
				inputmode="numeric"
				maxlength="8"
				placeholder="Введите PIN"
				disabled={loading || !selectedGroup}
			/>
		</div>

		<button
			class="btn btn-primary w-full"
			onclick={login}
			disabled={loading || !selectedId || !pin}
		>
			{loading ? 'Проверка…' : 'Войти'}
		</button>

		<div class="mt-4 text-center">
			<a href="/teacher/login" class="text-sm text-muted">Вход для преподавателя →</a>
		</div>
	</div>
</div>
