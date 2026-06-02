const http = require('http');

const PORT = +(process.env.TEST_PORT || 3000);
const HOST = process.env.TEST_HOST || 'localhost';
const ADMIN_PWD = process.env.ADMIN_PASSWORD || process.env.TEACHER_PASSWORD || 'admin';

function req(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const json = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: HOST, port: PORT, path, method,
      headers: {
        ...(json ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) } : {}),
        ...(cookie ? { Cookie: cookie } : {})
      }
    };
    const r = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const cookies = res.headers['set-cookie'] || [];
        resolve({ status: res.statusCode, body: data, cookies });
      });
    });
    r.on('error', reject);
    if (json) r.write(json);
    r.end();
  });
}

const jar = (cookies) => cookies.map(c => c.split(';')[0]).join('; ');

function ok(label, cond, detail = '') {
  const mark = cond ? '✓' : '✗';
  console.log(`  ${mark} ${label}${detail ? '  →  ' + detail : ''}`);
  if (!cond) process.exitCode = 1;
}

async function run() {
  console.log('\n══════════════════════════════════════');
  console.log('   Exam App — Integration Test');
  console.log('══════════════════════════════════════\n');

  console.log('1. Вход администратора');
  const aBad = await req('POST', '/api/auth/teacher', { username: 'admin', password: 'wrong' });
  ok('Wrong pwd → 401', aBad.status === 401);
  const aGood = await req('POST', '/api/auth/teacher', { username: 'admin', password: ADMIN_PWD });
  ok('Correct pwd → 200', aGood.status === 200);
  ok('role = admin', JSON.parse(aGood.body).role === 'admin', aGood.body);
  const adminCookie = jar(aGood.cookies);
  const aNoTeacher = await req('GET', '/api/teacher/questions', null, adminCookie);
  ok('admin не видит teacher-API → 401', aNoTeacher.status === 401, `status=${aNoTeacher.status}`);

  console.log('\n2. Создание преподавателя');
  const mk = await req('POST', '/api/teacher/admins',
    { username: 't_test', password: 't_test_pwd', role: 'teacher' }, adminCookie);
  ok('Учётка создана → 200', mk.status === 200, mk.body);

  console.log('\n3. Вход преподавателя');
  const tGood = await req('POST', '/api/auth/teacher', { username: 't_test', password: 't_test_pwd' });
  ok('Login → 200', tGood.status === 200);
  ok('role = teacher', JSON.parse(tGood.body).role === 'teacher');
  const teacherCookie = jar(tGood.cookies);
  const me = await req('GET', '/api/teacher/me', null, teacherCookie);
  ok('/me role = teacher', me.status === 200 && JSON.parse(me.body).role === 'teacher');
  const grp = await req('GET', '/api/teacher/groups', null, teacherCookie);
  const grpData = JSON.parse(grp.body);
  ok('Авто-группа создана', grp.status === 200 && !!grpData.current_id, `current_id=${grpData.current_id}`);

  console.log('\n4. Импорт вопросов');
  const imp = await req('POST', '/api/teacher/questions/import', {
    theory: 'Теоретический вопрос 1\nТеоретический вопрос 2\nТеоретический вопрос 3',
    practical: 'Практическое задание 1\nПрактическое задание 2'
  }, teacherCookie);
  ok('Импорт → 200', imp.status === 200);
  ok('Добавлено 5', JSON.parse(imp.body).added === 5, imp.body);
  const q = await req('GET', '/api/teacher/questions', null, teacherCookie);
  const questions = JSON.parse(q.body);
  const theory = questions.filter(x => x.type === 'theory').length;
  const practical = questions.filter(x => x.type === 'practical').length;
  ok('3 теоретических', theory === 3, `найдено: ${theory}`);
  ok('2 практических', practical === 2, `найдено: ${practical}`);

  console.log('\n5. Импорт студента');
  const impS = await req('POST', '/api/teacher/students/import',
    { text: 'Тестов Тест Тестович' }, teacherCookie);
  const imported = JSON.parse(impS.body);
  ok('Импорт → 200', impS.status === 200);
  ok('1 студент с PIN', Array.isArray(imported) && imported.length === 1 && /^\d{6}$/.test(imported[0].pin),
     imported[0] ? `pin=${imported[0].pin}` : '');
  const student = imported[0];

  const g = await req('GET', '/api/groups');
  const groups = JSON.parse(g.body);
  ok('Публичный список групп ≥1', g.status === 200 && groups.length >= 1, `групп: ${groups.length}`);
  const groupId = groups[0].id;
  const s = await req('GET', '/api/students?group_id=' + groupId);
  const studentsPub = JSON.parse(s.body);
  ok('Студент виден публично', studentsPub.some(x => x.id === student.id), `найдено: ${studentsPub.length}`);

  console.log('\n6. Вход студента');
  const saBad = await req('POST', '/api/auth/student', { student_id: student.id, pin: '000000' });
  ok('Wrong PIN → 401', saBad.status === 401);
  const saWait = await req('POST', '/api/auth/student', { student_id: student.id, pin: student.pin });
  ok('Закрыт → waiting', saWait.status === 200 && JSON.parse(saWait.body).waiting === true, saWait.body);

  const openR = await req('POST', '/api/teacher/settings', { exam_open: 1 }, teacherCookie);
  ok('Экзамен открыт', openR.status === 200, openR.body);

  const saGood = await req('POST', '/api/auth/student', { student_id: student.id, pin: student.pin });
  ok('Correct PIN → 200', saGood.status === 200);
  const studentCookie = jar(saGood.cookies);
  ok('student_token set', studentCookie.includes('student_token'));

  console.log('\n7. Получение экзамена');
  const ex = await req('GET', '/api/exam', null, studentCookie);
  ok('200 OK', ex.status === 200);
  const exam = JSON.parse(ex.body);
  ok('exam_id присвоен', !!exam.exam_id, `id=${exam.exam_id}`);
  ok('3 вопроса', Array.isArray(exam.questions) && exam.questions.length === 3, `len=${exam.questions?.length}`);
  ok('Q1 theory', exam.questions[0]?.type === 'theory');
  ok('Q2 theory', exam.questions[1]?.type === 'theory');
  ok('Q3 practical', exam.questions[2]?.type === 'practical');
  ok('Q1 ≠ Q2 (разные)', exam.questions[0]?.id !== exam.questions[1]?.id);
  ok('position 1..3', exam.questions.every((qq, i) => qq.position === i + 1));

  console.log('\n8. Отправка событий');
  const ts = Date.now();
  const ev = await req('POST', '/api/exam/events', {
    events: [
      { field: '1', type: 'keystroke', payload: { key: 'У', length: 9, cursor: 9 }, ts },
      { field: '1', type: 'answer_snapshot', payload: { value: 'Указатель' }, ts: ts + 1 },
      { field: null, type: 'tab_hidden', payload: {}, ts: ts + 2 },
      { field: '1', type: 'copy', payload: { text: 'Указатель' }, ts: ts + 3 },
      { field: '2', type: 'keystroke', payload: { key: 'М', length: 6, cursor: 6 }, ts: ts + 4 },
      { field: '2', type: 'answer_snapshot', payload: { value: 'Массив' }, ts: ts + 5 },
      { field: null, type: 'window_blur', payload: {}, ts: ts + 6 },
    ]
  }, studentCookie);
  ok('200 OK', ev.status === 200);
  ok('ok: true', JSON.parse(ev.body).ok === true);

  console.log('\n9. Сдача работы');
  const sub = await req('POST', '/api/exam/submit', {
    answers: { 1: 'Указатель — адрес в памяти.', 2: 'Массив — набор элементов.', 3: 'int main(){return 0;}' }
  }, studentCookie);
  ok('200 OK', sub.status === 200);
  ok('ok: true', JSON.parse(sub.body).ok === true);

  console.log('\n10. Сессия после сдачи');
  const afterSub = await req('GET', '/api/exam', null, studentCookie);
  ok('401 после сдачи', afterSub.status === 401);

  console.log('\n11. Преподаватель видит результаты');
  const exList = await req('GET', '/api/teacher/exams', null, teacherCookie);
  const exams = JSON.parse(exList.body);
  ok('200 OK', exList.status === 200);
  const kExam = exams.find(e => e.student_name?.includes('Тестов'));
  ok('Экзамен студента', !!kExam, kExam ? `id=${kExam.id}` : '');
  ok('submitted_at есть', !!kExam?.submitted_at);
  ok('tab_hidden = 1', kExam?.tab_hidden_count === 1, `count=${kExam?.tab_hidden_count}`);
  ok('copy = 1', kExam?.copy_count === 1, `count=${kExam?.copy_count}`);

  console.log('\n12. Детали экзамена');
  const det = await req('GET', `/api/teacher/exams/${kExam.id}`, null, teacherCookie);
  ok('200 OK', det.status === 200);
  const detail = JSON.parse(det.body);
  ok('questions[] = 3', Array.isArray(detail.questions) && detail.questions.length === 3, `len=${detail.questions?.length}`);
  const q1 = detail.questions.find(x => x.position === 1);
  ok('q1.answer сохранён', (q1?.answer || '').length > 0);
  ok('events ≥ 7', detail.events?.length >= 7, `событий: ${detail.events?.length}`);
  const ks = detail.events.filter(e => e.type === 'keystroke');
  const snaps = detail.events.filter(e => e.type === 'answer_snapshot');
  ok('keystroke без value', ks[0]?.payload?.value === undefined, `payload: ${JSON.stringify(ks[0]?.payload)}`);
  ok('snapshot.value', snaps[0]?.payload?.value === 'Указатель', `value: ${snaps[0]?.payload?.value}`);

  console.log('\n13. Оценка');
  const gr = await req('POST', `/api/teacher/exams/${kExam.id}/grade`,
    { grade: '5', teacher_comment: 'Отлично' }, teacherCookie);
  ok('Оценка → 200', gr.status === 200);
  const res = await req('GET', '/api/exam/result', null, studentCookie);
  const resD = JSON.parse(res.body);
  ok('Студент видит оценку', res.status === 200 && resD.grade === '5', `grade=${resD.grade}`);

  console.log('\n══════════════════════════════════════');
  if (process.exitCode) {
    console.log('  РЕЗУЛЬТАТ: ЕСТЬ ОШИБКИ (см. ✗ выше)');
  } else {
    console.log('  РЕЗУЛЬТАТ: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ ✓');
  }
  console.log('══════════════════════════════════════\n');
}

run().catch(e => { console.error('Критическая ошибка:', e.message); process.exit(1); });
