const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const { db, examTypes, initDatabase } = require('./database');
const qualService = require('./qualificationService');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

initDatabase();

function generateId() {
  return 'CAND' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
}

function getStepDescription(step) {
  const stepMap = {
    'initial': '初始录入',
    'photo_required': '缺少照片',
    'qualification_failed': '资格不通过',
    'payment_required': '未缴费',
    'ready_for_review': '待审核',
    'review_pending': '审核中',
    'approved': '审核通过',
    'rejected': '审核不通过'
  };
  return stepMap[step] || step;
}

function getStatusBadge(status) {
  const statusMap = {
    'pending': '待处理',
    'qualification_failed': '资格失败',
    'approved': '通过',
    'rejected': '不通过',
    'payment_failed': '缴费异常'
  };
  return statusMap[status] || status;
}

function getPaymentStatusText(status) {
  const map = {
    'unpaid': '未缴费',
    'paid': '已缴费',
    'failed': '缴费失败',
    'refunded': '已退款'
  };
  return map[status] || status;
}

app.get('/api/exam-types', (req, res) => {
  db.all('SELECT * FROM exam_types', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/candidates', (req, res) => {
  const { name, idCard, phone, education, workYears, examTypeId, photoUploaded, paymentStatus } = req.body;
  
  const id = generateId();
  const currentStep = qualService.determineCurrentStep({
    education,
    work_years: workYears,
    exam_type_id: examTypeId,
    photo_uploaded: photoUploaded ? 1 : 0,
    payment_status: paymentStatus
  });

  const stmt = db.prepare(`INSERT INTO candidates 
    (id, name, id_card, phone, education, work_years, exam_type_id, photo_uploaded, payment_status, current_step)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  stmt.run(id, name, idCard, phone, education, workYears, examTypeId, 
    photoUploaded ? 1 : 0,
    paymentStatus || 'unpaid', currentStep,
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: '该身份证号已存在' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ id, message: '考生信息录入成功', currentStep, stepDescription: getStepDescription(currentStep) });
    }
  );
  stmt.finalize();
});

app.get('/api/candidates', (req, res) => {
  const query = `
    SELECT c.*, et.name as exam_type_name 
    FROM candidates c
    LEFT JOIN exam_types et ON c.exam_type_id = et.id
    ORDER BY c.created_at DESC
  `;
  
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const candidates = rows.map(row => ({
      ...row,
      step_description: getStepDescription(row.current_step),
      status_text: getStatusBadge(row.status),
      payment_status_text: getPaymentStatusText(row.payment_status)
    }));
    res.json(candidates);
  });
});

app.get('/api/candidates/:id', (req, res) => {
  db.get(`
    SELECT c.*, et.name as exam_type_name, et.min_education, et.min_work_years
    FROM candidates c
    LEFT JOIN exam_types et ON c.exam_type_id = et.id
    WHERE c.id = ?
  `, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: '考生不存在' });
    
    const eligibility = qualService.checkReviewEligibility(row);
    row.step_description = getStepDescription(row.current_step);
    row.eligibility_checks = eligibility.checks;
    row.eligibility_all_passed = eligibility.allPassed;
    
    res.json(row);
  });
});

app.post('/api/candidates/:id/qualification-check', (req, res) => {
  db.get('SELECT * FROM candidates WHERE id = ?', [req.params.id], (err, candidate) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!candidate) return res.status(404).json({ error: '考生不存在' });

    const result = qualService.checkQualification(
      candidate.education,
      candidate.work_years,
      candidate.exam_type_id
    );

    const newStep = result.passed ? 'ready_for_review' : 'qualification_failed';
    const newStatus = result.passed ? 'pending' : 'qualification_failed';

    db.run('UPDATE candidates SET current_step = ?, status = ?, qualification_result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStep, newStatus, result.passed ? 'passed' : 'failed', req.params.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.run('INSERT INTO audit_logs (candidate_id, step, result, comment) VALUES (?, ?, ?, ?)',
          [req.params.id, 'qualification', result.passed ? 'passed' : 'failed', result.error || '资格校验'],
          function(err) {
            if (err) console.error(err);
            res.json({
              ...result,
              candidateId: req.params.id,
              newStep,
              stepDescription: getStepDescription(newStep)
            });
          }
        );
      }
    );
  });
});

app.post('/api/candidates/:id/supplement-photo', (req, res) => {
  db.run('UPDATE candidates SET photo_uploaded = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: '考生不存在' });

      db.get('SELECT * FROM candidates WHERE id = ?', [req.params.id], (err, candidate) => {
        if (err) return res.status(500).json({ error: err.message });

        const newStep = qualService.determineCurrentStep(candidate);

        db.run('UPDATE candidates SET current_step = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newStep, req.params.id],
          (err) => {
            if (err) return res.status(500).json({ error: err.message });

            db.run('INSERT INTO audit_logs (candidate_id, step, result, comment) VALUES (?, ?, ?, ?)',
              [req.params.id, 'photo_supplement', 'passed', '已补交照片'],
              (err) => {
                if (err) console.error(err);
                res.json({
                  message: '照片补交成功',
                  newStep,
                  stepDescription: getStepDescription(newStep)
                });
              }
            );
          }
        );
      });
    }
  );
});

app.post('/api/candidates/:id/payment-confirm', (req, res) => {
  db.run('UPDATE candidates SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['paid', req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: '考生不存在' });

      db.get('SELECT * FROM candidates WHERE id = ?', [req.params.id], (err, candidate) => {
        if (err) return res.status(500).json({ error: err.message });

        const newStep = qualService.determineCurrentStep(candidate);

        db.run('UPDATE candidates SET current_step = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newStep, req.params.id],
          (err) => {
            if (err) return res.status(500).json({ error: err.message });

            db.run('INSERT INTO audit_logs (candidate_id, step, result, comment) VALUES (?, ?, ?, ?)',
              [req.params.id, 'payment', 'passed', '缴费确认'],
              (err) => {
                if (err) console.error(err);
                res.json({
                  message: '缴费确认成功',
                  newStep,
                  stepDescription: getStepDescription(newStep)
                });
              }
            );
          }
        );
      });
    }
  );
});

app.post('/api/candidates/:id/review', (req, res) => {
  const { decision, comment } = req.body;

  db.get('SELECT * FROM candidates WHERE id = ?', [req.params.id], (err, candidate) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!candidate) return res.status(404).json({ error: '考生不存在' });

    const eligibility = qualService.canPassReview(candidate);

    if (decision === 'approve' && !eligibility.canPass) {
      return res.status(400).json({
        error: '审核拦截',
        blockedReason: eligibility.blockedReason
      });
    }

    const needsReReview = qualService.needsReReviewAfterSupplement(candidate);

    const newStatus = decision === 'approve' ? 'approved' : 'rejected';
    const newStep = decision === 'approve' ? 'approved' : 'rejected';

    db.run('UPDATE candidates SET status = ?, current_step = ?, qualification_review_comment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, newStep, comment || null, req.params.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });

        db.run('INSERT INTO audit_logs (candidate_id, step, result, comment) VALUES (?, ?, ?, ?)',
          [req.params.id, 'review', decision === 'approve' ? 'passed' : 'failed', comment || '审核'],
          (err) => {
            if (err) console.error(err);
            res.json({
              message: `审核${decision === 'approve' ? '通过' : '不通过'}`,
              newStatus,
              newStep,
              stepDescription: getStepDescription(newStep)
            });
          }
        );
      }
    );
  });
});

app.post('/api/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传CSV文件' });

  const results = {
    success: [],
    failed: [],
    total: 0
  };

  const importRecordStmt = db.prepare('INSERT INTO import_records (filename, total_count, success_count, failed_count) VALUES (?, ?, ?, ?)');
  const failureStmt = db.prepare('INSERT INTO import_failures (import_record_id, row_number, row_data, error_message) VALUES (?, ?, ?, ?)');

  let importRecordId = null;
  let rowNumber = 1;
  let successCount = 0;
  let failedCount = 0;

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => {
      rowNumber++;
      results.total++;

      const errors = [];
      if (!row['姓名']) errors.push('缺少姓名字段');
      if (!row['身份证号']) errors.push('缺少身份证号字段');
      if (!row['学历']) errors.push('缺少学历字段');
      if (!row['工作年限']) errors.push('缺少工作年限字段');
      if (!row['考试类型']) errors.push('缺少考试类型字段');

      const workYears = parseInt(row['工作年限'], 10);
      if (isNaN(workYears)) errors.push('工作年限必须是数字');

      const examTypeIdMap = {
        '一级建造师': 'architect',
        '工程师': 'engineer',
        '中级工程师': 'engineer',
        '注册会计师': 'accountant'
      };

      const examTypeId = examTypeIdMap[row['考试类型']] || 'architect';

      if (errors.length > 0) {
        failedCount++;
        results.failed.push({
          row: rowNumber,
          data: row,
          error: errors.join('；')
        });
        return;
      }

      const id = generateId();
      const photoUploaded = (row['照片'] && row['照片'] === '是') ? 1 : 0;
      const paymentStatus = row['缴费状态'] === '已缴费' ? 'paid' : 'unpaid';

      const currentStep = qualService.determineCurrentStep({
        education: row['学历'],
        work_years: workYears,
        exam_type_id: examTypeId,
        photo_uploaded: photoUploaded,
        payment_status: paymentStatus
      });

      const stmt = db.prepare(`INSERT INTO candidates
        (id, name, id_card, phone, education, work_years, exam_type_id, photo_uploaded, payment_status, current_step)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

      stmt.run(id,
        row['姓名'],
        row['身份证号'],
        row['电话'] || null,
        row['学历'],
        workYears,
        examTypeId,
        photoUploaded,
        paymentStatus,
        currentStep,
        function(err) {
          if (err) {
            failedCount++;
            if (err.message.includes('UNIQUE')) {
              results.failed.push({
                row: rowNumber,
                data: row,
                error: '身份证号已存在'
              });
            } else {
              results.failed.push({
                row: rowNumber,
                data: row,
                error: err.message
              });
            }
          } else {
            successCount++;
            results.success.push({
              id,
              name: row['姓名'],
              step: currentStep,
              stepDescription: getStepDescription(currentStep)
            });
          }
        }
      );
      stmt.finalize();
    })
    .on('end', () => {
      importRecordStmt.run(req.file.originalname, results.total, successCount, failedCount, function(err) {
        if (err) console.error(err);
        importRecordId = this.lastID;

        results.failed.forEach(f => {
          failureStmt.run(importRecordId, f.row, JSON.stringify(f.data), f.error);
        });
        failureStmt.finalize();

        fs.unlinkSync(req.file.path);

        let importResult = {
          total: results.total,
          success: successCount,
          failed: failedCount,
          successList: results.success,
          failedList: results.failed
        };

        if (successCount === results.total) {
          importResult.overallStatus = '全部成功';
        } else if (successCount > 0 && failedCount > 0) {
          importResult.overallStatus = '部分成功';
        } else {
          importResult.overallStatus = '全部失败';
        }

        res.json(importResult);
      });
    })
    .on('error', (err) => {
      res.status(500).json({ error: '文件解析错误: ' + err.message });
    });
});

