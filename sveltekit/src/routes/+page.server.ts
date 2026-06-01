import type { PageServerLoad } from './$types';
import db from '$lib/server/db';

export const load: PageServerLoad = () => {
	return {
		groups: db.prepare('SELECT id, name FROM groups ORDER BY name').all() as Array<{
			id: number;
			name: string;
		}>
	};
};
