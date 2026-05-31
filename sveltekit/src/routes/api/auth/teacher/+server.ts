import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import bcrypt from 'bcryptjs';
import db from '$lib/server/db';
import { readJson } from '$lib/server/guard';
import { hitLimit, resetLimit } from '$lib/server/rateLimit';
import { setTeacherSession, setTeacherGroup } from '$lib/server/auth';
import { ensureActiveGroup } from '$lib/server/groups';
import type { Teacher } from '$lib/server/types';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const body = await readJson(request);
	const password = body.password;
	const username = String(body.username ?? 'admin').trim() || 'admin';
	if (!password) return json({ error: 'Укажите пароль' }, { status: 400 });

	// username в ключе держит лимит при едином IP за reverse-proxy.
	const limitKey = `teacher:${getClientAddress()}:${username}`;
	if (hitLimit(limitKey, 8, 15 * 60 * 1000)) {
		return json({ error: 'Слишком много попыток входа, попробуйте позже' }, { status: 429 });
	}

	const teacher = db.prepare('SELECT * FROM teachers WHERE username = ?').get(username) as
		| Teacher
		| undefined;
	if (!teacher || !bcrypt.compareSync(String(password), teacher.password_hash)) {
		return json({ error: 'Неверный логин или пароль' }, { status: 401 });
	}

	resetLimit(limitKey);
	setTeacherSession(cookies, teacher.id);
	if (teacher.role === 'teacher') setTeacherGroup(cookies, ensureActiveGroup(teacher.id, null));
	return json({ ok: true, role: teacher.role });
};
