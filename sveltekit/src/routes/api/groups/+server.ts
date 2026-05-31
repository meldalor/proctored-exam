import { json } from '@sveltejs/kit';
import db from '$lib/server/db';

export const GET = () => json(db.prepare('SELECT id, name FROM groups ORDER BY name').all());
