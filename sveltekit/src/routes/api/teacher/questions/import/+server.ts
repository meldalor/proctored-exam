import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/server/db';
import { requireTeacher, readJson } from '$lib/server/guard';

const IMPORT_LIMIT = 1000;

export const POST: RequestHandler = async ({ locals, request }) => {
	const groupId = requireTeacher(locals);
	const body = await readJson(request);
	const theory = String(body.theory || '')
		.split('\n')
		.map((s) => s.trim())
		.filter(Boolean);
	const practical = String(body.practical || '')
		.split('\n')
		.map((s) => s.trim())
		.filter(Boolean);
	if (theory.length === 0 && practical.length === 0)
		return json({ error: 'Пустой список' }, { status: 400 });
	if (theory.length + practical.length > IMPORT_LIMIT)
		return json({ error: `Слишком большой список (макс. ${IMPORT_LIMIT})` }, { status: 400 });

	const ins = db.prepare('INSERT INTO questions (type, body, group_id) VALUES (?,?,?)');
	db.transaction(() => {
		for (const b of theory) ins.run('theory', b, groupId);
		for (const b of practical) ins.run('practical', b, groupId);
	})();
	return json({
		added: theory.length + practical.length,
		theory: theory.length,
		practical: practical.length
	});
};
