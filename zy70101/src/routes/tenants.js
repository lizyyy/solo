const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/init');
const dayjs = require('dayjs');

const router = express.Router();

router.post('/', (req, res) => {
  const { code, name, area, effective_from } = req.body;
  
  if (!code || !name || area == null) {
    return res.status(400).json({
      success: false,
      error: '租户编码、名称和面积不能为空'
    });
  }
  
  const effectiveFrom = effective_from || dayjs().format('YYYY-MM-DD');
  
  try {
    const tenantId = uuidv4();
    const versionId = uuidv4();
    
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO tenants (id, code, name, current_area)
        VALUES (?, ?, ?, ?)
      `).run(tenantId, code, name, area);
      
      db.prepare(`
        INSERT INTO tenant_area_versions 
          (id, tenant_id, area, effective_from)
        VALUES (?, ?, ?, ?)
      `).run(versionId, tenantId, area, effectiveFrom);
    });
    
    tx();
    
    const tenant = db.prepare(`
      SELECT t.*, tav.area as latest_area, tav.effective_from
      FROM tenants t
      JOIN tenant_area_versions tav ON tav.tenant_id = t.id
      WHERE t.id = ?
      ORDER BY tav.effective_from DESC
      LIMIT 1
    `).get(tenantId);
    
    res.json({ success: true, data: tenant });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(400).json({
        success: false,
        error: `租户编码 ${code} 已存在`
      });
    }
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/', (req, res) => {
  const tenants = db.prepare(`
    SELECT t.*, tav.area as current_area_value, tav.effective_from
    FROM tenants t
    JOIN tenant_area_versions tav ON tav.tenant_id = t.id
    WHERE tav.effective_to IS NULL
    ORDER BY t.created_at DESC
  `).all();
  res.json({ success: true, data: tenants });
});

router.post('/:id/area-change', (req, res) => {
  const { id } = req.params;
  const { new_area, effective_from, reason } = req.body;
  
  if (!new_area || !effective_from) {
    return res.status(400).json({
      success: false,
      error: '新面积和生效日期不能为空'
    });
  }
  
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
  if (!tenant) {
    return res.status(404).json({ success: false, error: '租户不存在' });
  }
  
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE tenant_area_versions 
      SET effective_to = date(?, '-1 day')
      WHERE tenant_id = ? AND effective_to IS NULL
    `).run(effective_from, id);
    
    const versionId = uuidv4();
    db.prepare(`
      INSERT INTO tenant_area_versions 
        (id, tenant_id, area, effective_from)
      VALUES (?, ?, ?, ?)
    `).run(versionId, id, new_area, effective_from);
    
    db.prepare(`
      UPDATE tenants SET current_area = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(new_area, id);
  });
  
  tx();
  
  const history = db.prepare(`
    SELECT * FROM tenant_area_versions 
    WHERE tenant_id = ? 
    ORDER BY effective_from DESC
  `).all(id);
  
  res.json({
    success: true,
    data: {
      message: reason || '租户面积已更新',
      area_history: history
    }
  });
});

router.get('/:id/area-history', (req, res) => {
  const { id } = req.params;
  
  const history = db.prepare(`
    SELECT * FROM tenant_area_versions 
    WHERE tenant_id = ? 
    ORDER BY effective_from DESC
  `).all(id);
  
  res.json({ success: true, data: history });
});

module.exports = router;
