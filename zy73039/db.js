/* =========================================================
   数据库层 - SQLite (better-sqlite3)
   表结构：
     records    - 回访记录主表
     versions   - 版本链（每次导入/人工补改追加）
     anomalies  - 异常时间线（体重混写、口径变更、人工处理）
   ========================================================= */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'stray_tracker.sqlite');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/* ---------- 建表 ---------- */
db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    owner_wechat TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    human_edited INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_records_owner ON records(owner_wechat);
  CREATE INDEX IF NOT EXISTS idx_records_status ON records(status);

  CREATE TABLE IF NOT EXISTS versions (
    vid TEXT PRIMARY KEY,
    record_id TEXT NOT NULL,
    version_index INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'import',
    animal_name TEXT,
    visit_date TEXT,
    weight TEXT,
    weight_value REAL,
    weight_unit TEXT,
    med_reminder TEXT,
    wechat_note TEXT,
    attachment TEXT,
    verbal_note TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_versions_record ON versions(record_id, version_index DESC);

  CREATE TABLE IF NOT EXISTS anomalies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id TEXT NOT NULL,
    vid TEXT,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    diffs_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_anomalies_record ON anomalies(record_id);
  CREATE INDEX IF NOT EXISTS idx_anomalies_type ON anomalies(type);
`);

/* ---------- 工具 ---------- */
const uid = () => 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const vid = () => 'v_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const nowISO = () => new Date().toISOString();

function parseWeight(raw) {
  if (!raw) return { value: null, unit: null, raw: '' };
  const str = String(raw).trim().toLowerCase();
  const m = str.match(/^([\d.]+)\s*(kg|kilogram|kilograms|公斤|千克|g|gram|grams|克|斤|lb|lbs|pound|pounds|磅)?$/);
  if (!m) return { value: null, unit: null, raw: str };
  const v = parseFloat(m[1]);
  let u = m[2] || '';
  if (['kg', 'kilogram', 'kilograms', '公斤', '千克'].includes(u)) u = 'kg';
  else if (['g', 'gram', 'grams', '克'].includes(u)) u = 'g';
  else if (['斤'].includes(u)) u = 'jin';
  else if (['lb', 'lbs', 'pound', 'pounds', '磅'].includes(u)) u = 'lb';
  return { value: isNaN(v) ? null : v, unit: u || null, raw: str };
}

function detectWeightMix(raw) {
  if (!raw) return false;
  const str = String(raw).toLowerCase();
  const has = {
    kg: /(kg|kilogram|公斤|千克)/.test(str),
    g:  /(^|[\d\s.,])(g|克)(?![a-z])/.test(str),
    jin: /斤/.test(str),
    lb: /(lb|pound|磅)/.test(str),
  };
  return [has.kg, has.g, has.jin, has.lb].filter(Boolean).length >= 2;
}

const KEY_FIELDS = ['weight', 'medReminder', 'wechatNote', 'attachment', 'verbalNote'];
const FIELD_LABEL = {
  weight: '回访体重',
  medReminder: '用药提醒',
  wechatNote: '主人微信备注原文',
  attachment: '晚到附件',
  verbalNote: '临时口头说明',
};

function pickKeyFields(d) {
  return {
    weight: d.weight || '',
    medReminder: d.medReminder || '',
    wechatNote: d.wechatNote || '',
    attachment: d.attachment || '',
    verbalNote: d.verbalNote || '',
  };
}

function diffFields(a, b) {
  const ka = pickKeyFields(a);
  const kb = pickKeyFields(b);
  const diffs = [];
  for (const k of Object.keys(ka)) {
    const va = ka[k];
    const vb = kb[k];
    if (String(va).trim() !== String(vb).trim()) {
      diffs.push({ field: k, label: FIELD_LABEL[k] || k, before: va, after: vb });
    }
  }
  return diffs;
}

/* ---------- 版本/异常序列化 ---------- */
function rowToVersion(row) {
  if (!row) return null;
  return {
    vid: row.vid,
    versionIndex: row.version_index,
    source: row.source,
    animalName: row.animal_name,
    visitDate: row.visit_date,
    weight: row.weight,
    weightValue: row.weight_value,
    weightUnit: row.weight_unit,
    medReminder: row.med_reminder,
    wechatNote: row.wechat_note,
    attachment: row.attachment,
    verbalNote: row.verbal_note,
    createdAt: row.created_at,
    anomalies: [],
  };
}

function rowToAnomaly(row) {
  if (!row) return null;
  let diffs = null;
  try { diffs = row.diffs_json ? JSON.parse(row.diffs_json) : null; } catch (e) { diffs = null; }
  return {
    id: row.id,
    recordId: row.record_id,
    vid: row.vid,
    type: row.type,
    message: row.message,
    diffs,
    createdAt: row.created_at,
  };
}

function rowToRecord(row, versions, anomalies) {
  if (!row) return null;
  const latest = versions && versions.length ? versions[versions.length - 1] : null;
  return {
    id: row.id,
    ownerWechat: row.owner_wechat,
    status: row.status,
    humanEdited: !!row.human_edited,
    flags: { humanEdited: !!row.human_edited },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    versions: versions || [],
    anomalies: anomalies || [],
    latest: latest ? {
      animalName: latest.animalName,
      visitDate: latest.visitDate,
      weight: latest.weight,
      weightUnit: latest.weightUnit,
      weightValue: latest.weightValue,
      medReminder: latest.medReminder,
      wechatNote: latest.wechatNote,
      attachment: latest.attachment,
      verbalNote: latest.verbalNote,
      vid: latest.vid,
    } : null,
  };
}

/* ---------- 准备语句 ---------- */
const stmts = {};

function prepare() {
  stmts.insertRecord = db.prepare(`
    INSERT INTO records (id, owner_wechat, status, human_edited, created_at, updated_at)
    VALUES (@id, @owner_wechat, @status, @human_edited, @created_at, @updated_at)
  `);
  stmts.updateRecordStatus = db.prepare(`
    UPDATE records SET status = @status, human_edited = @human_edited, updated_at = @updated_at
    WHERE id = @id
  `);
  stmts.updateRecordUpdated = db.prepare(`
    UPDATE records SET updated_at = @updated_at WHERE id = @id
  `);
  stmts.findActiveByOwner = db.prepare(`
    SELECT * FROM records WHERE owner_wechat = ? AND status != 'revoked' LIMIT 1
  `);
  stmts.getRecord = db.prepare(`SELECT * FROM records WHERE id = ?`);
  stmts.listRecords = db.prepare(`SELECT * FROM records ORDER BY updated_at DESC`);

  stmts.getVersions = db.prepare(`
    SELECT * FROM versions WHERE record_id = ? ORDER BY version_index ASC
  `);
  stmts.getVersionCount = db.prepare(`
    SELECT COUNT(*) AS cnt FROM versions WHERE record_id = ?
  `);
  stmts.insertVersion = db.prepare(`
    INSERT INTO versions (vid, record_id, version_index, source, animal_name, visit_date,
      weight, weight_value, weight_unit, med_reminder, wechat_note, attachment, verbal_note, created_at)
    VALUES (@vid, @record_id, @version_index, @source, @animal_name, @visit_date,
      @weight, @weight_value, @weight_unit, @med_reminder, @wechat_note, @attachment, @verbal_note, @created_at)
  `);

  stmts.insertAnomaly = db.prepare(`
    INSERT INTO anomalies (record_id, vid, type, message, diffs_json, created_at)
    VALUES (@record_id, @vid, @type, @message, @diffs_json, @created_at)
  `);
  stmts.getAnomalies = db.prepare(`
    SELECT * FROM anomalies WHERE record_id = ? ORDER BY created_at ASC, id ASC
  `);
  stmts.listAllAnomalies = db.prepare(`
    SELECT a.*, r.owner_wechat
    FROM anomalies a JOIN records r ON a.record_id = r.id
    ORDER BY a.created_at DESC, a.id DESC
  `);
}
prepare();

/* ---------- 业务函数 ---------- */

/**
 * 导入记录（新记录或追加版本）
 */
function importRecord(payload) {
  const ownerWechat = (payload.ownerWechat || '').trim();
  if (!ownerWechat) throw new Error('主人微信备注不能为空');

  const wp = parseWeight(payload.weight);
  const weightMix = detectWeightMix(payload.weight);

  const tx = db.transaction(() => {
    let record = stmts.findActiveByOwner.get(ownerWechat);
    let created = false;
    const warnings = [];
    const versionAnomalies = [];
    const recordAnomaliesToAdd = [];

    let recordId;
    let versionIndex;

    if (record) {
      recordId = record.id;
      const cnt = stmts.getVersionCount.get(recordId).cnt;
      versionIndex = cnt;

      const lastVerRow = db.prepare(
        `SELECT * FROM versions WHERE record_id = ? ORDER BY version_index DESC LIMIT 1`
      ).get(recordId);
      const lastVer = rowToVersion(lastVerRow);

      const newVer = {
        weight: payload.weight || '',
        medReminder: payload.medReminder || '',
        wechatNote: payload.wechatNote || '',
        attachment: payload.attachment || '',
        verbalNote: payload.verbalNote || '',
      };
      const diffs = diffFields(lastVer, newVer);

      if (diffs.length > 0) {
        const a = {
          type: 'version_conflict',
          message: `与上一版相比有 ${diffs.length} 处口径变更`,
          diffs,
        };
        versionAnomalies.push(a);
        recordAnomaliesToAdd.push({
          type: 'version_conflict',
          message: `口径变更 ${diffs.length} 处`,
          diffs,
        });
        warnings.push(`检测到与上一版的口径变更 ${diffs.length} 处`);
      }

      if (weightMix) {
        versionAnomalies.push({
          type: 'weight_mix',
          message: '体重字段单位混写（kg/g/lb 同时出现），已挂起请确认',
        });
        recordAnomaliesToAdd.push({
          type: 'weight_mix',
          message: '体重单位混写，挂起中',
        });
        warnings.push('体重单位混写，已自动挂起，请接手同事确认');
      }

      const unitRows = db.prepare(
        `SELECT DISTINCT weight_unit AS u FROM versions WHERE record_id = ? AND weight_unit IS NOT NULL`
      ).all(recordId);
      const existingUnits = unitRows.map(r => r.u).filter(Boolean);
      if (wp.unit && existingUnits.length > 0 && !existingUnits.includes(wp.unit)) {
        versionAnomalies.push({
          type: 'weight_mix',
          message: `历史版本体重单位不一致（${existingUnits.concat(wp.unit).join(' / ')}），已挂起`,
        });
        recordAnomaliesToAdd.push({
          type: 'weight_mix',
          message: `跨版本体重单位不一致（${existingUnits.concat(wp.unit).join(' / ')}）`,
        });
        warnings.push('与历史版本体重单位不一致，已自动挂起');
      }

      const newVid = vid();
      const now = nowISO();
      stmts.insertVersion.run({
        vid: newVid,
        record_id: recordId,
        version_index: versionIndex,
        source: payload._source || 'import',
        animal_name: payload.animalName || null,
        visit_date: payload.visitDate || null,
        weight: payload.weight || null,
        weight_value: wp.value,
        weight_unit: wp.unit,
        med_reminder: payload.medReminder || null,
        wechat_note: payload.wechatNote || null,
        attachment: payload.attachment || null,
        verbal_note: payload.verbalNote || null,
        created_at: now,
      });

      for (const va of versionAnomalies) {
        stmts.insertAnomaly.run({
          record_id: recordId,
          vid: newVid,
          type: va.type,
          message: va.message,
          diffs_json: va.diffs ? JSON.stringify(va.diffs) : null,
          created_at: now,
        });
      }
      for (const ra of recordAnomaliesToAdd) {
        // 已在上面一起作为版本异常插入了，不重复插入
      }

      const hasWeightIssue = db.prepare(
        `SELECT COUNT(*) AS cnt FROM anomalies WHERE record_id = ? AND type = 'weight_mix'`
      ).get(recordId).cnt > 0;
      const hasVersionConflict = versionAnomalies.some(a => a.type === 'version_conflict');
      const needsAttention = hasWeightIssue || hasVersionConflict;

      let newStatus = record.status;
      if (needsAttention && record.status !== 'revoked') {
        newStatus = hasWeightIssue ? 'hang' : 'pending';
      }

      stmts.updateRecordUpdated.run({ id: recordId, updated_at: now });
      if (newStatus !== record.status) {
        if (record.status === 'cleared' && needsAttention) {
          const msg = hasWeightIssue
            ? '已放行记录追加新材料后发现体重单位问题，重新挂起'
            : '已放行记录追加新材料后发现口径变更，回到待补证据';
          stmts.insertAnomaly.run({
            record_id: recordId,
            vid: newVid,
            type: 'human_edit',
            message: msg,
            diffs_json: null,
            created_at: now,
          });
        }
        stmts.updateRecordStatus.run({
          id: recordId,
          status: newStatus,
          human_edited: record.human_edited,
          updated_at: now,
        });
      }
    } else {
      created = true;
      recordId = uid();
      versionIndex = 0;
      const now = nowISO();
      let status = 'pending';

      const newVid = vid();

      stmts.insertRecord.run({
        id: recordId,
        owner_wechat: ownerWechat,
        status,
        human_edited: 0,
        created_at: now,
        updated_at: now,
      });

      stmts.insertVersion.run({
        vid: newVid,
        record_id: recordId,
        version_index: 0,
        source: payload._source || 'import',
        animal_name: payload.animalName || null,
        visit_date: payload.visitDate || null,
        weight: payload.weight || null,
        weight_value: wp.value,
        weight_unit: wp.unit,
        med_reminder: payload.medReminder || null,
        wechat_note: payload.wechatNote || null,
        attachment: payload.attachment || null,
        verbal_note: payload.verbalNote || null,
        created_at: now,
      });

      if (weightMix) {
        stmts.insertAnomaly.run({
          record_id: recordId,
          vid: newVid,
          type: 'weight_mix',
          message: '体重单位混写，挂起中',
          diffs_json: null,
          created_at: now,
        });
        status = 'hang';
        warnings.push('体重单位混写，已自动挂起');
        stmts.updateRecordStatus.run({
          id: recordId,
          status,
          human_edited: 0,
          updated_at: now,
        });
      }
    }

    return { recordId, created, warnings };
  });

  const result = tx();
  return {
    record: getRecordDetail(result.recordId),
    created: result.created,
    warnings: result.warnings,
  };
}

/**
 * 确认放行
 */
function confirmRecord(id, options = {}) {
  const record = stmts.getRecord.get(id);
  if (!record) throw new Error('记录不存在');
  if (record.status === 'revoked') throw new Error('已撤回的记录不能再确认');

  const tx = db.transaction(() => {
    const now = nowISO();
    const humanEdited = 1;
    const reason = options.reason || options.note || '';

    let msg;
    if (record.status === 'hang') {
      msg = reason
        ? `人工确认放行（从挂起状态确认）：${reason}`
        : '人工确认放行（从挂起状态确认）';
    } else if (record.status === 'pending') {
      msg = reason
        ? `人工确认放行（待补证据→已放行）：${reason}`
        : '人工确认放行（待补证据→已放行）';
    } else if (record.status === 'cleared') {
      msg = reason
        ? `再次确认放行（已放行→已放行）：${reason}`
        : '再次确认放行';
    } else {
      msg = reason ? `确认放行：${reason}` : '确认放行';
    }

    stmts.insertAnomaly.run({
      record_id: id,
      vid: null,
      type: 'human_edit',
      message: msg,
      diffs_json: null,
      created_at: now,
    });

    stmts.updateRecordStatus.run({
      id,
      status: 'cleared',
      human_edited: humanEdited,
      updated_at: now,
    });
    return true;
  });

  tx();
  return getRecordDetail(id);
}

/**
 * 撤回
 */
function revokeRecord(id, options = {}) {
  const record = stmts.getRecord.get(id);
  if (!record) throw new Error('记录不存在');

  const tx = db.transaction(() => {
    const now = nowISO();
    stmts.insertAnomaly.run({
      record_id: id,
      vid: null,
      type: 'human_edit',
      message: options.reason
        ? `撤回：${options.reason}`
        : '撤回（未填原因）',
      diffs_json: null,
      created_at: now,
    });
    stmts.updateRecordStatus.run({
      id,
      status: 'revoked',
      human_edited: 1,
      updated_at: now,
    });
    return true;
  });

  tx();
  return getRecordDetail(id);
}

/**
 * 人工补改
 */
function humanPatchRecord(id, patch, options = {}) {
  const record = stmts.getRecord.get(id);
  if (!record) throw new Error('记录不存在');
  if (record.status === 'revoked') throw new Error('已撤回的记录不可编辑');

  const tx = db.transaction(() => {
    const cnt = stmts.getVersionCount.get(id).cnt;
    const lastVerRow = db.prepare(
      `SELECT * FROM versions WHERE record_id = ? ORDER BY version_index DESC LIMIT 1`
    ).get(id);
    const lastVer = rowToVersion(lastVerRow);

    const newVerData = {
      animalName: patch.animalName != null ? patch.animalName : lastVer.animalName,
      visitDate: patch.visitDate != null ? patch.visitDate : lastVer.visitDate,
      weight: patch.weight != null ? patch.weight : lastVer.weight,
      medReminder: patch.medReminder != null ? patch.medReminder : lastVer.medReminder,
      wechatNote: patch.wechatNote != null ? patch.wechatNote : lastVer.wechatNote,
      attachment: patch.attachment != null ? patch.attachment : lastVer.attachment,
      verbalNote: patch.verbalNote != null ? patch.verbalNote : lastVer.verbalNote,
    };

    const diffs = diffFields(lastVer, newVerData);
    if (diffs.length === 0) return { changed: false };

    const wp = parseWeight(newVerData.weight);
    const newVid = vid();
    const now = nowISO();

    stmts.insertVersion.run({
      vid: newVid,
      record_id: id,
      version_index: cnt,
      source: 'human_edit',
      animal_name: newVerData.animalName || null,
      visit_date: newVerData.visitDate || null,
      weight: newVerData.weight || null,
      weight_value: wp.value,
      weight_unit: wp.unit,
      med_reminder: newVerData.medReminder || null,
      wechat_note: newVerData.wechatNote || null,
      attachment: newVerData.attachment || null,
      verbal_note: newVerData.verbalNote || null,
      created_at: now,
    });

    stmts.insertAnomaly.run({
      record_id: id,
      vid: newVid,
      type: 'human_edit',
      message: `人工修改 ${diffs.length} 处字段` + (options.reason ? `：${options.reason}` : ''),
      diffs_json: JSON.stringify(diffs),
      created_at: now,
    });

    const stillWeightIssue = db.prepare(
      `SELECT COUNT(*) AS cnt FROM anomalies WHERE record_id = ? AND type = 'weight_mix'`
    ).get(id).cnt > 0;

    let newStatus = record.status;
    if (stillWeightIssue && record.status !== 'cleared' && record.status !== 'revoked') {
      newStatus = 'hang';
    } else if (record.status === 'hang' && !stillWeightIssue) {
      newStatus = 'pending';
    }

    stmts.updateRecordStatus.run({
      id,
      status: newStatus,
      human_edited: 1,
      updated_at: now,
    });

    return { changed: true };
  });

  const result = tx();
  return { record: getRecordDetail(id), changed: result.changed };
}

/**
 * 单条记录详情（含版本和异常）
 */
function getRecordDetail(id) {
  const row = stmts.getRecord.get(id);
  if (!row) return null;
  const verRows = stmts.getVersions.all(id);
  const anomRows = stmts.getAnomalies.all(id);

  const versions = verRows.map(rowToVersion);

  const verAnomMap = {};
  for (const a of anomRows) {
    if (!a.vid) continue;
    if (!verAnomMap[a.vid]) verAnomMap[a.vid] = [];
    verAnomMap[a.vid].push(rowToAnomaly(a));
  }
  for (const v of versions) {
    v.anomalies = verAnomMap[v.vid] || [];
  }

  const anomalies = anomRows.map(rowToAnomaly);
  return rowToRecord(row, versions, anomalies);
}

/**
 * 列表（含最新版本摘要）
 */
function listRecords(filter = 'all') {
  let rows = stmts.listRecords.all();
  if (filter === 'human') {
    rows = rows.filter(r => !!r.human_edited);
  } else if (filter !== 'all') {
    rows = rows.filter(r => r.status === filter);
  }
  return rows.map(row => {
    const latestVer = db.prepare(
      `SELECT * FROM versions WHERE record_id = ? ORDER BY version_index DESC LIMIT 1`
    ).get(row.id);
    const latest = rowToVersion(latestVer);
    const anomRows = stmts.getAnomalies.all(row.id);
    const anomalies = anomRows.map(rowToAnomaly);
    const r = rowToRecord(row, [latest], anomalies);
    r.versionCount = stmts.getVersionCount.get(row.id).cnt;
    return r;
  });
}

/**
 * 全部异常时间线
 */
function listAnomalies() {
  const rows = stmts.listAllAnomalies.all();
  return rows.map(row => {
    const a = rowToAnomaly(row);
    a.ownerWechat = row.owner_wechat;
    const rec = stmts.getRecord.get(row.record_id);
    if (rec) {
      a.status = rec.status;
      const latestVer = db.prepare(
        `SELECT animal_name FROM versions WHERE record_id = ? ORDER BY version_index DESC LIMIT 1`
      ).get(row.record_id);
      a.animalName = latestVer ? latestVer.animal_name : null;
    }
    return a;
  });
}

/**
 * 页面摘要
 */
function getSummary() {
  const rows = stmts.listRecords.all();
  const out = {
    total: rows.length,
    cleared: 0,
    pending: 0,
    human: 0,
    hang: 0,
    revoked: 0,
    weightIssues: 0,
    versionConflicts: 0,
  };
  const anomRows = stmts.listAllAnomalies.all();
  for (const a of anomRows) {
    if (a.type === 'weight_mix') out.weightIssues++;
    if (a.type === 'version_conflict') out.versionConflicts++;
  }
  for (const r of rows) {
    if (r.status === 'cleared') out.cleared++;
    else if (r.status === 'pending') out.pending++;
    else if (r.status === 'hang') out.hang++;
    else if (r.status === 'revoked') out.revoked++;
    if (r.human_edited) out.human++;
  }
  return out;
}

module.exports = {
  db,
  DB_PATH,
  importRecord,
  confirmRecord,
  revokeRecord,
  humanPatchRecord,
  getRecordDetail,
  listRecords,
  listAnomalies,
  getSummary,
  parseWeight,
  detectWeightMix,
  diffFields,
};
