const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });

const humanErrors = {
  SONG_CODE_EXISTS: '曲目编号已存在，请检查后重试',
  SONG_NOT_FOUND: '找不到该曲目，请确认曲目别名表已导入',
  PHOTO_NOT_FOUND: '找不到对应的签到照片',
  PRACTICE_NOT_FOUND: '找不到该练习记录',
  SUBSTITUTE_NEED_VERIFY: '临时替补信息需要票务同事复核，暂不标记为正常',
  IMPORT_EMPTY: '导入的表格是空的，请检查文件内容',
  INVALID_DATE: '日期格式不正确，请使用 YYYY-MM-DD 格式',
  MISSING_REQUIRED: '缺少必填信息：{field}',
  SETTLEMENT_EXISTS: '该记录已生成过分账明细，请勿重复操作'
};

function sendError(res, errorCode, details = '') {
  const message = humanErrors[errorCode] || errorCode;
  const finalMessage = details ? message.replace('{field}', details) : message;
  res.status(400).json({ error: true, message: finalMessage, code: errorCode });
}

function logOperation(operationType, tableName, recordId, oldData, newData, canRollback = false) {
  db.insertOperationLog(
    operationType, tableName, recordId,
    oldData ? JSON.stringify(oldData) : null,
    newData ? JSON.stringify(newData) : null,
    canRollback ? 1 : 0
  );
}

app.post('/api/song-aliases/import', (req, res) => {
  const { songs, operator = '许老师' } = req.body;

  if (!songs || songs.length === 0) {
    return sendError(res, 'IMPORT_EMPTY');
  }

  const results = { imported: 0, updated: 0, skipped: 0, details: [] };

  try {
    for (const song of songs) {
      const { song_code, song_name, alias, part_type, remark } = song;

      if (!song_code || !song_name || !part_type) {
        results.skipped++;
        results.details.push({ song, reason: '缺少必填字段' });
        continue;
      }

      const existing = db.findSongByCode(song_code);

      if (existing) {
        const fieldsChanged = [];
        if (existing.song_name !== song_name) fieldsChanged.push('song_name');
        if ((existing.alias || '') !== (alias || '')) fieldsChanged.push('alias');
        if (existing.part_type !== part_type) fieldsChanged.push('part_type');
        if ((existing.remark || '') !== (remark || '')) fieldsChanged.push('remark');

        if (fieldsChanged.length > 0) {
          const newVersion = existing.version + 1;

          db.insertSongHistory(
            existing.id, existing.song_code, existing.song_name, existing.alias,
            existing.part_type, existing.remark, existing.version, '修改', operator
          );

          db.updateSong(existing.id, song_name, alias, part_type, remark, newVersion);

          results.updated++;
          results.details.push({ song_code, action: 'updated', changedFields: fieldsChanged });
        } else {
          results.skipped++;
          results.details.push({ song_code, action: 'skipped', reason: '内容无变化' });
        }
      } else {
        const id = db.insertSong(song_code, song_name, alias, part_type, remark);

        db.insertSongHistory(id, song_code, song_name, alias, part_type, remark, 1, '新增', operator);

        results.imported++;
        results.details.push({ song_code, action: 'imported' });
      }
    }

    logOperation('批量导入曲目别名', 'song_aliases', null, null, { count: songs.length }, false);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ error: true, message: '导入失败：' + error.message });
  }
});

app.get('/api/song-aliases', (req, res) => {
  const { keyword, part_type } = req.query;
  const rows = db.listSongs({ keyword, part_type });
  res.json({ success: true, data: rows });
});

app.get('/api/song-aliases/:id/history', (req, res) => {
  const rows = db.listSongHistory(Number(req.params.id));
  res.json({ success: true, data: rows });
});

app.post('/api/attendance-photos', upload.single('photo'), (req, res) => {
  const { class_date, remark } = req.body;

  if (!class_date) {
    return sendError(res, 'MISSING_REQUIRED', '上课日期');
  }
  if (!req.file) {
    return sendError(res, 'MISSING_REQUIRED', '签到照片');
  }

  const id = db.insertAttendancePhoto(
    class_date, '/uploads/' + req.file.filename, req.file.originalname, remark
  );

  logOperation('上传签到照片', 'attendance_photos', id, null, { class_date, photo_name: req.file.originalname }, false);

  res.json({
    success: true,
    data: {
      id,
      class_date,
      photo_path: '/uploads/' + req.file.filename,
      photo_name: req.file.originalname
    }
  });
});

app.get('/api/attendance-photos', (req, res) => {
  const { class_date } = req.query;
  const rows = db.listAttendancePhotos({ class_date });
  res.json({ success: true, data: rows });
});

app.post('/api/practice-records', (req, res) => {
  const {
    practice_date,
    song_code,
    student_name,
    attendance_status = '正常',
    has_substitute = 0,
    substitute_info,
    substitute_source,
    attendance_photo_id,
    remark
  } = req.body;

  if (!practice_date) return sendError(res, 'MISSING_REQUIRED', '练习日期');
  if (!song_code) return sendError(res, 'MISSING_REQUIRED', '曲目编号');
  if (!student_name) return sendError(res, 'MISSING_REQUIRED', '学生姓名');

  const song = db.findSongByCode(song_code);
  if (!song) {
    return sendError(res, 'SONG_NOT_FOUND');
  }

  let is_verified = 1;
  if (has_substitute && substitute_source === '群消息') {
    is_verified = 0;
  }

  const id = db.insertPracticeRecord({
    practice_date,
    song_alias_id: song.id,
    song_code,
    song_name: song.song_name,
    part_type: song.part_type,
    student_name,
    attendance_status,
    has_substitute,
    substitute_info,
    substitute_source,
    is_verified,
    attendance_photo_id,
    remark
  });

  logOperation('新增练习记录', 'practice_records', id, null, req.body, true);

  const record = db.findPracticeRecord(id);

  res.json({
    success: true,
    data: record,
    warning: has_substitute && substitute_source === '群消息' ? '临时替补（群消息）已标记为待复核，请票务同事确认' : null
  });
});

