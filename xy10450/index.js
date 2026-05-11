const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database');
const { analyzeQuote, analyzeAllQuotesForItem } = require('./business');

async function main() {
  await db.initDatabase();

  const app = express();
  app.use(bodyParser.json());

  app.get('/', (req, res) => {
    res.json({ message: '装修材料采购比价 API' });
  });

  app.post('/api/projects', (req, res) => {
    const { name, description } = req.body;
    const info = db.prepare('INSERT INTO projects (name, description) VALUES (?, ?)').run(name, description || '');
    res.json({ id: info.lastInsertRowid, name, description });
  });

  app.get('/api/projects', (req, res) => {
    const projects = db.prepare('SELECT * FROM projects').all();
    res.json(projects);
  });

  app.post('/api/suppliers', (req, res) => {
    const { name, contact } = req.body;
    const info = db.prepare('INSERT INTO suppliers (name, contact) VALUES (?, ?)').run(name, contact || '');
    res.json({ id: info.lastInsertRowid, name, contact });
  });

  app.get('/api/suppliers', (req, res) => {
    const suppliers = db.prepare('SELECT * FROM suppliers').all();
    res.json(suppliers);
  });

  app.get('/api/categories', (req, res) => {
    const cats = db.prepare('SELECT * FROM material_categories').all();
    res.json(cats);
  });

  app.post('/api/materials', (req, res) => {
    const { project_id, category_id, name, spec, unit, quantity, budget_unit_price, delivery_deadline } = req.body;
    const info = db.prepare(`
      INSERT INTO material_items (project_id, category_id, name, spec, unit, quantity, budget_unit_price, delivery_deadline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(project_id, category_id, name, spec, unit, quantity, budget_unit_price || null, delivery_deadline || null);
    res.json({ id: info.lastInsertRowid, project_id, category_id, name, spec, unit, quantity, budget_unit_price, delivery_deadline });
  });

  app.get('/api/materials', (req, res) => {
    const { project_id } = req.query;
    let sql = `
      SELECT mi.*, mc.name as category_name, mc.unit as category_unit
      FROM material_items mi
      JOIN material_categories mc ON mi.category_id = mc.id
    `;
    const params = [];
    if (project_id) {
      sql += ' WHERE mi.project_id = ?';
      params.push(project_id);
    }
    const items = db.prepare(sql).all(...params);
    res.json(items);
  });

  app.get('/api/materials/:id', (req, res) => {
    const item = db.prepare(`
      SELECT mi.*, mc.name as category_name, mc.unit as category_unit
      FROM material_items mi
      JOIN material_categories mc ON mi.category_id = mc.id
      WHERE mi.id = ?
    `).get(req.params.id);
    if (!item) return res.status(404).json({ error: '材料不存在' });
    res.json(item);
  });

  app.post('/api/quotes', (req, res) => {
    const { material_item_id, supplier_id, quote_date, unit_price, unit, tax_rate, delivery_days, spec, brand, is_alternative, note } = req.body;
    
    const material = db.prepare('SELECT * FROM material_items WHERE id = ?').get(material_item_id);
    if (!material) return res.status(400).json({ error: '材料不存在' });

    const existing = db.prepare(`
      SELECT id FROM quotes 
      WHERE material_item_id = ? AND supplier_id = ? AND quote_date = ? AND spec = ?
    `).get(material_item_id, supplier_id, quote_date, spec);
    
    if (existing) {
      return res.status(409).json({ error: '同一供应商已存在相同日期和规格的报价', code: 'DUPLICATE_QUOTE' });
    }

    try {
      const info = db.prepare(`
        INSERT INTO quotes (material_item_id, supplier_id, quote_date, unit_price, unit, tax_rate, delivery_days, spec, brand, is_alternative, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(material_item_id, supplier_id, quote_date, unit_price, unit, tax_rate ?? null, delivery_days ?? null, spec, brand || '', is_alternative ? 1 : 0, note || '');
      
      const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(info.lastInsertRowid);
      const analyzed = analyzeQuote(quote, material);
      res.json(analyzed);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/quotes', (req, res) => {
    const { material_item_id } = req.query;
    let sql = `
      SELECT q.*, s.name as supplier_name
      FROM quotes q
      JOIN suppliers s ON q.supplier_id = s.id
    `;
    const params = [];
    if (material_item_id) {
      sql += ' WHERE q.material_item_id = ?';
      params.push(material_item_id);
    }
    const quotes = db.prepare(sql).all(...params);
    res.json(quotes);
  });

  app.post('/api/selections', (req, res) => {
    const { material_item_id, quote_id, selected_by } = req.body;
    
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quote_id);
    if (!quote) return res.status(400).json({ error: '报价不存在' });
    if (quote.material_item_id !== material_item_id) return res.status(400).json({ error: '报价与材料不匹配' });

    const existing = db.prepare('SELECT * FROM supplier_selections WHERE material_item_id = ?').get(material_item_id);
    
    if (quote.is_alternative === 1) {
      if (existing) {
        db.prepare('UPDATE supplier_selections SET quote_id = ?, status = ?, selected_by = ?, selected_at = CURRENT_TIMESTAMP WHERE material_item_id = ?')
          .run(quote_id, 'pending_approval', selected_by || '', material_item_id);
      } else {
        db.prepare(`
          INSERT INTO supplier_selections (material_item_id, quote_id, status, selected_by, selected_at)
          VALUES (?, ?, 'pending_approval', ?, CURRENT_TIMESTAMP)
        `).run(material_item_id, quote_id, selected_by || '');
      }
      
      const sel = db.prepare('SELECT * FROM supplier_selections WHERE material_item_id = ?').get(material_item_id);
      db.prepare('INSERT INTO approval_history (selection_id, action, actor, note) VALUES (?, ?, ?, ?)')
        .run(sel.id, 'selected_alternative', selected_by || '', '选择了替代规格，等待审批');
      
      res.json({ ...sel, requires_approval: true, reason: '替代品规格需要审批' });
      return;
    }

    if (existing) {
      db.prepare('UPDATE supplier_selections SET quote_id = ?, status = ?, selected_by = ?, selected_at = CURRENT_TIMESTAMP WHERE material_item_id = ?')
        .run(quote_id, 'approved', selected_by || '', material_item_id);
      const sel = db.prepare('SELECT * FROM supplier_selections WHERE material_item_id = ?').get(material_item_id);
      db.prepare('INSERT INTO approval_history (selection_id, action, actor, note) VALUES (?, ?, ?, ?)')
        .run(sel.id, 'selected', selected_by || '', '选择了标准规格供应商');
      db.prepare('INSERT INTO approval_history (selection_id, action, actor, note) VALUES (?, ?, ?, ?)')
        .run(sel.id, 'approved', 'auto', '标准规格自动批准');
      res.json({ ...sel, requires_approval: false });
    } else {
      const info = db.prepare(`
        INSERT INTO supplier_selections (material_item_id, quote_id, status, selected_by, selected_at, approved_by, approved_at)
        VALUES (?, ?, 'approved', ?, CURRENT_TIMESTAMP, 'auto', CURRENT_TIMESTAMP)
      `).run(material_item_id, quote_id, selected_by || '');
      const sel = db.prepare('SELECT * FROM supplier_selections WHERE id = ?').get(info.lastInsertRowid);
      db.prepare('INSERT INTO approval_history (selection_id, action, actor, note) VALUES (?, ?, ?, ?)')
        .run(sel.id, 'selected', selected_by || '', '选择了标准规格供应商');
      db.prepare('INSERT INTO approval_history (selection_id, action, actor, note) VALUES (?, ?, ?, ?)')
        .run(sel.id, 'approved', 'auto', '标准规格自动批准');
      res.json({ ...sel, requires_approval: false });
    }
  });

  app.post('/api/selections/:id/approve', (req, res) => {
    const { approved_by, approval_note } = req.body;
    const sel = db.prepare('SELECT * FROM supplier_selections WHERE id = ?').get(req.params.id);
    if (!sel) return res.status(404).json({ error: '选择不存在' });
    
    db.prepare('UPDATE supplier_selections SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, approval_note = ? WHERE id = ?')
      .run('approved', approved_by || '', approval_note || '', req.params.id);
    
    db.prepare('INSERT INTO approval_history (selection_id, action, actor, note) VALUES (?, ?, ?, ?)')
      .run(sel.id, 'approved', approved_by || '', approval_note || '');
    
    const updated = db.prepare('SELECT * FROM supplier_selections WHERE id = ?').get(req.params.id);
    res.json(updated);
  });

  app.post('/api/selections/:id/reject', (req, res) => {
    const { approved_by, approval_note } = req.body;
    const sel = db.prepare('SELECT * FROM supplier_selections WHERE id = ?').get(req.params.id);
    if (!sel) return res.status(404).json({ error: '选择不存在' });
    
    db.prepare('UPDATE supplier_selections SET status = ?, approved_by = ?, approval_note = ? WHERE id = ?')
      .run('rejected', approved_by || '', approval_note || '', req.params.id);
    
    db.prepare('INSERT INTO approval_history (selection_id, action, actor, note) VALUES (?, ?, ?, ?)')
      .run(sel.id, 'rejected', approved_by || '', approval_note || '');
    
    const updated = db.prepare('SELECT * FROM supplier_selections WHERE id = ?').get(req.params.id);
    res.json(updated);
  });

  app.get('/api/projects/:projectId/comparison', (req, res) => {
    const materials = db.prepare(`
      SELECT mi.*, mc.name as category_name
      FROM material_items mi
      JOIN material_categories mc ON mi.category_id = mc.id
      WHERE mi.project_id = ?
    `).all(req.params.projectId);

    const result = materials.map(mat => {
      const quotes = db.prepare(`
        SELECT q.*, s.name as supplier_name
        FROM quotes q
        JOIN suppliers s ON q.supplier_id = s.id
        WHERE q.material_item_id = ?
        ORDER BY q.created_at DESC
      `).all(mat.id);

      const analyzed = analyzeAllQuotesForItem(mat, quotes);
      
      const selection = db.prepare(`
        SELECT ss.*, q.unit_price as selected_price, q.unit as selected_unit, q.spec as selected_spec,
               s.name as supplier_name
        FROM supplier_selections ss
        JOIN quotes q ON ss.quote_id = q.id
        JOIN suppliers s ON q.supplier_id = s.id
        WHERE ss.material_item_id = ?
      `).get(mat.id);
      
      const approvalHistory = selection
        ? db.prepare('SELECT * FROM approval_history WHERE selection_id = ? ORDER BY created_at').all(selection.id)
        : [];

      const allRisks = analyzed.analyzedQuotes.flatMap(a => a.risks).concat(
        analyzed.analyzedQuotes.flatMap(a => a.specDiff)
      );

      return {
        material: {
          id: mat.id,
          name: mat.name,
          spec: mat.spec,
          category: mat.category_name,
          unit: mat.unit,
          quantity: mat.quantity,
          budget_unit_price: mat.budget_unit_price,
          total_budget: mat.budget_unit_price ? mat.budget_unit_price * mat.quantity : null,
          delivery_deadline: mat.delivery_deadline
        },
        quotes: analyzed.analyzedQuotes.map(a => ({
          ...a.quote,
          normalized_unit_price: a.normalizedUnitPrice,
          unit_price_with_tax: a.unitPriceWithTax,
          risks: a.risks,
          spec_differences: a.specDiff,
          is_best: analyzed.recommended && analyzed.recommended.quote.id === a.quote.id
        })),
        recommendation: analyzed.recommended ? {
          quote_id: analyzed.recommended.quote.id,
          supplier_name: analyzed.recommended.quote.supplier_name,
          supplier_id: analyzed.recommended.quote.supplier_id,
          unit_price_with_tax: analyzed.recommended.unitPriceWithTax,
          normalized_unit_price: analyzed.recommended.normalizedUnitPrice,
          risks: analyzed.recommended.risks,
          spec: analyzed.recommended.quote.spec,
          is_alternative: analyzed.recommended.quote.is_alternative === 1
        } : null,
        risk_summary: {
          count: allRisks.length,
          items: allRisks
        },
        budget_difference: analyzed.budgetDiff,
        budget_difference_percentage: analyzed.budgetDiff && mat.budget_unit_price
          ? (analyzed.budgetDiff / mat.budget_unit_price * 100).toFixed(2)
          : null,
        selection: selection ? {
          ...selection,
          approval_history: approvalHistory
        } : null
      };
    });

    const summaryTotalBudget = result.reduce((sum, r) => sum + (r.material.total_budget || 0), 0);
    const summaryTotalSelected = result
      .filter(r => r.selection && r.selection.status === 'approved')
      .reduce((sum, r) => {
        const a = r.quotes.find(q => q.id === r.selection.quote_id);
        return sum + (a && a.unit_price_with_tax ? a.unit_price_with_tax * r.material.quantity : 0);
      }, 0);

    res.json({
      project_id: parseInt(req.params.projectId),
      items: result,
      summary: {
        total_materials: result.length,
        with_quotes: result.filter(r => r.quotes.length > 0).length,
        selected: result.filter(r => r.selection && r.selection.status === 'approved').length,
        pending_approval: result.filter(r => r.selection && r.selection.status === 'pending_approval').length,
        total_budget: summaryTotalBudget,
        total_selected: summaryTotalSelected,
        overall_budget_diff: summaryTotalBudget > 0 ? summaryTotalSelected - summaryTotalBudget : null
      }
    });
  });

  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`装修材料采购比价 API 运行在 http://localhost:${PORT}`);
  });
}

main().catch(e => {
  console.error('启动失败:', e);
  process.exit(1);
});
