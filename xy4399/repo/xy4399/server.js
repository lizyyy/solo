const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const csvParser = require('csv-parser');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const db = require('./database');
const { calculateOxideMolars, normalizeToUnity } = require('./oxideCalculator');
const { detectOxideRisks, detectPositionRisks, sortRisksBySeverity, applyRiskOverride } = require('./riskDetector');

const app = express();
const PORT = 3001;
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/api/kiln-runs', (req, res) => {
  db.all('SELECT * FROM kiln_runs ORDER BY date DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/kiln-runs', (req, res) => {
  const { name, date, notes } = req.body;
  db.run('INSERT INTO kiln_runs (name, date, notes) VALUES (?, ?, ?)',
    [name, date, notes],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, name, date, notes });
    }
  );
});

app.get('/api/kiln-runs/:id', (req, res) => {
  const kilnRunId = req.params.id;
  
  db.get('SELECT * FROM kiln_runs WHERE id = ?', [kilnRunId], (err, kilnRun) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!kilnRun) {
      res.status(404).json({ error: 'Kiln run not found' });
      return;
    }
    
    db.all('SELECT * FROM test_samples WHERE kiln_run_id = ? ORDER BY sample_code', [kilnRunId], (err, samples) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const parsedSamples = samples.map(s => ({
        ...s,
        glaze_recipe: JSON.parse(s.glaze_recipe || '[]'),
        oxide_molars: JSON.parse(s.oxide_molars || '{}'),
        risks: JSON.parse(s.risks || '[]'),
        risk_override: JSON.parse(s.risk_override || '[]')
      }));
      
      res.json({
        kilnRun,
        samples: parsedSamples
      });
    });
  });
});

app.delete('/api/kiln-runs/:id', (req, res) => {
  const kilnRunId = req.params.id;
  
  db.serialize(() => {
    db.run('DELETE FROM test_samples WHERE kiln_run_id = ?', [kilnRunId]);
    db.run('DELETE FROM firing_curves WHERE kiln_run_id = ?', [kilnRunId]);
    db.run('DELETE FROM kiln_runs WHERE id = ?', [kilnRunId], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ deleted: this.changes > 0 });
    });
  });
});

app.get('/api/bodies', (req, res) => {
  db.all('SELECT * FROM bodies ORDER BY code', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/bodies', (req, res) => {
  const { code, name, description } = req.body;
  db.run('INSERT INTO bodies (code, name, description) VALUES (?, ?, ?)',
    [code, name, description],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          res.status(400).json({ error: 'Body code already exists' });
        } else {
          res.status(500).json({ error: err.message });
        }
        return;
      }
      res.json({ id: this.lastID, code, name, description });
    }
  );
});

app.get('/api/materials', (req, res) => {
  db.all('SELECT * FROM materials ORDER BY name', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const parsedRows = rows.map(r => ({
      ...r,
      oxides: JSON.parse(r.oxides || '{}')
    }));
    res.json(parsedRows);
  });
});

app.post('/api/materials', (req, res) => {
  const { name, formula, oxides, notes } = req.body;
  const oxidesStr = JSON.stringify(oxides || {});
  
  db.run('INSERT INTO materials (name, formula, oxides, notes) VALUES (?, ?, ?, ?)',
    [name, formula, oxidesStr, notes],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, name, formula, oxides, notes });
    }
  );
});

