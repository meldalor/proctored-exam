import db from './db';
import path from 'node:path';
import fs from 'node:fs';

const screenshotsRoot = path.join(process.cwd(), 'data', 'screenshots');

// Удаляет строки и файлы скриншотов экзамена. Вызывать до удаления самого экзамена (FK).
export function deleteExamScreenshots(examId: number): void {
	db.prepare('DELETE FROM screenshots WHERE exam_id = ?').run(examId);
	fs.rmSync(path.join(screenshotsRoot, String(examId)), { recursive: true, force: true });
}

export interface ExamRow {
	id: number;
	started_at: number;
	submitted_at: number | null;
	grade: string | null;
	teacher_comment: string | null;
	attempt: number;
	student_id: number;
	student_name: string;
	copy_count: number;
	paste_count: number;
	tab_hidden_count: number;
	window_blur_count: number;
}

const examsWithStatsStmt = db.prepare(`
  SELECT
    e.id, e.started_at, e.submitted_at, e.grade, e.teacher_comment, e.attempt,
    s.id AS student_id, s.name AS student_name,
    COALESCE(SUM(v.type='copy'),        0) AS copy_count,
    COALESCE(SUM(v.type='paste'),       0) AS paste_count,
    COALESCE(SUM(v.type='tab_hidden'),  0) AS tab_hidden_count,
    COALESCE(SUM(v.type='window_blur'), 0) AS window_blur_count
  FROM exams e
  JOIN students s ON s.id = e.student_id
  LEFT JOIN events v ON v.exam_id = e.id
  WHERE s.group_id = ?
  GROUP BY e.id
  ORDER BY s.name ASC, e.attempt ASC
`);

export function getExamsWithStats(groupId: number): ExamRow[] {
	return examsWithStatsStmt.all(groupId) as ExamRow[];
}

export function resetStudentExams(studentId: number): void {
	const examIds = (
		db.prepare('SELECT id FROM exams WHERE student_id=?').all(studentId) as Array<{
			id: number;
		}>
	).map((r) => r.id);
	const delEvents = db.prepare('DELETE FROM events WHERE exam_id=?');
	const delEQ = db.prepare('DELETE FROM exam_questions WHERE exam_id=?');
	const delExam = db.prepare('DELETE FROM exams WHERE id=?');
	db.transaction(() => {
		for (const id of examIds) {
			delEvents.run(id);
			delEQ.run(id);
			deleteExamScreenshots(id);
			delExam.run(id);
		}
		db.prepare('UPDATE students SET retake_allowed=0 WHERE id=?').run(studentId);
	})();
}

// Нейтрализация formula-injection: ведущие = + - @ (tab/CR) экранируются префиксом '.
export function csvSafe(v: unknown): string {
	const s = String(v ?? '');
	return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}
