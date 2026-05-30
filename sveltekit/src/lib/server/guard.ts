import { error } from '@sveltejs/kit';

export function requireTeacher(locals: App.Locals): number {
	if (!locals.teacher || locals.groupId == null) throw error(401, 'Unauthorized');
	return locals.groupId;
}

export function requireAdmin(locals: App.Locals): number {
	if (!locals.teacher || locals.teacherId == null) throw error(401, 'Unauthorized');
	if (locals.role !== 'admin') throw error(403, 'Forbidden');
	return locals.teacherId;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
	try {
		const v = await request.json();
		return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}