app.post('/api/samples', async (req, res) => {
  const {
    kiln_run_id,
    body_id,
    sample_code,
    position,
    position_temp,
    glaze_recipe,
    photo_path,
    notes
  } = req.body;

  try {
    const materials = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM materials', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const oxideMolars = calculateOxideMolars(glaze_recipe, materials);
    const normalizedOxides = normalizeToUnity(oxideMolars);
    const oxideRisks = detectOxideRisks(oxideMolars);
    const sortedRisks = sortRisksBySeverity(oxideRisks);

    const glazeRecipeStr = JSON.stringify(glaze_recipe || []);
    const oxideMolarsStr = JSON.stringify(normalizedOxides || {});
    const risksStr = JSON.stringify(sortedRisks || []);

    db.run(`INSERT INTO test_samples 
      (kiln_run_id, body_id, sample_code, position, position_temp, 
       glaze_recipe, oxide_molars, photo_path, notes, risks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [kiln_run_id, body_id, sample_code, position, position_temp,
       glazeRecipeStr, oxideMolarsStr, photo_path, notes, risksStr],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({
          id: this.lastID,
          kiln_run_id,
          body_id,
          sample_code,
          position,
          position_temp,
          glaze_recipe,
          oxide_molars: normalizedOxides,
          risks: sortedRisks,
          photo_path,
          notes
        });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/samples/:id/risk-override', (req, res) => {
  const sampleId = req.params.id;
  const { risk_override } = req.body;
  const overrideStr = JSON.stringify(risk_override || []);

  db.run('UPDATE test_samples SET risk_override = ? WHERE id = ?',
    [overrideStr, sampleId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ updated: this.changes > 0, risk_override });
    }
  );
});

app.post('/api/import/csv', upload.single('file'), (req, res) => {
  const results = [];
  const filePath = req.file.path;

  fs.createReadStream(filePath)
    .pipe(csvParser())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        fs.unlinkSync(filePath);
        res.json({ data: results });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    })
    .on('error', (err) => {
      fs.unlinkSync(filePath);
      res.status(500).json({ error: err.message });
    });
});

app.post('/api/import/json', upload.single('file'), (req, res) => {
  try {
    const filePath = req.file.path;
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    fs.unlinkSync(filePath);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export/markdown/:kilnId', (req, res) => {
  const kilnId = req.params.kilnId;
  
  db.get('SELECT * FROM kiln_runs WHERE id = ?', [kilnId], (err, kilnRun) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.all('SELECT * FROM test_samples WHERE kiln_run_id = ? ORDER BY sample_code', [kilnId], (err, samples) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      let markdown = `# ${kilnRun.name}\n\n`;
      markdown += `**日期**: ${kilnRun.date}\n\n`;
      if (kilnRun.notes) {
        markdown += `**备注**: ${kilnRun.notes}\n\n`;
      }
      
      markdown += `---\n\n`;
      markdown += `## 试片记录\n\n`;
      
      for (const sample of samples) {
        const recipe = JSON.parse(sample.glaze_recipe || '[]');
        const oxides = JSON.parse(sample.oxide_molars || '{}');
        const risks = JSON.parse(sample.risks || '[]');
        const overrides = JSON.parse(sample.risk_override || '[]');
        const appliedRisks = applyRiskOverride(risks, overrides);

        markdown += `### 试片 ${sample.sample_code || 'N/A'}\n\n`;
        
        if (sample.position) {
          markdown += `- **窑位**: ${sample.position}`;
          if (sample.position_temp) {
            markdown += ` (${sample.position_temp}°C)`;
          }
          markdown += `\n`;
        }

        markdown += `\n#### 配方\n\n`;
        if (recipe.length > 0) {
          markdown += `| 原料 | 用量 |\n`;
          markdown += `|------|------|\n`;
          for (const item of recipe) {
            markdown += `| ${item.material} | ${item.weight} |\n`;
          }
        } else {
          markdown += `无配方数据\n`;
        }

        markdown += `\n#### 氧化物摩尔比例\n\n`;
        const oxideEntries = Object.entries(oxides);
        if (oxideEntries.length > 0) {
          markdown += `| 氧化物 | 摩尔比 |\n`;
          markdown += `|--------|--------|\n`;
          for (const [oxide, ratio] of oxideEntries) {
            markdown += `| ${oxide} | ${ratio.toFixed(4)} |\n`;
          }
        } else {
          markdown += `无氧化物数据\n`;
        }

        if (appliedRisks.length > 0) {
          markdown += `\n#### 风险检测\n\n`;
          for (const risk of appliedRisks) {
            const severityEmoji = risk.severity === 'high' ? '🔴' : risk.severity === 'medium' ? '🟡' : '🟢';
            const overridden = risk.overridden ? ' (已改判)' : '';
            markdown += `- ${severityEmoji} **${risk.message}**${overridden}\n`;
          }
        }

        if (sample.notes) {
          markdown += `\n#### 备注\n\n${sample.notes}\n`;
        }

        markdown += `\n---\n\n`;
      }

      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${kilnRun.name}.md"`);
      res.send(markdown);
    });
  });
});

app.get('/api/export/issues/:kilnId', (req, res) => {
  const kilnId = req.params.kilnId;
  
  db.get('SELECT * FROM kiln_runs WHERE id = ?', [kilnId], (err, kilnRun) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.all('SELECT * FROM test_samples WHERE kiln_run_id = ? ORDER BY sample_code', [kilnId], (err, samples) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      const issues = [];
      
      for (const sample of samples) {
        const risks = JSON.parse(sample.risks || '[]');
        const overrides = JSON.parse(sample.risk_override || '[]');
        const appliedRisks = applyRiskOverride(risks, overrides);

        for (const risk of appliedRisks) {
          issues.push({
            kiln_name: kilnRun.name,
            sample_code: sample.sample_code || 'N/A',
            position: sample.position || '',
            position_temp: sample.position_temp || '',
            risk_type: risk.type,
            severity: risk.severity,
            message: risk.message,
            overridden: risk.overridden || false,
            details: JSON.stringify(risk.details || {})
          });
        }
      }

      if (issues.length > 0) {
        const parser = new Parser({
          fields: [
            'kiln_name', 'sample_code', 'position', 'position_temp',
            'risk_type', 'severity', 'message', 'overridden', 'details'
          ]
        });
        const csv = parser.parse(issues);
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${kilnRun.name}_issues.csv"`);
        res.send(csv);
      } else {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${kilnRun.name}_issues.csv"`);
        res.send('kiln_name,sample_code,position,position_temp,risk_type,severity,message,overridden,details');
      }
    });
  });
});

app.post('/api/kiln-runs/:id/analyze-positions', (req, res) => {
  const kilnId = req.params.id;
  
  db.all('SELECT * FROM test_samples WHERE kiln_run_id = ?', [kilnId], async (err, samples) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const positionRisks = detectPositionRisks(samples);
    
    const updates = [];
    for (const sample of samples) {
      const existingRisks = JSON.parse(sample.risks || '[]');
      const newPositionRisks = positionRisks[sample.id] || [];
      
      const filteredExisting = existingRisks.filter(r => r.type !== 'position_temp_variation');
      const mergedRisks = [...filteredExisting, ...newPositionRisks];
      const sortedRisks = sortRisksBySeverity(mergedRisks);
      
      updates.push({
        sampleId: sample.id,
        risks: sortedRisks
      });
    }

    for (const update of updates) {
      await new Promise((resolve, reject) => {
        db.run('UPDATE test_samples SET risks = ? WHERE id = ?',
          [JSON.stringify(update.risks), update.sampleId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    res.json({ positionRisks, updated: updates.length });
  });
});

app.listen(PORT, () => {
  console.log(`陶瓷釉料小试复盘工具运行在 http://localhost:${PORT}`);
});
