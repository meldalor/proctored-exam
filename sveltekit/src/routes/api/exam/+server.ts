import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { getStudentExam } from '$lib/server/studentAuth';
import { getSetting } from '$lib/server/groups';

export const GET: RequestHandler = ({ cookies }) => {
	const exam = getStudentExam(cookies.get('student_token'));
	if (!exam) return json({ error: 'Not authenticated' }, { status: 401 });

	const questions = db
		.prepare(
			`SELECT eq.position, eq.answer, q.id, q.type, q.body
       FROM exam_questions eq JOIN questions q ON q.id = eq.question_id
       WHERE eq.exam_id = ? ORDER BY eq.position`
		)
		.all(exam.id);
	const student = db
		.prepare('SELECT name, group_id FROM students WHERE id = ?')
		.get(exam.student_id) as {
		name: string;
		group_id: number;
	};
	const mins = getSetting(student.group_id, 'exam_duration_minutes') || '0';

	return json({
		exam_id: exam.id,
		student_name: student.name,
		started_at: exam.started_at,
		duration_minutes: +mins,
		fullscreen_lock: getSetting(student.group_id, 'fullscreen_lock_enabled') === '1',
		screen_capture: getSetting(student.group_id, 'screen_capture_enabled') === '1',
		questions
	});
};
