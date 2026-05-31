import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { requireTeacher } from '$lib/server/guard';
import { resetStudentExams } from '$lib/server/exams';

export const POST: RequestHandler = ({ locals }) => {
	const groupId = requireTeacher(locals);
	const students = db.prepare('SELECT id FROM students WHERE group_id=?').all(groupId) as Array<{
		id: number;
	}>;
	for (const s of students) resetStudentExams(s.id);
	return json({ ok: true });
};
