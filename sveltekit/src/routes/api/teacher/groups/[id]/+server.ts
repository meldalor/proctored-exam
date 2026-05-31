import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { requireTeacher, readJson } from '$lib/server/guard';
import { ensureActiveGroup, deleteGroupData } from '$lib/server/groups';
import { setTeacherGroup } from '$lib/server/auth';

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	requireTeacher(locals);
	const body = await readJson(request);
	const name = String(body.name || '').trim();
	if (!name) return json({ error: 'Укажите название группы' }, { status: 400 });
	const info = db
		.prepare('UPDATE groups SET name=? WHERE id=? AND teacher_id=?')
		.run(name, params.id, locals.teacherId);
	if (info.changes === 0) return json({ error: 'Группа не найдена' }, { status: 404 });
	return json({ ok: true });
};

export const DELETE: RequestHandler = ({ locals, params, cookies }) => {
	const groupId = requireTeacher(locals);
	const gid = Number(params.id);
	const owned = db
		.prepare('SELECT id FROM groups WHERE id=? AND teacher_id=?')
		.get(gid, locals.teacherId) as { id: number } | undefined;
	if (!owned) return json({ error: 'Группа не найдена' }, { status: 404 });
	db.transaction(() => deleteGroupData(gid))();
	if (groupId === gid) setTeacherGroup(cookies, ensureActiveGroup(locals.teacherId!, null));
	return json({ ok: true });
};
