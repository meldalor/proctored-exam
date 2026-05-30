export interface Student {
	id: number;
	name: string;
	pin_hash: string;
	created_at: number;
	group_id: number;
	retake_allowed: number;
}

export interface Exam {
	id: number;
	student_id: number;
	session_token: string;
	started_at: number;
	submitted_at: number | null;
	grade: string | null;
	teacher_comment: string | null;
	attempt: number;
}

export interface Group {
	id: number;
	name: string;
	created_at: number;
}

export type TeacherRole = 'admin' | 'teacher';

export interface Teacher {
	id: number;
	username: string;
	password_hash: string;
	role: TeacherRole;
	created_at: number;
}
