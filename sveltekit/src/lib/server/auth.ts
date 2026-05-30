import crypto from 'node:crypto';
import { building } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';

const DEV_SECRET = 'dev-secret-change-me';
const WEAK_SECRETS = new Set([DEV_SECRET, 'dev-secret-change-me-min-32-characters']);
const rawSecret = process.env.SESSION_SECRET;
// !building: при vite build NODE_ENV тоже production — fail-fast только в рантайме, иначе ломается сборка.
if (!building && process.env.NODE_ENV === 'production') {
	if (!rawSecret || rawSecret.length < 32 || WEAK_SECRETS.has(rawSecret)) {
		throw new Error(
			'SESSION_SECRET должен быть задан в production случайной строкой не короче 32 символов (текущее значение пусто или совпадает с известным дефолтом). Сгенерируйте: openssl rand -base64 32'
		);
	}
} else if (!building && !rawSecret) {
	console.warn('[auth] SESSION_SECRET не задан — используется небезопасный dev-дефолт.');
}
const SECRET = rawSecret || DEV_SECRET;
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

const baseCookie = {
	httpOnly: true,
	sameSite: 'strict' as const,
	secure: COOKIE_SECURE,
	path: '/'
};

export function safeStrEqual(a: string, b: string): boolean {
	const ba = Buffer.from(String(a));
	const bb = Buffer.from(String(b));
	if (ba.length !== bb.length) return false;
	return crypto.timingSafeEqual(ba, bb);
}

function sign(value: string): string {
	const mac = crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
	return `${value}.${mac}`;
}

function unsign(signed: string | undefined): string | null {
	if (!signed) return null;
	const i = signed.lastIndexOf('.');
	if (i < 0) return null;
	const value = signed.slice(0, i);
	const mac = signed.slice(i + 1);
	const expected = crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
	if (mac.length !== expected.length) return null;
	return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected)) ? value : null;
}

export function setTeacherSession(cookies: Cookies, teacherId: number): void {
	cookies.set('teacher_session', sign(String(teacherId)), { ...baseCookie, maxAge: 8 * 3600 });
}

export function clearTeacherSession(cookies: Cookies): void {
	cookies.delete('teacher_session', { path: '/' });
	cookies.delete('teacher_group', { path: '/' });
}

export function getTeacherId(cookies: Cookies): number | null {
	const v = unsign(cookies.get('teacher_session'));
	if (v == null) return null;
	const id = Number(v);
	return Number.isInteger(id) && id > 0 ? id : null;
}

export function getTeacherGroup(cookies: Cookies): number | null {
	const v = unsign(cookies.get('teacher_group'));
	return v ? Number(v) : null;
}

export function setTeacherGroup(cookies: Cookies, groupId: number): void {
	cookies.set('teacher_group', sign(String(groupId)), { ...baseCookie, maxAge: 8 * 3600 });
}

export function setStudentToken(cookies: Cookies, token: string): void {
	cookies.set('student_token', token, baseCookie);
}

export function clearStudentToken(cookies: Cookies): void {
	cookies.delete('student_token', { path: '/' });
}

export function setPendingStudent(cookies: Cookies, studentId: number): void {
	cookies.set('pending_student', sign(String(studentId)), { ...baseCookie, maxAge: 8 * 3600 });
}

export function getPendingStudent(cookies: Cookies): number | null {
	const v = unsign(cookies.get('pending_student'));
	return v ? Number(v) : null;
}

export function clearPendingStudent(cookies: Cookies): void {
	cookies.delete('pending_student', { path: '/' });
}
