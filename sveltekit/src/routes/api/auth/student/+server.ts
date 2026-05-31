import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import bcrypt from 'bcryptjs';
import db from '$lib/server/db';
import { getSetting } from '$lib/server/groups';
import { createExam } from '$lib/server/examService';
import { hitLimit, resetLimit } from '$lib/server/rateLimit';
import { readJson } from '$lib/server/guard';
import { setStudentToken, setPendingStudent } from '$lib/server/auth';
import type { Student } from '$lib/server/types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await readJson(request);
	const studentId = Number(body.student_id);
	const pin = body.pin;
	if (!studentId || !pin) return json({ error: 'Укажите студента и PIN' }, { status: 400 });

	if (hitLimit(`pin:${studentId}`)) {
		return json(
			{ error: 'Слишком много попыток для этого студента, попробуйте через 10 минут' },
			{ status: 429 }
		);
	}

	const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId) as
		| Student
		| undefined;
	if (!student) return json({ error: 'Студент не найден' }, { status: 401 });

	const valid = await bcrypt.compare(String(pin), student.pin_hash);
	if (!valid) return json({ error: 'Неверный PIN' }, { status: 401 });

	resetLimit(`pin:${studentId}`);

	const existing = db
		.prepare('SELECT * FROM exams WHERE student_id = ? AND submitted_at IS NULL')
		.get(studentId) as { id: number; session_token: string } | undefined;
	if (existing) {
		setStudentToken(cookies, existing.session_token);
		return json({ exam_id: existing.id });
	}

	const submitted = db
		.prepare(
			'SELECT id, session_token FROM exams WHERE student_id = ? AND submitted_at IS NOT NULL ORDER BY attempt DESC LIMIT 1'
		)
		.get(studentId) as { id: number; session_token: string } | undefined;
	if (submitted && !student.retake_allowed) {
		setStudentToken(cookies, submitted.session_token);
		return json({ exam_id: submitted.id, review: true });
	}

	if (getSetting(student.group_id, 'exam_open') !== '1') {
		setPendingStudent(cookies, studentId);
		return json({ waiting: true });
	}

	const r = createExam(student);
	if (r.error) return json({ error: r.error }, { status: 500 });
	setStudentToken(cookies, r.token!);
	return json({ exam_id: r.exam_id });
};
