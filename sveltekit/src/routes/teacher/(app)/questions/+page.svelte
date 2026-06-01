<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Markdown from '$lib/components/Markdown.svelte';
	import { pushToast } from '$lib/stores/toasts.svelte';
	import { appConfirm } from '$lib/stores/confirm.svelte';

	interface Question {
		id: number;
		type: 'theory' | 'practical';
		body: string;
		active: number;
		_num?: number;
	}

	let questions = $state<Question[]>([]);
	let tab = $state<'all' | 'theory' | 'practical'>('all');
	let edit = $state<Question | null>(null);
	let adding = $state(false);
	let importing = $state(false);
	let importTheory = $state('');
	let importPractical = $state('');
	let importBusy = $state(false);
	let form = $state<{ type: 'theory' | 'practical'; body: string }>({ type: 'theory', body: '' });

	const filtered = $derived(tab === 'all' ? questions : questions.filter((q) => q.type === tab));

	function renumber() {
		questions.forEach((q, i) => (q._num = i + 1));
	}

	async function load() {
		const r = await fetch('/api/teacher/questions');
		if (r.status === 401) {
			window.location.href = '/teacher/login';
			return;
		}
		questions = await r.json();
		renumber();
	}

	function openAdd() {
		adding = true;
		importing = false;
		edit = null;
		form = { type: 'theory', body: '' };
	}

	async function doImport() {
		if ((!importTheory.trim() && !importPractical.trim()) || importBusy) return;
		importBusy = true;
		try {
			const r = await fetch('/api/teacher/questions/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ theory: importTheory, practical: importPractical })
			});
			const data = await r.json();
			await load();
			importing = false;
			importTheory = '';
			importPractical = '';
			pushToast('Импорт', 'Добавлено вопросов: ' + (data.added || 0), 'success');
		} finally {
			importBusy = false;
		}
	}

	async function addQuestion() {
		if (!form.body) return;
		const r = await fetch('/api/teacher/questions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(form)
		});
		const q = await r.json();
		questions.push(q);
		renumber();
		adding = false;
		form = { type: 'theory', body: '' };
	}

	function startEdit(q: Question) {
		edit = { ...q };
		adding = false;
	}
	async function saveEdit() {
		if (!edit) return;
		await fetch('/api/teacher/questions/' + edit.id, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ body: edit.body, active: edit.active })
		});
		const idx = questions.findIndex((q) => q.id === edit!.id);
		if (idx !== -1) questions[idx] = { ...questions[idx], ...edit };
		edit = null;
	}
	async function toggle(q: Question) {
		await fetch('/api/teacher/questions/' + q.id, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ active: q.active ? 0 : 1 })
		});
		q.active = q.active ? 0 : 1;
	}
	async function del(q: Question) {
		if (!(await appConfirm('Удалить вопрос #' + q._num + '?'))) return;
		await fetch('/api/teacher/questions/' + q.id, { method: 'DELETE' });
		questions = questions.filter((x) => x.id !== q.id);
		renumber();
	}

	onMount(load);
</script>

