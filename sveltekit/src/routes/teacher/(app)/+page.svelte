<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { pushToast } from '$lib/stores/toasts.svelte';
	import { notify, initNotify, toggleNotify } from '$lib/stores/notify.svelte';
	import { appConfirm } from '$lib/stores/confirm.svelte';
	import { EV_LABELS, EV_WARNING, EV_COUNTER } from '$lib/events';
	import { clickOutside } from '$lib/actions/clickOutside';

	interface ExamRow {
		id: number;
		student_id: number;
		student_name: string;
		started_at: number;
		submitted_at: number | null;
		attempt: number;
		copy_count: number;
		paste_count: number;
		tab_hidden_count: number;
		window_blur_count: number;
	}

	let exams = $state<ExamRow[]>([]);
	let filter = $state<'all' | 'active' | 'submitted'>('all');
	let durationInput = $state('0');
	let limitEnabled = $state(false);
	let examOpen = $state(false);
	let expanded = $state<Record<number, boolean>>({});
	let currentGroupId: number | null = null;
	let exportOpen = $state(false);
	let settingsOpen = $state(false);
	let theoryCount = $state('2');
	let practicalCount = $state('1');
	let captureEnabled = $state(false);
	let activeTheory = $state(0);
	let activePractical = $state(0);
	let es: EventSource | null = null;

	type Grouped = { latest: ExamRow; older: ExamRow[] };

	const groupsByStudent = $derived.by<Grouped[]>(() => {
		const by: Record<number, ExamRow[]> = {};
		for (const e of exams) (by[e.student_id] ||= []).push(e);
		const result = Object.values(by).map((list) => {
			list.sort((a, b) => (a.attempt || 1) - (b.attempt || 1));
			return { latest: list[list.length - 1], older: list.slice(0, -1).reverse() };
		});
		result.sort((a, b) => (b.latest.started_at || 0) - (a.latest.started_at || 0));
		return result;
	});
	const filteredGroups = $derived.by(() => {
		if (filter === 'active') return groupsByStudent.filter((g) => !g.latest.submitted_at);
		if (filter === 'submitted') return groupsByStudent.filter((g) => g.latest.submitted_at);
		return groupsByStudent;
	});
	const displayRows = $derived.by(() => {
		const rows: Array<ExamRow & { _latest?: boolean; _hasOlder?: boolean; _older?: boolean }> = [];
		for (const g of filteredGroups) {
			rows.push({ ...g.latest, _latest: true, _hasOlder: g.older.length > 0 });
			if (expanded[g.latest.student_id]) for (const o of g.older) rows.push({ ...o, _older: true });
		}
		return rows;
	});

	// Зеркало createExam: открыть экзамен можно только при достатке активных вопросов на билет.
	const canOpen = $derived(
		activeTheory >= (+theoryCount || 2) && activePractical >= (+practicalCount || 1)
	);

	const active = $derived(groupsByStudent.filter((g) => !g.latest.submitted_at).length);
	const submitted = $derived(groupsByStudent.filter((g) => g.latest.submitted_at).length);
	const totalSuspicious = $derived(
		exams.reduce(
			(s, e) =>
				s +
				(e.copy_count || 0) +
				(e.paste_count || 0) +
				(e.tab_hidden_count || 0) +
				(e.window_blur_count || 0),
			0
		)
	);

	function fmtDt(ts: number | null) {
		if (!ts) return '—';
		return new Date(ts).toLocaleString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
	function countClass(n: number) {
		if (!n) return 'count-cell count-ok';
		return n >= 3 ? 'count-cell count-bad' : 'count-cell count-warn';
	}
	function toggleExpand(sid: number) {
		expanded = { ...expanded, [sid]: !expanded[sid] };
	}

	async function load() {
		const r = await fetch('/api/teacher/exams');
		if (r.status === 401) {
			window.location.href = '/teacher/login';
			return;
		}
		exams = await r.json();
	}
	async function loadGroup() {
		const r = await fetch('/api/teacher/groups');
		if (r.ok) currentGroupId = (await r.json()).current_id;
	}
	async function loadSettings() {
		const r = await fetch('/api/teacher/settings');
		if (r.ok) {
			const s = await r.json();
			durationInput = s.exam_duration_minutes ?? '0';
			limitEnabled = +durationInput > 0;
			examOpen = s.exam_open === '1';
			theoryCount = s.questions_per_exam_theory ?? '2';
			practicalCount = s.questions_per_exam_practical ?? '1';
			captureEnabled = s.screen_capture_enabled === '1';
			activeTheory = s.active_theory ?? 0;
			activePractical = s.active_practical ?? 0;
		}
	}
	function clampCount(v: string, max: number) {
		const n = Math.max(0, Math.min(max, Math.trunc(+v) || 0));
		return String(n);
	}
	function toggleLimit() {
		if (limitEnabled) {
			if (+durationInput < 1) durationInput = '90';
		} else durationInput = '0';
	}
	async function saveSettings() {
		theoryCount = clampCount(theoryCount, activeTheory);
		practicalCount = clampCount(practicalCount, activePractical);
		await fetch('/api/teacher/settings', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				exam_duration_minutes: limitEnabled ? +durationInput || 0 : 0,
				questions_per_exam_theory: +theoryCount,
				questions_per_exam_practical: +practicalCount,
				screen_capture_enabled: captureEnabled
			})
		});
		settingsOpen = false;
		pushToast('Настройки', 'Сохранено', 'success');
	}
	async function toggleExamOpen() {
		const r = await fetch('/api/teacher/settings', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ exam_open: examOpen ? 1 : 0 })
		});
		if (!r.ok) {
			const d = await r.json().catch(() => ({}));
			examOpen = false;
			pushToast('Нельзя открыть экзамен', d.error || 'Недостаточно вопросов в банке', 'warning');
		}
	}
	async function resetAll() {
		if (
			!(await appConfirm(
				'Сбросить экзамен ВСЕМ студентам группы? Все попытки (включая сданные) будут удалены безвозвратно.'
			))
		)
			return;
		await fetch('/api/teacher/exams/reset-all', { method: 'POST' });
		await load();
		pushToast('Сброшено', 'Все попытки в группе удалены', 'warning');
	}

	function connectSSE() {
		es = new EventSource('/api/teacher/stream');
		es.addEventListener('exam_started', (e) => {
			const d = JSON.parse((e as MessageEvent).data);
			if (d.group_id !== currentGroupId) return;
			load();
			if (notify.enabled)
				pushToast(
					'Новый экзамен',
					d.student_name + ' начал работу',
					'info',
					'/teacher/exam/' + d.exam_id
				);
		});
		es.addEventListener('exam_event', (e) => {
			const d = JSON.parse((e as MessageEvent).data);
			if (d.group_id !== currentGroupId) return;
			const exam = exams.find((x) => x.id === d.exam_id);
			if (exam) {
				const c = EV_COUNTER[d.type] as keyof ExamRow | undefined;
				if (c) (exam[c] as number)++;
			}
			const label = EV_LABELS[d.type];
			if (label && notify.enabled)
				pushToast(
					d.student_name,
					label,
					EV_WARNING.has(d.type) ? 'warning' : 'info',
					'/teacher/exam/' + d.exam_id
				);
		});
		es.addEventListener('exam_submitted', (e) => {
			const d = JSON.parse((e as MessageEvent).data);
			if (d.group_id !== currentGroupId) return;
			const exam = exams.find((x) => x.id === d.exam_id);
			if (exam) exam.submitted_at = d.submitted_at;
			if (notify.enabled)
				pushToast(
					'Работа сдана',
					d.student_name + ' завершил экзамен',
					'success',
					'/teacher/exam/' + d.exam_id
				);
		});
		es.onerror = () => setTimeout(connectSSE, 3000);
	}

	onMount(async () => {
		initNotify();
		await loadGroup();
		await load();
		await loadSettings();
		connectSSE();
	});
	onDestroy(() => es?.close());