app.get('/api/export', (req, res) => {
  const query = `
    SELECT
      c.name as 姓名,
      c.id_card as 身份证号,
      c.phone as 联系电话,
      et.name as 考试类型,
      c.education as 学历,
      c.work_years as 工作年限,
      CASE WHEN c.photo_uploaded = 1 THEN '是' ELSE '否' END as 照片已上传,
      CASE c.payment_status
        WHEN 'paid' THEN '已缴费'
        WHEN 'unpaid' THEN '未缴费'
        ELSE c.payment_status
      END as 缴费状态,
      CASE c.current_step
        WHEN 'initial' THEN '初始录入'
        WHEN 'photo_required' THEN '缺少照片'
        WHEN 'qualification_failed' THEN '资格不通过'
        WHEN 'payment_required' THEN '未缴费'
        WHEN 'ready_for_review' THEN '待审核'
        WHEN 'approved' THEN '审核通过'
        WHEN 'rejected' THEN '审核不通过'
        ELSE c.current_step
      END as 当前步骤,
      CASE c.status
        WHEN 'pending' THEN '待处理'
        WHEN 'qualification_failed' THEN '资格失败'
        WHEN 'approved' THEN '通过'
        WHEN 'rejected' THEN '不通过'
        ELSE c.status
      END as 审核状态,
      c.qualification_review_comment as 审核意见
    FROM candidates c
    LEFT JOIN exam_types et ON c.exam_type_id = et.id
    ORDER BY c.created_at DESC
  `;

  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const fields = ['姓名', '身份证号', '联系电话', '考试类型', '学历', '工作年限', '照片已上传', '缴费状态', '当前步骤', '审核状态', '审核意见'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(rows);

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('考试报名核对表.csv');
    res.send('\uFEFF' + csv);
  });
});

