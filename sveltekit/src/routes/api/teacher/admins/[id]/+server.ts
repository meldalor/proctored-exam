import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import bcrypt from 'bcryptjs';
import db from '$lib/server/db';
import { requireAdmin, readJson } from '$lib/server/guard';
import { deleteGroupData } from '$lib/server/groups';
import type { Teacher, TeacherRole } from '$lib/server/types';

function adminCount(): number {
	return (db.prepare("SELECT COUNT(*) c FROM teachers WHERE role = 'admin'").get() as { c: number })
		.c;
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	requireAdmin(locals);
	const id = Number(params.id);
	const target = db.prepare('SELECT * FROM teachers WHERE id = ?').get(id) as Teacher | undefined;
	if (!target) return json({ error: 'Учётка не найдена' }, { status: 404 });

	const body = await readJson(request);

	if (body.role !== undefined) {
		const role: TeacherRole = body.role === 'admin' ? 'admin' : 'teacher';
		if (target.role === 'admin' && role !== 'admin' && adminCount() <= 1) {
			return json({ error: 'Нельзя разжаловать последнего администратора' }, { status: 400 });
		}
		db.prepare('UPDATE teachers SET role = ? WHERE id = ?').run(role, id);
	}

	if (body.username !== undefined) {
		const username = String(body.username).trim().toLowerCase();
		if (!username) return json({ error: 'Логин не может быть пустым' }, { status: 400 });
		const clash = db
			.prepare('SELECT id FROM teachers WHERE username = ? AND id <> ?')
			.get(username, id);
		if (clash) return json({ error: 'Логин уже занят' }, { status: 409 });
		db.prepare('UPDATE teachers SET username = ? WHERE id = ?').run(username, id);
	}

	if (body.password) {
		db.prepare('UPDATE teachers SET password_hash = ? WHERE id = ?').run(
			bcrypt.hashSync(String(body.password), 10),
			id
		);
	}

	return json({ ok: true });
};

export const DELETE: RequestHandler = ({ locals, params }) => {
	const meId = requireAdmin(locals);
	const id = Number(params.id);
	if (id === meId) return json({ error: 'Нельзя удалить свою учётку' }, { status: 400 });

	const target = db.prepare('SELECT * FROM teachers WHERE id = ?').get(id) as Teacher | undefined;
	if (!target) return json({ error: 'Учётка не найдена' }, { status: 404 });
	if (target.role === 'admin' && adminCount() <= 1) {
		return json({ error: 'Нельзя удалить последнего администратора' }, { status: 400 });
	}

	// Каскад: у препода висят группы → студенты/вопросы/экзамены (FK enforced).
	const groupIds = (
		db.prepare('SELECT id FROM groups WHERE teacher_id = ?').all(id) as Array<{ id: number }>
	).map((r) => r.id);
	db.transaction(() => {
		for (const gid of groupIds) deleteGroupData(gid);
		db.prepare('DELETE FROM teachers WHERE id = ?').run(id);
	})();
	return json({ ok: true });
};
