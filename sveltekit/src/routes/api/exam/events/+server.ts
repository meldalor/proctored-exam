import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { getStudentExam } from '$lib/server/studentAuth';
import { readJson } from '$lib/server/guard';
import { ALERT_TYPES } from '$lib/server/events';
import { broadcast } from '$lib/server/sse';

interface ClientEvent {
	field?: string | null;
	type: string;
	payload?: unknown;
	ts?: number;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const exam = getStudentExam(cookies.get('student_token'));
	if (!exam) return json({ error: 'Not authenticated' }, { status: 401 });

	const body = await readJson(request);
	const events = body.events as ClientEvent[] | undefined;
	const draft = body.draft as Record<string, unknown> | undefined;

	if (Array.isArray(events) && events.length > 0) {
		const insertEvent = db.prepare(
			'INSERT INTO events (exam_id, field, type, payload, ts, server_ts) VALUES (?,?,?,?,?,?)'
		);
		const serverTs = Date.now();
		db.transaction(() => {
			for (const ev of events) {
				insertEvent.run(
					exam.id,
					ev.field ?? null,
					ev.type,
					JSON.stringify(ev.payload ?? {}),
					ev.ts ?? serverTs,
					serverTs
				);
			}
		})();

		const student = db
			.prepare('SELECT name, group_id FROM students WHERE id = ?')
			.get(exam.student_id) as { name: string; group_id: number };
		for (const ev of events) {
			if (ALERT_TYPES.has(ev.type)) {
				broadcast('exam_event', {
					exam_id: exam.id,
					student_name: student.name,
					type: ev.type,
					field: ev.field ?? null,
					ts: ev.ts ?? Date.now(),
					group_id: student.group_id
				});
			}
		}
	}

	if (draft && typeof draft === 'object') {
		const upd = db.prepare('UPDATE exam_questions SET answer=? WHERE exam_id=? AND position=?');
		db.transaction(() => {
			for (const [pos, ans] of Object.entries(draft)) {
				if (ans != null) upd.run(ans as string, exam.id, +pos);
			}
		})();
	}

	return json({ ok: true });
};
