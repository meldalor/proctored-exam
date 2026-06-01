<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { pushToast } from '$lib/stores/toasts.svelte';
	import { appConfirm } from '$lib/stores/confirm.svelte';

	interface Student {
		id: number;
		name: string;
		created_at: number;
	}

	let students = $state<Student[]>([]);
	let adding = $state(false);
	let importing = $state(false);
	let importText = $state('');
	let importBusy = $state(false);
	let form = $state({ name: '' });
	let editId = $state<number | null>(null);
	let editName = $state('');
	let editPin = $state('');
	let resetting = $state(false);
	let knownPins = $state<Record<number, string>>({});
	let pinVisible = $state<Record<number, boolean>>({});
	let pinCopied = $state<Record<number, boolean>>({});

	function savePins() {
		sessionStorage.setItem('knownPins', JSON.stringify(knownPins));
	}
	function fmtDt(ts: number) {
		return ts ? new Date(ts).toLocaleDateString('ru-RU') : '—';
	}

	async function load() {
		const r = await fetch('/api/teacher/students');
		if (r.status === 401) {
			window.location.href = '/teacher/login';
			return;
		}
		students = await r.json();
	}

	async function add() {
		if (!form.name.trim()) return;
		const r = await fetch('/api/teacher/students', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: form.name.trim() })
		});
		const s = await r.json();
		students.push({ id: s.id, name: s.name, created_at: Date.now() });
		knownPins = { ...knownPins, [s.id]: s.pin };
		savePins();
		students.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
		adding = false;
		form = { name: '' };
	}

	async function doImport() {
		if (!importText.trim() || importBusy) return;
		importBusy = true;
		try {
			const r = await fetch('/api/teacher/students/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: importText })
			});
			const added = await r.json();
			const pins = { ...knownPins };
			for (const s of added) {
				students.push({ id: s.id, name: s.name, created_at: Date.now() });
				pins[s.id] = s.pin;
			}
			knownPins = pins;
			savePins();
			students.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
			importing = false;
			importText = '';
			pushToast('Импорт', 'Добавлено: ' + added.length, 'success');
		} finally {
			importBusy = false;
		}
	}

	function startEdit(s: Student) {
		editId = s.id;
		editName = s.name;
		editPin = '';
	}
	async function saveEdit(s: Student) {
		const body: { name: string; pin?: string } = { name: editName };
		if (editPin) body.pin = editPin;
		await fetch('/api/teacher/students/' + s.id, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		s.name = editName;
		if (editPin) {
			knownPins = { ...knownPins, [s.id]: editPin };
			pinVisible[s.id] = false;
			savePins();
		}
		editId = null;
		editPin = '';
	}
	async function del(s: Student) {
		if (!(await appConfirm('Удалить студента «' + s.name + '»?'))) return;
		await fetch('/api/teacher/students/' + s.id, { method: 'DELETE' });
		students = students.filter((x) => x.id !== s.id);
	}

	async function resetAllPins() {
		if (
			Object.keys(knownPins).length > 0 &&
			!(await appConfirm(
				'Перегенерировать PIN всем студентам группы? Старые PIN перестанут действовать.'
			))
		)
			return;
		resetting = true;
		try {
			const r = await fetch('/api/teacher/students/reset-all-pins', { method: 'POST' });
			const results = await r.json();
			const pins: Record<number, string> = {};
			for (const p of results) {
				pins[p.id] = p.pin;
				pinVisible[p.id] = false;
			}
			knownPins = pins;
			savePins();
		} finally {
			resetting = false;
		}
	}

	function copyPin(s: Student) {
		const pin = knownPins[s.id];
		if (!pin) return;
		navigator.clipboard.writeText(pin).then(() => {
			pinCopied[s.id] = true;
			setTimeout(() => (pinCopied[s.id] = false), 1500);
		});
	}

	onMount(() => {
		const saved = sessionStorage.getItem('knownPins');
		if (saved)
			try {
				knownPins = JSON.parse(saved);
			} catch {
				// битый кеш
			}
		load();
	});
</script>

<div class="container py-4">
	<div class="flex items-center justify-between mb-4">
		<h1>Студенты</h1>
		<div class="flex gap-2">
			<button class="btn btn-warning" onclick={resetAllPins} disabled={resetting}>
				{resetting ? 'Генерация…' : 'reset PIN (всем)'}
			</button>
			<button class="btn btn-secondary" onclick={() => (importing = !importing)}>[import]</button>
			<button class="btn btn-primary" onclick={() => (adding = !adding)}>+ Добавить студента</button
			>
		</div>
	</div>

	{#if importing}
		<div class="card mb-4" style="border:2px solid #4f46e5">
			<h2 class="mb-3">Импорт студентов</h2>
			<div class="form-group">
				<label for="imp">Список — по одному ФИО на строку</label>
				<textarea
					id="imp"
					bind:value={importText}
					style="min-height:160px"
					placeholder={'Иванов Иван Иванович\nПетрова Анна Сергеевна\nСидоров Пётр Алексеевич'}
				></textarea>
			</div>
			<div class="flex gap-2 justify-end">
				<button
					class="btn btn-secondary"
					onclick={() => {
						importing = false;
						importText = '';
					}}>Отмена</button
				>
				<button
					class="btn btn-primary"
					onclick={doImport}
					disabled={!importText.trim() || importBusy}
				>
					{importBusy ? 'Импорт…' : 'Импортировать'}
				</button>
			</div>
		</div>
	{/if}

	{#if adding}
		<div class="card mb-4" style="border:2px solid #4f46e5">
			<h2 class="mb-3">Новый студент</h2>
			<div class="form-group">
				<label for="nm">ФИО</label>
				<input
					id="nm"
					type="text"
					bind:value={form.name}
					placeholder="Иванов Иван Иванович"
					onkeydown={(e) => {
						if (e.key === 'Enter') add();
					}}
				/>
				<div class="text-xs text-muted mt-1">PIN сгенерируется автоматически</div>
			</div>
			<div class="flex gap-2 justify-end">
				<button
					class="btn btn-secondary"
					onclick={() => {
						adding = false;
						form = { name: '' };
					}}>Отмена</button
				>
				<button class="btn btn-primary" onclick={add} disabled={!form.name.trim()}>Добавить</button>
			</div>
		</div>
	{/if}

	<div class="card" style="padding:0;overflow:hidden">
		<div class="table-wrap">
			<table style="table-layout:fixed;width:100%">
				<colgroup>
					<col style="width:40px" />
					<col />
					<col style="width:110px" />
					<col style="width:170px" />
					<col style="width:110px" />
				</colgroup>
				<thead>
					<tr>
						<th style="width:40px">#</th>
						<th>ФИО</th>
						<th class="text-center">Добавлен</th>
						<th class="text-center">PIN</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each students as s, idx (s.id)}
						<tr>
							<td class="text-muted">{idx + 1}</td>
							<td>
								{#if editId === s.id}
									<input
										type="text"
										bind:value={editName}
										style="width:100%;box-sizing:border-box"
										onkeydown={(e) => {
											if (e.key === 'Enter') saveEdit(s);
										}}
									/>
								{:else}
									<span class="font-semibold">{s.name}</span>
								{/if}
							</td>
							<td class="text-sm text-muted text-center">{fmtDt(s.created_at)}</td>
							<td class="text-center">
								{#if editId === s.id}
									<input
										type="text"
										bind:value={editPin}
										placeholder="(не менять)"
										inputmode="numeric"
										maxlength="8"
										style="width:100%;box-sizing:border-box"
										onkeydown={(e) => {
											if (e.key === 'Enter') saveEdit(s);
										}}
									/>
								{:else}
									<div style="display:inline-block;position:relative;white-space:nowrap">
										{#if pinCopied[s.id]}<span class="pin-toast">Скопировано</span>{/if}
										<span
											class="font-mono pin-clickable"
											style="display:inline-block;min-width:6ch"
											title={knownPins[s.id] ? 'Кликните, чтобы скопировать' : ''}
											role="presentation"
											onclick={() => copyPin(s)}
											>{knownPins[s.id]
												? pinVisible[s.id]
													? knownPins[s.id]
													: '••••••'
												: '—'}</span
										>
										{#if knownPins[s.id]}
											<button
												class="btn-icon btn-icon-bare"
												style="position:absolute;left:100%;top:50%;transform:translateY(-50%);margin-left:.25rem"
												onclick={() => (pinVisible[s.id] = !pinVisible[s.id])}
												title={pinVisible[s.id] ? 'Скрыть' : 'Показать'}
											>
												<Icon name={pinVisible[s.id] ? 'eye-slash' : 'eye'} />
											</button>
										{/if}
									</div>
								{/if}
							</td>
							<td>
								<div class="flex gap-1 justify-end">
									{#if editId === s.id}
										<button class="btn-icon" onclick={() => saveEdit(s)} title="Сохранить">
											<Icon name="check" />
										</button>
										<button class="btn-icon" onclick={() => (editId = null)} title="Отмена">
											<Icon name="x" />
										</button>
									{:else}
										<button class="btn-icon" onclick={() => startEdit(s)} title="Редактировать">
											<Icon name="pencil" />
										</button>
										<button class="btn-icon btn-icon-danger" onclick={() => del(s)} title="Удалить">
											<Icon name="trash" />
										</button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
					{#if students.length === 0}
						<tr><td colspan="5" class="text-center text-muted py-4">Нет студентов</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>
