const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/init');

const router = express.Router();

router.post('/', (req, res) => {
  const { name, description, rule_config, effective_from } = req.body;
  
  if (!name || !rule_config || !effective_from) {
    return res.status(400).json({
      success: false,
      error: '规则名称、配置和生效日期不能为空'
    });
  }
  
  if (typeof rule_config !== 'object' || rule_config.pricePerUnit == null) {
    return res.status(400).json({
      success: false,
      error: '规则配置必须是对象，且包含 pricePerUnit（单价）字段'
    });
  }
  
  try {
    const latestVersion = db.prepare(`
      SELECT MAX(version) as max_ver FROM allocation_rules
    `).get();
    const nextVersion = (latestVersion.max_ver || 0) + 1;
    
    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE allocation_rules 
        SET effective_to = date(?, '-1 day'), is_active = 0
        WHERE effective_to IS NULL AND is_active = 1
      `).run(effective_from);
      
      const ruleId = uuidv4();
      db.prepare(`
        INSERT INTO allocation_rules 
          (id, version, name, description, rule_config, effective_from)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(ruleId, nextVersion, name, description, JSON.stringify(rule_config), effective_from);
      
      return { id: ruleId, version: nextVersion };
    });
    
    const result = tx();
    const rule = db.prepare('SELECT * FROM allocation_rules WHERE id = ?').get(result.id);
    
    res.json({
      success: true,
      data: {
        ...rule,
        rule_config: JSON.parse(rule.rule_config),
        message: `分摊规则版本 ${result.version} 已创建并生效`
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/', (req, res) => {
  const rules = db.prepare(`
    SELECT * FROM allocation_rules ORDER BY version DESC
  `).all().map(r => ({
    ...r,
    rule_config: JSON.parse(r.rule_config)
  }));
  
  res.json({ success: true, data: rules });
});

router.get('/active', (req, res) => {
  const rule = db.prepare(`
    SELECT * FROM allocation_rules 
    WHERE is_active = 1 AND effective_to IS NULL
    ORDER BY version DESC LIMIT 1
  `).get();
  
  if (!rule) {
    return res.status(404).json({ success: false, error: '没有当前生效的分摊规则' });
  }
  
  res.json({
    success: true,
    data: {
      ...rule,
      rule_config: JSON.parse(rule.rule_config)
    }
  });
});

router.get('/version/:version', (req, res) => {
  const { version } = req.params;
  
  const rule = db.prepare(`
    SELECT * FROM allocation_rules WHERE version = ?
  `).get(parseInt(version));
  
  if (!rule) {
    return res.status(404).json({ success: false, error: `规则版本 ${version} 不存在` });
  }
  
  res.json({
    success: true,
    data: {
      ...rule,
      rule_config: JSON.parse(rule.rule_config)
    }
  });
});

router.get('/for-period/:period', (req, res) => {
  const { period } = req.params;
  const periodStart = period + '-01';
  
  const rule = db.prepare(`
    SELECT * FROM allocation_rules
    WHERE effective_from <= ?
      AND (effective_to IS NULL OR effective_to >= ?)
    ORDER BY version DESC
    LIMIT 1
  `).get(periodStart, periodStart);
  
  if (!rule) {
    return res.status(404).json({ 
      success: false, 
      error: `未找到 ${period} 适用的分摊规则` 
    });
  }
  
  res.json({
    success: true,
    data: {
      period,
      ...rule,
      rule_config: JSON.parse(rule.rule_config)
    }
  });
});

module.exports = router;
