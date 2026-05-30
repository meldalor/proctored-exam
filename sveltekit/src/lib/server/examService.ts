import { v4 as uuidv4 } from 'uuid';
import db from './db';
import { getSetting } from './groups';
import { broadcast } from './sse';
import type { Student } from './types';

export interface CreateExamResult {
	exam_id?: number;
	token?: string;
	attempt?: number;
	error?: string;
}

export function createExam(student: Student): CreateExamResult {
	const theoryCount = +getSetting(student.group_id, 'questions_per_exam_theory') || 2;
	const practicalCount = +getSetting(student.group_id, 'questions_per_exam_practical') || 1;

	const theoryQs = db
		.prepare(
			"SELECT id FROM questions WHERE type='theory' AND active=1 AND group_id=? ORDER BY RANDOM() LIMIT ?"
		)
		.all(student.group_id, theoryCount) as Array<{ id: number }>;
	const practicalQs = db
		.prepare(
			"SELECT id FROM questions WHERE type='practical' AND active=1 AND group_id=? ORDER BY RANDOM() LIMIT ?"
		)
		.all(student.group_id, practicalCount) as Array<{ id: number }>;

	if (theoryQs.length < theoryCount || practicalQs.length < practicalCount) {
		return { error: 'Недостаточно вопросов в банке' };
	}

	const token = uuidv4();
	const now = Date.now();
	const attempt =
		(db.prepare('SELECT COUNT(*) c FROM exams WHERE student_id=?').get(student.id) as { c: number })
			.c + 1;

	const examId = db.transaction(() => {
		const r = db
			.prepare(
				'INSERT INTO exams (student_id, session_token, started_at, attempt) VALUES (?,?,?,?)'
			)
			.run(student.id, token, now, attempt);
		const insEQ = db.prepare(
			'INSERT INTO exam_questions (exam_id, position, question_id) VALUES (?,?,?)'
		);
		let pos = 1;
		for (const q of theoryQs) insEQ.run(r.lastInsertRowid, pos++, q.id);
		for (const q of practicalQs) insEQ.run(r.lastInsertRowid, pos++, q.id);
		db.prepare('UPDATE students SET retake_allowed=0 WHERE id=?').run(student.id);
		return Number(r.lastInsertRowid);
	})();

	broadcast('exam_started', {
		exam_id: examId,
		student_name: student.name,
		started_at: now,
		group_id: student.group_id
	});

	return { exam_id: examId, token, attempt };
}
