const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dbFile = path.join(dataDir, 'db.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = {
  tables: {
    song_aliases: [],
    song_alias_history: [],
    attendance_photos: [],
    practice_records: [],
    practice_history: [],
    settlement_details: [],
    operation_logs: []
  },
  autoIncrement: {
    song_aliases: 1,
    song_alias_history: 1,
    attendance_photos: 1,
    practice_records: 1,
    practice_history: 1,
    settlement_details: 1,
    operation_logs: 1
  }
};

function saveDB() {
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf8');
}

function loadDB() {
  if (fs.existsSync(dbFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
      if (data.tables) db.tables = data.tables;
      if (data.autoIncrement) db.autoIncrement = data.autoIncrement;
    } catch (e) {
      console.log('数据库文件损坏，使用空数据库');
    }
  }
}

loadDB();

function now() {
  const d = new Date();
  const pad = n => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function nextId(table) {
  const id = db.autoIncrement[table];
  db.autoIncrement[table]++;
  return id;
}

const API = {
  findSongByCode(song_code) {
    return db.tables.song_aliases.find(r => r.song_code === song_code && r.is_deleted === 0) || null;
  },

  listSongs({ keyword, part_type } = {}) {
    let result = db.tables.song_aliases.filter(r => r.is_deleted === 0);
    if (keyword) {
      const kw = keyword;
      result = result.filter(r =>
        r.song_code.includes(kw) || r.song_name.includes(kw) || (r.alias || '').includes(kw)
      );
    }
    if (part_type) {
      result = result.filter(r => r.part_type === part_type);
    }
    return result.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },

  insertSong(song_code, song_name, alias, part_type, remark) {
    const id = nextId('song_aliases');
    const record = {
      id, song_code, song_name, alias, part_type, remark,
      version: 1, is_deleted: 0, created_at: now(), updated_at: now()
    };
    db.tables.song_aliases.push(record);
    saveDB();
    return id;
  },

  updateSong(id, song_name, alias, part_type, remark, version) {
    const record = db.tables.song_aliases.find(r => r.id === id);
    if (record) {
      Object.assign(record, { song_name, alias, part_type, remark, version, updated_at: now() });
      saveDB();
    }
  },

  insertSongHistory(song_alias_id, song_code, song_name, alias, part_type, remark, version, change_type, changed_by) {
    const id = nextId('song_alias_history');
    db.tables.song_alias_history.push({
      id, song_alias_id, song_code, song_name, alias, part_type, remark, version, change_type, changed_by,
      changed_at: now()
    });
    saveDB();
    return id;
  },

  listSongHistory(song_alias_id) {
    return db.tables.song_alias_history
      .filter(r => r.song_alias_id === song_alias_id)
      .sort((a, b) => b.version - a.version);
  },

  insertAttendancePhoto(class_date, photo_path, photo_name, remark) {
    const id = nextId('attendance_photos');
    const record = {
      id, class_date, photo_path, photo_name, remark,
      uploader: '许老师', uploaded_at: now()
    };
    db.tables.attendance_photos.push(record);
    saveDB();
    return id;
  },

  listAttendancePhotos({ class_date } = {}) {
    let result = [...db.tables.attendance_photos];
    if (class_date) {
      result = result.filter(r => r.class_date === class_date);
    }
    return result.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
  },

  findAttendancePhoto(id) {
    return db.tables.attendance_photos.find(r => r.id === id) || null;
  },

  insertPracticeRecord({
    practice_date, song_alias_id, song_code, song_name, part_type, student_name,
    attendance_status, has_substitute, substitute_info, substitute_source, is_verified,
    attendance_photo_id, remark
  }) {
    const id = nextId('practice_records');
    const record = {
      id, practice_date, song_alias_id, song_code, song_name, part_type, student_name,
      attendance_status, has_substitute, substitute_info, substitute_source, is_verified,
      verified_by: null, verified_at: null, attendance_photo_id, remark,
      created_at: now(), updated_at: now()
    };
    db.tables.practice_records.push(record);
    saveDB();
    return id;
  },

  listPracticeRecords({ practice_date, is_verified, has_substitute, part_type } = {}) {
    let result = db.tables.practice_records.map(pr => {
      const ap = db.tables.attendance_photos.find(p => p.id === pr.attendance_photo_id);
      return { ...pr, photo_path: ap?.photo_path, photo_name: ap?.photo_name };
    });
    if (practice_date !== undefined && practice_date !== '') {
      result = result.filter(r => r.practice_date === practice_date);
    }
    if (is_verified !== undefined && is_verified !== '') {
      result = result.filter(r => r.is_verified === Number(is_verified));
    }
    if (has_substitute !== undefined && has_substitute !== '') {
      result = result.filter(r => r.has_substitute === Number(has_substitute));
    }
    if (part_type) {
      result = result.filter(r => r.part_type === part_type);
    }
    return result.sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  findPracticeRecord(id) {
    const pr = db.tables.practice_records.find(r => r.id === id);
    if (!pr) return null;
    const ap = db.tables.attendance_photos.find(p => p.id === pr.attendance_photo_id);
    const sa = db.tables.song_aliases.find(s => s.id === pr.song_alias_id);
    return { ...pr, photo_path: ap?.photo_path, photo_name: ap?.photo_name, song_alias: sa?.alias };
  },

  listVerifiedPracticesByDate(practice_date) {
    return db.tables.practice_records.filter(r => r.practice_date === practice_date && r.is_verified === 1);
  },

  verifyPractice(id, verified_by) {
    const record = db.tables.practice_records.find(r => r.id === id);
    if (record) {
      Object.assign(record, { is_verified: 1, verified_by, verified_at: now(), attendance_status: '正常' });
      saveDB();
    }
  },

  updatePracticeRemark(id, remark) {
    const record = db.tables.practice_records.find(r => r.id === id);
    if (record) {
      Object.assign(record, { remark, updated_at: now() });
      saveDB();
    }
  },

  updatePracticeStatus(id, attendance_status) {
    const record = db.tables.practice_records.find(r => r.id === id);
    if (record) {
      Object.assign(record, { attendance_status, updated_at: now() });
      saveDB();
    }
  },

  updatePracticeSubstitute(id, substitute_info) {
    const record = db.tables.practice_records.find(r => r.id === id);
    if (record) {
      Object.assign(record, { substitute_info, updated_at: now() });
      saveDB();
    }
  },

  insertPracticeHistory(practice_id, field_name, old_value, new_value, changed_by) {
    const id = nextId('practice_history');
    db.tables.practice_history.push({
      id, practice_id, field_name, old_value, new_value,
      changed_by: changed_by || '许老师', changed_at: now()
    });
    saveDB();
    return id;
  },

  listPracticeHistory(practice_id) {
    return db.tables.practice_history
      .filter(r => r.practice_id === practice_id)
      .sort((a, b) => b.changed_at.localeCompare(a.changed_at));
  },

  findSettlementByPractice(practice_id) {
    return db.tables.settlement_details.find(r => r.practice_id === practice_id) || null;
  },

  insertSettlementDetail(practice_id, student_name, song_name, part_type, unit_price, total_amount) {
    const id = nextId('settlement_details');
    db.tables.settlement_details.push({
      id, practice_id, student_name, song_name, part_type,
      class_count: 1, unit_price, total_amount,
      status: '待结算', settlement_date: null, remark: null,
      created_at: now(), updated_at: now()
    });
    saveDB();
    return id;
  },

  listSettlementDetails({ practice_date, status } = {}) {
    let result = db.tables.settlement_details.map(sd => {
      const pr = db.tables.practice_records.find(p => p.id === sd.practice_id);
      return { ...sd, practice_date: pr?.practice_date, is_verified: pr?.is_verified };
    });
    if (practice_date) {
      result = result.filter(r => r.practice_date === practice_date);
    }
    if (status) {
      result = result.filter(r => r.status === status);
    }
    return result.sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  insertOperationLog(operation_type, table_name, record_id, old_data, new_data, can_rollback) {
    const id = nextId('operation_logs');
    db.tables.operation_logs.push({
      id, operation_type, table_name, record_id, old_data, new_data,
      operator: '许老师', operation_time: now(), can_rollback
    });
    saveDB();
    return id;
  },

  listOperationLogs() {
    return [...db.tables.operation_logs]
      .sort((a, b) => b.operation_time.localeCompare(a.operation_time))
      .slice(0, 100);
  },

  countPractices({ practice_date, is_verified, has_substitute } = {}) {
    let result = [...db.tables.practice_records];
    if (practice_date) {
      result = result.filter(r => r.practice_date === practice_date);
    }
    if (is_verified !== undefined) {
      result = result.filter(r => r.is_verified === is_verified);
    }
    if (has_substitute !== undefined) {
      result = result.filter(r => r.has_substitute === has_substitute);
    }
    return result.length;
  },

  groupPracticesByPart({ practice_date } = {}) {
    let result = [...db.tables.practice_records];
    if (practice_date) {
      result = result.filter(r => r.practice_date === practice_date);
    }
    const groups = {};
    result.forEach(r => {
      groups[r.part_type] = (groups[r.part_type] || 0) + 1;
    });
    return Object.entries(groups).map(([part_type, count]) => ({ part_type, count }));
  }
};

module.exports = API;
