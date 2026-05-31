import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import bcrypt from 'bcryptjs';
import db from '$lib/server/db';
import { requireTeacher, readJson } from '$lib/server/guard';
import { randomPin } from '$lib/server/pin';

export const GET: RequestHandler = ({ locals }) => {
	const groupId = requireTeacher(locals);
	return json(
		db
			.prepare('SELECT id, name, created_at FROM students WHERE group_id=? ORDER BY name')
			.all(groupId)
	);
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const groupId = requireTeacher(locals);
	const body = await readJson(request);
	const name = String(body.name || '').trim();
	if (!name) return json({ error: 'Укажите имя' }, { status: 400 });
	const pin = (body.pin && String(body.pin).trim()) || randomPin();
	const pin_hash = await bcrypt.hash(String(pin), 10);
	const r = db
		.prepare('INSERT INTO students (name, pin_hash, group_id) VALUES (?,?,?)')
		.run(name, pin_hash, groupId);
	return json({ id: Number(r.lastInsertRowid), name, pin });
};
