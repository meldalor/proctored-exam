import type { RequestHandler } from './$types';
import { requireTeacher } from '$lib/server/guard';
import { getExamsWithStats, csvSafe } from '$lib/server/exams';

export const GET: RequestHandler = ({ locals }) => {
	const groupId = requireTeacher(locals);
	const rows = getExamsWithStats(groupId);
	const header =
		'№,ID,Студент,Попытка,Начало,Конец,Оценка,Комментарий,Копий,Вставок,СменВкладки,Blur\n';
	const csv = rows
		.map((r, i) =>
			[
				i + 1,
				r.id,
				`"${csvSafe(r.student_name).replace(/"/g, '""')}"`,
				r.attempt,
				r.started_at ? new Date(r.started_at).toLocaleString('ru-RU') : '',
				r.submitted_at ? new Date(r.submitted_at).toLocaleString('ru-RU') : '',
				csvSafe(r.grade),
				`"${csvSafe(r.teacher_comment).replace(/"/g, '""')}"`,
				r.copy_count,
				r.paste_count,
				r.tab_hidden_count,
				r.window_blur_count
			].join(',')
		)
		.join('\n');
	return new Response('﻿' + header + csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': 'attachment; filename="exams.csv"'
		}
	});
};
