import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { getSetting } from '$lib/server/groups';
import { createExam } from '$lib/server/examService';
import { getPendingStudent, setStudentToken, clearPendingStudent } from '$lib/server/auth';
import type { Student } from '$lib/server/types';

export const GET: RequestHandler = ({ cookies }) => {
	const sid = getPendingStudent(cookies);
	if (!sid) return json({ error: 'no pending' }, { status: 401 });
	const student = db.prepare('SELECT * FROM students WHERE id=?').get(sid) as Student | undefined;
	if (!student) return json({ error: 'no student' }, { status: 401 });

	const ex = db
		.prepare('SELECT * FROM exams WHERE student_id=? AND submitted_at IS NULL')
		.get(sid) as { id: number; session_token: string } | undefined;
	if (ex) {
		setStudentToken(cookies, ex.session_token);
		clearPendingStudent(cookies);
		return json({ exam_id: ex.id });
	}
	if (getSetting(student.group_id, 'exam_open') !== '1') return json({ waiting: true });

	const r = createExam(student);
	if (r.error) return json({ error: r.error }, { status: 500 });
	setStudentToken(cookies, r.token!);
	clearPendingStudent(cookies);
	return json({ exam_id: r.exam_id });
};
