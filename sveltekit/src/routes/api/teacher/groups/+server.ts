import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { requireTeacher, readJson } from '$lib/server/guard';
import { ensureSettings } from '$lib/server/groups';

export const GET: RequestHandler = ({ locals }) => {
	const groupId = requireTeacher(locals);
	const groups = db
		.prepare(
			`SELECT g.id, g.name,
        (SELECT COUNT(*) FROM students  s WHERE s.group_id = g.id) AS students,
        (SELECT COUNT(*) FROM questions q WHERE q.group_id = g.id) AS questions
       FROM groups g WHERE g.teacher_id = ? ORDER BY g.id`
		)
		.all(locals.teacherId);
	return json({ current_id: groupId, groups });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	requireTeacher(locals);
	const body = await readJson(request);
	const name = String(body.name || '').trim();
	if (!name) return json({ error: 'Укажите название группы' }, { status: 400 });
	const r = db
		.prepare('INSERT INTO groups (name, teacher_id) VALUES (?, ?)')
		.run(name, locals.teacherId);
	ensureSettings(Number(r.lastInsertRowid));
	return json({ id: Number(r.lastInsertRowid), name });
};
