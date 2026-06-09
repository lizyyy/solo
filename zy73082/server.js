const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const initSqlJs = require('sql.js');
const ExcelJS = require('exceljs');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'tracker.db');

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let db;
let SQL;

function saveDB() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (e) {
    console.error('保存数据库失败:', e);
  }
}

setInterval(saveDB, 5000);
process.on('exit', saveDB);
process.on('SIGINT', () => { saveDB(); process.exit(); });

function toNamedParams(sql, params) {
  let i = 0;
  const args = [];
  const converted = sql.replace(/@(\w+)/g, (_, name) => {
    if (params && params.hasOwnProperty(name)) {
      args.push(params[name]);
      return '?';
    }
    const idx = Array.isArray(params) ? (i++) : '?';
    return idx;
  });
  return { sql: converted, args };
}

function prepare(db, sql) {
  function execute(params) {
    const { sql: converted, args } = toNamedParams(sql, params);
    const stmt = db.prepare(converted);
    if (args && args.length) stmt.bind(args);
    return stmt;
  }
  return {
    get(params) {
      const stmt = execute(params);
      const result = stmt.step() ? stmt.getAsObject() : undefined;
      stmt.free();
      return result;
    },
    all(params) {
      const stmt = execute(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },
    run(params) {
      const stmt = execute(params);
      stmt.step();
      const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
      const changes = db.exec('SELECT changes() as c')[0].values[0][0];
      stmt.free();
      return { lastInsertRowid: lastId, changes };
    },
  };
}

function nowStr(offset) {
  const d = new Date();
  if (offset) d.setTime(d.getTime() + offset);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function initDB() {
  SQL = await initSqlJs();
  let fileBuffer = null;
  try {
    if (fs.existsSync(DB_PATH)) {
      fileBuffer = fs.readFileSync(DB_PATH);
    }
  } catch (e) {}

  db = new SQL.Database(fileBuffer);

  db.exec(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_code TEXT NOT NULL,
      material_code TEXT,
      material_name TEXT,
      specification TEXT,
      quantity REAL,
      unit TEXT,
      floor TEXT,
      area TEXT,
      bim_remark TEXT,
      supplementary_remark TEXT,
      verbal_remark TEXT,
      manual_remark TEXT,
      review_remark TEXT,
      conclusion TEXT,
      conclusion_author TEXT,
      conclusion_updated_at TEXT,
      is_collision INTEGER DEFAULT 0,
      is_duplicate INTEGER DEFAULT 0,
      import_batch_id TEXT,
      content_hash TEXT,
      remark_version INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      UNIQUE(node_code, material_code)
    );

    CREATE TABLE IF NOT EXISTS material_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      operator TEXT,
      change_type TEXT,
      changed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      batch_name TEXT,
      operator TEXT,
      total_records INTEGER DEFAULT 0,
      new_records INTEGER DEFAULT 0,
      updated_records INTEGER DEFAULT 0,
      collision_records INTEGER DEFAULT 0,
      skipped_records INTEGER DEFAULT 0,
      created_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_materials_node ON materials(node_code);
    CREATE INDEX IF NOT EXISTS idx_materials_collision ON materials(is_collision);
    CREATE INDEX IF NOT EXISTS idx_history_material ON material_history(material_id);
  `);

  saveDB();
}

function computeContentHash(row) {
  const str = [
    row.node_code, row.material_code, row.material_name,
    row.specification, row.quantity, row.unit, row.floor, row.area,
    row.bim_remark, row.supplementary_remark, row.verbal_remark
  ].map(v => v === null || v === undefined ? '' : String(v)).join('|');
  return crypto.createHash('md5').update(str).digest('hex');
}

function logHistory(materialId, fieldName, oldVal, newVal, operator, changeType) {
  if (String(oldVal || '') === String(newVal || '')) return;
  const stmt = prepare(db, `
    INSERT INTO material_history (material_id, field_name, old_value, new_value, operator, change_type, changed_at)
    VALUES (@mid, @fn, @ov, @nv, @op, @ct, @ca)
  `);
  stmt.run({
    mid: materialId,
    fn: fieldName,
    ov: String(oldVal || ''),
    nv: String(newVal || ''),
    op: operator || '系统',
    ct: changeType || 'update',
    ca: nowStr()
  });
}

function execTransaction(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    saveDB();
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

app.get('/api/materials', (req, res) => {
  const { collision_only = 'false', keyword = '', page = 1, pageSize = 50 } = req.query;
  const offset = (page - 1) * pageSize;
  
  let whereClauses = [];
  let params = {};
  
  if (collision_only === 'true') {
    whereClauses.push('(is_collision = 1 OR is_duplicate = 1)');
  }
  
  if (keyword) {
    whereClauses.push(`(
      node_code LIKE @kw OR
      material_code LIKE @kw OR
      material_name LIKE @kw OR
      specification LIKE @kw OR
      bim_remark LIKE @kw OR
      manual_remark LIKE @kw OR
      review_remark LIKE @kw OR
      conclusion LIKE @kw
    )`);
    params.kw = `%${keyword}%`;
  }
  
  const whereSQL = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
  
  const totalRow = prepare(db, `SELECT COUNT(*) as cnt FROM materials ${whereSQL}`).get(params);
  const total = totalRow ? (totalRow.cnt || 0) : 0;
  
  const rows = prepare(db, `
    SELECT * FROM materials ${whereSQL}
    ORDER BY 
      is_collision DESC,
      is_duplicate DESC,
      updated_at DESC,
      id DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: Number(pageSize), offset: Number(offset) });
  
  res.json({ data: rows, total, page: Number(page), pageSize: Number(pageSize) });
});

