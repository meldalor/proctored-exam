declare global {
	namespace App {
		interface Locals {
			teacher: boolean;
			teacherId: number | null;
			role: 'admin' | 'teacher' | null;
			groupId: number | null;
		}
	}
}

export {};
