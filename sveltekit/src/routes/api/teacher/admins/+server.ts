import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import bcrypt from 'bcryptjs';
import db from '$lib/server/db';
import { requireAdmin, readJson } from '$lib/server/guard';
import type { TeacherRole } from '$lib/server/types';

export const GET: RequestHandler = ({ locals }) => {
	requireAdmin(locals);
	return json(
		db.prepare('SELECT id, username, role, created_at FROM teachers ORDER BY username').all()
	);
};

export const POST: RequestHandler = async ({ locals, request }) => {
	requireAdmin(locals);
	const body = await readJson(request);
	const username = String(body.username ?? '')
		.trim()
		.toLowerCase();
	const password = String(body.password ?? '');
	const role: TeacherRole = body.role === 'admin' ? 'admin' : 'teacher';
	if (!username || !password) return json({ error: 'Укажите логин и пароль' }, { status: 400 });

	const exists = db.prepare('SELECT id FROM teachers WHERE username = ?').get(username);
	if (exists) return json({ error: 'Логин уже занят' }, { status: 409 });

	const r = db
		.prepare('INSERT INTO teachers (username, password_hash, role) VALUES (?,?,?)')
		.run(username, bcrypt.hashSync(password, 10), role);
	return json({ id: Number(r.lastInsertRowid), username, role });
};
