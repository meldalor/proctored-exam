import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';

export const GET: RequestHandler = ({ cookies }) => {
	const token = cookies.get('student_token');
	if (!token) return json({ error: 'Not authenticated' }, { status: 401 });

	const exam = db.prepare('SELECT * FROM exams WHERE session_token = ?').get(token) as
		| {
				id: number;
				student_id: number;
				started_at: number;
				submitted_at: number | null;
				grade: string | null;
				teacher_comment: string | null;
		  }
		| undefined;
	if (!exam) return json({ error: 'Not found' }, { status: 401 });

	const student = db.prepare('SELECT name FROM students WHERE id = ?').get(exam.student_id) as {
		name: string;
	};
	const questions = db
		.prepare(
			`SELECT eq.position, eq.answer, q.type, q.body
       FROM exam_questions eq JOIN questions q ON q.id = eq.question_id
       WHERE eq.exam_id = ? ORDER BY eq.position`
		)
		.all(exam.id);

	return json({
		exam_id: exam.id,
		student_name: student.name,
		started_at: exam.started_at,
		submitted_at: exam.submitted_at,
		grade: exam.grade,
		teacher_comment: exam.teacher_comment,
		questions
	});
};
