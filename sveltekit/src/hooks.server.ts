import type { Handle, HandleServerError } from '@sveltejs/kit';
import db from '$lib/server/db';
import { getTeacherId, getTeacherGroup, setTeacherGroup } from '$lib/server/auth';
import { ensureActiveGroup } from '$lib/server/groups';
import { closeAllClients } from '$lib/server/sse';
import type { TeacherRole } from '$lib/server/types';

let shuttingDown = false;
function shutdown(): void {
	if (shuttingDown) return;
	shuttingDown = true;
	try {
		closeAllClients();
	} catch {
		// нет открытых стримов
	}
	try {
		db.close();
	} catch {
		// БД уже закрыта
	}
}
// adapter-node драйнит in-flight и эмитит 'sveltekit:shutdown'; SIGTERM/SIGINT — страховка на иных раннерах.
process.once('sveltekit:shutdown', shutdown);
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

export const handleError: HandleServerError = ({ error, status, message }) => {
	if (status !== 404) console.error('[error]', error);
	return { message };
};

export const handle: Handle = async ({ event, resolve }) => {
	// Chrome пробит этот путь при открытии DevTools — гасим 404-шум.
	if (event.url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
		return new Response(null, { status: 204 });
	}

	const teacherId = getTeacherId(event.cookies);
	const teacher = teacherId
		? (db.prepare('SELECT id, role FROM teachers WHERE id = ?').get(teacherId) as
				| { id: number; role: TeacherRole }
				| undefined)
		: undefined;

	if (teacher) {
		event.locals.teacher = true;
		event.locals.teacherId = teacher.id;
		event.locals.role = teacher.role;
		if (teacher.role === 'teacher') {
			const preferred = getTeacherGroup(event.cookies);
			const gid = ensureActiveGroup(teacher.id, preferred);
			event.locals.groupId = gid;
			if (gid !== preferred) setTeacherGroup(event.cookies, gid);
		} else {
			event.locals.groupId = null;
		}
	} else {
		event.locals.teacher = false;
		event.locals.teacherId = null;
		event.locals.role = null;
		event.locals.groupId = null;
	}

	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'same-origin');
	return response;
};
