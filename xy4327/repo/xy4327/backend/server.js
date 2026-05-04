const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const srtParser = require('./utils/srtParser');
const detectionEngine = require('./utils/detectionEngine');
const similarity = require('./utils/similarity');
const exporter = require('./utils/exporter');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const upload = multer({ dest: 'uploads/' });

// 项目管理
app.get('/api/projects', (req, res) => {
  db.all('SELECT * FROM projects ORDER BY updated_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM projects WHERE id = ?', [id], (err, project) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    
    db.all('SELECT * FROM subtitles WHERE project_id = ? ORDER BY sequence', [id], (err, subtitles) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      db.all('SELECT * FROM terms WHERE project_id = ?', [id], (err, terms) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        db.all('SELECT * FROM speakers WHERE project_id = ?', [id], (err, speakers) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          res.json({
            project,
            subtitles,
            terms,
            speakers
          });
        });
      });
    });
  });
});

app.post('/api/projects', (req, res) => {
  const { name, description } = req.body;
  db.run(
    'INSERT INTO projects (name, description) VALUES (?, ?)',
    [name, description || ''],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, name, description, created_at: new Date().toISOString() });
    }
  );
});

app.put('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  db.run(
    'UPDATE projects SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, description || '', id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      res.json({ success: true });
    }
  );
});

app.delete('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM detection_results WHERE project_id = ?', [id]);
  db.run('DELETE FROM proofread_records WHERE project_id = ?', [id]);
  db.run('DELETE FROM speakers WHERE project_id = ?', [id]);
  db.run('DELETE FROM terms WHERE project_id = ?', [id]);
  db.run('DELETE FROM subtitles WHERE project_id = ?', [id]);
  
  db.run('DELETE FROM projects WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ success: true });
  });
});

