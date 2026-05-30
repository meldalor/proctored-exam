import db from './db';

export interface ActiveExam {
	id: number;
	student_id: number;
	session_token: string;
	started_at: number;
	submitted_at: number | null;
}

export function getStudentExam(token: string | undefined): ActiveExam | null {
	if (!token) return null;
	const exam = db
		.prepare('SELECT * FROM exams WHERE session_token = ? AND submitted_at IS NULL')
		.get(token) as ActiveExam | undefined;
	return exam ?? null;
}
