import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';

// Не requireTeacher: у админа нет активной группы, но эндпоинт должен быть ему доступен.
export const GET: RequestHandler = ({ locals }) => {
	if (!locals.teacher || locals.teacherId == null) throw error(401, 'Unauthorized');
	const me = db
		.prepare('SELECT id, username, role FROM teachers WHERE id = ?')
		.get(locals.teacherId) as { id: number; username: string; role: string } | undefined;
	if (!me) return json({ error: 'Not found' }, { status: 404 });
	return json(me);
};
