import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireTeacher } from '$lib/server/guard';
import { getExamsWithStats } from '$lib/server/exams';

export const GET: RequestHandler = ({ locals }) => {
	const groupId = requireTeacher(locals);
	return json(getExamsWithStats(groupId));
};
