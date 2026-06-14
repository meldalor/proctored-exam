import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'node:fs';
import db from '$lib/server/db';
import { requireTeacher } from '$lib/server/guard';

export const GET: RequestHandler = ({ locals, params }) => {
	const groupId = requireTeacher(locals);

	// Экзамен должен принадлежать группе преподавателя.
	const owned = db
		.prepare(
			`SELECT 1 FROM exams e JOIN students s ON s.id = e.student_id
       WHERE e.id = ? AND s.group_id = ?`
		)
		.get(params.id, groupId);
	if (!owned) throw error(404, 'Not found');

	const shot = db
		.prepare('SELECT path FROM screenshots WHERE id = ? AND exam_id = ?')
		.get(params.shot, params.id) as { path: string } | undefined;
	if (!shot || !fs.existsSync(shot.path)) throw error(404, 'Not found');

	const buf = fs.readFileSync(shot.path);
	return new Response(new Uint8Array(buf), {
		headers: {
			'Content-Type': 'image/jpeg',
			'Cache-Control': 'private, max-age=3600'
		}
	});
};