app.get('/api/materials/stats', (req, res) => {
  const r = prepare(db, `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_collision = 1 OR is_duplicate = 1 THEN 1 ELSE 0 END) as collision_count,
      SUM(CASE WHEN conclusion IS NOT NULL AND conclusion != '' THEN 1 ELSE 0 END) as concluded_count,
      SUM(CASE WHEN manual_remark IS NOT NULL AND manual_remark != '' THEN 1 ELSE 0 END) as manual_remarked_count
    FROM materials
  `).get();
  res.json({
    total: Number(r.total) || 0,
    collision_count: Number(r.collision_count) || 0,
    concluded_count: Number(r.concluded_count) || 0,
    manual_remarked_count: Number(r.manual_remarked_count) || 0,
  });
});

app.get('/api/materials/:id', (req, res) => {
  const row = prepare(db, 'SELECT * FROM materials WHERE id = @id').get({ id: req.params.id });
  if (!row) return res.status(404).json({ error: '记录不存在' });
  res.json(row);
});

app.get('/api/materials/:id/history', (req, res) => {
  const history = prepare(db, `
    SELECT * FROM material_history 
    WHERE material_id = @mid 
    ORDER BY changed_at DESC, id DESC
  `).all({ mid: req.params.id });
  res.json(history);
});

app.put('/api/materials/:id', (req, res) => {
  const { id } = req.params;
  const body = req.body;
  const operator = body.operator || '复核人';
  
  const existing = prepare(db, 'SELECT * FROM materials WHERE id = @id').get({ id });
  if (!existing) return res.status(404).json({ error: '记录不存在' });
  
  const result = execTransaction(() => {
    const updatableFields = [
      'material_name', 'specification', 'quantity', 'unit', 'floor', 'area',
      'bim_remark', 'supplementary_remark', 'verbal_remark', 'manual_remark',
      'review_remark', 'conclusion', 'is_collision', 'is_duplicate'
    ];
    
    let updates = [];
    let params = {};
    let conclusionChanged = false;
    
    updatableFields.forEach(field => {
      if (body.hasOwnProperty(field) && body[field] !== undefined) {
        const oldVal = existing[field];
        let newVal = body[field];
        if (typeof newVal === 'boolean') newVal = newVal ? 1 : 0;
        if (String(oldVal || '') !== String(newVal || '')) {
          updates.push(`${field} = @${field}`);
          params[field] = newVal;
          
          let changeType = 'update';
          if (field === 'conclusion') { changeType = 'conclusion_change'; conclusionChanged = true; }
          if (['bim_remark', 'supplementary_remark', 'verbal_remark', 'manual_remark', 'review_remark'].includes(field)) {
            changeType = 'remark_change';
          }
          
          logHistory(id, field, oldVal, newVal, operator, changeType);
        }
      }
    });
    
    if (updates.length === 0) {
      return { updated: 0, id };
    }
    
    if (conclusionChanged) {
      updates.push('conclusion_author = @conclusion_author');
      updates.push('conclusion_updated_at = @conclusion_updated_at');
      params.conclusion_author = operator;
      params.conclusion_updated_at = nowStr();
    }
    
    updates.push('remark_version = remark_version + 1');
    updates.push('updated_at = @updated_at');
    params.updated_at = nowStr();
    params.id = id;
    
    const { sql: converted, args } = toNamedParams(
      `UPDATE materials SET ${updates.join(', ')} WHERE id = @id`,
      params
    );
    db.run(converted, args);
    
    return { updated: 1, id };
  });
  
  const updated = prepare(db, 'SELECT * FROM materials WHERE id = @id').get({ id });
  res.json({ ...result, data: updated });
});

