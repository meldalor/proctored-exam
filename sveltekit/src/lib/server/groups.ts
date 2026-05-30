import db from './db';

export const DEFAULTS: Readonly<Record<string, string>> = Object.freeze({
	exam_duration_minutes: '0',
	questions_per_exam_theory: '2',
	questions_per_exam_practical: '1',
	exam_open: '0'
});

export function ensureSettings(groupId: number): void {
	const ins = db.prepare(
		'INSERT OR IGNORE INTO group_settings (group_id,key,value) VALUES (?,?,?)'
	);
	for (const [k, v] of Object.entries(DEFAULTS)) ins.run(groupId, k, v);
}

export function getSetting(groupId: number, key: string): string {
	const row = db
		.prepare('SELECT value FROM group_settings WHERE group_id=? AND key=?')
		.get(groupId, key) as { value: string } | undefined;
	return row?.value ?? DEFAULTS[key];
}

// Сырые DELETE-шаги для группы; вызывать внутри транзакции caller'а (FK enforced).
export function deleteGroupData(gid: number): void {
	const examIds = (
		db
			.prepare(
				'SELECT e.id FROM exams e JOIN students s ON s.id = e.student_id WHERE s.group_id = ?'
			)
			.all(gid) as Array<{ id: number }>
	).map((r) => r.id);
	const delEvents = db.prepare('DELETE FROM events WHERE exam_id = ?');
	const delEQ = db.prepare('DELETE FROM exam_questions WHERE exam_id = ?');
	const delExam = db.prepare('DELETE FROM exams WHERE id = ?');
	for (const id of examIds) {
		delEvents.run(id);
		delEQ.run(id);
		delExam.run(id);
	}
	db.prepare('DELETE FROM students       WHERE group_id = ?').run(gid);
	db.prepare('DELETE FROM questions      WHERE group_id = ?').run(gid);
	db.prepare('DELETE FROM group_settings WHERE group_id = ?').run(gid);
	db.prepare('DELETE FROM groups         WHERE id = ?').run(gid);
}

export function ensureActiveGroup(teacherId: number, preferred: number | null): number {
	const rows = db
		.prepare('SELECT id FROM groups WHERE teacher_id = ? ORDER BY id')
		.all(teacherId) as Array<{ id: number }>;
	if (rows.length === 0) {
		const gid = Number(
			db.prepare("INSERT INTO groups (name, teacher_id) VALUES ('Новая группа', ?)").run(teacherId)
				.lastInsertRowid
		);
		ensureSettings(gid);
		return gid;
	}
	if (preferred && rows.some((r) => r.id === preferred)) return preferred;
	return rows[0].id;
}
