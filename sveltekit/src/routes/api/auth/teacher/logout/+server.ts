import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearTeacherSession } from '$lib/server/auth';

export const POST: RequestHandler = ({ cookies }) => {
	clearTeacherSession(cookies);
	return json({ ok: true });
};
