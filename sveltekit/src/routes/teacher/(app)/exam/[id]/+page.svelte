<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import Markdown from '$lib/components/Markdown.svelte';
	import { appConfirm } from '$lib/stores/confirm.svelte';
	import { EV_SHORT, EV_CLASS, EV_MARKER } from '$lib/events';

	interface EventItem {
		id: number;
		type: string;
		field: string | null;
		ts: number;
		payload: Record<string, unknown>;
	}
	interface QuestionItem {
		position: number;
		answer: string | null;
		id: number;
		type: 'theory' | 'practical';
		body: string;
	}
	interface Exam {
		id: number;
		student_id: number;
		student_name: string;
		started_at: number;
		submitted_at: number | null;
		grade: string | null;
		teacher_comment: string | null;
		attempt: number;
		retake_allowed: number;
		questions: QuestionItem[];
		events: EventItem[];
		screenshots: { id: number; ts: number }[];
	}
	interface Panel {
		field: string;
		label: string;
		badgeCls: string;
		questionBody: string;
		finalAnswer: string | null;
		currentMs: number;
		playing: boolean;
		showQuestion: boolean;
		overlayText: string;
	}

	const id = page.params.id;

	let exam = $state<Exam | null>(null);
	let loading = $state(true);
	let error = $state('');
	let grade = $state('');
	let teacherComment = $state('');
	let gradeSaved = $state(false);
	let logFilter = $state<'anomalies' | 'all'>('anomalies');
	let replaySpeed = $state(2);
	let panels = $state<Panel[]>([]);
	let hoverMarker = $state<EventItem | null>(null);
	let lightbox = $state<string | null>(null);

	const rafs: Record<string, number> = {};
	const overlayTimers: Record<string, ReturnType<typeof setTimeout>> = {};

	const totalMs = $derived(exam ? (exam.submitted_at || Date.now()) - exam.started_at : 1);
	const copyCount = $derived(exam?.events.filter((e) => e.type === 'copy').length || 0);
	const pasteCount = $derived(exam?.events.filter((e) => e.type === 'paste').length || 0);
	const tabCount = $derived(exam?.events.filter((e) => e.type === 'tab_hidden').length || 0);
	const blurCount = $derived(exam?.events.filter((e) => e.type === 'window_blur').length || 0);
	const focusCount = $derived(
		exam?.events.filter((e) => e.type === 'window_focus' || e.type === 'tab_visible').length || 0
	);

	const groupedEvents = $derived.by(() => {
		const result: Array<
			| EventItem
			| { type: 'keystroke_group'; field: string | null; count: number; ts: number; id: string }
		> = [];
		for (const ev of exam?.events || []) {
			if (ev.type === 'answer_snapshot') continue;
			if (ev.type === 'keystroke') {
				const last = result[result.length - 1];
				if (last && 'count' in last && last.field === ev.field) {
					last.count++;
				} else {
					result.push({
						type: 'keystroke_group',
						field: ev.field,
						count: 1,
						ts: ev.ts,
						id: 'kg_' + ev.id
					});
				}
			} else result.push(ev);
		}
		return result;
	});
	const displayEvents = $derived(
		logFilter === 'anomalies'
			? groupedEvents.filter((e) => e.type !== 'keystroke_group')
			: groupedEvents
	);

	function keystrokesFor(field: string) {
		return (exam?.events || []).filter((e) => e.type === 'keystroke' && e.field === field);
	}
	function snapshotsFor(field: string) {
		return (exam?.events || []).filter((e) => e.type === 'answer_snapshot' && e.field === field);
	}
	function eventsFor(field: string) {
		return (exam?.events || []).filter((e) => {
			if (
				['copy', 'paste', 'window_blur', 'window_focus', 'tab_hidden', 'tab_visible'].includes(
					e.type
				)
			)
				return e.field === field;
			return false;
		});
	}

	function getValueAt(field: string, ms: number) {
		if (!exam) return '';
		const targetTs = exam.started_at + ms;
		const snaps = snapshotsFor(field);
		const ks = keystrokesFor(field);
		let snap = snaps.find((s) => s.ts >= targetTs);
		if (!snap) snap = snaps[snaps.length - 1];
		if (!snap) return '';
		if (targetTs >= snap.ts) return (snap.payload?.value as string) || '';
		let len = 0;
		for (const k of ks) {
			if (k.ts > targetTs) break;
			if (typeof k.payload?.length === 'number') len = k.payload.length as number;
		}
		return ((snap.payload?.value as string) || '').slice(0, len);
	}

	function togglePlay(field: string) {
		const panel = panels.find((p) => p.field === field);
		if (!panel || !exam) return;
		if (panel.playing) {
			panel.playing = false;
			cancelAnimationFrame(rafs[field]);
			return;
		}
		panel.playing = true;
		let lastWall = Date.now();
		const tick = () => {
			if (!panel.playing || !exam) return;
			const now = Date.now();
			const prevMs = panel.currentMs;
			const delta = (now - lastWall) * replaySpeed;
			lastWall = now;
			panel.currentMs = Math.min(prevMs + delta, totalMs);
			const passed = eventsFor(field).filter((e) => {
				const eMs = e.ts - exam!.started_at;
				return eMs > prevMs && eMs <= panel.currentMs;
			});
			if (passed.length > 0) {
				const ev = passed[passed.length - 1];
				let text = '> ' + evLabel(ev.type);
				if (ev.type === 'paste' || ev.type === 'copy')
					text += ': "' + ((ev.payload?.text as string) || '').slice(0, 50) + '"';
				panel.overlayText = text;
				clearTimeout(overlayTimers[field]);
				overlayTimers[field] = setTimeout(() => (panel.overlayText = ''), 2000);
			}
			if (panel.currentMs >= totalMs) {
				panel.playing = false;
				return;
			}
			rafs[field] = requestAnimationFrame(tick);
		};
		rafs[field] = requestAnimationFrame(tick);
	}

	function markerPct(ts: number) {
		if (!exam || totalMs <= 0) return 0;
		return Math.min(100, Math.max(0, ((ts - exam.started_at) / totalMs) * 100));
	}
	function markerClass(type: string) {
		return 't-marker ' + (EV_MARKER[type] || 't-marker-copy');
	}
	function fmtDt(ts: number | null) {
		if (!ts) return '—';
		return new Date(ts).toLocaleString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}
	function fmtMs(ms: number) {
		if (ms == null || ms < 0) return '0:00';
		const s = Math.floor(ms / 1000);
		return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
	}
	function duration() {
		if (!exam) return '—';
		const d = (exam.submitted_at || Date.now()) - exam.started_at;
		return Math.floor(d / 60000) + ' мин ' + Math.floor((d % 60000) / 1000) + ' сек';
	}
	function evClass(type: string) {
		return EV_CLASS[type] || '';
	}
	function evLabel(type: string) {
		return EV_SHORT[type] || type;
	}
	function evPayloadStr(ev: EventItem) {
		if (ev.type === 'copy' || ev.type === 'paste')
			return '"' + ((ev.payload?.text as string) || '').slice(0, 60) + '"';
		return '';
	}

	async function saveGrade() {
		await fetch('/api/teacher/exams/' + id + '/grade', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ grade, teacher_comment: teacherComment })
		});
		gradeSaved = true;
		setTimeout(() => (gradeSaved = false), 3000);
	}
	async function allowRetake() {
		if (!exam) return;
		await fetch('/api/teacher/students/' + exam.student_id + '/allow-retake', { method: 'POST' });
		exam.retake_allowed = 1;
	}
	async function resetExam() {
		if (!exam) return;
		if (
			!(await appConfirm(
				'Сбросить экзамен студенту «' +
					exam.student_name +
					'»? Все его попытки будут удалены безвозвратно.'
			))
		)
			return;
		await fetch('/api/teacher/students/' + exam.student_id + '/reset-exam', { method: 'POST' });
		window.location.href = '/teacher';
	}

	onMount(async () => {
		const r = await fetch('/api/teacher/exams/' + id);
		if (r.status === 401) {
			window.location.href = '/teacher/login';
			return;
		}
		if (!r.ok) {
			error = 'Не найдено';
			loading = false;
			return;
		}
		exam = await r.json();
		grade = exam!.grade || '';
		teacherComment = exam!.teacher_comment || '';
		panels = (exam!.questions || []).map((q) => ({
			field: String(q.position),
			label: q.type === 'practical' ? 'Практическое задание' : 'Теория ' + q.position,
			badgeCls: q.type === 'practical' ? 'badge-yellow' : 'badge-blue',
			questionBody: q.body,
			finalAnswer: q.answer,
			currentMs: 0,
			playing: false,
			showQuestion: true,
			overlayText: ''
		}));
		loading = false;
	});

	onDestroy(() => {
		for (const k of Object.keys(rafs)) cancelAnimationFrame(rafs[k]);
		for (const k of Object.keys(overlayTimers)) clearTimeout(overlayTimers[k]);
	});