<div class="container py-4">
	<div
		class="page-header"
		style="background:transparent;border:none;padding:0;margin-bottom:1.5rem"
	>
		<div class="flex items-center justify-between">
			<h1>Банк вопросов</h1>
			<div class="flex gap-2">
				<button class="btn btn-secondary" onclick={() => (importing = !importing)}>[import]</button>
				<button class="btn btn-primary" onclick={openAdd}>+ Добавить вопрос</button>
			</div>
		</div>
	</div>

	{#if importing}
		<div class="card mb-4" style="border:2px solid #4f46e5">
			<h2 class="mb-3">Импорт вопросов</h2>
			<div class="form-row">
				<div class="form-group">
					<label for="impt">Теория — по одному вопросу на строку</label>
					<textarea
						id="impt"
						bind:value={importTheory}
						style="min-height:160px"
						placeholder={'Что такое указатель?\nЧем массив отличается от связного списка?\nКак работает рекурсия?'}
					></textarea>
				</div>
				<div class="form-group">
					<label for="impp">Практика — по одному заданию на строку</label>
					<textarea
						id="impp"
						bind:value={importPractical}
						style="min-height:160px"
						placeholder={'Напишите функцию вычисления факториала\nРеализуйте бинарный поиск по массиву\nОтсортируйте список пузырьком'}
					></textarea>
				</div>
			</div>
			<div class="flex gap-2 justify-end">
				<button
					class="btn btn-secondary"
					onclick={() => {
						importing = false;
						importTheory = '';
						importPractical = '';
					}}>Отмена</button
				>
				<button
					class="btn btn-primary"
					onclick={doImport}
					disabled={(!importTheory.trim() && !importPractical.trim()) || importBusy}
				>
					{importBusy ? 'Импорт…' : 'Импортировать'}
				</button>
			</div>
		</div>
	{/if}

	{#if adding}
		<div class="card mb-4" style="border:2px solid #4f46e5">
			<h2 class="mb-4">Новый вопрос</h2>
			<div class="form-group">
				<label for="qtype">Тип</label>
				<select id="qtype" bind:value={form.type}>
					<option value="theory">Теория</option>
					<option value="practical">Практика</option>
				</select>
			</div>
			<div class="form-group">
				<label for="qbody">Текст вопроса (поддерживает Markdown)</label>
				<textarea
					id="qbody"
					bind:value={form.body}
					style="min-height:140px"
					placeholder="Введите текст вопроса…"
				></textarea>
			</div>
			{#if form.body}
				<div class="mb-3">
					<div class="text-xs text-muted mb-1">Предпросмотр:</div>
					<div
						class="question-text p-3"
						style="background:var(--bg);border-radius:.5rem;border:1px solid var(--border)"
					>
						<Markdown source={form.body} />
					</div>
				</div>
			{/if}
			<div class="flex gap-2 justify-end">
				<button
					class="btn btn-secondary"
					onclick={() => {
						adding = false;
						form = { type: 'theory', body: '' };
					}}>Отмена</button
				>
				<button class="btn btn-primary" onclick={addQuestion} disabled={!form.body}>Добавить</button
				>
			</div>
		</div>
	{/if}

	<div class="flex gap-2 mb-4">
		<button
			class="btn btn-sm {tab === 'all' ? 'btn-primary' : 'btn-secondary'}"
			onclick={() => (tab = 'all')}>Все</button
		>
		<button
			class="btn btn-sm {tab === 'theory' ? 'btn-primary' : 'btn-secondary'}"
			onclick={() => (tab = 'theory')}>Теория</button
		>
		<button
			class="btn btn-sm {tab === 'practical' ? 'btn-primary' : 'btn-secondary'}"
			onclick={() => (tab = 'practical')}>Практика</button
		>
	</div>

	<div class="flex" style="flex-direction:column;gap:.75rem">
		{#each filtered as q (q.id)}
			<div class="q-card {q.active ? '' : 'inactive'}">
				<div class="flex items-start justify-between gap-3">
					<div style="flex:1">
						<div class="flex gap-2 items-center mb-2">
							<span class="badge {q.type === 'theory' ? 'badge-blue' : 'badge-yellow'}"
								>{q.type === 'theory' ? 'Теория' : 'Практика'}</span
							>
							{#if !q.active}<span class="badge badge-gray">Отключён</span>{/if}
							<span class="text-xs text-muted">#{q._num}</span>
						</div>
						{#if !edit || edit.id !== q.id}
							<div class="question-text text-sm"><Markdown source={q.body} /></div>
						{/if}
					</div>
					<div class="flex gap-1" style="flex-shrink:0">
						<button class="btn-icon" onclick={() => startEdit(q)} title="Редактировать">
							<Icon name="pencil" />
						</button>
						<button
							class="btn-icon"
							onclick={() => toggle(q)}
							title={q.active ? 'Деактивировать' : 'Активировать'}
						>
							<Icon name={q.active ? 'eye' : 'eye-slash'} />
						</button>
						<button class="btn-icon btn-icon-danger" onclick={() => del(q)} title="Удалить">
							<Icon name="trash" />
						</button>
					</div>
				</div>

				{#if edit && edit.id === q.id}
					<div class="mt-3">
						<div class="form-group">
							<label for="et">Тип</label>
							<select id="et" bind:value={edit.type}>
								<option value="theory">Теория</option>
								<option value="practical">Практика</option>
							</select>
						</div>
						<div class="form-group">
							<label for="eb">Текст вопроса (поддерживает Markdown)</label>
							<textarea id="eb" bind:value={edit.body} style="min-height:120px"></textarea>
						</div>
						<div class="flex gap-2 justify-end">
							<button class="btn btn-secondary btn-sm" onclick={() => (edit = null)}>Отмена</button>
							<button class="btn btn-primary btn-sm" onclick={saveEdit}>Сохранить</button>
						</div>
					</div>
				{/if}
			</div>
		{/each}
		{#if filtered.length === 0}
			<div class="text-center text-muted py-8">Нет вопросов в этой категории</div>
		{/if}
	</div>
</div>