app.post('/api/import', (req, res) => {
  const { records, batch_name = '手动导入', operator = '阿乔' } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: '导入数据为空' });
  }
  
  const batchId = 'BATCH_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  
  const result = execTransaction(() => {
    let newCount = 0;
    let updatedCount = 0;
    let collisionCount = 0;
    let skippedCount = 0;
    
    const insertStmt = prepare(db, `
      INSERT INTO materials (
        node_code, material_code, material_name, specification, quantity, unit,
        floor, area, bim_remark, supplementary_remark, verbal_remark,
        is_collision, is_duplicate, import_batch_id, content_hash, remark_version,
        created_at, updated_at
      ) VALUES (
        @node_code, @material_code, @material_name, @specification, @quantity, @unit,
        @floor, @area, @bim_remark, @supplementary_remark, @verbal_remark,
        0, 0, @import_batch_id, @content_hash, 1,
        @created_at, @updated_at
      )
    `);
    
    records.forEach(rec => {
      const nodeCode = String(rec.node_code || rec.node || '').trim();
      const materialCode = String(rec.material_code || rec.code || '').trim();
      
      if (!nodeCode) { skippedCount++; return; }
      
      const now = nowStr();
      const row = {
        node_code: nodeCode,
        material_code: materialCode || null,
        material_name: String(rec.material_name || rec.name || '').trim() || null,
        specification: String(rec.specification || rec.spec || '').trim() || null,
        quantity: rec.quantity !== undefined ? Number(rec.quantity) : null,
        unit: String(rec.unit || '').trim() || null,
        floor: String(rec.floor || '').trim() || null,
        area: String(rec.area || '').trim() || null,
        bim_remark: String(rec.bim_remark || rec.bim || '').trim() || null,
        supplementary_remark: String(rec.supplementary_remark || rec.supp || '').trim() || null,
        verbal_remark: String(rec.verbal_remark || rec.verbal || '').trim() || null,
        import_batch_id: batchId,
        content_hash: '',
        created_at: now,
        updated_at: now,
      };
      row.content_hash = computeContentHash(row);
      
      let existing = null;
      const findByCode = prepare(db, `
        SELECT * FROM materials WHERE node_code = @nc AND material_code = @mc LIMIT 1
      `).get({ nc: nodeCode, mc: materialCode || null });
      
      if (findByCode) {
        existing = findByCode;
      } else if (!materialCode) {
        const findByNode = prepare(db, `
          SELECT * FROM materials WHERE node_code = @nc AND (material_code IS NULL OR material_code = '') LIMIT 1
        `).get({ nc: nodeCode });
        if (findByNode) existing = findByNode;
      }
      
      if (existing) {
        if (existing.content_hash === row.content_hash) {
          skippedCount++;
          return;
        }
        
        let hasCollision = false;
        const remarkFields = ['bim_remark', 'supplementary_remark', 'verbal_remark'];
        const fieldChanges = [];
        
        remarkFields.forEach(field => {
          const oldV = existing[field] || '';
          const newV = row[field] || '';
          if (oldV && newV && oldV !== newV && !oldV.includes(newV) && !newV.includes(oldV)) {
            hasCollision = true;
            fieldChanges.push(field);
          }
        });
        
        const updates = [];
        const uparams = {};
        
        ['material_name', 'specification', 'quantity', 'unit', 'floor', 'area'].forEach(f => {
          if (row[f] !== null && row[f] !== undefined && row[f] !== '' && 
              String(existing[f] || '') !== String(row[f] || '')) {
            updates.push(`${f} = @${f}`);
            uparams[f] = row[f];
            logHistory(existing.id, f, existing[f], row[f], operator, 'import_update');
          }
        });
        
        remarkFields.forEach(f => {
          if (row[f]) {
            const existingVal = existing[f] || '';
            if (!existingVal) {
              updates.push(`${f} = @${f}`);
              uparams[f] = row[f];
              logHistory(existing.id, f, existingVal, row[f], operator, 'remark_append');
            } else if (!existingVal.includes(row[f])) {
              const merged = existingVal + `\n[${batch_name}] ${row[f]}`;
              updates.push(`${f} = @${f}`);
              uparams[f] = merged;
              logHistory(existing.id, f, existingVal, merged, operator,
                hasCollision && fieldChanges.includes(f) ? 'collision_merge' : 'remark_append');
            }
          }
        });
        
        if (hasCollision || existing.is_collision === 1) {
          const finalCol = true;
        }
        
        if (hasCollision) {
          updates.push('is_collision = 1');
          collisionCount++;
        }
        
        if (updates.length > 0 || hasCollision) {
          const mergedRow = { ...existing };
          Object.keys(uparams).forEach(k => mergedRow[k] = uparams[k]);
          const newHash = computeContentHash(mergedRow);
          if (!updates.find(u => u.startsWith('content_hash'))) {
            updates.push('content_hash = @content_hash');
            uparams.content_hash = newHash;
          }
          updates.push('remark_version = remark_version + 1');
          updates.push('updated_at = @updated_at');
          uparams.updated_at = nowStr();
          uparams.id = existing.id;
          
          const { sql: converted, args } = toNamedParams(
            `UPDATE materials SET ${updates.join(', ')} WHERE id = @id`,
            uparams
          );
          db.run(converted, args);
          updatedCount++;
        } else {
          skippedCount++;
        }
      } else {
        try {
          const info = insertStmt.run(row);
          newCount++;
          const newId = info.lastInsertRowid;
          
          const remarkFields = ['bim_remark', 'supplementary_remark', 'verbal_remark'];
          remarkFields.forEach(f => {
            if (row[f]) {
              logHistory(newId, f, '', row[f], operator, 'initial');
            }
          });
        } catch (e) {
          if (e.message.includes('UNIQUE') || e.message.includes('constraint')) {
            collisionCount++;
            try {
              const { sql, args } = toNamedParams(
                `UPDATE materials SET is_duplicate = 1, updated_at = @ua WHERE node_code = @nc AND (material_code = @mc OR (material_code IS NULL AND @mc IS NULL))`,
                { ua: nowStr(), nc: nodeCode, mc: materialCode || null }
              );
              db.run(sql, args);
            } catch (_) {}
          }
          skippedCount++;
        }
      }
    });
    
    prepare(db, `
      INSERT INTO import_batches (id, batch_name, operator, total_records, new_records, updated_records, collision_records, skipped_records, created_at)
      VALUES (@id, @bn, @op, @tr, @nr, @ur, @cr, @sr, @ca)
    `).run({
      id: batchId, bn: batch_name, op: operator,
      tr: records.length, nr: newCount, ur: updatedCount, cr: collisionCount, sr: skippedCount,
      ca: nowStr()
    });
    
    return { batchId, total: records.length, newCount, updatedCount, collisionCount, skippedCount };
  });
  
  res.json(result);
});

