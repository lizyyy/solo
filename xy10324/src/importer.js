const path = require('path');
const XLSX = require('xlsx');
const { normalizeDate, normalizeDateTime, parseAmount, generateId } = require('./utils');

function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    return require(filePath);
  } else if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  } else if (ext === '.csv') {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }
  throw new Error(`不支持的文件格式: ${ext}`);
}

function importStudents(rows, existing = []) {
  const map = new Map(existing.map(s => [s.id, s]));
  const results = { added: 0, updated: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const studentId = String(row['学生ID'] || row['studentId'] || row['id'] || '').trim();
    const name = String(row['姓名'] || row['name'] || '').trim();
    const totalLessons = parseAmount(row['总课时'] || row['totalLessons']);
    const usedLessons = parseAmount(row['已用课时'] || row['usedLessons']);
    const className = String(row['当前班级'] || row['className'] || '').trim();
    const effectiveDate = normalizeDate(row['生效日期'] || row['effectiveDate']);

    if (!studentId || !name) {
      results.errors.push(`第${i + 2}行: 缺少学生ID或姓名`);
      continue;
    }

    const id = `STU_${studentId}`;
    const record = {
      id,
      studentId,
      name,
      totalLessons,
      usedLessons: map.has(id) ? map.get(id).usedLessons : usedLessons,
      className,
      effectiveDate: effectiveDate || '2000-01-01',
      importedAt: new Date().toISOString()
    };

    if (map.has(id)) {
      record.usedLessons = map.get(id).usedLessons;
      map.set(id, { ...map.get(id), ...record });
      results.updated++;
    } else {
      map.set(id, record);
      results.added++;
    }
  }

  return { data: Array.from(map.values()), results };
}

function importSchedules(rows, existing = []) {
  const map = new Map(existing.map(s => [s.id, s]));
  const results = { added: 0, updated: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const classId = String(row['班级ID'] || row['classId'] || '').trim();
    const className = String(row['班级名称'] || row['className'] || '').trim();
    const lessonDate = normalizeDate(row['上课日期'] || row['lessonDate']);
    const startTime = String(row['开始时间'] || row['startTime'] || '').trim();
    const lessonHours = parseAmount(row['课时数'] || row['lessonHours']);

    if (!classId || !className || !lessonDate) {
      results.errors.push(`第${i + 2}行: 缺少班级ID、班级名称或上课日期`);
      continue;
    }

    const id = generateId(classId, lessonDate, startTime);
    const record = {
      id,
      classId,
      className,
      lessonDate,
      startTime,
      lessonHours: lessonHours || 1,
      importedAt: new Date().toISOString()
    };

    if (map.has(id)) {
      map.set(id, { ...map.get(id), ...record });
      results.updated++;
    } else {
      map.set(id, record);
      results.added++;
    }
  }

  return { data: Array.from(map.values()), results };
}

function importAttendances(rows, existing = []) {
  const map = new Map(existing.map(a => [a.id, a]));
  const results = { added: 0, updated: 0, duplicates: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const studentId = String(row['学生ID'] || row['studentId'] || '').trim();
    const classId = String(row['班级ID'] || row['classId'] || '').trim();
    const lessonDate = normalizeDate(row['上课日期'] || row['lessonDate']);
    const startTime = String(row['开始时间'] || row['startTime'] || '').trim();
    const status = String(row['签到状态'] || row['status'] || '').trim();
    const isMakeup = String(row['是否补课'] || row['isMakeup'] || '').trim().toLowerCase() === 'true' ||
                    String(row['是否补课'] || row['isMakeup'] || '').trim() === '1';
    const originalLeaveDate = normalizeDate(row['原请假日期'] || row['originalLeaveDate']);

    if (!studentId || !classId || !lessonDate) {
      results.errors.push(`第${i + 2}行: 缺少学生ID、班级ID或上课日期`);
      continue;
    }

    const id = generateId(studentId, classId, lessonDate, startTime);
    if (map.has(id)) {
      results.duplicates++;
      continue;
    }

    const record = {
      id,
      studentId: `STU_${studentId}`,
      classId,
      lessonDate,
      startTime,
      status: status || '正常',
      isMakeup,
      originalLeaveDate,
      importedAt: new Date().toISOString()
    };

    map.set(id, record);
    results.added++;
  }

  return { data: Array.from(map.values()), results };
}

