import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'materials.json');

export interface DBRowMaterial {
  id: string;
  material_code: string;
  material_name: string;
  specification: string;
  quantity: number;
  unit: string;
  project_name: string;
  layer_code: string;
  position: string;
  status: string;
  collision_point: string;
  cad_note: string;
  cad_judgment_change: string;
  change_order_no: string;
  change_order_reason: string;
  change_order_impact: string;
  manual_note: string;
  import_batch_no: string;
  created_at: string;
  updated_at: string;
}

export interface DBRowHistory {
  id: string;
  material_id: string;
  material_code: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  field_changes: string;
  operator: string;
  remark: string;
  created_at: string;
}

interface DBFile {
  materials: DBRowMaterial[];
  history: DBRowHistory[];
  version: number;
}

const DEFAULT_DB: DBFile = {
  materials: [],
  history: [],
  version: 1,
};

let cache: DBFile | null = null;
let lastRead = 0;
const CACHE_TTL = 50;

function readDB(): DBFile {
  const now = Date.now();
  if (cache && now - lastRead < CACHE_TTL && fs.existsSync(DB_PATH)) {
    return cache;
  }
  if (!fs.existsSync(DB_PATH)) {
    const init: DBFile = JSON.parse(JSON.stringify(DEFAULT_DB));
    const now2 = new Date().toISOString();
    init.materials = [
      {
        id: 'seed-001',
        material_code: 'JG-2024-001',
        material_name: '碳纤维布I级300g',
        specification: '300g/m², 宽100mm',
        quantity: 120,
        unit: 'm²',
        project_name: '滨江大厦结构加固',
        layer_code: 'LAYER-CFRP-01',
        position: '3层梁底B3-05',
        status: 'normal',
        collision_point: '',
        cad_note: '',
        cad_judgment_change: '',
        change_order_no: '',
        change_order_reason: '',
        change_order_impact: '',
        manual_note: '旧材料导入，与原清单一致',
        import_batch_no: 'SEED-INIT',
        created_at: now2,
        updated_at: now2,
      },
      {
        id: 'seed-002',
        material_code: 'JG-2024-002',
        material_name: '粘钢胶JGN型',
        specification: 'A+B组分, 20kg/组',
        quantity: 15,
        unit: '组',
        project_name: '滨江大厦结构加固',
        layer_code: 'LAYER-STEEL-02',
        position: '4层柱包钢C4-12',
        status: 'pending',
        collision_point: '',
        cad_note: '',
        cad_judgment_change: '',
        change_order_no: '',
        change_order_reason: '',
        change_order_impact: '',
        manual_note: '',
        import_batch_no: 'SEED-INIT',
        created_at: now2,
        updated_at: now2,
      },
      {
        id: 'seed-003',
        material_code: 'JG-2024-003',
        material_name: '植筋胶HRK-500',
        specification: '注射式, 360ml/支',
        quantity: 80,
        unit: '支',
        project_name: '滨江大厦结构加固',
        layer_code: 'LAYER-BAR-01',
        position: '5层板植筋B5-23区',
        status: 'rejudged',
        collision_point: '',
        cad_note: '',
        cad_judgment_change: '',
        change_order_no: '',
        change_order_reason: '',
        change_order_impact: '',
        manual_note: '',
        import_batch_no: 'SEED-INIT',
        created_at: now2,
        updated_at: now2,
      },
    ];
    init.history = init.materials.map((m, i) => ({
      id: `seed-h-${i + 1}`,
      material_id: m.id,
      material_code: m.material_code,
      action: 'csv_import',
      old_status: null,
      new_status: m.status,
      field_changes: '{}',
      operator: '阿宁',
      remark: '系统初始化种子数据',
      created_at: now2,
    }));
    fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2), 'utf8');
    cache = init;
    lastRead = Date.now();
    return cache;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    cache = JSON.parse(raw) as DBFile;
  } catch {
    cache = JSON.parse(JSON.stringify(DEFAULT_DB));
  }
  lastRead = Date.now();
  return cache;
}

function writeDB(db: DBFile) {
  cache = db;
  lastRead = Date.now();
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_PATH);
}

