import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const dataDir = path.join(process.cwd(), 'data');
const src = path.join(dataDir, 'exam.db');
if (!fs.existsSync(src)) {
	console.error(`[backup] База не найдена: ${src}`);
	process.exit(1);
}

const backupsDir = path.join(dataDir, 'backups');
fs.mkdirSync(backupsDir, { recursive: true });

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const dest = path.join(backupsDir, `exam-${ts}.db`);

const db = new Database(src, { readonly: true });
try {
	await db.backup(dest);
	const size = fs.statSync(dest).size;
	console.log(`[backup] Готово: ${dest} (${(size / 1024).toFixed(1)} КБ)`);
} catch (err) {
	console.error('[backup] Ошибка:', err);
	process.exitCode = 1;
} finally {
	db.close();
}
