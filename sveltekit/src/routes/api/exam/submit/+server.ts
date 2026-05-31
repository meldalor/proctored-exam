import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { getStudentExam } from '$lib/server/studentAuth';
import { readJson } from '$lib/server/guard';
import { broadcast } from '$lib/server/sse';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const exam = getStudentExam(cookies.get('student_token'));
	if (!exam) return json({ error: 'Not authenticated' }, { status: 401 });

	const body = await readJson(request);
	const answers = body.answers as Record<string, unknown> | undefined;
	const now = Date.now();

	db.transaction(() => {
		db.prepare('UPDATE exams SET submitted_at=? WHERE id=?').run(now, exam.id);
		if (answers && typeof answers === 'object') {
			const upd = db.prepare('UPDATE exam_questions SET answer=? WHERE exam_id=? AND position=?');
			for (const [pos, ans] of Object.entries(answers)) {
				upd.run((ans as string) ?? '', exam.id, +pos);
			}
		}
	})();

	// Токен не очищаем: студент сможет открыть свою сданную работу в read-only.
	const student = db
		.prepare('SELECT name, group_id FROM students WHERE id = ?')
		.get(exam.student_id) as { name: string; group_id: number };
	broadcast('exam_submitted', {
		exam_id: exam.id,
		student_name: student.name,
		submitted_at: now,
		group_id: student.group_id
	});

	return json({ ok: true });
};
