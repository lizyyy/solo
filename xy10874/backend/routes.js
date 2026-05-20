const express = require('express');
const router = express.Router();
const db = require('./database');
const { v4: uuidv4 } = require('uuid');
const rules = require('./rules');
const { Parser } = require('json2csv');

router.post('/plugins', (req, res) => {
  const { name, version, author, description, package_url, min_platform_version, max_platform_version } = req.body;
  
  if (!name || !version || !author || !min_platform_version) {
    return res.status(400).json({ error: '缺少必要字段' });
  }
  
  if (!rules.validateVersionFormat(version)) {
    return res.status(400).json({ error: '插件版本号格式不正确' });
  }
  
  const pluginId = uuidv4();
  db.run(
    'INSERT INTO plugins (id, name, version, author, description, package_url, min_platform_version, max_platform_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [pluginId, name, version, author, description, package_url, min_platform_version, max_platform_version],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: pluginId, message: '插件创建成功' });
    }
  );
});

router.get('/plugins', (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  
  let query = 'SELECT * FROM plugins';
  const params = [];
  
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), offset);
  
  db.all(query, params, (err, plugins) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    db.get('SELECT COUNT(*) as total FROM plugins' + (status ? ' WHERE status = ?' : ''), status ? [status] : [], (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        data: plugins,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: result.total
        }
      });
    });
  });
});

router.get('/plugins/export/csv', (req, res) => {
  db.all('SELECT * FROM plugins ORDER BY created_at DESC', [], (err, plugins) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    try {
      const parser = new Parser();
      const csv = parser.parse(plugins);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=plugins.csv');
      res.send(csv);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

router.post('/plugins/:id/permissions', (req, res) => {
  const pluginId = req.params.id;
  const { permission_name, permission_level, description, risk_level } = req.body;
  
  if (!permission_name || !permission_level) {
    return res.status(400).json({ error: '缺少必要字段' });
  }
  
  const permissionId = uuidv4();
  db.run(
    'INSERT INTO permissions (id, plugin_id, permission_name, permission_level, description, risk_level) VALUES (?, ?, ?, ?, ?, ?)',
    [permissionId, pluginId, permission_name, permission_level, description, risk_level || 'LOW'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: permissionId, message: '权限添加成功' });
    }
  );
});

router.post('/plugins/:id/screenshots', (req, res) => {
  const pluginId = req.params.id;
  const { url, description, is_valid } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: '缺少必要字段' });
  }
  
  const screenshotId = uuidv4();
  db.run(
    'INSERT INTO screenshots (id, plugin_id, url, description, is_valid) VALUES (?, ?, ?, ?, ?)',
    [screenshotId, pluginId, url, description, is_valid || 0],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: screenshotId, message: '截图添加成功' });
    }
  );
});

router.post('/plugins/:id/compatible-versions', (req, res) => {
  const pluginId = req.params.id;
  const { platform_version, is_tested, test_result } = req.body;
  
  if (!platform_version) {
    return res.status(400).json({ error: '缺少必要字段' });
  }
  
  if (!rules.validateVersionFormat(platform_version)) {
    return res.status(400).json({ error: '平台版本号格式不正确' });
  }
  
  db.get('SELECT id FROM compatible_versions WHERE plugin_id = ? AND platform_version = ?', [pluginId, platform_version], (err, existing) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (existing) {
      return res.status(400).json({ error: '该平台版本已存在' });
    }
    
    const versionId = uuidv4();
    db.run(
      'INSERT INTO compatible_versions (id, plugin_id, platform_version, is_tested, test_result) VALUES (?, ?, ?, ?, ?)',
      [versionId, pluginId, platform_version, is_tested || 0, test_result || ''],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: versionId, message: '兼容版本添加成功' });
      }
    );
  });
});

router.delete('/plugins/:id/compatible-versions/:versionId', (req, res) => {
  const { id: pluginId, versionId } = req.params;
  
  db.run('DELETE FROM compatible_versions WHERE id = ? AND plugin_id = ?', [versionId, pluginId], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '兼容版本不存在' });
    }
    res.json({ message: '兼容版本删除成功' });
  });
});

router.put('/plugins/:id/compatible-versions/:versionId', (req, res) => {
  const { id: pluginId, versionId } = req.params;
  const { is_tested, test_result } = req.body;
  
  db.run(
    'UPDATE compatible_versions SET is_tested = ?, test_result = ? WHERE id = ? AND plugin_id = ?',
    [is_tested || 0, test_result || '', versionId, pluginId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '兼容版本不存在' });
      }
      res.json({ message: '兼容版本更新成功' });
    }
  );
});