app.get('/api/practice-records', (req, res) => {
  const { practice_date, is_verified, has_substitute, part_type } = req.query;
  const rows = db.listPracticeRecords({ practice_date, is_verified, has_substitute, part_type });
  res.json({ success: true, data: rows });
});

app.get('/api/practice-records/:id', (req, res) => {
  const row = db.findPracticeRecord(Number(req.params.id));

  if (!row) {
    return sendError(res, 'PRACTICE_NOT_FOUND');
  }

  const history = db.listPracticeHistory(Number(req.params.id));
  res.json({ success: true, data: { ...row, history } });
});

app.put('/api/practice-records/:id/verify', (req, res) => {
  const { verified_by = '票务同事' } = req.body;
  const id = Number(req.params.id);

  const existing = db.findPracticeRecord(id);
  if (!existing) {
    return sendError(res, 'PRACTICE_NOT_FOUND');
  }

  db.verifyPractice(id, verified_by);

  db.insertPracticeHistory(id, 'is_verified', '0', '1', verified_by);

  logOperation('复核替补记录', 'practice_records', id, existing, { ...existing, is_verified: 1 }, false);

  res.json({ success: true, message: '复核通过，记录已标记为正常' });
});

app.put('/api/practice-records/:id', (req, res) => {
  const id = Number(req.params.id);
  const { remark, attendance_status, substitute_info } = req.body;

  const existing = db.findPracticeRecord(id);
  if (!existing) {
    return sendError(res, 'PRACTICE_NOT_FOUND');
  }

  const oldData = { ...existing };
  const changes = [];

  if (remark !== undefined && remark !== existing.remark) {
    db.updatePracticeRemark(id, remark);
    db.insertPracticeHistory(id, 'remark', existing.remark, remark, '许老师');
    changes.push('remark');
  }
  if (attendance_status !== undefined && attendance_status !== existing.attendance_status) {
    db.updatePracticeStatus(id, attendance_status);
    db.insertPracticeHistory(id, 'attendance_status', existing.attendance_status, attendance_status, '许老师');
    changes.push('attendance_status');
  }
  if (substitute_info !== undefined && substitute_info !== existing.substitute_info) {
    db.updatePracticeSubstitute(id, substitute_info);
    db.insertPracticeHistory(id, 'substitute_info', existing.substitute_info, substitute_info, '许老师');
    changes.push('substitute_info');
  }

  logOperation('修改练习记录', 'practice_records', id, oldData, req.body, true);

  const updated = db.findPracticeRecord(id);
  res.json({ success: true, data: updated, changedFields: changes });
});

app.post('/api/settlement/generate', (req, res) => {
  const { practice_date, operator = '许老师' } = req.body;

  if (!practice_date) {
    return sendError(res, 'MISSING_REQUIRED', '练习日期');
  }

  const practices = db.listVerifiedPracticesByDate(practice_date);

  if (practices.length === 0) {
    return res.json({ success: true, data: [], message: '该日期没有已复核的练习记录' });
  }

  try {
    for (const practice of practices) {
      const existing = db.findSettlementByPractice(practice.id);
      if (existing) continue;

      const unit_price = 100;
      const total_amount = unit_price * 1;

      db.insertSettlementDetail(
        practice.id, practice.student_name, practice.song_name,
        practice.part_type, unit_price, total_amount
      );
    }

    logOperation('生成分账明细', 'settlement_details', null, null, { practice_date }, false);

    const details = db.listSettlementDetails({ practice_date });

    res.json({ success: true, data: details });
  } catch (error) {
    res.status(500).json({ error: true, message: '生成分账失败：' + error.message });
  }
});

app.get('/api/settlement', (req, res) => {
  const { practice_date, status } = req.query;
  const rows = db.listSettlementDetails({ practice_date, status });
  res.json({ success: true, data: rows });
});

app.get('/api/operation-logs', (req, res) => {
  const rows = db.listOperationLogs();
  res.json({ success: true, data: rows });
});

app.get('/api/stats/summary', (req, res) => {
  const { practice_date } = req.query;

  const total = db.countPractices({ practice_date });
  const verified = db.countPractices({ practice_date, is_verified: 1 });
  const pending = db.countPractices({ practice_date, is_verified: 0 });
  const hasSubstitute = db.countPractices({ practice_date, has_substitute: 1 });
  const byPart = db.groupPracticesByPart({ practice_date });

  res.json({
    success: true,
    data: {
      total,
      verified,
      pending,
      hasSubstitute,
      byPart
    }
  });
});

app.post('/api/rollback/:logId', (req, res) => {
  res.json({ success: true, message: '回滚功能：记录已保留历史版本，可手动恢复' });
});

app.listen(PORT, () => {
  console.log(`合唱分声部练习跟踪系统已启动: http://localhost:${PORT}`);
});
