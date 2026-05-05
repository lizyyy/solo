const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, '..', 'data', 'breastmilk.db');

app.use(cors());
app.use(bodyParser.json());

let db;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      batch_number TEXT UNIQUE NOT NULL,
      donor_id TEXT,
      donor_name TEXT,
      collection_date TEXT,
      pasteurization_date TEXT,
      pasteurization_temp REAL,
      pasteurization_duration INTEGER,
      fridge_temp_log TEXT,
      status TEXT DEFAULT 'pending',
      risk_reasons TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS donor_screenings (
      id TEXT PRIMARY KEY,
      donor_id TEXT,
      donor_name TEXT,
      screening_date TEXT,
      blood_test_result TEXT,
      infectious_diseases TEXT,
      medications TEXT,
      lifestyle_factors TEXT,
      overall_result TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bacteria_cultures (
      id TEXT PRIMARY KEY,
      batch_id TEXT,
      test_date TEXT,
      colony_count REAL,
      organism_identified TEXT,
      antibiotic_sensitivity TEXT,
      result TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS fridge_temperatures (
      id TEXT PRIMARY KEY,
      batch_id TEXT,
      log_date TEXT,
      temperatures TEXT,
      avg_temp REAL,
      min_temp REAL,
      max_temp REAL,
      status TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS infant_requests (
      id TEXT PRIMARY KEY,
      request_id TEXT,
      infant_name TEXT,
      infant_dob TEXT,
      gestational_age INTEGER,
      weight REAL,
      medical_condition TEXT,
      requested_ml INTEGER,
      request_date TEXT,
      status TEXT DEFAULT 'pending',
      assigned_batch_id TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      batch_id TEXT,
      review_date TEXT,
      reviewer TEXT,
      status TEXT,
      risk_assessment TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  saveDatabase();
  console.log('数据库初始化完成');
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

app.get('/api/batches', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM batches ORDER BY created_at DESC');
    const batches = result.length > 0 ? result[0].values.map(row => {
      const obj = {};
      result[0].columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    }) : [];
    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/batches/:id', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM batches WHERE id = ?', [req.params.id]);
    if (result.length > 0 && result[0].values.length > 0) {
      const batch = {};
      result[0].columns.forEach((col, idx) => {
        batch[col] = result[0].values[0][idx];
      });
      res.json(batch);
    } else {
      res.status(404).json({ error: '批次未找到' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/batches', (req, res) => {
  try {
    const {
      batch_number, donor_id, donor_name, collection_date,
      pasteurization_date, pasteurization_temp, pasteurization_duration,
      fridge_temp_log, status, risk_reasons
    } = req.body;

    const id = uuidv4();
    const now = new Date().toISOString();

    db.run(`
      INSERT INTO batches (
        id, batch_number, donor_id, donor_name, collection_date,
        pasteurization_date, pasteurization_temp, pasteurization_duration,
        fridge_temp_log, status, risk_reasons, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, batch_number, donor_id, donor_name, collection_date,
      pasteurization_date, pasteurization_temp, pasteurization_duration,
      fridge_temp_log, status || 'pending', risk_reasons || '', now, now
    ]);

    saveDatabase();
    res.json({ id, message: '批次创建成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/batches/:id', (req, res) => {
  try {
    const {
      batch_number, donor_id, donor_name, collection_date,
      pasteurization_date, pasteurization_temp, pasteurization_duration,
      fridge_temp_log, status, risk_reasons
    } = req.body;

    const now = new Date().toISOString();

    db.run(`
      UPDATE batches SET
        batch_number = ?, donor_id = ?, donor_name = ?, collection_date = ?,
        pasteurization_date = ?, pasteurization_temp = ?, pasteurization_duration = ?,
        fridge_temp_log = ?, status = ?, risk_reasons = ?, updated_at = ?
      WHERE id = ?
    `, [
      batch_number, donor_id, donor_name, collection_date,
      pasteurization_date, pasteurization_temp, pasteurization_duration,
      fridge_temp_log, status, risk_reasons, now, req.params.id
    ]);

    saveDatabase();
    res.json({ message: '批次更新成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/donor-screenings', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM donor_screenings ORDER BY created_at DESC');
    const screenings = result.length > 0 ? result[0].values.map(row => {
      const obj = {};
      result[0].columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    }) : [];
    res.json(screenings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/donor-screenings', (req, res) => {
  try {
    const {
      donor_id, donor_name, screening_date, blood_test_result,
      infectious_diseases, medications, lifestyle_factors, overall_result, notes
    } = req.body;

    const id = uuidv4();

    db.run(`
      INSERT INTO donor_screenings (
        id, donor_id, donor_name, screening_date, blood_test_result,
        infectious_diseases, medications, lifestyle_factors, overall_result, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, donor_id, donor_name, screening_date, blood_test_result,
      infectious_diseases, medications, lifestyle_factors, overall_result, notes
    ]);

    saveDatabase();
    res.json({ id, message: '捐乳者筛查记录创建成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bacteria-cultures', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM bacteria_cultures ORDER BY created_at DESC');
    const cultures = result.length > 0 ? result[0].values.map(row => {
      const obj = {};
      result[0].columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    }) : [];
    res.json(cultures);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bacteria-cultures', (req, res) => {
  try {
    const {
      batch_id, test_date, colony_count, organism_identified,
      antibiotic_sensitivity, result, notes
    } = req.body;

    const id = uuidv4();

    db.run(`
      INSERT INTO bacteria_cultures (
        id, batch_id, test_date, colony_count, organism_identified,
        antibiotic_sensitivity, result, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, batch_id, test_date, colony_count, organism_identified,
      antibiotic_sensitivity, result, notes
    ]);

    saveDatabase();
    res.json({ id, message: '细菌培养记录创建成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/fridge-temperatures', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM fridge_temperatures ORDER BY created_at DESC');
    const temps = result.length > 0 ? result[0].values.map(row => {
      const obj = {};
      result[0].columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    }) : [];
    res.json(temps);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fridge-temperatures', (req, res) => {
  try {
    const {
      batch_id, log_date, temperatures, avg_temp,
      min_temp, max_temp, status, notes
    } = req.body;

    const id = uuidv4();

    db.run(`
      INSERT INTO fridge_temperatures (
        id, batch_id, log_date, temperatures, avg_temp,
        min_temp, max_temp, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, batch_id, log_date, temperatures, avg_temp,
      min_temp, max_temp, status, notes
    ]);

    saveDatabase();
    res.json({ id, message: '冰箱温度记录创建成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/infant-requests', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM infant_requests ORDER BY created_at DESC');
    const requests = result.length > 0 ? result[0].values.map(row => {
      const obj = {};
      result[0].columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    }) : [];
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/infant-requests', (req, res) => {
  try {
    const {
      request_id, infant_name, infant_dob, gestational_age,
      weight, medical_condition, requested_ml, request_date,
      status, assigned_batch_id, notes
    } = req.body;

    const id = uuidv4();

    db.run(`
      INSERT INTO infant_requests (
        id, request_id, infant_name, infant_dob, gestational_age,
        weight, medical_condition, requested_ml, request_date,
        status, assigned_batch_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, request_id, infant_name, infant_dob, gestational_age,
      weight, medical_condition, requested_ml, request_date,
      status || 'pending', assigned_batch_id, notes
    ]);

    saveDatabase();
    res.json({ id, message: '早产儿领用申请创建成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/infant-requests/:id', (req, res) => {
  try {
    const {
      request_id, infant_name, infant_dob, gestational_age,
      weight, medical_condition, requested_ml, request_date,
      status, assigned_batch_id, notes
    } = req.body;

    db.run(`
      UPDATE infant_requests SET
        request_id = ?, infant_name = ?, infant_dob = ?, gestational_age = ?,
        weight = ?, medical_condition = ?, requested_ml = ?, request_date = ?,
        status = ?, assigned_batch_id = ?, notes = ?
      WHERE id = ?
    `, [
      request_id, infant_name, infant_dob, gestational_age,
      weight, medical_condition, requested_ml, request_date,
      status, assigned_batch_id, notes, req.params.id
    ]);

    saveDatabase();
    res.json({ message: '领用申请更新成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reviews', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM reviews ORDER BY created_at DESC');
    const reviews = result.length > 0 ? result[0].values.map(row => {
      const obj = {};
      result[0].columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    }) : [];
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reviews', (req, res) => {
  try {
    const {
      batch_id, review_date, reviewer, status, risk_assessment, notes
    } = req.body;

    const id = uuidv4();

    db.run(`
      INSERT INTO reviews (
        id, batch_id, review_date, reviewer, status, risk_assessment, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id, batch_id, review_date, reviewer, status, risk_assessment, notes
    ]);

    saveDatabase();
    res.json({ id, message: '复核记录创建成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/import-sample-data', (req, res) => {
  try {
    db.run('DELETE FROM batches');
    db.run('DELETE FROM donor_screenings');
    db.run('DELETE FROM bacteria_cultures');
    db.run('DELETE FROM fridge_temperatures');
    db.run('DELETE FROM infant_requests');
    db.run('DELETE FROM reviews');

    const sampleData = {
      batches: [
        {
          id: uuidv4(),
          batch_number: 'BM20240501001',
          donor_id: 'D001',
          donor_name: '张女士',
          collection_date: '2024-05-01',
          pasteurization_date: '2024-05-01',
          pasteurization_temp: 62.5,
          pasteurization_duration: 30,
          fridge_temp_log: '-20.0, -19.8, -20.2, -20.1',
          status: 'approved',
          risk_reasons: '[]'
        },
        {
          id: uuidv4(),
          batch_number: 'BM20240502002',
          donor_id: 'D002',
          donor_name: '李女士',
          collection_date: '2024-05-02',
          pasteurization_date: '2024-05-02',
          pasteurization_temp: 62.0,
          pasteurization_duration: 30,
          fridge_temp_log: '-19.5, -18.0, -17.5, -18.2',
          status: 'quarantine',
          risk_reasons: '[{"type": "温度异常", "reason": "冰箱温度波动超出安全范围"}]'
        },
        {
          id: uuidv4(),
          batch_number: 'BM20240503003',
          donor_id: 'D003',
          donor_name: '王女士',
          collection_date: '2024-05-03',
          pasteurization_date: '2024-05-03',
          pasteurization_temp: 63.0,
          pasteurization_duration: 30,
          fridge_temp_log: '-20.1, -20.0, -19.9, -20.2',
          status: 'pending',
          risk_reasons: '[]'
        }
      ],
      donorScreenings: [
        {
          id: uuidv4(),
          donor_id: 'D001',
          donor_name: '张女士',
          screening_date: '2024-04-28',
          blood_test_result: '正常',
          infectious_diseases: '无',
          medications: '无',
          lifestyle_factors: '无',
          overall_result: '合格',
          notes: '首次捐乳，身体健康'
        },
        {
          id: uuidv4(),
          donor_id: 'D002',
          donor_name: '李女士',
          screening_date: '2024-04-30',
          blood_test_result: '正常',
          infectious_diseases: '无',
          medications: '维生素补充剂',
          lifestyle_factors: '无',
          overall_result: '合格',
          notes: '正在服用维生素补充剂，不影响捐乳'
        },
        {
          id: uuidv4(),
          donor_id: 'D003',
          donor_name: '王女士',
          screening_date: '2024-05-01',
          blood_test_result: '正常',
          infectious_diseases: '无',
          medications: '无',
          lifestyle_factors: '无',
          overall_result: '合格',
          notes: '捐乳经验丰富，已捐乳多次'
        }
      ],
      bacteriaCultures: [
        {
          id: uuidv4(),
          batch_id: '',
          test_date: '2024-05-01',
          colony_count: 0,
          organism_identified: '无',
          antibiotic_sensitivity: '无',
          result: '阴性',
          notes: '细菌培养结果正常'
        }
      ],
      fridgeTemperatures: [
        {
          id: uuidv4(),
          batch_id: '',
          log_date: '2024-05-01',
          temperatures: '-20.0, -19.8, -20.2, -20.1',
          avg_temp: -20.0,
          min_temp: -20.2,
          max_temp: -19.8,
          status: '正常',
          notes: '温度稳定在安全范围'
        }
      ],
      infantRequests: [
        {
          id: uuidv4(),
          request_id: 'REQ20240505001',
          infant_name: '小明明',
          infant_dob: '2024-04-20',
          gestational_age: 32,
          weight: 1800,
          medical_condition: '早产儿，呼吸窘迫综合征',
          requested_ml: 100,
          request_date: '2024-05-05',
          status: 'approved',
          assigned_batch_id: '',
          notes: '需要特殊喂养需求'
        },
        {
          id: uuidv4(),
          request_id: 'REQ20240505002',
          infant_name: '小天天',
          infant_dob: '2024-04-15',
          gestational_age: 30,
          weight: 1500,
          medical_condition: '极低出生体重儿',
          requested_ml: 80,
          request_date: '2024-05-05',
          status: 'pending',
          assigned_batch_id: '',
          notes: '需要高营养需求'
        }
      ]
    };

    sampleData.batches.forEach(batch => {
      const now = new Date().toISOString();
      db.run(`
        INSERT INTO batches (
          id, batch_number, donor_id, donor_name, collection_date,
          pasteurization_date, pasteurization_temp, pasteurization_duration,
          fridge_temp_log, status, risk_reasons, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        batch.id, batch.batch_number, batch.donor_id, batch.donor_name, batch.collection_date,
        batch.pasteurization_date, batch.pasteurization_temp, batch.pasteurization_duration,
        batch.fridge_temp_log, batch.status, batch.risk_reasons, now, now
      ]);
    });

    sampleData.donorScreenings.forEach(screening => {
      db.run(`
        INSERT INTO donor_screenings (
          id, donor_id, donor_name, screening_date, blood_test_result,
          infectious_diseases, medications, lifestyle_factors, overall_result, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        screening.id, screening.donor_id, screening.donor_name, screening.screening_date,
        screening.blood_test_result, screening.infectious_diseases, screening.medications,
        screening.lifestyle_factors, screening.overall_result, screening.notes
      ]);
    });

    sampleData.bacteriaCultures.forEach(culture => {
      db.run(`
        INSERT INTO bacteria_cultures (
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        culture.id, culture.batch_id, culture.test_date, culture.colony_count,
        culture.organism_identified, culture.antibiotic_sensitivity, culture.result, culture.notes
      ]);
    });

    sampleData.fridgeTemperatures.forEach(temp => {
      db.run(`
        INSERT INTO fridge_temperatures (
          id, batch_id, log_date, temperatures, avg_temp,
          min_temp, max_temp, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        temp.id, temp.batch_id, temp.log_date, temp.temperatures, temp.avg_temp,
        temp.min_temp, temp.max_temp, temp.status, temp.notes
      ]);
    });

    sampleData.infantRequests.forEach(request => {
      db.run(`
        INSERT INTO infant_requests (
          id, request_id, infant_name, infant_dob, gestational_age,
          weight, medical_condition, requested_ml, request_date,
          status, assigned_batch_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        request.id, request.request_id, request.infant_name, request.infant_dob,
        request.gestational_age, request.weight, request.medical_condition,
        request.requested_ml, request.request_date, request.status, request.assigned_batch_id, request.notes
      ]);
    });

    saveDatabase();
    res.json({ message: '示例数据导入成功', count: {
      batches: sampleData.batches.length,
      donorScreenings: sampleData.donorScreenings.length,
      bacteriaCultures: sampleData.bacteriaCultures.length,
      fridgeTemperatures: sampleData.fridgeTemperatures.length,
      infantRequests: sampleData.infantRequests.length
    }});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/markdown', (req, res) => {
  try {
    const batchesResult = db.exec('SELECT * FROM batches ORDER BY created_at DESC');
    const batches = batchesResult.length > 0 ? batchesResult[0].values.map(row => {
      const obj = {};
      batchesResult[0].columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    }) : [];

    const requestsResult = db.exec('SELECT * FROM infant_requests ORDER BY created_at DESC');
    const requests = requestsResult.length > 0 ? requestsResult[0].values.map(row => {
      const obj = {};
      requestsResult[0].columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    }) : [];

    const reviewsResult = db.exec('SELECT * FROM reviews ORDER BY created_at DESC');
    const reviews = reviewsResult.length > 0 ? reviewsResult[0].values.map(row => {
      const obj = {};
      reviewsResult[0].columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    }) : [];

    let markdown = `# 母乳库放行交接单\n\n`;
    markdown += `生成时间：${new Date().toLocaleString('zh-CN')}\n\n`;
    markdown += `## 批次状态概览\n\n`;
    markdown += `| 批次号 | 捐乳者 | 采集日期 | 状态 | 风险原因 |\n`;
    markdown += `|--------|----------|----------|------|----------|\n`;

    batches.forEach(batch => {
      const statusText = {
        'pending': '待复核',
        'approved': '可发放',
        'quarantine': '隔离',
        'discarded': '报废'
      }[batch.status] || batch.status;

      let riskReasons = '';
      try {
        const risks = JSON.parse(batch.risk_reasons || '[]');
        riskReasons = risks.map(r => r.reason || r).join('; ');
      } catch {
        riskReasons = batch.risk_reasons || '无';
      }

      markdown += `| ${batch.batch_number} | ${batch.donor_name} | ${batch.collection_date} | ${statusText} | ${riskReasons} |\n`;
    });

    markdown += `\n## 早产儿领用申请\n\n`;
    markdown += `| 申请号 | 婴儿姓名 | 孕周 | 体重 | 申请量 | 状态 |\n`;
    markdown += `|--------|----------|------|------|--------|------|\n`;

    requests.forEach(request => {
      const statusText = {
        'pending': '待处理',
        'approved': '已批准',
        'rejected': '已拒绝'
      }[request.status] || request.status;

      markdown += `| ${request.request_id} | ${request.infant_name} | ${request.gestational_age}周 | ${request.weight}g | ${request.requested_ml}ml | ${statusText} |\n`;
    });

    if (reviews.length > 0) {
      markdown += `\n## 复核记录\n\n`;
      reviews.forEach(review => {
        const statusText = {
          'approved': '可发放',
          'quarantine': '隔离',
          'discarded': '报废'
        }[review.status] || review.status;

        markdown += `### 批次: ${review.batch_id}\n`;
        markdown += `- 复核时间: ${review.review_date}\n`;
        markdown += `- 复核人: ${review.reviewer}\n`;
        markdown += `- 状态: ${statusText}\n`;
        markdown += `- 风险评估: ${review.risk_assessment || '无'}\n`;
        markdown += `- 备注: ${review.notes || '无'}\n\n`;
      });
    }

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="breastmilk-release-${new Date().toISOString().split('T')[0]}.md`);
    res.send(markdown);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/json', (req, res) => {
  try {
    const exportData = {
      exportDate: new Date().toISOString(),
      batches: [],
      donorScreenings: [],
      bacteriaCultures: [],
      fridgeTemperatures: [],
      infantRequests: [],
      reviews: []
    };

    const batchesResult = db.exec('SELECT * FROM batches ORDER BY created_at DESC');
    if (batchesResult.length > 0) {
      exportData.batches = batchesResult[0].values.map(row => {
        const obj = {};
        batchesResult[0].columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      });
    }

    const screeningsResult = db.exec('SELECT * FROM donor_screenings ORDER BY created_at DESC');
    if (screeningsResult.length > 0) {
      exportData.donorScreenings = screeningsResult[0].values.map(row => {
        const obj = {};
        screeningsResult[0].columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      });
    }

    const culturesResult = db.exec('SELECT * FROM bacteria_cultures ORDER BY created_at DESC');
    if (culturesResult.length > 0) {
      exportData.bacteriaCultures = culturesResult[0].values.map(row => {
        const obj = {};
        culturesResult[0].columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      });
    }

    const tempsResult = db.exec('SELECT * FROM fridge_temperatures ORDER BY created_at DESC');
    if (tempsResult.length > 0) {
      exportData.fridgeTemperatures = tempsResult[0].values.map(row => {
        const obj = {};
        tempsResult[0].columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      });
    }

    const requestsResult = db.exec('SELECT * FROM infant_requests ORDER BY created_at DESC');
    if (requestsResult.length > 0) {
      exportData.infantRequests = requestsResult[0].values.map(row => {
        const obj = {};
        requestsResult[0].columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      });
    }

    const reviewsResult = db.exec('SELECT * FROM reviews ORDER BY created_at DESC');
    if (reviewsResult.length > 0) {
      exportData.reviews = reviewsResult[0].values.map(row => {
        const obj = {};
        reviewsResult[0].columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      });
    }

    const jsonStr = JSON.stringify(exportData, null, 2);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="breastmilk-audit-${new Date().toISOString().split('T')[0]}.json"`);
    res.send(jsonStr);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`母乳库值班放行复核应用后端服务运行在 http://localhost:${PORT}`);
  });
});