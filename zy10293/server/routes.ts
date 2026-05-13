import { Router, Request, Response } from 'express'
import db from './database'
import dayjs from 'dayjs'

const router = Router()

function generateNo(prefix: string): string {
  const timestamp = dayjs().format('YYYYMMDDHHmmss')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `${prefix}${timestamp}${random}`
}

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

router.get('/materials', (req: Request, res: Response) => {
  const { type, keyword } = req.query
  let sql = 'SELECT * FROM raw_materials WHERE 1=1'
  const params: any[] = []
  
  if (type) {
    sql += ' AND type = ?'
    params.push(type)
  }
  if (keyword) {
    sql += ' AND (name LIKE ? OR batch_no LIKE ? OR origin LIKE ?)'
    const kw = `%${keyword}%`
    params.push(kw, kw, kw)
  }
  sql += ' ORDER BY created_at DESC'
  
  const materials = db.prepare(sql).all(...params)
  res.json(materials)
})

router.post('/materials', (req: Request, res: Response) => {
  const { batch_no, name, type, origin, stock_quantity, unit, purchase_date, supplier, description } = req.body
  
  const existing = db.prepare('SELECT id FROM raw_materials WHERE batch_no = ?').get(batch_no)
  if (existing) {
    return res.status(400).json({ error: '批次号已存在', code: 'DUPLICATE_BATCH' })
  }
  
  const stmt = db.prepare(`
    INSERT INTO raw_materials (batch_no, name, type, origin, stock_quantity, unit, purchase_date, supplier, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(batch_no, name, type, origin, stock_quantity || 0, unit || 'g', purchase_date, supplier, description)
  
  res.json({ id: result.lastInsertRowid, ...req.body })
})

router.put('/materials/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const { name, type, origin, stock_quantity, unit, purchase_date, supplier, description } = req.body
  
  const stmt = db.prepare(`
    UPDATE raw_materials 
    SET name = ?, type = ?, origin = ?, stock_quantity = ?, unit = ?, purchase_date = ?, supplier = ?, description = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  stmt.run(name, type, origin, stock_quantity, unit, purchase_date, supplier, description, id)
  
  res.json({ success: true })
})

router.get('/schemes', (req: Request, res: Response) => {
  const { status, keyword } = req.query
  let sql = `
    SELECT s.*, 
           COUNT(DISTINCT t.id) as tasting_count,
           COUNT(DISTINCT f.id) as feedback_count,
           AVG(f.rating) as avg_rating
    FROM blending_schemes s
    LEFT JOIN tasting_sessions t ON s.id = t.scheme_id
    LEFT JOIN feedbacks f ON t.id = f.session_id
    WHERE 1=1
  `
  const params: any[] = []
  
  if (status && status !== 'all') {
    sql += ' AND s.status = ?'
    params.push(status)
  }
  if (keyword) {
    sql += ' AND (s.name LIKE ? OR s.scheme_no LIKE ?)'
    const kw = `%${keyword}%`
    params.push(kw, kw)
  }
  sql += ' GROUP BY s.id ORDER BY s.created_at DESC'
  
  const schemes = db.prepare(sql).all(...params)
  res.json(schemes)
})

router.get('/schemes/:id', (req: Request, res: Response) => {
  const { id } = req.params
  
  const scheme = db.prepare('SELECT * FROM blending_schemes WHERE id = ?').get(id)
  if (!scheme) {
    return res.status(404).json({ error: '方案不存在' })
  }
  
  const items = db.prepare(`
    SELECT i.*, m.name as material_name, m.batch_no, m.stock_quantity
    FROM blending_items i
    JOIN raw_materials m ON i.material_id = m.id
    WHERE i.scheme_id = ?
  `).all(id)
  
  const history = db.prepare(`
    SELECT * FROM blending_schemes 
    WHERE parent_id = ? OR id = ?
    ORDER BY version ASC
  `).all(id, id)
  
  res.json({ ...scheme, items, history })
})

router.post('/schemes', (req: Request, res: Response) => {
  const { name, items, description, parent_id } = req.body
  
  const totalRatio = items.reduce((sum: number, item: any) => sum + Number(item.ratio), 0)
  if (Math.abs(totalRatio - 100) > 0.01) {
    return res.status(400).json({ 
      error: `比例合计必须为100%，当前为${totalRatio.toFixed(2)}%`, 
      code: 'INVALID_RATIO' 
    })
  }
  
  for (const item of items) {
    const material: any = db.prepare('SELECT stock_quantity, name FROM raw_materials WHERE id = ?').get(item.material_id)
    if (material && material.stock_quantity < item.quantity) {
      return res.status(400).json({ 
        error: `原料【${material.name}】库存不足，需要${item.quantity}，当前库存${material.stock_quantity}`,
        code: 'INSUFFICIENT_STOCK'
      })
    }
  }
  
  const scheme_no = generateNo('BS')
  let version = 1
  let parentVersion = 0
  
  if (parent_id) {
    const parent: any = db.prepare('SELECT version FROM blending_schemes WHERE id = ?').get(parent_id)
    if (parent) {
      version = parent.version + 1
      parentVersion = parent.version
    }
  }
  
  const insertScheme = db.prepare(`
    INSERT INTO blending_schemes (scheme_no, name, version, parent_id, total_ratio, description, status)
    VALUES (?, ?, ?, ?, ?, ?, 'draft')
  `)
  const result = insertScheme.run(scheme_no, name, version, parent_id || null, totalRatio, description)
  
  const schemeId = result.lastInsertRowid
  
  const insertItem = db.prepare(`
    INSERT INTO blending_items (scheme_id, material_id, ratio, quantity)
    VALUES (?, ?, ?, ?)
  `)
  
  for (const item of items) {
    insertItem.run(schemeId, item.material_id, item.ratio, item.quantity)
  }
  
  res.json({ id: schemeId, scheme_no, name, version, total_ratio })
})

router.post('/schemes/:id/approve', (req: Request, res: Response) => {
  const { id } = req.params
  
  const avgRating: any = db.prepare(`
    SELECT AVG(f.rating) as avg_rating, COUNT(f.id) as feedback_count
    FROM blending_schemes s
    JOIN tasting_sessions t ON s.id = t.scheme_id
    JOIN feedbacks f ON t.id = f.session_id
    WHERE s.id = ?
  `).get(id)
  
  if (avgRating && avgRating.feedback_count > 0 && avgRating.avg_rating < 3) {
    return res.status(400).json({ 
      error: `该方案平均评分${avgRating.avg_rating.toFixed(1)}分，低于3分，不建议入库`,
      code: 'LOW_RATING',
      avg_rating: avgRating.avg_rating
    })
  }
  
  db.prepare("UPDATE blending_schemes SET status = 'approved' WHERE id = ?").run(id)
  res.json({ success: true })
})

router.get('/tastings', (req: Request, res: Response) => {
  const { scheme_id, start_date, end_date } = req.query
  let sql = `
    SELECT t.*, s.name as scheme_name, s.scheme_no,
           f.rating, f.aroma, f.taste, f.aftertaste, f.suggestions, f.will_buy
    FROM tasting_sessions t
    JOIN blending_schemes s ON t.scheme_id = s.id
    LEFT JOIN feedbacks f ON t.id = f.session_id
    WHERE 1=1
  `
  const params: any[] = []
  
  if (scheme_id) {
    sql += ' AND t.scheme_id = ?'
    params.push(scheme_id)
  }
  if (start_date) {
    sql += ' AND t.tasting_date >= ?'
    params.push(start_date)
  }
  if (end_date) {
    sql += ' AND t.tasting_date <= ?'
    params.push(end_date)
  }
  sql += ' ORDER BY t.tasting_date DESC'
  
  const tastings = db.prepare(sql).all(...params)
  res.json(tastings)
})

router.post('/tastings', (req: Request, res: Response) => {
  const { scheme_id, customer_id, customer_name, tasting_date, location, notes } = req.body
  
  const session_no = generateNo('TS')
  const stmt = db.prepare(`
    INSERT INTO tasting_sessions (session_no, scheme_id, customer_id, customer_name, tasting_date, location, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(session_no, scheme_id, customer_id || null, customer_name, tasting_date, location, notes)
  
  res.json({ id: result.lastInsertRowid, session_no })
})

router.post('/feedbacks', (req: Request, res: Response) => {
  const { session_id, rating, aroma, taste, aftertaste, suggestions, will_buy } = req.body
  
  const existing: any = db.prepare('SELECT id FROM feedbacks WHERE session_id = ?').get(session_id)
  if (existing) {
    return res.status(400).json({ 
      error: '该试饮已有反馈，请勿重复提交', 
      code: 'DUPLICATE_FEEDBACK' 
    })
  }
  
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: '评分必须在1-5之间' })
  }
  
  const stmt = db.prepare(`
    INSERT INTO feedbacks (session_id, rating, aroma, taste, aftertaste, suggestions, will_buy)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(session_id, rating, aroma, taste, aftertaste, suggestions, will_buy ? 1 : 0)
  
  res.json({ id: result.lastInsertRowid, success: true })
})

router.get('/products', (req: Request, res: Response) => {
  const sql = `
    SELECT p.*, s.name as scheme_name, s.scheme_no,
           SUM(sr.quantity) as sold_quantity
    FROM finished_products p
    JOIN blending_schemes s ON p.scheme_id = s.id
    LEFT JOIN sales_records sr ON p.id = sr.product_id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `
  const products = db.prepare(sql).all()
  res.json(products)
})

router.post('/products', (req: Request, res: Response) => {
  const { scheme_id, name, production_date, quantity, unit, cost_price, selling_price, notes } = req.body
  
  const scheme: any = db.prepare('SELECT status FROM blending_schemes WHERE id = ?').get(scheme_id)
  if (!scheme) {
    return res.status(400).json({ error: '拼配方案不存在' })
  }
  if (scheme.status !== 'approved') {
    return res.status(400).json({ error: '该方案尚未通过审核，无法入库' })
  }
  
  const product_no = generateNo('FP')
  const stmt = db.prepare(`
    INSERT INTO finished_products (product_no, scheme_id, name, production_date, quantity, unit, cost_price, selling_price, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(product_no, scheme_id, name, production_date, quantity, unit || 'g', cost_price, selling_price, notes)
  
  res.json({ id: result.lastInsertRowid, product_no })
})

router.get('/sales', (req: Request, res: Response) => {
  const { start_date, end_date } = req.query
  let sql = `
    SELECT sr.*, p.name as product_name, p.product_no, s.name as scheme_name
    FROM sales_records sr
    JOIN finished_products p ON sr.product_id = p.id
    JOIN blending_schemes s ON p.scheme_id = s.id
    WHERE 1=1
  `
  const params: any[] = []
  
  if (start_date) {
    sql += ' AND sr.sale_date >= ?'
    params.push(start_date)
  }
  if (end_date) {
    sql += ' AND sr.sale_date <= ?'
    params.push(end_date)
  }
  sql += ' ORDER BY sr.sale_date DESC'
  
  const sales = db.prepare(sql).all(...params)
  res.json(sales)
})

router.post('/sales', (req: Request, res: Response) => {
  const { product_id, customer_id, customer_name, sale_date, quantity, unit_price, notes } = req.body
  
  const product: any = db.prepare('SELECT quantity as stock, name FROM finished_products WHERE id = ?').get(product_id)
  if (!product) {
    return res.status(400).json({ error: '产品不存在' })
  }
  if (product.stock < quantity) {
    return res.status(400).json({ 
      error: `库存不足，【${product.name}】当前库存${product.stock}，需要${quantity}` 
    })
  }
  
  const sale_no = generateNo('SL')
  const total_amount = quantity * unit_price
  
  db.transaction(() => {
    db.prepare(`
      INSERT INTO sales_records (sale_no, product_id, customer_id, customer_name, sale_date, quantity, unit_price, total_amount, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sale_no, product_id, customer_id || null, customer_name, sale_date, quantity, unit_price, total_amount, notes)
    
    db.prepare('UPDATE finished_products SET quantity = quantity - ? WHERE id = ?').run(quantity, product_id)
  })()
  
  res.json({ success: true, sale_no, total_amount })
})

router.get('/stats/conversion', (req: Request, res: Response) => {
  const { start_date, end_date } = req.query
  let dateFilter = ''
  const params: any[] = []
  
  if (start_date) {
    dateFilter += ' AND t.tasting_date >= ?'
    params.push(start_date)
  }
  if (end_date) {
    dateFilter += ' AND t.tasting_date <= ?'
    params.push(end_date)
  }
  
  const stats = db.prepare(`
    SELECT 
      COUNT(DISTINCT t.id) as total_tastings,
      COUNT(DISTINCT f.id) as total_feedbacks,
      COUNT(DISTINCT CASE WHEN f.rating >= 4 THEN t.id END) as good_feedback_count,
      COUNT(DISTINCT p.id) as product_count,
      COUNT(DISTINCT s.id) as sale_count,
      COUNT(DISTINCT CASE WHEN f.will_buy = 1 THEN t.id END) as will_buy_count,
      COUNT(DISTINCT sr.id) as actual_sales,
      SUM(CASE WHEN f.will_buy = 1 THEN 1 ELSE 0 END) * 1.0 / NULLIF(COUNT(f.id), 0) as purchase_intention_rate,
      COUNT(DISTINCT sr.id) * 1.0 / NULLIF(COUNT(DISTINCT t.id), 0) as conversion_rate
    FROM blending_schemes bs
    LEFT JOIN tasting_sessions t ON bs.id = t.scheme_id ${dateFilter}
    LEFT JOIN feedbacks f ON t.id = f.session_id
    LEFT JOIN finished_products p ON bs.id = p.scheme_id
    LEFT JOIN sales_records sr ON p.id = sr.product_id
    LEFT JOIN sales_records s ON p.id = s.product_id
  `).get(...params)
  
  res.json(stats)
})

router.get('/stats/scheme-performance', (req: Request, res: Response) => {
  const data = db.prepare(`
    SELECT 
      bs.id, bs.scheme_no, bs.name, bs.status,
      COUNT(DISTINCT t.id) as tasting_count,
      COUNT(DISTINCT f.id) as feedback_count,
      AVG(f.rating) as avg_rating,
      COUNT(DISTINCT CASE WHEN f.rating >= 4 THEN f.id END) as good_feedback_count,
      COUNT(DISTINCT p.id) as product_count,
      COALESCE(SUM(sr.quantity), 0) as total_sold_quantity,
      COALESCE(SUM(sr.total_amount), 0) as total_sales_amount
    FROM blending_schemes bs
    LEFT JOIN tasting_sessions t ON bs.id = t.scheme_id
    LEFT JOIN feedbacks f ON t.id = f.session_id
    LEFT JOIN finished_products p ON bs.id = p.scheme_id
    LEFT JOIN sales_records sr ON p.id = sr.product_id
    GROUP BY bs.id
    ORDER BY total_sales_amount DESC, avg_rating DESC
  `).all()
  
  res.json(data)
})

router.get('/customers', (req: Request, res: Response) => {
  const { keyword } = req.query
  let sql = 'SELECT * FROM customers WHERE 1=1'
  const params: any[] = []
  
  if (keyword) {
    sql += ' AND (name LIKE ? OR phone LIKE ?)'
    const kw = `%${keyword}%`
    params.push(kw, kw)
  }
  sql += ' ORDER BY created_at DESC'
  
  const customers = db.prepare(sql).all(...params)
  res.json(customers)
})

router.post('/customers', (req: Request, res: Response) => {
  const { name, phone, type, preferences } = req.body
  
  try {
    const stmt = db.prepare(`
      INSERT INTO customers (name, phone, type, preferences)
      VALUES (?, ?, ?, ?)
    `)
    const result = stmt.run(name, phone, type, preferences)
    res.json({ id: result.lastInsertRowid, name, phone })
  } catch (e: any) {
    if (e.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '该手机号已存在', code: 'DUPLICATE_PHONE' })
    }
    res.status(500).json({ error: e.message })
  }
})

export default router
