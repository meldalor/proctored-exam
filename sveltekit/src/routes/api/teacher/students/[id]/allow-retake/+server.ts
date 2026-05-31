import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { requireTeacher } from '$lib/server/guard';

export const POST: RequestHandler = ({ locals, params }) => {
	const groupId = requireTeacher(locals);
	const info = db
		.prepare('UPDATE students SET retake_allowed=1 WHERE id=? AND group_id=?')
		.run(params.id, groupId);
	if (info.changes === 0) return json({ error: 'Not found' }, { status: 404 });
	return json({ ok: true });
};