router.post('/plugins/:id/validate', async (req, res) => {
  const pluginId = req.params.id;
  
  try {
    const result = await rules.runAllValidations(pluginId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/plugins/:id/submit', async (req, res) => {
  const pluginId = req.params.id;
  const { auditor } = req.body;
  
  try {
    const result = await rules.transitionStatus(pluginId, 'SUBMITTED', auditor, '提交审核', '');
    
    setTimeout(async () => {
      await rules.transitionStatus(pluginId, 'AUTO_AUDITING', 'system', '自动审核中', '');
      
      setTimeout(async () => {
        const validation = await rules.runAllValidations(pluginId);
        const reason = validation.errors.map(e => e.message).join('; ');
        
        if (validation.valid && !validation.requiresManualReview) {
          await rules.transitionStatus(pluginId, 'AUTO_PASSED', 'system', '自动审核通过', '');
        } else if (validation.valid && validation.requiresManualReview) {
          await rules.transitionStatus(pluginId, 'PENDING_REVIEW', 'system', '需要人工审核', reason);
        } else {
          await rules.transitionStatus(pluginId, 'REJECTED', 'system', '自动审核拒绝', reason);
        }
      }, 2000);
    }, 1000);
    
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/plugins/:id/approve', async (req, res) => {
  const pluginId = req.params.id;
  const { auditor, suggestions } = req.body;
  
  try {
    const result = await rules.transitionStatus(pluginId, 'APPROVED', auditor, '审核通过', suggestions);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/plugins/:id/reject', async (req, res) => {
  const pluginId = req.params.id;
  const { auditor, reason, suggestions } = req.body;
  
  try {
    const result = await rules.transitionStatus(pluginId, 'REJECTED', auditor, reason, suggestions);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/plugins/:id/release', async (req, res) => {
  const pluginId = req.params.id;
  const { operator } = req.body;
  
  try {
    const result = await rules.releasePlugin(pluginId, operator);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/plugins/:id/rollback', async (req, res) => {
  const pluginId = req.params.id;
  const { operator, reason } = req.body;
  
  try {
    const result = await rules.rollbackPlugin(pluginId, operator, reason);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/plugins/:id', (req, res) => {
  const pluginId = req.params.id;
  
  db.get('SELECT * FROM plugins WHERE id = ?', [pluginId], (err, plugin) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!plugin) {
      return res.status(404).json({ error: '插件不存在' });
    }
    
    db.all('SELECT * FROM permissions WHERE plugin_id = ?', [pluginId], (err, permissions) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.all('SELECT * FROM screenshots WHERE plugin_id = ?', [pluginId], (err, screenshots) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all('SELECT * FROM compatible_versions WHERE plugin_id = ?', [pluginId], (err, compatible_versions) => {
          if (err) return res.status(500).json({ error: err.message });
          
          db.all('SELECT * FROM audit_records WHERE plugin_id = ? ORDER BY created_at DESC', [pluginId], (err, audit_records) => {
            if (err) return res.status(500).json({ error: err.message });
            
            db.all('SELECT * FROM release_records WHERE plugin_id = ? ORDER BY release_time DESC', [pluginId], (err, release_records) => {
              if (err) return res.status(500).json({ error: err.message });
              
              res.json({
                ...plugin,
                permissions,
                screenshots,
                compatible_versions,
                audit_records,
                release_records
              });
            });
          });
        });
      });
    });
  });
});

router.get('/dashboard/stats', (req, res) => {
  const statuses = ['DRAFT', 'SUBMITTED', 'AUTO_AUDITING', 'PENDING_REVIEW', 'AUTO_PASSED', 'APPROVED', 'RELEASED', 'ROLLED_BACK', 'REJECTED'];
  
  db.all('SELECT status, COUNT(*) as count FROM plugins GROUP BY status', [], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const stats = {};
    statuses.forEach(status => {
      stats[status] = 0;
    });
    
    results.forEach(row => {
      stats[row.status] = row.count;
    });
    
    db.all('SELECT * FROM plugins ORDER BY created_at DESC LIMIT 10', [], (err, recentPlugins) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      db.get('SELECT COUNT(*) as total FROM audit_records WHERE DATE(created_at) = DATE("now")', [], (err, todayAudits) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        res.json({
          by_status: stats,
          recent_plugins: recentPlugins,
          today_audits: todayAudits.total
        });
      });
    });
  });
});

router.get('/audit-records', (req, res) => {
  const { plugin_id, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  
  let query = 'SELECT * FROM audit_records';
  const params = [];
  
  if (plugin_id) {
    query += ' WHERE plugin_id = ?';
    params.push(plugin_id);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), offset);
  
  db.all(query, params, (err, records) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ data: records });
  });
});

module.exports = router;
