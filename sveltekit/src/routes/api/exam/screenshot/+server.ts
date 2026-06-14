import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import path from 'node:path';
import fs from 'node:fs';
import db from '$lib/server/db';
import { getStudentExam } from '$lib/server/studentAuth';
import { getSetting } from '$lib/server/groups';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_PER_EXAM = 3000;
const dataDir = path.join(process.cwd(), 'data');

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	const exam = getStudentExam(cookies.get('student_token'));
	if (!exam) return json({ error: 'Not authenticated' }, { status: 401 });

	// Защита-в-глубину: выключенная для группы запись не должна писать картинки.
	const student = db.prepare('SELECT group_id FROM students WHERE id = ?').get(exam.student_id) as
		| { group_id: number }
		| undefined;
	if (!student || getSetting(student.group_id, 'screen_capture_enabled') !== '1') {
		return json({ error: 'Screen capture disabled' }, { status: 403 });
	}

	const count = (
		db.prepare('SELECT COUNT(*) c FROM screenshots WHERE exam_id = ?').get(exam.id) as { c: number }
	).c;
	if (count >= MAX_PER_EXAM) return json({ error: 'Limit reached' }, { status: 429 });

	const buf = Buffer.from(await request.arrayBuffer());
	if (buf.length === 0 || buf.length > MAX_BYTES) {
		return json({ error: 'Bad size' }, { status: 400 });
	}
	// JPEG начинается с FF D8.
	if (buf[0] !== 0xff || buf[1] !== 0xd8) {
		return json({ error: 'Not a JPEG' }, { status: 400 });
	}

	const ts = +(url.searchParams.get('ts') || '') || Date.now();
	const dir = path.join(dataDir, 'screenshots', String(exam.id));
	fs.mkdirSync(dir, { recursive: true });
	const filePath = path.join(dir, `${ts}.jpg`);
	fs.writeFileSync(filePath, buf);
	db.prepare('INSERT INTO screenshots (exam_id, ts, path) VALUES (?,?,?)').run(
		exam.id,
		ts,
		filePath
	);

	return json({ ok: true });
};