</script>

<div class="page-header">
	<div class="container">
		<h1>Экзамен</h1>
		<div class="flex items-center gap-1">
			<button
				class="btn-icon"
				onclick={() => (settingsOpen = true)}
				title="Настройки экзамена"
				aria-label="Настройки экзамена"
			>
				<Icon name="gear" />
			</button>

			<button
				class="btn-icon"
				onclick={toggleNotify}
				title={notify.enabled ? 'Выключить уведомления' : 'Включить уведомления'}
				aria-label="Уведомления"
			>
				<Icon name={notify.enabled ? 'bell' : 'bell-slash'} />
			</button>

			<div class="export-wrap" use:clickOutside={() => (exportOpen = false)}>
				<button
					class="btn-icon"
					onclick={() => (exportOpen = !exportOpen)}
					title="Экспорт результатов"
					aria-label="Экспорт результатов"
				>
					<Icon name="download" />
				</button>
				{#if exportOpen}
					<div class="export-menu">
						<a class="export-item" href="/api/teacher/exams/export.csv" download>CSV</a>
						<a class="export-item" href="/api/teacher/exams/export.tsv" download>TSV (Excel)</a>
						<a class="export-item" href="/api/teacher/exams/export.json" download>JSON</a>
					</div>
				{/if}
			</div>

			<button
				class="btn-icon btn-icon-danger"
				onclick={resetAll}
				title="Сбросить все экзамены"
				aria-label="Сбросить все экзамены"
			>
				<Icon name="trash" />
			</button>
		</div>
	</div>
</div>

{#if settingsOpen}
	<div
		class="group-modal-overlay"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) settingsOpen = false;
		}}
	>
		<div class="group-modal">
			<div class="flex items-center justify-between mb-3">
				<h2>Настройки экзамена</h2>
				<button
					class="btn-icon btn-icon-bare"
					onclick={() => (settingsOpen = false)}
					title="Закрыть"
				>
					<Icon name="x" />
				</button>
			</div>

			<div class="form-group">
				<label class="flex items-center gap-2" style="cursor:pointer">
					<span class="switch">
						<input type="checkbox" bind:checked={limitEnabled} onchange={toggleLimit} />
						<span class="switch-slider"></span>
					</span>
					<span>Ограничить время</span>
				</label>
				{#if limitEnabled}
					<div class="flex items-center gap-2 mt-2">
						<input
							type="number"
							min="1"
							class="no-spin"
							bind:value={durationInput}
							style="width:5rem;text-align:center"
						/>
						<span class="text-xs text-muted">минут на экзамен</span>
					</div>
				{/if}
			</div>

			<div class="form-row">
				<div class="form-group">
					<label for="thc">Теоретических вопросов в билете</label>
					<input
						id="thc"
						type="number"
						min="0"
						max={activeTheory}
						bind:value={theoryCount}
						onchange={() => (theoryCount = clampCount(theoryCount, activeTheory))}
					/>
					<div class="text-xs text-muted mt-1">Доступно активных: {activeTheory}</div>
				</div>
				<div class="form-group">
					<label for="prc">Практических вопросов в билете</label>
					<input
						id="prc"
						type="number"
						min="0"
						max={activePractical}
						bind:value={practicalCount}
						onchange={() => (practicalCount = clampCount(practicalCount, activePractical))}
					/>
					<div class="text-xs text-muted mt-1">Доступно активных: {activePractical}</div>
				</div>
			</div>

			<div class="form-group">
				<label class="flex items-center gap-2" style="cursor:pointer">
					<span class="switch">
						<input type="checkbox" bind:checked={captureEnabled} />
						<span class="switch-slider"></span>
					</span>
					<span>Запись экрана (скриншоты)</span>
				</label>
				<div class="text-xs text-muted mt-1">
					Требует от студента шаринга всего экрана. Работает только по HTTPS.
				</div>
			</div>

			<div class="flex gap-2 justify-end">
				<button class="btn btn-secondary" onclick={() => (settingsOpen = false)}>Отмена</button>
				<button class="btn btn-primary" onclick={saveSettings}>Сохранить</button>
			</div>
		</div>
	</div>
{/if}

<div class="container">
	<div class="card exam-state-card">
		<label class="switch" title={!canOpen && !examOpen ? 'Недостаточно вопросов в банке' : ''}>
			<input
				type="checkbox"
				bind:checked={examOpen}
				onchange={toggleExamOpen}
				disabled={!examOpen && !canOpen}
			/>
			<span class="switch-slider"></span>
		</label>
		<div class="exam-state-text">
			<div class="exam-state-title {examOpen ? 'is-open' : ''}">
				{examOpen ? 'Экзамен открыт' : 'Экзамен закрыт'}
			</div>
			<div class="text-sm text-muted">
				{examOpen ? 'Студенты могут входить и начинать работу' : 'Вход для студентов закрыт'}
			</div>
			{#if !canOpen && !examOpen}
				<div class="exam-state-warn text-xs">Недостаточно активных вопросов в банке</div>
			{/if}
		</div>
	</div>

	<div class="stats-grid">
		<StatCard value={active} label="Сдают сейчас" />
		<StatCard value={submitted} label="Сданных работ" />
		<StatCard value={totalSuspicious} label="Подозрит. действий" />
	</div>

	<div class="flex gap-2 mb-3">
		<button
			class="btn btn-sm {filter === 'all' ? 'btn-primary' : 'btn-secondary'}"
			onclick={() => (filter = 'all')}>Все</button
		>
		<button
			class="btn btn-sm {filter === 'active' ? 'btn-primary' : 'btn-secondary'}"
			onclick={() => (filter = 'active')}>Активные</button
		>
		<button
			class="btn btn-sm {filter === 'submitted' ? 'btn-primary' : 'btn-secondary'}"
			onclick={() => (filter = 'submitted')}>Сданные</button
		>
	</div>

	<div class="card" style="padding:0;overflow:hidden">
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>Студент</th>
						<th>Начало</th>
						<th>Окончание / Статус</th>
						<th title="Копирование" class="text-center"><span class="cli-tag">[copy]</span></th>
						<th title="Вставка" class="text-center"><span class="cli-tag">[paste]</span></th>
						<th title="Смена вкладки" class="text-center"><span class="cli-tag">[tab]</span></th>
						<th title="Потеря фокуса окна" class="text-center"
							><span class="cli-tag">[blur]</span></th
						>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each displayRows as e (e.id)}
						<tr class={e._older ? 'attempt-older' : ''}>
							<td class="font-semibold">
								{#if e._latest && e._hasOlder}
									<button
										class="btn-icon btn-icon-bare"
										style="vertical-align:top"
										onclick={() => toggleExpand(e.student_id)}
										title={expanded[e.student_id] ? 'Свернуть попытки' : 'Показать прошлые попытки'}
									>
										<span
											style={expanded[e.student_id]
												? 'display:inline-block;transform:rotate(90deg)'
												: ''}><Icon name="caret" /></span
										>
									</button>
								{/if}
								{#if e._older}<span style="display:inline-block;width:1.75rem"></span>{/if}
								{#if !e._older}<span style="vertical-align:top">{e.student_name}</span>{/if}
								{#if e.attempt > 1 || e._older}
									<span class="badge badge-gray" style="margin-left:.4rem;vertical-align:top"
										>попытка {e.attempt}</span
									>
								{/if}
							</td>
							<td class="text-sm">{fmtDt(e.started_at)}</td>
							<td>
								{#if !e.submitted_at}<span class="badge badge-green">● Активен</span>
								{:else}<span class="text-sm">{fmtDt(e.submitted_at)}</span>{/if}
							</td>
							<td class={countClass(e.copy_count)}>{e.copy_count}</td>
							<td class={countClass(e.paste_count)}>{e.paste_count}</td>
							<td class={countClass(e.tab_hidden_count)}>{e.tab_hidden_count}</td>
							<td class={countClass(e.window_blur_count)}>{e.window_blur_count}</td>
							<td><a href="/teacher/exam/{e.id}" class="btn btn-sm btn-secondary">[detail]</a></td>
						</tr>
					{/each}
					{#if displayRows.length === 0}
						<tr><td colspan="8" class="text-center text-muted py-4">Нет данных</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>
