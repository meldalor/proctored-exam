import type { RequestHandler } from './$types';
import { requireTeacher } from '$lib/server/guard';
import { getExamsWithStats, csvSafe } from '$lib/server/exams';

export const GET: RequestHandler = ({ locals }) => {
	const groupId = requireTeacher(locals);
	const rows = getExamsWithStats(groupId);
	const header =
		'№\tID\tСтудент\tПопытка\tНачало\tКонец\tОценка\tКомментарий\tКопий\tВставок\tСменВкладки\tBlur\n';
	const tsv = rows
		.map((r, i) =>
			[
				i + 1,
				r.id,
				csvSafe(r.student_name).replace(/\t/g, ' '),
				r.attempt,
				r.started_at ? new Date(r.started_at).toLocaleString('ru-RU') : '',
				r.submitted_at ? new Date(r.submitted_at).toLocaleString('ru-RU') : '',
				csvSafe(r.grade).replace(/\t/g, ' '),
				csvSafe(r.teacher_comment).replace(/\t/g, ' '),
				r.copy_count,
				r.paste_count,
				r.tab_hidden_count,
				r.window_blur_count
			].join('\t')
		)
		.join('\n');
	return new Response('﻿' + header + tsv, {
		headers: {
			'Content-Type': 'text/tab-separated-values; charset=utf-8',
			'Content-Disposition': 'attachment; filename="exams.tsv"'
		}
	});
};
