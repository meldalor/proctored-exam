import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { requireTeacher, readJson } from '$lib/server/guard';

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const groupId = requireTeacher(locals);
	const q = db
		.prepare('SELECT * FROM questions WHERE id=? AND group_id=?')
		.get(params.id, groupId) as { body: string; active: number } | undefined;
	if (!q) return json({ error: 'Not found' }, { status: 404 });
	const body = await readJson(request);
	db.prepare('UPDATE questions SET body=?, active=? WHERE id=?').run(
		(body.body as string) ?? q.body,
		body.active !== undefined ? (body.active as number) : q.active,
		params.id
	);
	return json({ ok: true });
};

export const DELETE: RequestHandler = ({ locals, params }) => {
	const groupId = requireTeacher(locals);
	db.prepare('DELETE FROM questions WHERE id=? AND group_id=?').run(params.id, groupId);
	return json({ ok: true });
};