function buildWhere(
  rows: DBRowMaterial[],
  where: { keyword?: string; status?: string; project?: string; layer?: string },
): DBRowMaterial[] {
  let result = rows;
  if (where.keyword) {
    const kw = where.keyword.toLowerCase();
    result = result.filter(r =>
      r.material_code.toLowerCase().includes(kw) ||
      r.material_name.toLowerCase().includes(kw) ||
      r.specification.toLowerCase().includes(kw) ||
      r.position.toLowerCase().includes(kw) ||
      r.project_name.toLowerCase().includes(kw),
    );
  }
  if (where.status) result = result.filter(r => r.status === where.status);
  if (where.project) result = result.filter(r => r.project_name === where.project);
  if (where.layer) result = result.filter(r => r.layer_code === where.layer);
  return result;
}

export const db = {
  // Materials
  countMaterials(where: { keyword?: string; status?: string; project?: string; layer?: string } = {}) {
    return buildWhere(readDB().materials, where).length;
  },
  queryMaterials(params: {
    keyword?: string;
    status?: string;
    project?: string;
    layer?: string;
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDir?: 'asc' | 'desc';
  } = {}) {
    const { page = 1, pageSize = 20, orderBy = 'updated_at', orderDir = 'desc' } = params;
    const db0 = readDB();
    let rows = buildWhere(db0.materials, params);
    rows = [...rows].sort((a, b) => {
      const va = (a as any)[orderBy] ?? '';
      const vb = (b as any)[orderBy] ?? '';
      return orderDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    const total = rows.length;
    const start = (page - 1) * pageSize;
    return { total, data: rows.slice(start, start + pageSize) };
  },
  getMaterialById(id: string): DBRowMaterial | undefined {
    return readDB().materials.find(m => m.id === id);
  },
  getMaterialByCode(code: string): DBRowMaterial | undefined {
    return readDB().materials.find(m => m.material_code === code);
  },
  insertMaterial(row: DBRowMaterial) {
    const db0 = readDB();
    if (db0.materials.some(m => m.material_code === row.material_code)) {
      throw new Error(`材料编号已存在：${row.material_code}`);
    }
    db0.materials.push(row);
    writeDB(db0);
  },
  updateMaterial(id: string, patch: Partial<DBRowMaterial>) {
    const db0 = readDB();
    const idx = db0.materials.findIndex(m => m.id === id);
    if (idx === -1) return null;
    db0.materials[idx] = { ...db0.materials[idx], ...patch, id, updated_at: patch.updated_at || db0.materials[idx].updated_at };
    writeDB(db0);
    return db0.materials[idx];
  },
  countHistory(where: { action?: string; keyword?: string } = {}) {
    let rows = readDB().history;
    if (where.action) rows = rows.filter(h => h.action === where.action);
    if (where.keyword) {
      const kw = where.keyword.toLowerCase();
      rows = rows.filter(h =>
        h.material_code.toLowerCase().includes(kw) ||
        h.remark.toLowerCase().includes(kw) ||
        h.operator.toLowerCase().includes(kw),
      );
    }
    return rows.length;
  },
  queryHistory(params: {
    action?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  } = {}) {
    const { page = 1, pageSize = 50 } = params;
    let rows = readDB().history;
    if (params.action) rows = rows.filter(h => h.action === params.action);
    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      rows = rows.filter(h =>
        h.material_code.toLowerCase().includes(kw) ||
        h.remark.toLowerCase().includes(kw) ||
        h.operator.toLowerCase().includes(kw),
      );
    }
    rows = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const total = rows.length;
    const start = (page - 1) * pageSize;
    return { total, data: rows.slice(start, start + pageSize) };
  },
  getHistoryByMaterialId(materialId: string): DBRowHistory[] {
    return readDB().history
      .filter(h => h.material_id === materialId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  insertHistory(row: DBRowHistory) {
    const db0 = readDB();
    db0.history.push(row);
    writeDB(db0);
  },
  getAllMaterials(): DBRowMaterial[] {
    return readDB().materials.slice().sort((a, b) => a.material_code.localeCompare(b.material_code));
  },
  getMaterialStats(): Record<string, number> {
    const result: Record<string, number> = {
      pending: 0, normal: 0, rejudged: 0, changing: 0, archived: 0,
    };
    for (const m of readDB().materials) {
      if (m.status in result) result[m.status]++;
    }
    return result;
  },
  // placeholder for original `db.prepare` usage (not used)
  prepare: undefined as any,
  exec: undefined as any,
  pragma: (_: string) => {},
};

export default db;
