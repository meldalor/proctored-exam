import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { requireTeacher } from '$lib/server/guard';
import { resetStudentExams } from '$lib/server/exams';

export const POST: RequestHandler = ({ locals, params }) => {
	const groupId = requireTeacher(locals);
	const s = db
		.prepare('SELECT id FROM students WHERE id=? AND group_id=?')
		.get(params.id, groupId) as { id: number } | undefined;
	if (!s) return json({ error: 'Not found' }, { status: 404 });
	resetStudentExams(s.id);
	return json({ ok: true });
};
