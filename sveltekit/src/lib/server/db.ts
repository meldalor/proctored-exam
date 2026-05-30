import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { building } from '$app/environment';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'exam.db'));
const journal = (process.env.SQLITE_JOURNAL || 'DELETE').toUpperCase();
db.pragma(`journal_mode = ${journal}`);
db.pragma('foreign_keys = ON');
// synchronous=NORMAL безопасен только при WAL и экономит fsync.
if (journal === 'WAL') {
	db.pragma('synchronous = NORMAL');
	db.pragma('wal_autocheckpoint = 1000');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS group_settings (
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    key      TEXT    NOT NULL,
    value    TEXT    NOT NULL DEFAULT '',
    PRIMARY KEY (group_id, key)
  );

  CREATE TABLE IF NOT EXISTS students (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    pin_hash   TEXT    NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS questions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT    NOT NULL CHECK(type IN ('theory','practical')),
    body       TEXT    NOT NULL,
    active     INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS exams (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id    INTEGER NOT NULL REFERENCES students(id),
    session_token TEXT    UNIQUE NOT NULL,
    started_at    INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    submitted_at  INTEGER
  );

  CREATE TABLE IF NOT EXISTS exam_questions (
    exam_id     INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    question_id INTEGER NOT NULL REFERENCES questions(id),
    answer      TEXT,
    PRIMARY KEY (exam_id, position)
  );
  CREATE INDEX IF NOT EXISTS exam_questions_exam ON exam_questions(exam_id);

  CREATE TABLE IF NOT EXISTS events (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id   INTEGER NOT NULL REFERENCES exams(id),
    field     TEXT,
    type      TEXT    NOT NULL,
    payload   TEXT    NOT NULL DEFAULT '{}',
    ts        INTEGER NOT NULL,
    server_ts INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS teachers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'teacher' CHECK(role IN ('admin','teacher')),
    created_at    INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );
  INSERT OR IGNORE INTO settings (key, value) VALUES ('exam_duration_minutes', '0');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('questions_per_exam_theory', '2');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('questions_per_exam_practical', '1');

  CREATE INDEX IF NOT EXISTS events_exam_ts          ON events(exam_id, ts);
  CREATE INDEX IF NOT EXISTS events_type             ON events(type);
  CREATE INDEX IF NOT EXISTS exams_student_submitted ON exams(student_id, submitted_at);
`);

for (const col of [
	'ALTER TABLE exams     ADD COLUMN grade TEXT',
	'ALTER TABLE exams     ADD COLUMN teacher_comment TEXT',
	'ALTER TABLE students  ADD COLUMN group_id INTEGER REFERENCES groups(id)',
	'ALTER TABLE questions ADD COLUMN group_id INTEGER REFERENCES groups(id)',
	'ALTER TABLE exams     ADD COLUMN attempt INTEGER NOT NULL DEFAULT 1',
	'ALTER TABLE students  ADD COLUMN retake_allowed INTEGER NOT NULL DEFAULT 0',
	'ALTER TABLE groups    ADD COLUMN teacher_id INTEGER REFERENCES teachers(id)'
]) {
	try {
		db.exec(col);
	} catch {
		// колонка уже есть
	}
}

db.exec(`
  CREATE INDEX IF NOT EXISTS students_group  ON students(group_id);
  CREATE INDEX IF NOT EXISTS questions_group ON questions(group_id);
  CREATE INDEX IF NOT EXISTS groups_teacher  ON groups(teacher_id);
`);

// Догрупповые данные старой схемы переносятся в одну дефолтную группу.
{
	const orphan =
		(db.prepare('SELECT COUNT(*) c FROM students  WHERE group_id IS NULL').get() as { c: number })
			.c +
		(db.prepare('SELECT COUNT(*) c FROM questions WHERE group_id IS NULL').get() as { c: number })
			.c;
	const hasGroups = (db.prepare('SELECT COUNT(*) c FROM groups').get() as { c: number }).c > 0;
	if (orphan > 0 && !hasGroups) {
		const gid = db
			.prepare("INSERT INTO groups (name) VALUES ('Группа по умолчанию')")
			.run().lastInsertRowid;
		db.prepare('UPDATE students  SET group_id=? WHERE group_id IS NULL').run(gid);
		db.prepare('UPDATE questions SET group_id=? WHERE group_id IS NULL').run(gid);
		const ins = db.prepare(
			'INSERT OR IGNORE INTO group_settings (group_id,key,value) VALUES (?,?,?)'
		);
		for (const s of db.prepare('SELECT key,value FROM settings').all() as Array<{
			key: string;
			value: string;
		}>) {
			ins.run(gid, s.key, s.value);
		}
	}
}

{
	const count = (db.prepare('SELECT COUNT(*) c FROM teachers').get() as { c: number }).c;
	if (count === 0) {
		const pwd = process.env.ADMIN_PASSWORD || process.env.TEACHER_PASSWORD || 'admin';
		// !building: при vite build NODE_ENV тоже production — предупреждаем только в рантайме.
		if (!building && process.env.NODE_ENV === 'production' && (!pwd || pwd === 'admin')) {
			console.warn(
				'[db] ВНИМАНИЕ: пароль администратора не задан (ADMIN_PASSWORD) — используется слабый "admin". Смените его или задайте ADMIN_PASSWORD.'
			);
		}
		db.prepare(
			"INSERT INTO teachers (username, password_hash, role) VALUES ('admin', ?, 'admin')"
		).run(bcrypt.hashSync(pwd, 10));
	}
}

export default db;