</script>

{#if loading}
	<div class="container py-8 text-center text-muted">Загрузка…</div>
{:else if error}
	<div class="container py-4"><div class="alert alert-error">{error}</div></div>
{:else if exam}
	<div class="container py-4">
		<div class="card mb-4">
			<div class="flex items-center justify-between flex-wrap gap-3">
				<div>
					<h1>
						{exam.student_name}
						<span class="badge badge-gray" style="font-size:.75rem;vertical-align:middle"
							>попытка {exam.attempt || 1}</span
						>
					</h1>
					<div class="text-sm text-muted mt-1">
						Начало: {fmtDt(exam.started_at)} &nbsp;|&nbsp; Конец: {exam.submitted_at
							? fmtDt(exam.submitted_at)
							: 'в процессе'} &nbsp;|&nbsp; Длительность: {duration()}
					</div>
					<div class="flex gap-2 mt-3">
						{#if exam.submitted_at && !exam.retake_allowed}
							<button class="btn btn-sm btn-secondary" onclick={allowRetake}
								>Разрешить пересдачу</button
							>
						{/if}
						{#if exam.retake_allowed}<span class="badge badge-green">пересдача разрешена</span>{/if}
						<button class="btn btn-sm btn-danger" onclick={resetExam}
							>Сбросить экзамен студенту</button
						>
					</div>
				</div>
				<div class="flex gap-2 flex-wrap">
					{#if copyCount > 0}<span class="badge badge-yellow">{copyCount} * [copy]</span>{/if}
					{#if pasteCount > 0}<span class="badge badge-yellow">{pasteCount} * [paste]</span>{/if}
					{#if tabCount > 0}<span class="badge badge-red">{tabCount} * [tab]</span>{/if}
					{#if blurCount > 0}<span class="badge badge-red">{blurCount} * [blur]</span>{/if}
					{#if focusCount > 0}<span class="badge badge-green">{focusCount} * [focus]</span>{/if}
				</div>
			</div>
		</div>

		{#each panels as panel (panel.field)}
			<div class="card mb-4">
				<div class="flex items-center justify-between mb-3">
					<div>
						<span class="badge {panel.badgeCls}">{panel.label}</span>
						<span class="text-sm text-muted ml-2">{keystrokesFor(panel.field).length} нажатий</span>
					</div>
					<div class="flex gap-2 items-center flex-wrap">
						<button
							class="btn btn-sm btn-secondary"
							onclick={() => (panel.showQuestion = !panel.showQuestion)}
							>{panel.showQuestion ? 'Скрыть вопрос' : 'Показать вопрос'}</button
						>
						<div class="flex gap-1 items-center">
							<span class="text-xs text-muted">×</span>
							{#each [1, 2, 5, 10] as s (s)}
								<button
									class="btn btn-xs {replaySpeed === s ? 'btn-primary' : 'btn-secondary'}"
									onclick={() => (replaySpeed = s)}>{s}</button
								>
							{/each}
						</div>
						<button class="btn btn-sm btn-primary" onclick={() => togglePlay(panel.field)}
							>{panel.playing ? '[pause]' : '[play]'}</button
						>
					</div>
				</div>

				{#if panel.showQuestion}
					<div
						class="question-text mb-3 p-4"
						style="background:var(--bg);border-radius:.5rem;border:1px solid var(--border)"
					>
						<Markdown source={panel.questionBody} />
					</div>
				{/if}

				<div class="replay-panel">
					<div class="flex items-center gap-3 mb-2">
						<span class="text-xs text-muted">{fmtMs(panel.currentMs)}</span>
						<div style="flex:1">
							<input
								type="range"
								class="timeline-slider"
								min="0"
								max={totalMs}
								value={panel.currentMs}
								oninput={(e) => (panel.currentMs = +(e.target as HTMLInputElement).value)}
							/>
							<div class="timeline-markers">
								{#each eventsFor(panel.field) as ev (ev.id)}
									<div
										class="{markerClass(ev.type)}{hoverMarker?.id === ev.id
											? ' t-marker-hover'
											: ''}"
										style="left:{markerPct(ev.ts)}%"
										role="presentation"
										onmouseenter={() => (hoverMarker = ev)}
										onmouseleave={() => (hoverMarker = null)}
										onclick={() => (panel.currentMs = ev.ts - exam!.started_at)}
									></div>
								{/each}
								{#if hoverMarker && hoverMarker.field === panel.field}
									<div class="t-tooltip" style="left:{markerPct(hoverMarker.ts)}%">
										<span class="t-tooltip-label">{evLabel(hoverMarker.type)}</span>
										<span class="t-tooltip-ts">{fmtMs(hoverMarker.ts - exam.started_at)}</span>
										{#if hoverMarker.payload?.text}
											<span class="t-tooltip-payload"
												>«{(hoverMarker.payload.text as string).slice(0, 60)}»</span
											>
										{/if}
									</div>
								{/if}
							</div>
						</div>
						<span class="text-xs text-muted">{fmtMs(totalMs)}</span>
					</div>

					<div class="replay-overlay">{panel.overlayText}</div>
					<div class="replay-text mt-2">
						{getValueAt(panel.field, panel.currentMs) || '(пусто)'}
					</div>
				</div>

				{#if exam.submitted_at}
					<div class="mt-3">
						<div class="text-xs text-muted mb-1 font-semibold">Финальный ответ (сданный):</div>
						<div class="replay-text" style="border-color:#22c55e">
							{panel.finalAnswer || '(нет ответа)'}
						</div>
					</div>
				{/if}
			</div>
		{/each}

		<div class="card">
			<div class="flex items-center justify-between mb-3">
				<h2>Журнал событий</h2>
				<div class="flex gap-2 items-center">
					<button
						class="btn btn-sm {logFilter === 'anomalies' ? 'btn-primary' : 'btn-secondary'}"
						onclick={() => (logFilter = 'anomalies')}>Аномалии</button
					>
					<button
						class="btn btn-sm {logFilter === 'all' ? 'btn-primary' : 'btn-secondary'}"
						onclick={() => (logFilter = 'all')}>Все</button
					>
					<span class="badge badge-gray">{displayEvents.length} строк</span>
				</div>
			</div>
			<div class="event-log">
				{#each displayEvents as ev (ev.id)}
					<div class="event-row">
						<span class="event-ts">{fmtMs(ev.ts - exam.started_at)}</span>
						{#if ev.type === 'keystroke_group'}
							<span>
								<span class="event-type ev-keystroke">Ввод</span>
								<span class="text-xs text-muted">{ev.field ? '[' + ev.field + ']' : ''}</span>
								<span class="text-xs text-muted">— {(ev as { count: number }).count} нажатий</span>
							</span>
						{:else}
							<span>
								<span class="event-type {evClass(ev.type)}">{evLabel(ev.type)}</span>
								<span class="text-xs text-muted">{ev.field ? '[' + ev.field + ']' : ''}</span>
								<span class="text-xs">{evPayloadStr(ev as EventItem)}</span>
							</span>
						{/if}
					</div>
				{/each}
				{#if displayEvents.length === 0}
					<div class="text-center text-muted py-4">Нет событий</div>
				{/if}
			</div>
		</div>

		{#if exam.screenshots?.length}
			<div class="card mt-4">
				<div class="flex items-center justify-between mb-3">
					<h2>Запись экрана</h2>
					<span class="badge badge-gray">{exam.screenshots.length} кадров</span>
				</div>
				<div class="screenshot-grid">
					{#each exam.screenshots as shot (shot.id)}
						<button
							class="screenshot-thumb"
							onclick={() => (lightbox = '/api/teacher/exams/' + id + '/screenshots/' + shot.id)}
						>
							<img
								loading="lazy"
								src="/api/teacher/exams/{id}/screenshots/{shot.id}"
								alt="скриншот {fmtMs(shot.ts - exam.started_at)}"
							/>
							<span class="screenshot-ts">{fmtMs(shot.ts - exam.started_at)}</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<div class="card mt-4">
			<h2>Оценка</h2>
			<div class="flex gap-3 mt-3" style="flex-wrap:wrap">
				<div class="form-group" style="flex:0 0 150px">
					<label for="grd">Оценка</label>
					<input id="grd" type="text" bind:value={grade} placeholder="5 / зачёт / …" />
				</div>
				<div class="form-group" style="flex:1 1 300px">
					<label for="cmt">Комментарий</label>
					<input
						id="cmt"
						type="text"
						bind:value={teacherComment}
						placeholder="Комментарий к работе…"
					/>
				</div>
			</div>
			<div class="flex items-center gap-3">
				<button class="btn btn-primary btn-sm" onclick={saveGrade}>Сохранить оценку</button>
				{#if gradeSaved}<span class="text-sm" style="color:var(--success)">[ok] Сохранено</span
					>{/if}
			</div>
		</div>
	</div>
{/if}

{#if lightbox}
	<div class="lightbox" role="presentation" onclick={() => (lightbox = null)}>
		<img src={lightbox} alt="скриншот крупно" />
	</div>
{/if}

<style>
	.screenshot-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 0.5rem;
	}
	.screenshot-thumb {
		position: relative;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		overflow: hidden;
		cursor: zoom-in;
		background: var(--bg);
		aspect-ratio: 16 / 10;
	}
	.screenshot-thumb img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.screenshot-ts {
		position: absolute;
		left: 0;
		bottom: 0;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		padding: 0.1rem 0.3rem;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
	}
	.lightbox {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.85);
		cursor: zoom-out;
		padding: 1rem;
	}
	.lightbox img {
		max-width: 95vw;
		max-height: 95vh;
		object-fit: contain;
	}
</style>
