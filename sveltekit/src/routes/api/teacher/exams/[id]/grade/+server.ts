import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { requireTeacher, readJson } from '$lib/server/guard';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const groupId = requireTeacher(locals);
	const exam = db
		.prepare(
			`SELECT e.id FROM exams e JOIN students s ON s.id = e.student_id
       WHERE e.id = ? AND s.group_id = ?`
		)
		.get(params.id, groupId);
	if (!exam) return json({ error: 'Not found' }, { status: 404 });
	const body = await readJson(request);
	db.prepare('UPDATE exams SET grade=?, teacher_comment=? WHERE id=?').run(
		(body.grade as string) ?? null,
		(body.teacher_comment as string) ?? null,
		params.id
	);
	return json({ ok: true });
};