app.get('/api/batches', (req, res) => {
  const rows = prepare(db, 'SELECT * FROM import_batches ORDER BY created_at DESC LIMIT 50').all();
  res.json(rows);
});

app.get('/api/export', async (req, res) => {
  const { collision_only = 'false' } = req.query;
  
  let sql = 'SELECT * FROM materials';
  if (collision_only === 'true') sql += ' WHERE is_collision = 1 OR is_duplicate = 1';
  sql += ' ORDER BY is_collision DESC, is_duplicate DESC, node_code';
  
  const rows = prepare(db, sql).all();
  
  const workbook = new ExcelJS.Workbook();
  const sheetName = collision_only === 'true' ? '碰撞记录' : '材料追踪';
  const ws = workbook.addWorksheet(sheetName);
  
  ws.columns = [
    { header: '节点编号', key: 'node_code', width: 18 },
    { header: '材料编码', key: 'material_code', width: 18 },
    { header: '材料名称', key: 'material_name', width: 20 },
    { header: '规格型号', key: 'specification', width: 22 },
    { header: '数量', key: 'quantity', width: 10 },
    { header: '单位', key: 'unit', width: 8 },
    { header: '楼层', key: 'floor', width: 10 },
    { header: '区域', key: 'area', width: 12 },
    { header: 'BIM模型备注', key: 'bim_remark', width: 35 },
    { header: '后补备注', key: 'supplementary_remark', width: 35 },
    { header: '口头说明', key: 'verbal_remark', width: 30 },
    { header: '人工备注(复核)', key: 'manual_remark', width: 30 },
    { header: '复核备注', key: 'review_remark', width: 30 },
    { header: '结论', key: 'conclusion', width: 25 },
    { header: '结论修改人', key: 'conclusion_author', width: 12 },
    { header: '结论更新时间', key: 'conclusion_updated_at', width: 22 },
    { header: '是否碰撞', key: 'is_collision', width: 10 },
    { header: '是否重复', key: 'is_duplicate', width: 10 },
    { header: '备注版本', key: 'remark_version', width: 10 },
    { header: '更新时间', key: 'updated_at', width: 22 },
  ];
  
  rows.forEach(r => {
    ws.addRow({
      ...r,
      is_collision: r.is_collision ? '是' : '否',
      is_duplicate: r.is_duplicate ? '是' : '否',
    });
  });
  
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  
  ws.eachRow((row, rowNum) => {
    if (rowNum > 1) {
      const rec = rows[rowNum - 2];
      if (rec && (rec.is_collision || rec.is_duplicate)) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      }
      row.alignment = { vertical: 'top', wrapText: true };
    }
  });
  
  ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columnCount } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  
  const filename = `幕墙节点材料追踪_${new Date().toISOString().slice(0,10)}${collision_only === 'true' ? '_碰撞' : ''}.xlsx`;
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  
  await workbook.xlsx.write(res);
  res.end();
});

