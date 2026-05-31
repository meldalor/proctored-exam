import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { requireTeacher } from '$lib/server/guard';
import { setTeacherGroup } from '$lib/server/auth';

export const POST: RequestHandler = ({ locals, params, cookies }) => {
	requireTeacher(locals);
	const g = db
		.prepare('SELECT id FROM groups WHERE id=? AND teacher_id=?')
		.get(params.id, locals.teacherId) as { id: number } | undefined;
	if (!g) return json({ error: 'Группа не найдена' }, { status: 404 });
	setTeacherGroup(cookies, g.id);
	return json({ ok: true });
};
