import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import bcrypt from 'bcryptjs';
import db from '$lib/server/db';
import { requireTeacher, readJson } from '$lib/server/guard';
import { randomPin } from '$lib/server/pin';

const IMPORT_LIMIT = 1000;

export const POST: RequestHandler = async ({ locals, request }) => {
	const groupId = requireTeacher(locals);
	const body = await readJson(request);
	const names = String(body.text || '')
		.split('\n')
		.map((s) => s.trim())
		.filter(Boolean);
	if (names.length === 0) return json({ error: 'Пустой список' }, { status: 400 });
	if (names.length > IMPORT_LIMIT)
		return json({ error: `Слишком большой список (макс. ${IMPORT_LIMIT})` }, { status: 400 });

	const results: Array<{ name: string; pin: string; hash: string }> = [];
	for (const name of names) {
		const pin = randomPin();
		const hash = await bcrypt.hash(pin, 10);
		results.push({ name, pin, hash });
	}

	const ins = db.prepare('INSERT INTO students (name, pin_hash, group_id) VALUES (?,?,?)');
	const out: Array<{ id: number; name: string; pin: string }> = [];
	db.transaction(() => {
		for (const r of results) {
			const info = ins.run(r.name, r.hash, groupId);
			out.push({ id: Number(info.lastInsertRowid), name: r.name, pin: r.pin });
		}
	})();

	return json(out);
};