app.get('/api/export/csv', (req, res) => {
  const { collision_only = 'false' } = req.query;
  let sql = 'SELECT * FROM materials';
  if (collision_only === 'true') sql += ' WHERE is_collision = 1 OR is_duplicate = 1';
  sql += ' ORDER BY is_collision DESC, is_duplicate DESC, node_code';
  const rows = prepare(db, sql).all();
  
  const headers = ['节点编号','材料编码','材料名称','规格型号','数量','单位','楼层','区域',
    'BIM模型备注','后补备注','口头说明','人工备注(复核)','复核备注','结论','结论修改人','结论更新时间',
    '是否碰撞','是否重复','备注版本','更新时间'];
  const keys = ['node_code','material_code','material_name','specification','quantity','unit','floor','area',
    'bim_remark','supplementary_remark','verbal_remark','manual_remark','review_remark','conclusion','conclusion_author','conclusion_updated_at',
    'is_collision','is_duplicate','remark_version','updated_at'];
  
  const esc = v => {
    const s = v === null || v === undefined ? '' : String(v);
    return '"' + s.replace(/"/g, '""') + '"';
  };
  
  const lines = [headers.map(esc).join(',')];
  rows.forEach(r => {
    const copy = { ...r, is_collision: r.is_collision ? '是' : '否', is_duplicate: r.is_duplicate ? '是' : '否' };
    lines.push(keys.map(k => esc(copy[k])).join(','));
  });
  
  const filename = `幕墙节点材料追踪_${new Date().toISOString().slice(0,10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send('\ufeff' + lines.join('\n'));
});

app.post('/api/seed-demo', (req, res) => {
  const demoRecords = [
    { node_code: 'CW-N-001', material_code: 'AL-6063-01', material_name: '铝合金竖梃', specification: '6063-T5 120x60x3', quantity: 120, unit: 'm', floor: '3F-15F', area: '东立面', bim_remark: 'BIM模型V2.1定义，竖梃间距1.5m', supplementary_remark: '', verbal_remark: '' },
    { node_code: 'CW-N-001', material_code: 'GL-TP-01', material_name: '钢化中空玻璃', specification: '10+12A+10 Low-E', quantity: 240, unit: 'm²', floor: '3F-15F', area: '东立面', bim_remark: 'BIM模型V2.1，玻璃板块1500x2400', supplementary_remark: '变更单#003：V3版改为12+12A+12', verbal_remark: '阿乔口头：先按新规格下单，正式变更下周到' },
    { node_code: 'CW-N-002', material_code: 'AL-6063-02', material_name: '铝合金横梃', specification: '6063-T5 80x40x2.5', quantity: 300, unit: 'm', floor: '3F-15F', area: '东立面', bim_remark: 'BIM模型V2.1横梃', supplementary_remark: '', verbal_remark: '' },
    { node_code: 'CW-N-003', material_code: 'SS-304-01', material_name: '不锈钢转接件', specification: '304 200x150x8', quantity: 960, unit: '件', floor: '3F-15F', area: '东、南立面', bim_remark: 'BIM模型V2.1埋件转接系统', supplementary_remark: '变更单#007：转接件厚度由6mm增至8mm', verbal_remark: '' },
    { node_code: 'CW-N-004', material_code: 'GL-TP-02', material_name: '钢化夹胶玻璃(雨棚)', specification: '10+1.52PVB+10', quantity: 85, unit: 'm²', floor: '1F入口', area: '南入口雨棚', bim_remark: 'BIM模型V2.1入口雨棚', supplementary_remark: '', verbal_remark: '阿乔口头：雨棚玻璃需考虑雪荷载，复核厚度是否足够' },
    { node_code: 'CW-N-005', material_code: 'AL-6063-03', material_name: '铝合金装饰扣盖', specification: '6063-T5 氟碳喷涂银色', quantity: 800, unit: 'm', floor: '3F-15F', area: '全周', bim_remark: 'BIM模型V2.1装饰线条', supplementary_remark: '', verbal_remark: '' },
    { node_code: 'CW-N-006', material_code: 'SL-201-01', material_name: '硅酮密封胶', specification: '中性耐候 590ml', quantity: 2400, unit: '支', floor: '全部', area: '全部', bim_remark: 'BIM模型V2.1注胶系统', supplementary_remark: '变更单#005：品牌由供应商A改为B', verbal_remark: '' },
    { node_code: 'CW-N-007', material_code: 'AL-6063-04', material_name: '铝合金开启扇料', specification: '6063-T5 断热', quantity: 48, unit: '樘', floor: '5F/10F/15F', area: '可开启区域', bim_remark: 'BIM模型V2.1开启扇', supplementary_remark: '变更单#011：增加限位装置', verbal_remark: '阿乔口头：开启扇五金件要与样板一致' },
    { node_code: 'CW-N-003', material_code: 'SS-304-01-R', material_name: '不锈钢转接件(重复上传)', specification: '304 200x150x8', quantity: 960, unit: '件', floor: '3F-15F', area: '东、南立面', bim_remark: 'BIM模型V3.0重新上传，疑似与V2版本的SS-304-01重复', supplementary_remark: '', verbal_remark: '' },
    { node_code: 'CW-N-008', material_code: 'TP-BKT-01', material_name: '碳钢后置埋板', specification: 'Q235B 300x200x10 热浸镀锌', quantity: 720, unit: '块', floor: '3F-15F', area: '全周', bim_remark: 'BIM模型V2.1后置埋件', supplementary_remark: '补充：化学锚栓规格M12x160，每块4套', verbal_remark: '' },
    { node_code: 'CW-N-009', material_code: 'IN-WS-01', material_name: '保温棉', specification: '岩棉 50mm 密度100kg/m³', quantity: 1200, unit: 'm²', floor: '各层梁位', area: '全周', bim_remark: 'BIM模型V2.1层间保温', supplementary_remark: '', verbal_remark: '' },
    { node_code: 'CW-N-010', material_code: 'DR-AL-01', material_name: '铝单板(背衬)', specification: '2.5mm 氟碳喷涂', quantity: 600, unit: 'm²', floor: '各层梁位', area: '全周', bim_remark: 'BIM模型V2.1层间背衬', supplementary_remark: '变更单#009：背衬板颜色由银灰改为深灰', verbal_remark: '' },
  ];
  
  const result = execTransaction(() => {
    db.exec('DELETE FROM material_history');
    db.exec('DELETE FROM materials');
    db.exec('DELETE FROM import_batches');
    
    const batchId = 'BATCH_DEMO_' + Date.now();
    const now = nowStr();
    let count = 0;
    let collisions = 0;
    const seenCode = new Set();
    const seenSpec = new Map();
    
    const insertStmt = prepare(db, `
      INSERT INTO materials (
        node_code, material_code, material_name, specification, quantity, unit,
        floor, area, bim_remark, supplementary_remark, verbal_remark,
        is_collision, is_duplicate, import_batch_id, content_hash, remark_version,
        created_at, updated_at
      ) VALUES (
        @node_code, @material_code, @material_name, @specification, @quantity, @unit,
        @floor, @area, @bim_remark, @supplementary_remark, @verbal_remark,
        @is_collision, @is_duplicate, @import_batch_id, @content_hash, @remark_version,
        @created_at, @updated_at
      )
    `);
    
    demoRecords.forEach(rec => {
      const codeKey = rec.node_code + '|' + (rec.material_code || '');
      const specKey = rec.node_code + '|' + (rec.specification || '');
      const isDup = seenCode.has(codeKey) || seenSpec.has(specKey);
      if (isDup) collisions++;
      seenCode.add(codeKey);
      seenSpec.set(specKey, true);
      
      const row = {
        ...rec,
        is_collision: isDup ? 1 : 0,
        is_duplicate: isDup ? 1 : 0,
        import_batch_id: batchId,
        remark_version: 1,
        content_hash: '',
        created_at: now,
        updated_at: now,
      };
      row.content_hash = computeContentHash(row);
      const info = insertStmt.run(row);
      count++;
      
      const newId = info.lastInsertRowid;
      ['bim_remark', 'supplementary_remark', 'verbal_remark'].forEach(f => {
        if (rec[f]) {
          logHistory(newId, f, '', rec[f], '阿乔', 'initial');
        }
      });
    });
    
    prepare(db, `INSERT INTO import_batches (id, batch_name, operator, total_records, new_records, collision_records, created_at)
      VALUES (@id, @bn, @op, @tr, @nr, @cr, @ca)`).run({
      id: batchId, bn: '演示数据初始化', op: '系统',
      tr: demoRecords.length, nr: count, cr: collisions, ca: nowStr()
    });
    
    const now2 = nowStr();
    const now3 = nowStr(-3 * 3600 * 1000);
    db.run(`UPDATE materials SET 
      review_remark = ?,
      manual_remark = ?,
      conclusion = ?,
      conclusion_author = ?,
      conclusion_updated_at = ?,
      remark_version = remark_version + 1,
      updated_at = ?
      WHERE node_code = ? AND material_code = ?`,
      ['已复核材料口径，与变更单#003一致，等待现场确认厚度',
       '复核人注：玻璃规格变更是关键变更，需做专项技术交底',
       '同意按变更单#003执行，玻璃厚度升级为12+12A+12',
       '复核人', now2, now2,
       'CW-N-001', 'GL-TP-01']
    );
    
    const m1 = prepare(db, `SELECT id FROM materials WHERE node_code = @nc AND material_code = @mc`).get({ nc: 'CW-N-001', mc: 'GL-TP-01' });
    if (m1) {
      logHistory(m1.id, 'review_remark', '', '已复核材料口径，与变更单#003一致，等待现场确认厚度', '复核人', 'remark_change');
      logHistory(m1.id, 'manual_remark', '', '复核人注：玻璃规格变更是关键变更，需做专项技术交底', '复核人', 'remark_change');
      logHistory(m1.id, 'conclusion', '', '同意按变更单#003执行，玻璃厚度升级为12+12A+12', '复核人', 'conclusion_change');
    }
    
    db.run(`UPDATE materials SET 
      conclusion = ?,
      conclusion_author = ?,
      conclusion_updated_at = ?,
      remark_version = remark_version + 1,
      updated_at = ?
      WHERE node_code = ? AND material_code = ? AND is_duplicate = 0`,
      ['转接件厚度升级确认，按8mm执行，注意焊接工艺', '阿乔', now3, now3,
       'CW-N-003', 'SS-304-01']
    );
    
    const m2 = prepare(db, `SELECT id FROM materials WHERE node_code = @nc AND material_code = @mc AND is_duplicate = 0`).get({ nc: 'CW-N-003', mc: 'SS-304-01' });
    if (m2) {
      logHistory(m2.id, 'conclusion', '', '转接件厚度升级确认，按8mm执行，注意焊接工艺', '阿乔', 'conclusion_change');
    }
    
    return { inserted: count, collisions };
  });
  
  saveDB();
  res.json({ message: '演示数据已初始化', ...result });
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`幕墙节点材料追踪系统已启动: http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
