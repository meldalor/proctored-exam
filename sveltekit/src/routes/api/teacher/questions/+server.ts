import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { requireTeacher, readJson } from '$lib/server/guard';

export const GET: RequestHandler = ({ locals }) => {
	const groupId = requireTeacher(locals);
	return json(
		db
			.prepare("SELECT * FROM questions WHERE group_id=? ORDER BY (type='practical'), id")
			.all(groupId)
	);
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const groupId = requireTeacher(locals);
	const body = await readJson(request);
	const type = body.type as string;
	const text = body.body as string;
	if (!type || !text) return json({ error: 'Укажите тип и текст' }, { status: 400 });
	if (!['theory', 'practical'].includes(type))
		return json({ error: 'Неверный тип вопроса' }, { status: 400 });
	const r = db
		.prepare('INSERT INTO questions (type, body, group_id) VALUES (?,?,?)')
		.run(type, text, groupId);
	return json({ id: Number(r.lastInsertRowid), type, body: text, active: 1 });
};