function importLeaves(rows, existing = []) {
  const map = new Map(existing.map(l => [l.id, l]));
  const results = { added: 0, updated: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const studentId = String(row['学生ID'] || row['studentId'] || '').trim();
    const classId = String(row['班级ID'] || row['classId'] || '').trim();
    const lessonDate = normalizeDate(row['请假日期'] || row['lessonDate']);
    const startTime = String(row['开始时间'] || row['startTime'] || '').trim();
    const reason = String(row['请假原因'] || row['reason'] || '').trim();
    const madeUp = String(row['已补课'] || row['madeUp'] || '').trim().toLowerCase() === 'true' ||
                  String(row['已补课'] || row['madeUp'] || '').trim() === '1';

    if (!studentId || !classId || !lessonDate) {
      results.errors.push(`第${i + 2}行: 缺少学生ID、班级ID或请假日期`);
      continue;
    }

    const id = generateId(studentId, classId, lessonDate, startTime);
    const record = {
      id,
      studentId: `STU_${studentId}`,
      classId,
      lessonDate,
      startTime,
      reason,
      madeUp,
      importedAt: new Date().toISOString()
    };

    if (map.has(id)) {
      map.set(id, { ...map.get(id), ...record });
      results.updated++;
    } else {
      map.set(id, record);
      results.added++;
    }
  }

  return { data: Array.from(map.values()), results };
}

function importMakeups(rows, existing = []) {
  const map = new Map(existing.map(m => [m.id, m]));
  const results = { added: 0, updated: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const studentId = String(row['学生ID'] || row['studentId'] || '').trim();
    const originalClassId = String(row['原班级ID'] || row['originalClassId'] || '').trim();
    const originalDate = normalizeDate(row['原上课日期'] || row['originalDate']);
    const makeupClassId = String(row['补课班级ID'] || row['makeupClassId'] || '').trim();
    const makeupDate = normalizeDate(row['补课日期'] || row['makeupDate']);
    const makeupStartTime = String(row['补课开始时间'] || row['makeupStartTime'] || '').trim();

    if (!studentId || !originalClassId || !originalDate || !makeupDate) {
      results.errors.push(`第${i + 2}行: 缺少必要字段`);
      continue;
    }

    const id = generateId(studentId, originalClassId, originalDate);
    const record = {
      id,
      studentId: `STU_${studentId}`,
      originalClassId,
      originalDate,
      makeupClassId,
      makeupDate,
      makeupStartTime,
      importedAt: new Date().toISOString()
    };

    if (map.has(id)) {
      map.set(id, { ...map.get(id), ...record });
      results.updated++;
    } else {
      map.set(id, record);
      results.added++;
    }
  }

  return { data: Array.from(map.values()), results };
}

function importTransfers(rows, existing = []) {
  const map = new Map(existing.map(t => [t.id, t]));
  const results = { added: 0, updated: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const studentId = String(row['学生ID'] || row['studentId'] || '').trim();
    const fromClassId = String(row['转出班级ID'] || row['fromClassId'] || '').trim();
    const toClassId = String(row['转入班级ID'] || row['toClassId'] || '').trim();
    const transferDate = normalizeDate(row['转班日期'] || row['transferDate']);
    const reason = String(row['转班原因'] || row['reason'] || '').trim();

    if (!studentId || !fromClassId || !toClassId || !transferDate) {
      results.errors.push(`第${i + 2}行: 缺少必要字段`);
      continue;
    }

    const id = generateId(studentId, fromClassId, toClassId, transferDate);
    const record = {
      id,
      studentId: `STU_${studentId}`,
      fromClassId,
      toClassId,
      transferDate,
      reason,
      importedAt: new Date().toISOString()
    };

    if (map.has(id)) {
      results.duplicates = (results.duplicates || 0) + 1;
      continue;
    }

    map.set(id, record);
    results.added++;
  }

  return { data: Array.from(map.values()), results };
}

module.exports = {
  parseFile,
  importStudents,
  importSchedules,
  importAttendances,
  importLeaves,
  importMakeups,
  importTransfers
};