app.get('/api/stats', (req, res) => {
  db.all(`
    SELECT
      current_step,
      COUNT(*) as count
    FROM candidates
    GROUP BY current_step
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const stats = {};
    rows.forEach(row => {
      stats[row.current_step] = row.count;
    });

    res.json({
      byStep: stats,
      stepDescriptions: {
        initial: '初始录入',
        photo_required: '缺少照片',
        qualification_failed: '资格不通过',
        payment_required: '未缴费',
        ready_for_review: '待审核',
        approved: '审核通过',
        rejected: '审核不通过'
      }
    });
  });
});

function seedSampleData() {
  const samples = [
    {
      name: '张三',
      idCard: '110101199001011234',
      phone: '13800138001',
      education: '本科',
      workYears: 5,
      examTypeId: 'architect',
      photoUploaded: 1,
      paymentStatus: 'paid',
      desc: '正常通过候选人（全部条件满足）'
    },
    {
      name: '李四',
      idCard: '110101199202022345',
      phone: '13800138002',
      education: '本科',
      workYears: 2,
      examTypeId: 'architect',
      photoUploaded: 1,
      paymentStatus: 'paid',
      desc: '年限不足（一级建造师需要4年）'
    },
    {
      name: '王五',
      idCard: '110101198803033456',
      phone: '13800138003',
      education: '本科',
      workYears: 6,
      examTypeId: 'engineer',
      photoUploaded: 0,
      paymentStatus: 'paid',
      desc: '照片缺失，待补交'
    },
    {
      name: '赵六',
      idCard: '110101198504044567',
      phone: '13800138004',
      education: '硕士',
      workYears: 8,
      examTypeId: 'accountant',
      photoUploaded: 1,
      paymentStatus: 'unpaid',
      desc: '缴费异常（未缴费）'
    }
  ];

  samples.forEach((sample, index) => {
    const id = generateId() + index;
    const currentStep = qualService.determineCurrentStep({
      education: sample.education,
      work_years: sample.workYears,
      exam_type_id: sample.examTypeId,
      photo_uploaded: sample.photoUploaded,
      payment_status: sample.paymentStatus
    });

    db.get('SELECT id FROM candidates WHERE id_card = ?', [sample.idCard], (err, existing) => {
      if (!existing) {
        const stmt = db.prepare(`INSERT INTO candidates
          (id, name, id_card, phone, education, work_years, exam_type_id, photo_uploaded, payment_status, current_step)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

        stmt.run(id, sample.name, sample.idCard, sample.phone, sample.education, sample.workYears,
          sample.examTypeId, sample.photoUploaded, sample.paymentStatus, currentStep,
          (err) => {
            if (err) console.error(err);
            console.log(`已添加样例数据：${sample.name} - ${sample.desc}`);
          }
        );
        stmt.finalize();
      }
    });
  });
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  seedSampleData();
});
