import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { requireTeacher, readJson } from '$lib/server/guard';
import { getSetting } from '$lib/server/groups';

export const GET: RequestHandler = ({ locals }) => {
	const groupId = requireTeacher(locals);
	const countActive = db.prepare(
		'SELECT COUNT(*) c FROM questions WHERE type = ? AND active = 1 AND group_id = ?'
	);
	const activeTheory = (countActive.get('theory', groupId) as { c: number }).c;
	const activePractical = (countActive.get('practical', groupId) as { c: number }).c;
	return json({
		exam_duration_minutes: getSetting(groupId, 'exam_duration_minutes'),
		questions_per_exam_theory: getSetting(groupId, 'questions_per_exam_theory'),
		questions_per_exam_practical: getSetting(groupId, 'questions_per_exam_practical'),
		active_theory: activeTheory,
		active_practical: activePractical,
		exam_open: getSetting(groupId, 'exam_open'),
		fullscreen_lock_enabled: getSetting(groupId, 'fullscreen_lock_enabled'),
		screen_capture_enabled: getSetting(groupId, 'screen_capture_enabled'),
		screenshot_interval_seconds: getSetting(groupId, 'screenshot_interval_seconds')
	});
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const groupId = requireTeacher(locals);
	const body = await readJson(request);
	const set = db.prepare(
		'INSERT OR REPLACE INTO group_settings (group_id, key, value) VALUES (?,?,?)'
	);
	if (body.exam_duration_minutes !== undefined) {
		set.run(groupId, 'exam_duration_minutes', String(+(body.exam_duration_minutes as number) || 0));
	}
	if (body.exam_open !== undefined) {
		// Зеркало createExam: нельзя открыть экзамен, если активных вопросов меньше, чем нужно на билет.
		if (body.exam_open) {
			const countActive = db.prepare(
				'SELECT COUNT(*) c FROM questions WHERE type = ? AND active = 1 AND group_id = ?'
			);
			const activeTheory = (countActive.get('theory', groupId) as { c: number }).c;
			const activePractical = (countActive.get('practical', groupId) as { c: number }).c;
			const reqTheory = +getSetting(groupId, 'questions_per_exam_theory') || 2;
			const reqPractical = +getSetting(groupId, 'questions_per_exam_practical') || 1;
			if (activeTheory < reqTheory || activePractical < reqPractical) {
				return json(
					{
						error: `Недостаточно активных вопросов: нужно теория ${reqTheory}, практика ${reqPractical}; есть ${activeTheory} и ${activePractical}`
					},
					{ status: 400 }
				);
			}
		}
		set.run(groupId, 'exam_open', body.exam_open ? '1' : '0');
	}
	if (body.questions_per_exam_theory !== undefined) {
		set.run(
			groupId,
			'questions_per_exam_theory',
			String(Math.max(0, Math.trunc(+(body.questions_per_exam_theory as number)) || 0))
		);
	}
	if (body.questions_per_exam_practical !== undefined) {
		set.run(
			groupId,
			'questions_per_exam_practical',
			String(Math.max(0, Math.trunc(+(body.questions_per_exam_practical as number)) || 0))
		);
	}
	if (body.fullscreen_lock_enabled !== undefined) {
		set.run(groupId, 'fullscreen_lock_enabled', body.fullscreen_lock_enabled ? '1' : '0');
	}
	if (body.screen_capture_enabled !== undefined) {
		set.run(groupId, 'screen_capture_enabled', body.screen_capture_enabled ? '1' : '0');
	}
	if (body.screenshot_interval_seconds !== undefined) {
		set.run(
			groupId,
			'screenshot_interval_seconds',
			String(
				Math.max(2, Math.min(600, Math.trunc(+(body.screenshot_interval_seconds as number)) || 10))
			)
		);
	}
	return json({ ok: true });
};
