import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';

export const GET: RequestHandler = ({ url }) => {
	const groupId = Number(url.searchParams.get('group_id'));
	if (!groupId) return json([]);
	return json(
		db.prepare('SELECT id, name FROM students WHERE group_id=? ORDER BY name').all(groupId)
	);
};
