import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.teacher) throw redirect(302, '/teacher/login');
	const onAdmin = url.pathname.startsWith('/teacher/admin');
	if (locals.role === 'admin' && !onAdmin) throw redirect(302, '/teacher/admin');
	if (locals.role !== 'admin' && onAdmin) throw redirect(302, '/teacher');
	return { groupId: locals.groupId, role: locals.role };
};
