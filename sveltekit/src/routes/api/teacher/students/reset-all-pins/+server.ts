import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import bcrypt from 'bcryptjs';
import db from '$lib/server/db';
import { requireTeacher } from '$lib/server/guard';
import { randomPin } from '$lib/server/pin';

export const POST: RequestHandler = async ({ locals }) => {
	const groupId = requireTeacher(locals);
	const students = db
		.prepare('SELECT id, name FROM students WHERE group_id=? ORDER BY name')
		.all(groupId) as Array<{ id: number; name: string }>;
	if (students.length === 0) return json([]);

	const results: Array<{ id: number; name: string; pin: string; hash: string }> = [];
	for (const s of students) {
		const pin = randomPin();
		const hash = await bcrypt.hash(pin, 10);
		results.push({ id: s.id, name: s.name, pin, hash });
	}

	const update = db.prepare('UPDATE students SET pin_hash = ? WHERE id = ?');
	db.transaction(() => {
		for (const r of results) update.run(r.hash, r.id);
	})();

	return json(results.map((r) => ({ id: r.id, name: r.name, pin: r.pin })));
};
