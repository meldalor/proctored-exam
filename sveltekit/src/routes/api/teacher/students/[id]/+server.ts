import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import bcrypt from 'bcryptjs';
import db from '$lib/server/db';
import { requireTeacher, readJson } from '$lib/server/guard';

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const groupId = requireTeacher(locals);
	const s = db
		.prepare('SELECT * FROM students WHERE id=? AND group_id=?')
		.get(params.id, groupId) as { name: string; pin_hash: string } | undefined;
	if (!s) return json({ error: 'Not found' }, { status: 404 });
	const body = await readJson(request);
	const newName = (body.name as string) ?? s.name;
	const newHash = body.pin ? await bcrypt.hash(String(body.pin), 10) : s.pin_hash;
	db.prepare('UPDATE students SET name=?, pin_hash=? WHERE id=?').run(newName, newHash, params.id);
	return json({ ok: true });
};

export const DELETE: RequestHandler = ({ locals, params }) => {
	const groupId = requireTeacher(locals);
	db.prepare('DELETE FROM students WHERE id=? AND group_id=?').run(params.id, groupId);
	return json({ ok: true });
};
