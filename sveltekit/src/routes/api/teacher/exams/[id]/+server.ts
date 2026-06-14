import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { requireTeacher } from '$lib/server/guard';

interface EventRow {
	id: number;
	exam_id: number;
	field: string | null;
	type: string;
	payload: unknown;
	ts: number;
	server_ts: number;
}

export const GET: RequestHandler = ({ locals, params }) => {
	const groupId = requireTeacher(locals);
	const exam = db
		.prepare(
			`SELECT e.*, s.name AS student_name, s.retake_allowed
       FROM exams e JOIN students s ON s.id = e.student_id
       WHERE e.id = ? AND s.group_id = ?`
		)
		.get(params.id, groupId) as Record<string, unknown> | undefined;
	if (!exam) return json({ error: 'Not found' }, { status: 404 });

	const questions = db
		.prepare(
			`SELECT eq.position, eq.answer, q.id, q.type, q.body
       FROM exam_questions eq JOIN questions q ON q.id = eq.question_id
       WHERE eq.exam_id = ? ORDER BY eq.position`
		)
		.all(exam.id);

	const events = db
		.prepare('SELECT * FROM events WHERE exam_id=? ORDER BY ts ASC')
		.all(exam.id) as EventRow[];
	for (const ev of events) {
		try {
			ev.payload = JSON.parse(ev.payload as string);
		} catch {
			ev.payload = {};
		}
	}

	const screenshots = db
		.prepare('SELECT id, ts FROM screenshots WHERE exam_id=? ORDER BY ts ASC')
		.all(exam.id);

	return json({ ...exam, questions, events, screenshots });
};
