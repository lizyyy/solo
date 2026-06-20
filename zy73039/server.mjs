import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8775);
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'stray_tracker.sqlite');

const STATUS = {
  PENDING: 'pending',
  CLEARED: 'cleared',
  REVOKED: 'revoked',
  HANG: 'hang',
};

await mkdir(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    owner_wechat TEXT NOT NULL,
    status TEXT NOT NULL,
    flags_json TEXT NOT NULL,
    versions_json TEXT NOT NULL,
    anomalies_json TEXT NOT NULL,
    latest_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_records_owner_status ON records(owner_wechat, status);
  CREATE INDEX IF NOT EXISTS idx_records_updated_at ON records(updated_at);
  CREATE TABLE IF NOT EXISTS operation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id TEXT,
    action TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const selectAll = db.prepare('SELECT * FROM records ORDER BY updated_at DESC');
const selectById = db.prepare('SELECT * FROM records WHERE id = ?');
const selectActiveByOwner = db.prepare(
  'SELECT * FROM records WHERE owner_wechat = ? AND status != ? ORDER BY updated_at DESC LIMIT 1'
);
const upsertRecord = db.prepare(`
  INSERT INTO records (
    id, owner_wechat, status, flags_json, versions_json, anomalies_json,
    latest_json, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    owner_wechat = excluded.owner_wechat,
    status = excluded.status,
    flags_json = excluded.flags_json,
    versions_json = excluded.versions_json,
    anomalies_json = excluded.anomalies_json,
    latest_json = excluded.latest_json,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at
`);
const deleteAllRecords = db.prepare('DELETE FROM records');
const insertOperation = db.prepare(
  'INSERT INTO operation_log(record_id, action, payload_json, created_at) VALUES (?, ?, ?, ?)'
);

function rowToRecord(row) {
  return {
    id: row.id,
    ownerWechat: row.owner_wechat,
    status: row.status,
    flags: JSON.parse(row.flags_json),
    versions: JSON.parse(row.versions_json),
    anomalies: JSON.parse(row.anomalies_json),
    latest: JSON.parse(row.latest_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function saveRecord(record, action, payload = {}) {
  upsertRecord.run(
    record.id,
    record.ownerWechat,
    record.status,
    JSON.stringify(record.flags || { humanEdited: false }),
    JSON.stringify(record.versions || []),
    JSON.stringify(record.anomalies || []),
    JSON.stringify(record.latest || {}),
    record.createdAt,
    record.updatedAt
  );
  insertOperation.run(record.id, action, JSON.stringify(payload), nowISO());
}

function uid() {
  return 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function vid() {
  return 'v_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function nowISO() {
  return new Date().toISOString();
}

function parseWeight(raw) {
  if (!raw) return { value: null, unit: null, raw: '' };
  const str = String(raw).trim().toLowerCase();
  const m = str.match(/^([\d.]+)\s*(kg|kilogram|kilograms|公斤|千克|g|gram|grams|克|lb|lbs|pound|pounds|磅)?$/);
  if (!m) return { value: null, unit: null, raw: str };
  const v = parseFloat(m[1]);
  let u = m[2] || '';
  if (['kg', 'kilogram', 'kilograms', '公斤', '千克'].includes(u)) u = 'kg';
  else if (['g', 'gram', 'grams', '克'].includes(u)) u = 'g';
  else if (['lb', 'lbs', 'pound', 'pounds', '磅'].includes(u)) u = 'lb';
  return { value: Number.isNaN(v) ? null : v, unit: u || null, raw: str };
}

function detectWeightMix(raw) {
  if (!raw) return false;
  const str = String(raw).toLowerCase();
  const has = {
    kg: /(kg|kilogram|公斤|千克)/.test(str),
    g: /(^|[\d\s.,])(g|克)(?![a-z])/.test(str),
    lb: /(lb|pound|磅)/.test(str),
  };
  return [has.kg, has.g, has.lb].filter(Boolean).length >= 2;
}

function pickKeyFields(d) {
  return {
    weight: d.weight || '',
    weightUnit: d.weightUnit || null,
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
      diffs.push({ field: k, before: va, after: vb });
    }
  }
  return diffs;
}

function summarizeLatest(record) {
  const v = record.versions[record.versions.length - 1];
  return {
    animalName: v.animalName,
    visitDate: v.visitDate,
    weight: v.weight,
    weightUnit: v.weightUnit,
    weightValue: v.weightValue,
    medReminder: v.medReminder,
    wechatNote: v.wechatNote,
    attachment: v.attachment,
    verbalNote: v.verbalNote,
    vid: v.vid,
  };
}

function importRecord(payload) {
  const ownerWechat = (payload.ownerWechat || '').trim();
  if (!ownerWechat) throw new HttpError(400, '主人微信备注不能为空');

  const wp = parseWeight(payload.weight);
  const weightMix = detectWeightMix(payload.weight);
  const createdAt = nowISO();
  const version = {
    vid: vid(),
    createdAt,
    weight: payload.weight || '',
    weightParsed: wp,
    weightUnit: wp.unit,
    weightValue: wp.value,
    animalName: payload.animalName || '',
    visitDate: payload.visitDate || '',
    medReminder: payload.medReminder || '',
    wechatNote: payload.wechatNote || '',
    attachment: payload.attachment || '',
    verbalNote: payload.verbalNote || '',
    source: payload._source || 'import',
    anomalies: [],
  };

  const existingRow = selectActiveByOwner.get(ownerWechat, STATUS.REVOKED);
  let record;
  let created = false;
  const warnings = [];

  if (existingRow) {
    record = rowToRecord(existingRow);
    const lastVer = record.versions[record.versions.length - 1];
    const diffs = diffFields(lastVer, version);

    if (diffs.length > 0) {
      version.anomalies.push({
        type: 'version_conflict',
        message: `与上一版相比有 ${diffs.length} 处口径变更`,
        diffs,
        at: version.createdAt,
      });
      record.anomalies.push({
        type: 'version_conflict',
        vid: version.vid,
        message: `版本 ${version.vid} 口径变更 ${diffs.length} 处`,
        diffs,
        at: version.createdAt,
      });
      warnings.push(`检测到与上一版的口径变更 ${diffs.length} 处`);
    }

    if (weightMix) {
      version.anomalies.push({
        type: 'weight_mix',
        message: '体重字段单位混写（kg/g/lb 同时出现），已挂起请确认',
        at: version.createdAt,
      });
      record.anomalies.push({
        type: 'weight_mix',
        vid: version.vid,
        message: '体重单位混写，挂起中',
        at: version.createdAt,
      });
      warnings.push('体重单位混写，已自动挂起，请接手同事确认');
    }

    const units = record.versions
      .map((v) => v.weightUnit)
      .filter(Boolean)
      .concat(version.weightUnit ? [version.weightUnit] : []);
    const uniqueUnits = [...new Set(units)];
    if (uniqueUnits.length >= 2) {
      version.anomalies.push({
        type: 'weight_mix',
        message: `历史版本体重单位不一致（${uniqueUnits.join(' / ')}），已挂起`,
        at: version.createdAt,
      });
      record.anomalies.push({
        type: 'weight_mix',
        vid: version.vid,
        message: `跨版本体重单位不一致（${uniqueUnits.join(' / ')}）`,
        at: version.createdAt,
      });
      warnings.push('与历史版本体重单位不一致，已自动挂起');
    }

    record.versions.push(version);
    record.updatedAt = version.createdAt;
    record.latest = summarizeLatest(record);
    if (record.anomalies.some((a) => a.type === 'weight_mix')) {
      record.status = STATUS.HANG;
    }
  } else {
    created = true;
    record = {
      id: uid(),
      ownerWechat,
      status: STATUS.PENDING,
      createdAt: version.createdAt,
      updatedAt: version.createdAt,
      anomalies: [],
      versions: [version],
      flags: { humanEdited: false },
    };

    if (weightMix) {
      version.anomalies.push({
        type: 'weight_mix',
        message: '体重字段单位混写，已挂起请确认',
        at: version.createdAt,
      });
      record.anomalies.push({
        type: 'weight_mix',
        vid: version.vid,
        message: '体重单位混写，挂起中',
        at: version.createdAt,
      });
      record.status = STATUS.HANG;
      warnings.push('体重单位混写，已自动挂起');
    }
    record.latest = summarizeLatest(record);
  }

  saveRecord(record, created ? 'import:create' : 'import:append', payload);
  return { record, warnings, created };
}

function confirmRecord(id, options = {}) {
  const record = getExistingRecord(id);
  if (record.status === STATUS.REVOKED) throw new HttpError(409, '已撤回的记录不能再确认');

  if (record.status === STATUS.HANG) {
    record.anomalies.push({
      type: 'human_edit',
      message: options.note
        ? `人工确认放行（挂起）：${options.note}`
        : '人工确认放行（从挂起状态确认）',
      at: nowISO(),
    });
    record.flags.humanEdited = true;
  }

  record.status = STATUS.CLEARED;
  record.updatedAt = nowISO();
  saveRecord(record, 'confirm', options);
  return record;
}

function revokeRecord(id, options = {}) {
  const record = getExistingRecord(id);
  record.status = STATUS.REVOKED;
  record.updatedAt = nowISO();
  record.anomalies.push({
    type: 'human_edit',
    message: options.reason ? `撤回：${options.reason}` : '撤回（未填原因）',
    at: nowISO(),
  });
  record.flags.humanEdited = true;
  saveRecord(record, 'revoke', options);
  return record;
}

function humanPatchRecord(id, patch, options = {}) {
  const record = getExistingRecord(id);
  if (record.status === STATUS.REVOKED) throw new HttpError(409, '已撤回的记录不可编辑');

  const lastVer = record.versions[record.versions.length - 1];
  const newVer = {
    ...lastVer,
    vid: vid(),
    createdAt: nowISO(),
    source: 'human_edit',
    anomalies: [],
  };
  Object.assign(newVer, patch);

  const wp = parseWeight(patch.weight != null ? patch.weight : newVer.weight);
  newVer.weightParsed = wp;
  newVer.weightUnit = wp.unit;
  newVer.weightValue = wp.value;

  const diffs = diffFields(lastVer, newVer);
  if (diffs.length === 0) return record;

  newVer.anomalies.push({
    type: 'human_edit',
    message: `人工修改 ${diffs.length} 处字段` + (options.reason ? `：${options.reason}` : ''),
    diffs,
    at: newVer.createdAt,
  });
  record.anomalies.push({
    type: 'human_edit',
    vid: newVer.vid,
    message: `人工修改 ${diffs.length} 处`,
    diffs,
    at: newVer.createdAt,
  });

  record.versions.push(newVer);
  record.flags.humanEdited = true;
  record.latest = summarizeLatest(record);
  record.updatedAt = newVer.createdAt;

  const stillWeightIssue = record.versions.some((v) =>
    v.anomalies.some((a) => a.type === 'weight_mix')
  );
  if (stillWeightIssue && record.status !== STATUS.CLEARED && record.status !== STATUS.REVOKED) {
    record.status = STATUS.HANG;
  } else if (record.status === STATUS.HANG && !stillWeightIssue) {
    record.status = STATUS.PENDING;
  }

  saveRecord(record, 'human_patch', { patch, options });
  return record;
}

function getExistingRecord(id) {
  const row = selectById.get(id);
  if (!row) throw new HttpError(404, '记录不存在');
  return rowToRecord(row);
}

function listRecords(filter = 'all') {
  let rs = selectAll.all().map(rowToRecord);
  if (filter === 'human') {
    rs = rs.filter((r) => r.flags && r.flags.humanEdited);
  } else if (filter !== 'all') {
    rs = rs.filter((r) => r.status === filter);
  }
  return rs.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

function getSummary() {
  const out = {
    total: 0,
    cleared: 0,
    pending: 0,
    human: 0,
    hang: 0,
    revoked: 0,
    weightIssues: 0,
    versionConflicts: 0,
  };
  for (const r of listRecords('all')) {
    out.total++;
    if (r.status === STATUS.CLEARED) out.cleared++;
    else if (r.status === STATUS.PENDING) out.pending++;
    else if (r.status === STATUS.HANG) out.hang++;
    else if (r.status === STATUS.REVOKED) out.revoked++;
    if (r.flags && r.flags.humanEdited) out.human++;
    for (const a of r.anomalies) {
      if (a.type === 'weight_mix') out.weightIssues++;
      if (a.type === 'version_conflict') out.versionConflicts++;
    }
  }
  return out;
}

function listAnomalies() {
  const items = [];
  for (const r of listRecords('all')) {
    for (const a of r.anomalies) {
      items.push({
        recordId: r.id,
        ownerWechat: r.ownerWechat,
        animalName: r.latest && r.latest.animalName,
        status: r.status,
        vid: a.vid,
        type: a.type,
        message: a.message,
        diffs: a.diffs || null,
        at: a.at,
      });
    }
  }
  return items.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, '请求体不是有效 JSON');
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

async function sendStatic(res, pathname) {
  const file = pathname === '/' ? '/index.html' : pathname;
  const normalized = path.normalize(file).replace(/^(\.\.[/\\])+/, '');
  const target = path.join(__dirname, normalized);
  if (!target.startsWith(__dirname) || !existsSync(target)) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }
  const ext = path.extname(target).toLowerCase();
  const type = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  }[ext] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  res.end(await readFile(target));
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, database: DB_PATH });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/records') {
    const filter = url.searchParams.get('filter') || 'all';
    sendJson(res, 200, { records: listRecords(filter), summary: getSummary() });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/summary') {
    sendJson(res, 200, getSummary());
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/anomalies') {
    sendJson(res, 200, { anomalies: listAnomalies() });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/records/import') {
    sendJson(res, 201, importRecord(await readJson(req)));
    return;
  }
  if (req.method === 'DELETE' && url.pathname === '/api/records') {
    deleteAllRecords.run();
    insertOperation.run(null, 'clear_all', '{}', nowISO());
    sendJson(res, 200, { ok: true });
    return;
  }

  const actionMatch = url.pathname.match(/^\/api\/records\/([^/]+)\/(confirm|revoke)$/);
  if (req.method === 'POST' && actionMatch) {
    const [, id, action] = actionMatch;
    const payload = await readJson(req);
    const record = action === 'confirm' ? confirmRecord(id, payload) : revokeRecord(id, payload);
    sendJson(res, 200, { record });
    return;
  }

  const patchMatch = url.pathname.match(/^\/api\/records\/([^/]+)$/);
  if (req.method === 'PATCH' && patchMatch) {
    const payload = await readJson(req);
    sendJson(res, 200, {
      record: humanPatchRecord(patchMatch[1], payload.patch || {}, payload.options || {}),
    });
    return;
  }

  sendJson(res, 404, { error: 'API endpoint not found' });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    await sendStatic(res, decodeURIComponent(url.pathname));
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    sendJson(res, status, { error: err.message || 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log(`流浪动物救助回访追踪 API running at http://localhost:${PORT}`);
  console.log(`SQLite database: ${DB_PATH}`);
});