// 导入 SRT
app.post('/api/projects/:id/import/srt', upload.single('srt'), (req, res) => {
  const { id } = req.params;
  const file = req.file;
  
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  
  const content = fs.readFileSync(file.path, 'utf-8');
  const subtitles = srtParser.parse(content);
  
  // 清空现有字幕
  db.run('DELETE FROM subtitles WHERE project_id = ?', [id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // 插入新字幕
    const stmt = db.prepare(`
      INSERT INTO subtitles 
      (project_id, sequence, start_time, end_time, start_seconds, end_seconds, original_text, current_text, speaker)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    subtitles.forEach(sub => {
      stmt.run([
        id,
        sub.sequence,
        sub.startTime,
        sub.endTime,
        sub.startSeconds,
        sub.endSeconds,
        sub.text,
        sub.text,
        sub.speaker || null
      ]);
    });
    
    stmt.finalize((err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // 更新项目时间
      db.run('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
      
      // 删除临时文件
      fs.unlinkSync(file.path);
      
      res.json({ success: true, count: subtitles.length });
    });
  });
});

// 导入术语表
app.post('/api/projects/:id/import/terms', upload.single('terms'), (req, res) => {
  const { id } = req.params;
  const file = req.file;
  
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  
  const content = fs.readFileSync(file.path, 'utf-8');
  let terms = [];
  
  try {
    // 尝试解析 JSON
    terms = JSON.parse(content);
  } catch (e) {
    // 否则按行解析
    const lines = content.split('\n').filter(line => line.trim());
    terms = lines.map(line => {
      const parts = line.split(/[,\t]/);
      return {
        term: parts[0]?.trim() || '',
        replacement: parts[1]?.trim() || '',
        category: parts[2]?.trim() || '通用',
        is_sensitive: (parts[3]?.trim() === 'true' || parts[3]?.trim() === '1')
      };
    }).filter(t => t.term);
  }
  
  // 清空现有术语
  db.run('DELETE FROM terms WHERE project_id = ?', [id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // 插入新术语
    const stmt = db.prepare(`
      INSERT INTO terms (project_id, term, replacement, category, is_sensitive)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    terms.forEach(term => {
      stmt.run([
        id,
        term.term,
        term.replacement || '',
        term.category || '通用',
        term.is_sensitive ? 1 : 0
      ]);
    });
    
    stmt.finalize((err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      db.run('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
      fs.unlinkSync(file.path);
      
      res.json({ success: true, count: terms.length });
    });
  });
});

// 导入说话人名单
app.post('/api/projects/:id/import/speakers', upload.single('speakers'), (req, res) => {
  const { id } = req.params;
  const file = req.file;
  
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  
  const content = fs.readFileSync(file.path, 'utf-8');
  let speakers = [];
  
  try {
    speakers = JSON.parse(content);
  } catch (e) {
    const lines = content.split('\n').filter(line => line.trim());
    speakers = lines.map(line => {
      const parts = line.split(/[,\t]/);
      return {
        name: parts[0]?.trim() || '',
        alias: parts[1]?.trim() || '',
        is_sensitive: (parts[2]?.trim() === 'true' || parts[2]?.trim() === '1')
      };
    }).filter(s => s.name);
  }
  
  db.run('DELETE FROM speakers WHERE project_id = ?', [id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const stmt = db.prepare(`
      INSERT INTO speakers (project_id, name, alias, is_sensitive)
      VALUES (?, ?, ?, ?)
    `);
    
    speakers.forEach(speaker => {
      stmt.run([
        id,
        speaker.name,
        speaker.alias || '',
        speaker.is_sensitive ? 1 : 0
      ]);
    });
    
    stmt.finalize((err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      db.run('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
      fs.unlinkSync(file.path);
      
      res.json({ success: true, count: speakers.length });
    });
  });
});

// 字幕管理
app.get('/api/projects/:id/subtitles', (req, res) => {
  const { id } = req.params;
  db.all('SELECT * FROM subtitles WHERE project_id = ? ORDER BY sequence', [id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.put('/api/subtitles/:id', (req, res) => {
  const { id } = req.params;
  const { current_text, speaker, is_reviewed } = req.body;
  
  db.get('SELECT * FROM subtitles WHERE id = ?', [id], (err, oldSub) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!oldSub) {
      res.status(404).json({ error: 'Subtitle not found' });
      return;
    }
    
    // 记录校对历史
    if (current_text !== undefined && current_text !== oldSub.current_text) {
      db.run(`
        INSERT INTO proofread_records (project_id, subtitle_id, action, old_value, new_value)
        VALUES (?, ?, 'text_update', ?, ?)
      `, [oldSub.project_id, id, oldSub.current_text, current_text]);
    }
    
    if (is_reviewed !== undefined && is_reviewed !== oldSub.is_reviewed) {
      db.run(`
        INSERT INTO proofread_records (project_id, subtitle_id, action, old_value, new_value)
        VALUES (?, ?, 'review_toggle', ?, ?)
      `, [oldSub.project_id, id, oldSub.is_reviewed ? 'true' : 'false', is_reviewed ? 'true' : 'false']);
    }
    
    db.run(
      'UPDATE subtitles SET current_text = ?, speaker = ?, is_reviewed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [current_text !== undefined ? current_text : oldSub.current_text, 
       speaker !== undefined ? speaker : oldSub.speaker, 
       is_reviewed !== undefined ? (is_reviewed ? 1 : 0) : oldSub.is_reviewed, 
       id],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        db.run('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [oldSub.project_id]);
        res.json({ success: true });
      }
    );
  });
});

// 规则检测
app.post('/api/projects/:id/detect', (req, res) => {
  const { id } = req.params;
  
  db.all('SELECT * FROM subtitles WHERE project_id = ? ORDER BY sequence', [id], (err, subtitles) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.all('SELECT * FROM terms WHERE project_id = ?', [id], (err, terms) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      db.all('SELECT * FROM speakers WHERE project_id = ?', [id], (err, speakers) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        const results = detectionEngine.detectAll(subtitles, terms, speakers);
        
        // 保存检测结果
        db.run('DELETE FROM detection_results WHERE project_id = ?', [id], (err) => {
          if (err) {
            console.error('Error clearing old results:', err);
          }
          
          const stmt = db.prepare(`
            INSERT INTO detection_results 
            (project_id, subtitle_id, issue_type, severity, message, details)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          
          results.forEach(result => {
            stmt.run([
              id,
              result.subtitleId || null,
              result.type,
              result.severity,
              result.message,
              result.details ? JSON.stringify(result.details) : null
            ]);
          });
          
          stmt.finalize((err) => {
            if (err) {
              console.error('Error saving results:', err);
            }
            res.json({ results, count: results.length });
          });
        });
      });
    });
  });
});

app.get('/api/projects/:id/detection-results', (req, res) => {
  const { id } = req.params;
  db.all(`
    SELECT dr.*, s.sequence, s.current_text
    FROM detection_results dr
    LEFT JOIN subtitles s ON dr.subtitle_id = s.id
    WHERE dr.project_id = ?
    ORDER BY dr.created_at DESC
  `, [id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.put('/api/detection-results/:id/resolve', (req, res) => {
  const { id } = req.params;
  db.run('UPDATE detection_results SET is_resolved = 1 WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true });
  });
});

// 相似度建议
app.post('/api/similarity/suggest', (req, res) => {
  const { text, candidates, topN = 3 } = req.body;
  
  if (!text || !candidates || !Array.isArray(candidates)) {
    res.status(400).json({ error: 'Invalid request: text and candidates array required' });
    return;
  }
  
  const suggestions = similarity.findSimilar(text, candidates, topN);
  res.json({ suggestions });
});

app.post('/api/projects/:id/similarity/check', (req, res) => {
  const { id } = req.params;
  const { threshold = 0.8 } = req.body;
  
  db.all('SELECT * FROM subtitles WHERE project_id = ? ORDER BY sequence', [id], (err, subtitles) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const similarPairs = similarity.findSimilarPairs(subtitles, threshold);
    res.json({ similarPairs, count: similarPairs.length });
  });
});

// 导出功能
app.get('/api/projects/:id/export/srt', (req, res) => {
  const { id } = req.params;
  
  db.all('SELECT * FROM subtitles WHERE project_id = ? ORDER BY sequence', [id], (err, subtitles) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.get('SELECT * FROM projects WHERE id = ?', [id], (err, project) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const srtContent = exporter.exportSRT(subtitles);
      const filename = `${project.name || 'subtitles'}_corrected.srt`;
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.send(srtContent);
    });
  });
});

app.get('/api/projects/:id/export/markdown', (req, res) => {
  const { id } = req.params;
  
  Promise.all([
    new Promise((resolve, reject) => {
      db.all('SELECT * FROM subtitles WHERE project_id = ? ORDER BY sequence', [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    new Promise((resolve, reject) => {
      db.all(`
        SELECT dr.*, s.sequence, s.current_text as subtitle_text
        FROM detection_results dr
        LEFT JOIN subtitles s ON dr.subtitle_id = s.id
        WHERE dr.project_id = ?
        ORDER BY dr.severity DESC, dr.created_at
      `, [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    new Promise((resolve, reject) => {
      db.get('SELECT * FROM projects WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    })
  ]).then(([subtitles, detectionResults, project]) => {
    const markdown = exporter.exportMarkdown(subtitles, detectionResults, project);
    const filename = `${project.name || 'subtitle'}_report.md`;
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(markdown);
  }).catch(err => {
    res.status(500).json({ error: err.message });
  });
});

app.get('/api/projects/:id/export/json', (req, res) => {
  const { id } = req.params;
  
  Promise.all([
    new Promise((resolve, reject) => {
      db.get('SELECT * FROM projects WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    }),
    new Promise((resolve, reject) => {
      db.all('SELECT * FROM subtitles WHERE project_id = ? ORDER BY sequence', [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    new Promise((resolve, reject) => {
      db.all('SELECT * FROM terms WHERE project_id = ?', [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    new Promise((resolve, reject) => {
      db.all('SELECT * FROM speakers WHERE project_id = ?', [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    new Promise((resolve, reject) => {
      db.all('SELECT * FROM proofread_records WHERE project_id = ? ORDER BY created_at', [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }),
    new Promise((resolve, reject) => {
      db.all('SELECT * FROM detection_results WHERE project_id = ?', [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    })
  ]).then(([project, subtitles, terms, speakers, records, detections]) => {
    const jsonData = exporter.exportJSON({
      project,
      subtitles,
      terms,
      speakers,
      proofreadRecords: records,
      detectionResults: detections,
      exportTime: new Date().toISOString()
    });
    
    const filename = `${project.name || 'subtitle'}_audit.json`;
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(jsonData);
  }).catch(err => {
    res.status(500).json({ error: err.message });
  });
});

// 校对记录
app.get('/api/projects/:id/records', (req, res) => {
  const { id } = req.params;
  db.all(`
    SELECT pr.*, s.sequence, s.current_text
    FROM proofread_records pr
    LEFT JOIN subtitles s ON pr.subtitle_id = s.id
    WHERE pr.project_id = ?
    ORDER BY pr.created_at DESC
  `, [id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`无障碍字幕校对台后端服务已启动: http://localhost:${PORT}`);
});