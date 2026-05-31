import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireTeacher } from '$lib/server/guard';
import { getExamsWithStats } from '$lib/server/exams';

export const GET: RequestHandler = ({ locals }) => {
	const groupId = requireTeacher(locals);
	const rows = getExamsWithStats(groupId);
	return json(
		rows.map((r, i) => ({
			pos: i + 1,
			id: r.id,
			student: r.student_name,
			attempt: r.attempt,
			started_at: r.started_at ? new Date(r.started_at).toISOString() : null,
			submitted_at: r.submitted_at ? new Date(r.submitted_at).toISOString() : null,
			grade: r.grade || null,
			comment: r.teacher_comment || null,
			copy_count: r.copy_count,
			paste_count: r.paste_count,
			tab_hidden_count: r.tab_hidden_count,
			window_blur_count: r.window_blur_count
		})),
		{ headers: { 'Content-Disposition': 'attachment; filename="exams.json"' } }
	);
};
