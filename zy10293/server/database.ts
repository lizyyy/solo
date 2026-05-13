import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(__dirname, '../data/tea.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS raw_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      origin TEXT,
      stock_quantity REAL NOT NULL DEFAULT 0,
      unit TEXT DEFAULT 'g',
      purchase_date TEXT,
      supplier TEXT,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blending_schemes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scheme_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      parent_id INTEGER,
      status TEXT DEFAULT 'draft',
      total_ratio REAL NOT NULL DEFAULT 0,
      estimated_cost REAL,
      description TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES blending_schemes(id)
    );

    CREATE TABLE IF NOT EXISTS blending_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scheme_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      ratio REAL NOT NULL,
      quantity REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (scheme_id) REFERENCES blending_schemes(id),
      FOREIGN KEY (material_id) REFERENCES raw_materials(id),
      UNIQUE(scheme_id, material_id)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE,
      type TEXT,
      preferences TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasting_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_no TEXT UNIQUE NOT NULL,
      scheme_id INTEGER NOT NULL,
      customer_id INTEGER,
      customer_name TEXT,
      tasting_date TEXT NOT NULL,
      location TEXT,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (scheme_id) REFERENCES blending_schemes(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      aroma TEXT,
      taste TEXT,
      aftertaste TEXT,
      suggestions TEXT,
      will_buy INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES tasting_sessions(id),
      UNIQUE(session_id)
    );

    CREATE TABLE IF NOT EXISTS finished_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      scheme_id INTEGER NOT NULL,
      production_date TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT DEFAULT 'g',
      cost_price REAL,
      selling_price REAL,
      status TEXT DEFAULT 'in_stock',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (scheme_id) REFERENCES blending_schemes(id)
    );

    CREATE TABLE IF NOT EXISTS sales_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_no TEXT UNIQUE NOT NULL,
      product_id INTEGER NOT NULL,
      customer_id INTEGER,
      customer_name TEXT,
      sale_date TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total_amount REAL NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES finished_products(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE INDEX IF NOT EXISTS idx_blending_scheme_status ON blending_schemes(status);
    CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedbacks(rating);
    CREATE INDEX IF NOT EXISTS idx_tasting_date ON tasting_sessions(tasting_date);
    CREATE INDEX IF NOT EXISTS idx_sale_date ON sales_records(sale_date);
  `)

  initSampleData()
}

function initSampleData() {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM raw_materials').get() as any
  if (count.cnt > 0) return

  const insertMaterial = db.prepare(`
    INSERT INTO raw_materials (batch_no, name, type, origin, stock_quantity, unit, purchase_date, supplier)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertMaterial.run('BAT202401001', '祁门红茶', '红茶', '安徽黄山', 5000, 'g', '2024-01-15', '黄山茶农合作社')
  insertMaterial.run('BAT202401002', '正山小种', '红茶', '福建武夷山', 3000, 'g', '2024-01-16', '武夷山茶叶有限公司')
  insertMaterial.run('BAT202401003', '龙井绿茶', '绿茶', '浙江杭州', 4000, 'g', '2024-01-17', '杭州龙井茶业')
  insertMaterial.run('BAT202401004', '铁观音', '乌龙茶', '福建安溪', 3500, 'g', '2024-01-18', '安溪铁观音集团')
  insertMaterial.run('BAT202401005', '大红袍', '乌龙茶', '福建武夷山', 2000, 'g', '2024-01-19', '武夷山大红袍厂')
  insertMaterial.run('BAT202401006', '普洱熟茶', '普洱茶', '云南勐海', 6000, 'g', '2024-01-20', '勐海茶厂')

  const insertScheme = db.prepare(`
    INSERT INTO blending_schemes (scheme_no, name, version, status, total_ratio, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  insertScheme.run('BS001V1', '经典祁红拼配', 1, 'approved', 100, '祁门红茶为主，搭配少量正山小种，口感醇厚')
  insertScheme.run('BS001V2', '经典祁红拼配V2', 2, 'approved', 100, '调整比例后，回甘更明显')
  insertScheme.run('BS002V1', '乌龙韵香', 1, 'approved', 100, '铁观音与大红袍的完美结合，香气悠长')
  insertScheme.run('BS003V1', '普洱陈韵', 1, 'draft', 100, '待试饮优化中')

  const insertItem = db.prepare(`
    INSERT INTO blending_items (scheme_id, material_id, ratio, quantity)
    VALUES (?, ?, ?, ?)
  `)

  insertItem.run(1, 1, 70, 700)
  insertItem.run(1, 2, 30, 300)
  insertItem.run(2, 1, 75, 750)
  insertItem.run(2, 2, 25, 250)
  insertItem.run(3, 4, 60, 600)
  insertItem.run(3, 5, 40, 400)
  insertItem.run(4, 6, 100, 1000)

  const insertTasting = db.prepare(`
    INSERT INTO tasting_sessions (session_no, scheme_id, customer_name, tasting_date, location)
    VALUES (?, ?, ?, ?, ?)
  `)

  const customers = ['张先生', '李女士', '王先生', '赵女士', '陈先生', '刘女士', '周先生', '吴女士']
  const locations = ['门店A', '门店B', '品鉴会', '线上试饮']
  
  for (let i = 1; i <= 15; i++) {
    const schemeId = i <= 8 ? 1 : i <= 12 ? 3 : 2
    insertTasting.run(
      `TS${String(i).padStart(4, '0')}`,
      schemeId,
      customers[i % customers.length],
      `2024-0${(i % 4) + 1}-${String((i % 28) + 1).padStart(2, '0')}`,
      locations[i % locations.length]
    )
  }

  const insertFeedback = db.prepare(`
    INSERT INTO feedbacks (session_id, rating, aroma, taste, aftertaste, suggestions, will_buy)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const aromas = ['花香明显', '蜜香悠长', '果香清甜', '兰香优雅', '陈香浓郁']
  const tastes = ['入口醇厚', '鲜爽回甘', '滋味浓郁', '口感柔和', '茶气足']
  const aftertastes = ['回甘持久', '生津明显', '喉韵悠长', '杯香留底', '余味无穷']
  const suggestions = ['', '比例可再微调', '香气可以更突出', '口感稍淡', '建议增加回甘']

  for (let i = 1; i <= 12; i++) {
    const rating = i <= 3 ? 5 : i <= 7 ? 4 : i <= 10 ? 3 : 2
    insertFeedback.run(
      i,
      rating,
      aromas[i % aromas.length],
      tastes[i % tastes.length],
      aftertastes[i % aftertastes.length],
      suggestions[i % suggestions.length],
      rating >= 4 ? 1 : 0
    )
  }

  const insertProduct = db.prepare(`
    INSERT INTO finished_products (product_no, name, scheme_id, production_date, quantity, unit, cost_price, selling_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertProduct.run('FP001', '经典祁红礼盒装', 1, '2024-02-01', 500, '罐', 80, 198)
  insertProduct.run('FP002', '经典祁红V2礼盒', 2, '2024-02-15', 300, '罐', 85, 218)
  insertProduct.run('FP003', '乌龙韵香礼盒', 3, '2024-02-20', 200, '罐', 95, 238)

  const insertSale = db.prepare(`
    INSERT INTO sales_records (sale_no, product_id, customer_name, sale_date, quantity, unit_price, total_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  for (let i = 1; i <= 8; i++) {
    const productId = i <= 4 ? 1 : i <= 6 ? 2 : 3
    const qty = i % 3 + 1
    const price = productId === 1 ? 198 : productId === 2 ? 218 : 238
    insertSale.run(
      `SL${String(i).padStart(4, '0')}`,
      productId,
      customers[i % customers.length],
      `2024-0${(i % 3) + 2}-${String((i % 28) + 1).padStart(2, '0')}`,
      qty,
      price,
      qty * price
    )
  }
}

export default db
