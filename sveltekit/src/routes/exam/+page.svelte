<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Markdown from '$lib/components/Markdown.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { Tracker, isTouchDevice } from '$lib/tracking';
	import { ScreenCapture } from '$lib/screenCapture';
	import { appConfirm } from '$lib/stores/confirm.svelte';

	interface Question {
		position: number;
		type: 'theory' | 'practical';
		body: string;
		answer?: string;
	}
	interface Exam {
		exam_id: number;
		student_name: string;
		started_at: number;
		duration_minutes: number;
		fullscreen_lock?: boolean;
		screen_capture?: boolean;
		questions: Question[];
	}

	let exam = $state<Exam | null>(null);
	let answers = $state<Record<number, string>>({});
	let loading = $state(true);
	let waiting = $state(false);
	let error = $state('');
	let submitting = $state(false);
	let reviewMode = $state(false);
	let justSubmitted = $state(false);
	let reviewGrade = $state<string | null>(null);
	let reviewComment = $state<string | null>(null);
	let elapsed = $state('00:00:00');
	let timerLabel = $state('прошло времени');
	let timerDanger = $state(false);
	let step = $state(1);
	let typedBodies = $state<Record<number, string>>({});
	let needsFullscreen = $state(false);
	let fullscreenError = $state(false);
	let needsScreenShare = $state(false);
	let screenShareError = $state('');

	const seenSteps: Record<number, boolean> = {};
	const lastSnapshots: Record<number, string> = {};
	const tracker = new Tracker();
	const screenCapture = new ScreenCapture();
	let flushTimer: ReturnType<typeof setInterval> | undefined;
	let clockTimer: ReturnType<typeof setInterval> | undefined;
	let pollTimer: ReturnType<typeof setInterval> | undefined;
	let gradeTimer: ReturnType<typeof setInterval> | undefined;
	let typingTimer: ReturnType<typeof setTimeout> | undefined;

	const totalSteps = $derived(exam?.questions.length ?? 0);
	const navHint = $derived.by(() => {
		if (!exam) return '';
		if (step === totalSteps) return 'Проверьте ответы и сдайте работу';
		const next = exam.questions[step];
		if (!next) return 'Переходите к следующему вопросу';
		return next.type === 'practical'
			? 'Ответьте и переходите к практическому заданию'
			: 'Ответьте развёрнуто и переходите дальше';
	});
	const nextLabel = $derived.by(() => {
		const next = exam?.questions[step];
		if (!next) return 'Дальше →';
		return next.type === 'practical' ? 'К практическому заданию →' : 'Следующий вопрос →';
	});

	function stepLabel(q: Question) {
		return q.type === 'practical' ? 'Практика' : 'Теория';
	}
	function sectionTitle(q: Question) {
		return q.type === 'practical' ? 'Практическое задание' : 'Теоретический вопрос ' + q.position;
	}

	async function flush() {
		for (const pos of Object.keys(answers)) {
			const p = Number(pos);
			if (answers[p] !== lastSnapshots[p]) {
				tracker.buf.push({
					field: String(p),
					type: 'answer_snapshot',
					payload: { value: answers[p] },
					ts: Date.now()
				});
				lastSnapshots[p] = answers[p];
			}
		}
		if (tracker.buf.length === 0) return;
		const batch = tracker.drain();
		try {
			await fetch('/api/exam/events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ events: batch, draft: { ...answers } })
			});
		} catch {
			tracker.buf.unshift(...batch);
		}
	}

	function startClock() {
		const tick = () => {
			if (!exam) return;
			const e = Date.now() - exam.started_at;
			if (exam.duration_minutes > 0) {
				const remaining = exam.duration_minutes * 60000 - e;
				if (remaining <= 0) {
					elapsed = '00:00:00';
					timerDanger = true;
					if (clockTimer) clearInterval(clockTimer);
					doSubmit(true);
					return;
				}
				const h = Math.floor(remaining / 3600000);
				const m = Math.floor((remaining % 3600000) / 60000);
				const s = Math.floor((remaining % 60000) / 1000);
				elapsed = [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
				timerDanger = remaining < 5 * 60000;
				timerLabel = 'осталось';
			} else {
				const h = Math.floor(e / 3600000);
				const m = Math.floor((e % 3600000) / 60000);
				const s = Math.floor((e % 60000) / 1000);
				elapsed = [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
			}
		};
		tick();
		clockTimer = setInterval(tick, 1000);
	}

	function typeStep(s: number) {
		const q = exam?.questions.find((x) => x.position === s);
		if (!q) return;
		if (typingTimer) clearTimeout(typingTimer);
		if (seenSteps[s]) {
			typedBodies[s] = q.body;
			return;
		}
		seenSteps[s] = true;
		typedBodies[s] = '';
		let i = 0;
		const tick = () => {
			if (i < q.body.length) {
				typedBodies[s] += q.body[i++];
				typingTimer = setTimeout(tick, 8);
			}
		};
		tick();
	}

	function onInput(field: number, e: Event) {
		const t = e.target as HTMLTextAreaElement;
		tracker.record(String(field), 'keystroke', {
			key: (e as InputEvent).data,
			length: t.value.length,
			cursor: t.selectionStart
		});
	}
	function onPaste(field: number, e: ClipboardEvent) {
		const text = e.clipboardData?.getData('text/plain') || '';
		tracker.record(String(field), 'paste', { text });
	}

	async function enterFullscreen() {
		fullscreenError = false;
		try {
			await document.documentElement.requestFullscreen();
			needsFullscreen = false;
		} catch {
			fullscreenError = true;
		}
	}
	function skipFullscreen() {
		// Браузер не дал полный экран — пропускаем, но фиксируем для преподавателя.
		tracker.record(tracker.activeField, 'fullscreen_exit');
		flush();
		needsFullscreen = false;
	}

	async function requestScreenShare() {
		screenShareError = '';
		const res = await screenCapture.start();
		if (res.ok) {
			tracker.record(tracker.activeField, 'screen_share_started');
			flush();
			needsScreenShare = false;
			return;
		}
		if (res.reason === 'not_monitor') {
			screenShareError = 'Нужно выбрать «Весь экран», а не отдельное окно или вкладку.';
			return;
		}
		if (res.reason === 'insecure') {
			// По http захват недоступен — не блокируем экзамен, но фиксируем отказ.
			tracker.record(tracker.activeField, 'screen_share_denied', { reason: 'insecure' });
			flush();
			screenShareError = 'Захват экрана недоступен без HTTPS — продолжаем без записи.';
			needsScreenShare = false;
			return;
		}
		tracker.record(tracker.activeField, 'screen_share_denied', { reason: res.reason });
		flush();
		screenShareError = 'Доступ к экрану обязателен — разрешите шаринг всего экрана.';
	}

	// Один клик = одно разрешение (иначе теряется user-activation для второго запроса).
	async function startExam() {
		if (needsScreenShare) {
			await requestScreenShare();
			return;
		}
		if (needsFullscreen) await enterFullscreen();
	}

	async function nextStep() {
		await flush();
		step++;
		tracker.activeField = String(step);
		typeStep(step);
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}
	async function prevStep() {
		if (step <= 1) return;
		await flush();
		step--;
		tracker.activeField = String(step);
		typeStep(step);
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	async function doSubmit(auto = false) {
		if (submitting) return;
		if (!auto && !(await appConfirm('Сдать работу? Это действие нельзя отменить.'))) return;
		await flush();
		submitting = true;
		try {
			const r = await fetch('/api/exam/submit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ answers: { ...answers } })
			});
			if (r.ok) {
				if (flushTimer) clearInterval(flushTimer);
				if (clockTimer) clearInterval(clockTimer);
				tracker.detach();
				screenCapture.stop();
				if (document.fullscreenElement) document.exitFullscreen();
				reviewMode = true;
				justSubmitted = true;
				startGradePolling();
			} else {
				submitting = false;
			}
		} catch {
			submitting = false;
		}
	}

	async function pollWaiting() {
		const tick = async () => {
			try {
				const r = await fetch('/api/exam/poll');
				if (r.status === 401) {
					if (pollTimer) clearInterval(pollTimer);
					window.location.href = '/';
					return;
				}
				const d = await r.json();
				if (d.exam_id) {
					if (pollTimer) clearInterval(pollTimer);
					window.location.reload();
					return;
				}
				waiting = true;
				loading = false;
			} catch {
				// повтор на следующем тике
			}
		};
		await tick();
		if (waiting) pollTimer = setInterval(tick, 3000);
	}

	// Опрос результата после сдачи: оценка появляется без перезагрузки страницы.
	function startGradePolling() {
		if (gradeTimer || reviewGrade) return;
		gradeTimer = setInterval(async () => {
			try {
				const r = await fetch('/api/exam/result');
				if (r.status === 401) {
					clearInterval(gradeTimer);
					gradeTimer = undefined;
					return;
				}
				if (!r.ok) return;
				const res = await r.json();
				if (res.grade) {
					reviewGrade = res.grade;
					reviewComment = res.teacher_comment;
					clearInterval(gradeTimer);
					gradeTimer = undefined;
				}
			} catch {
				// повтор на следующем тике
			}
		}, 5000);
	}

	onMount(async () => {
		try {
			const r = await fetch('/api/exam');
			if (r.status === 401) {
				// 401 → возможно уже сдана, пробуем read-only результат.
				const rr = await fetch('/api/exam/result');
				if (rr.ok) {
					const res = await rr.json();
					if (res.submitted_at) {
						exam = res;
						for (const q of res.questions) answers[q.position] = q.answer || '';
						reviewGrade = res.grade;
						reviewComment = res.teacher_comment;
						reviewMode = true;
						loading = false;
						if (!reviewGrade) startGradePolling();
						return;
					}
				}
				await pollWaiting();
				return;
			}
			if (!r.ok) {
				error = 'Не удалось загрузить экзамен';
				loading = false;
				return;
			}
			exam = await r.json();
			loading = false;
			for (const q of exam!.questions) {
				answers[q.position] = q.answer || '';
				lastSnapshots[q.position] = q.answer || '';
			}
			tracker.activeField = String(exam!.questions[0]?.position ?? 1);
			startClock();
			flushTimer = setInterval(flush, 2000);
			tracker.onFullscreenChange = (active) => {
				if (exam?.fullscreen_lock && !reviewMode && !submitting) needsFullscreen = !active;
			};
			if (!isTouchDevice() && exam!.fullscreen_lock) needsFullscreen = true;
			if (!isTouchDevice() && exam!.screen_capture) needsScreenShare = true;
			screenCapture.onStopped = () => {
				if (reviewMode || submitting) return;
				tracker.record(tracker.activeField, 'screen_share_stopped');
				flush();
				needsScreenShare = true;
			};
			tracker.attach(flush);
			typeStep(step);
		} catch {
			error = 'Ошибка соединения';
			loading = false;
		}
	});

	onDestroy(() => {
		if (flushTimer) clearInterval(flushTimer);
		if (clockTimer) clearInterval(clockTimer);
		if (pollTimer) clearInterval(pollTimer);
		if (gradeTimer) clearInterval(gradeTimer);
		if (typingTimer) clearTimeout(typingTimer);
		tracker.detach();
		screenCapture.stop();
	});
</script>

{#if !waiting && !reviewMode}
	<div class="exam-header">
		<div class="container flex items-center justify-between">
			<div>
				<h1>{exam ? 'Экзамен — ' + exam.student_name : 'Загрузка…'}</h1>
				<div class="text-sm mt-1" style="opacity:.75">
					{exam ? 'Начат: ' + new Date(exam.started_at).toLocaleTimeString('ru-RU') : ''}
				</div>
			</div>
			<div class="flex items-center gap-3">
				<div class="text-right">
					<div class="exam-timer" style={timerDanger ? 'color:var(--danger)' : ''}>{elapsed}</div>
					<div class="text-xs mt-1" style="opacity:.7">{timerLabel}</div>
				</div>
				<ThemeToggle />
			</div>
		</div>
	</div>
{/if}

{#if waiting}
	<div class="container py-8">
		<div class="flex justify-end mb-2"><ThemeToggle /></div>
		<div class="text-center">
			<div class="card" style="max-width:520px;margin:0 auto">
				<div style="font-size:2rem;font-family:var(--font-mono);color:var(--primary)">
					[ ожидание<span class="wait-cursor">_</span> ]
				</div>
				<h2 class="mt-3">Ожидание начала экзамена</h2>
				<p class="text-muted mt-2">
					Преподаватель ещё не открыл экзамен. Как только он начнётся, страница откроется
					автоматически.
				</p>
			</div>
		</div>
	</div>
{:else if loading}
	<div class="container py-8 text-center text-muted">Загрузка экзамена…</div>
{:else if error}
	<div class="container py-4">
		<div class="alert alert-error">{error}</div>
		<a href="/" class="btn btn-secondary mt-2">← Вернуться</a>
	</div>
{:else if reviewMode && exam}
	<div class="container py-4">
		<div class="flex items-center justify-between mb-4 gap-2 flex-wrap">
			<div>
				<h1 style="color:var(--primary)">Ваша работа</h1>
				<div class="text-sm text-muted mt-1">принято — изменить ответы уже нельзя</div>
			</div>
			<div class="flex items-center gap-2">
				<a href="/" class="btn btn-sm btn-secondary">← Выйти</a>
				<ThemeToggle />
			</div>
		</div>

		{#if reviewGrade}
			<div class="card mb-4" style="border-color:var(--success)">
				<div class="flex items-start gap-4 flex-wrap">
					<div>
						<div class="stat-label">Оценка</div>
						<div class="stat-value">{reviewGrade}</div>
					</div>
					{#if reviewComment}
						<div style="flex:1;min-width:200px">
							<div class="stat-label">Комментарий преподавателя</div>
							<div class="mt-1">{reviewComment}</div>
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<div class="alert alert-info mb-4">Работа на проверке — оценка появится здесь.</div>
		{/if}

		{#each exam.questions as q (q.position)}
			<div class="exam-section mb-4">
				<div class="exam-section-head">
					<span class="badge {q.type === 'theory' ? 'badge-blue' : 'badge-yellow'}"
						>{sectionTitle(q)}</span
					>
				</div>
				<div class="exam-section-body">
					<div class="question-text"><Markdown source={q.body} /></div>
					<div class="text-sm text-muted">Ваш ответ:</div>
					<div class="replay-text mt-2">{answers[q.position] || '(пусто)'}</div>
				</div>
			</div>
		{/each}
	</div>
{:else if exam}
	<div class="container py-4">
		<div class="flex items-center gap-2 mb-4 text-sm flex-wrap">
			{#each exam.questions as q, i (q.position)}
				<div class="flex items-center gap-2">
					<span
						style="padding:.15rem 0;border-radius:0;line-height:1;display:inline-flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:.72rem;font-weight:700;flex-shrink:0;{step >
						q.position
							? 'background:var(--border);color:var(--text-muted)'
							: step === q.position
								? 'background:var(--primary);color:var(--on-primary)'
								: 'background:transparent;color:var(--text-muted);border:1px solid var(--border)'}"
						>{q.position}</span
					>
					<span class={step === q.position ? 'font-semibold' : 'text-muted'}>{stepLabel(q)}</span>
					{#if i < exam.questions.length - 1}
						<span class="text-muted" style="margin:0 .1rem">─</span>
					{/if}
				</div>
			{/each}
		</div>

		{#each exam.questions as q (q.position)}
			{#if step === q.position}
				<div class="exam-section">
					<div class="exam-section-head">
						<span class="badge {q.type === 'theory' ? 'badge-blue' : 'badge-yellow'}"
							>{sectionTitle(q)}</span
						>
					</div>
					<div class="exam-section-body">
						<div class="question-text"><Markdown source={typedBodies[q.position] || ''} /></div>
						<label class="text-sm text-muted" for="ans-{q.position}">Ваш ответ:</label>
						<textarea
							id="ans-{q.position}"
							bind:value={answers[q.position]}
							oninput={(e) => onInput(q.position, e)}
							onpaste={(e) => onPaste(q.position, e)}
							onfocus={() => (tracker.activeField = String(q.position))}
							style="min-height:{q.type === 'practical' ? '220px' : '180px'}"
							placeholder={q.type === 'practical'
								? 'Введите решение…'
								: 'Введите развёрнутый ответ…'}
						></textarea>
						<div class="char-count">{(answers[q.position] || '').length} символов</div>
					</div>
				</div>
			{/if}
		{/each}

		<div class="card exam-nav mb-6">
			<div class="exam-nav-hint text-sm text-muted">{navHint}</div>
			<div class="exam-nav-btns">
				{#if step > 1}
					<button class="btn btn-secondary" onclick={prevStep}>← Назад</button>
				{/if}
				{#if step < totalSteps}
					<button class="btn btn-primary" onclick={nextStep}>{nextLabel}</button>
				{:else}
					<button class="btn btn-success" onclick={() => doSubmit()} disabled={submitting}>
						{submitting ? 'Отправка…' : 'Сдать работу'}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

{#if (needsFullscreen || needsScreenShare) && !reviewMode && !waiting}
	<div class="confirm-overlay" role="presentation">
		<div class="confirm-modal text-center" style="min-width:360px">
			<div style="font-size:2rem;font-family:var(--font-mono);color:var(--primary)">[ старт ]</div>
			<h2 class="mt-3">Подготовка к экзамену</h2>
			<p class="text-muted mt-2 mb-3">
				{#if needsScreenShare}
					Сначала разрешите запись экрана: нажмите кнопку и выберите <b>Весь экран</b>. Затем
					включится полноэкранный режим. Остановка записи и выход из полного экрана фиксируются
					преподавателем.
				{:else}
					Экзамен проходит в полноэкранном режиме. Выход из него фиксируется преподавателем.
				{/if}
			</p>
			{#if screenShareError}
				<div class="alert alert-error mb-3">{screenShareError}</div>
			{/if}
			{#if fullscreenError}
				<div class="alert alert-error mb-3">
					Браузер не разрешил полноэкранный режим — можно продолжить без него.
				</div>
			{/if}
			<button class="btn btn-primary" onclick={startExam}>
				{needsScreenShare ? 'Начать запись экрана' : 'Войти в полноэкранный режим'}
			</button>
			{#if needsFullscreen && !needsScreenShare}
				<div class="mt-3">
					<button class="btn btn-sm btn-secondary" onclick={skipFullscreen}>
						продолжить без полноэкранного режима
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if justSubmitted}
	<div class="confirm-overlay" role="presentation">
		<div class="confirm-modal text-center" style="min-width:340px">
			<div style="font-size:2rem;font-family:var(--font-mono);color:var(--primary)">
				[ submitted ]
			</div>
			<h2 class="mt-3">Работа принята</h2>
			<p class="text-muted mt-2 mb-4">Можете посмотреть, что вы ответили — ваши ответы ниже.</p>
			<button class="btn btn-primary" onclick={() => (justSubmitted = false)}>ОК</button>
		</div>
	</div>
{/if}
