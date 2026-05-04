const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const dbPath = path.join(__dirname, 'database', 'claims.db');
const uploadsDir = path.join(__dirname, 'uploads');
const exportsDir = path.join(__dirname, 'exports');

if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    policy_number TEXT,
    status TEXT DEFAULT 'processing',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id INTEGER NOT NULL,
    bill_date TEXT,
    amount REAL,
    hospital TEXT,
    department TEXT,
    bill_type TEXT,
    invoice_number TEXT,
    has_invoice_stamp INTEGER DEFAULT 0,
    has_diagnosis INTEGER DEFAULT 0,
    original_path TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (claim_id) REFERENCES claims(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id INTEGER NOT NULL,
    policy_name TEXT,
    deductible_amount REAL,
    waiting_period_days INTEGER,
    effective_date TEXT,
    policy_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (claim_id) REFERENCES claims(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS missing_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id INTEGER NOT NULL,
    item_type TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'medium',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (claim_id) REFERENCES claims(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (claim_id) REFERENCES claims(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT,
    description TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (claim_id) REFERENCES claims(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS risk_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id INTEGER NOT NULL,
    check_type TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    details TEXT,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (claim_id) REFERENCES claims(id)
  )`);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

app.get('/api/claims', (req, res) => {
  db.all('SELECT * FROM claims ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get('/api/claims/:id', (req, res) => {
  const claimId = req.params.id;
  
  db.get('SELECT * FROM claims WHERE id = ?', [claimId], (err, claim) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    
    db.all('SELECT * FROM bills WHERE claim_id = ?', [claimId], (err, bills) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      db.all('SELECT * FROM policies WHERE claim_id = ?', [claimId], (err, policies) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        db.all('SELECT * FROM missing_items WHERE claim_id = ?', [claimId], (err, missingItems) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          db.all('SELECT * FROM notes WHERE claim_id = ?', [claimId], (err, notes) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            
            db.all('SELECT * FROM photos WHERE claim_id = ?', [claimId], (err, photos) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              
              db.all('SELECT * FROM risk_checks WHERE claim_id = ?', [claimId], (err, riskChecks) => {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }
                
                res.json({
                  claim,
                  bills,
                  policies,
                  missingItems,
                  notes,
                  photos,
                  riskChecks
                });
              });
            });
          });
        });
      });
    });
  });
});

app.post('/api/claims', (req, res) => {
  const { case_number, customer_name, policy_number } = req.body;
  
  if (!case_number || !customer_name) {
    return res.status(400).json({ error: 'Case number and customer name are required' });
  }
  
  db.run(
    'INSERT INTO claims (case_number, customer_name, policy_number) VALUES (?, ?, ?)',
    [case_number, customer_name, policy_number],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(400).json({ error: 'Case number already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      
      res.status(201).json({
        id: this.lastID,
        case_number,
        customer_name,
        policy_number
      });
    }
  );
});

app.put('/api/claims/:id', (req, res) => {
  const claimId = req.params.id;
  const { case_number, customer_name, policy_number, status } = req.body;
  
  db.run(
    `UPDATE claims 
     SET case_number = ?, customer_name = ?, policy_number = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [case_number, customer_name, policy_number, status, claimId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Claim not found' });
      }
      
      res.json({ message: 'Claim updated successfully' });
    }
  );
});

app.delete('/api/claims/:id', (req, res) => {
  const claimId = req.params.id;
  
  db.serialize(() => {
    db.run('DELETE FROM bills WHERE claim_id = ?', [claimId]);
    db.run('DELETE FROM policies WHERE claim_id = ?', [claimId]);
    db.run('DELETE FROM missing_items WHERE claim_id = ?', [claimId]);
    db.run('DELETE FROM notes WHERE claim_id = ?', [claimId]);
    db.run('DELETE FROM photos WHERE claim_id = ?', [claimId]);
    db.run('DELETE FROM risk_checks WHERE claim_id = ?', [claimId]);
    
    db.run('DELETE FROM claims WHERE id = ?', [claimId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Claim not found' });
      }
      
      res.json({ message: 'Claim deleted successfully' });
    });
  });
});

app.post('/api/claims/:id/import-csv', upload.single('csvFile'), (req, res) => {
  const claimId = req.params.id;
  const csvPath = req.file.path;
  
  const bills = [];
  
  fs.createReadStream(csvPath)
    .pipe(csvParser())
    .on('data', (row) => {
      bills.push(row);
    })
    .on('end', () => {
      const stmt = db.prepare(`INSERT INTO bills 
        (claim_id, bill_date, amount, hospital, department, bill_type, invoice_number, notes) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      
      bills.forEach(bill => {
        stmt.run([
          claimId,
          bill['日期'] || bill['date'] || bill['bill_date'] || null,
          parseFloat(bill['金额'] || bill['amount'] || bill['total'] || 0),
          bill['医院'] || bill['hospital'] || bill['hospital_name'] || null,
          bill['科室'] || bill['department'] || null,
          bill['类型'] || bill['type'] || bill['bill_type'] || null,
          bill['发票号'] || bill['invoice_number'] || bill['invoice_no'] || null,
          JSON.stringify(bill)
        ]);
      });
      
      stmt.finalize((err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        fs.unlinkSync(csvPath);
        res.json({ 
          message: `Successfully imported ${bills.length} bills`,
          count: bills.length
        });
      });
    })
    .on('error', (err) => {
      res.status(500).json({ error: err.message });
    });
});

app.post('/api/claims/:id/import-policy', upload.single('policyFile'), (req, res) => {
  const claimId = req.params.id;
  const policyPath = req.file.path;
  
  fs.readFile(policyPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    try {
      const policyData = JSON.parse(data);
      
      db.run(`INSERT INTO policies 
        (claim_id, policy_name, deductible_amount, waiting_period_days, effective_date, policy_data) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          claimId,
          policyData.policy_name || policyData.name || '未命名保单',
          policyData.deductible_amount || policyData.deductible || 0,
          policyData.waiting_period_days || policyData.waiting_period || 0,
          policyData.effective_date || policyData.start_date || null,
          JSON.stringify(policyData)
        ],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          fs.unlinkSync(policyPath);
          res.json({ 
            message: 'Policy imported successfully',
            id: this.lastID
          });
        }
      );
    } catch (parseErr) {
      res.status(400).json({ error: 'Invalid JSON format' });
    }
  });
});

app.post('/api/claims/:id/import-photos', upload.array('photoFiles'), (req, res) => {
  const claimId = req.params.id;
  const files = req.files;
  
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  
  const stmt = db.prepare(`INSERT INTO photos (claim_id, file_name, file_path, description) VALUES (?, ?, ?, ?)`);
  
  files.forEach(file => {
    stmt.run([claimId, file.originalname, file.path, '']);
  });
  
  stmt.finalize((err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.json({ 
      message: `Successfully imported ${files.length} photos`,
      count: files.length
    });
  });
});

app.post('/api/claims/:id/notes', (req, res) => {
  const claimId = req.params.id;
  const { content } = req.body;
  
  if (!content) {
    return res.status(400).json({ error: 'Note content is required' });
  }
  
  db.run('INSERT INTO notes (claim_id, content) VALUES (?, ?)', [claimId, content], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.status(201).json({
      id: this.lastID,
      content,
      created_at: new Date().toISOString()
    });
  });
});

app.post('/api/claims/:id/missing-items', (req, res) => {
  const claimId = req.params.id;
  const { item_type, description, priority } = req.body;
  
  if (!item_type || !description) {
    return res.status(400).json({ error: 'Item type and description are required' });
  }
  
  db.run(
    'INSERT INTO missing_items (claim_id, item_type, description, priority) VALUES (?, ?, ?, ?)',
    [claimId, item_type, description, priority || 'medium'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      res.status(201).json({
        id: this.lastID,
        item_type,
        description,
        priority: priority || 'medium',
        status: 'pending'
      });
    }
  );
});

app.put('/api/missing-items/:id', (req, res) => {
  const itemId = req.params.id;
  const { status, description, priority, notes } = req.body;
  
  db.run(
    `UPDATE missing_items 
     SET status = ?, description = ?, priority = ?, notes = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [status, description, priority, notes, itemId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Missing item not found' });
      }
      
      res.json({ message: 'Missing item updated successfully' });
    }
  );
});

app.post('/api/claims/:id/check-risks', (req, res) => {
  const claimId = req.params.id;
  
  db.all('SELECT * FROM bills WHERE claim_id = ?', [claimId], (err, bills) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    db.all('SELECT * FROM policies WHERE claim_id = ?', [claimId], (err, policies) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      const riskChecks = [];
      
      const totalAmount = bills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
      const policy = policies[0];
      
      if (policy && policy.deductible_amount > 0) {
        const deductibleMet = totalAmount >= policy.deductible_amount;
        riskChecks.push({
          check_type: 'deductible',
          status: deductibleMet ? 'passed' : 'warning',
          message: deductibleMet ? '免赔额已达到' : '免赔额未达到',
          details: `总金额: ${totalAmount}, 免赔额: ${policy.deductible_amount}`
        });
      }
      
      if (policy && policy.waiting_period_days > 0 && policy.effective_date) {
        const effectiveDate = new Date(policy.effective_date);
        const waitingPeriodEnd = new Date(effectiveDate.getTime() + policy.waiting_period_days * 24 * 60 * 60 * 1000);
        
        let hasWaitingPeriodConflict = false;
        bills.forEach(bill => {
          if (bill.bill_date) {
            const billDate = new Date(bill.bill_date);
            if (billDate < waitingPeriodEnd) {
              hasWaitingPeriodConflict = true;
            }
          }
        });
        
        riskChecks.push({
          check_type: 'waiting_period',
          status: hasWaitingPeriodConflict ? 'warning' : 'passed',
          message: hasWaitingPeriodConflict ? '存在等待期冲突' : '等待期检查通过',
          details: `等待期结束日期: ${waitingPeriodEnd.toISOString().split('T')[0]}`
        });
      }
      
      const invoiceMap = new Map();
      const duplicateInvoices = [];
      bills.forEach((bill, index) => {
        if (bill.invoice_number) {
          if (invoiceMap.has(bill.invoice_number)) {
            duplicateInvoices.push(bill.invoice_number);
          } else {
            invoiceMap.set(bill.invoice_number, index);
          }
        }
      });
      
      riskChecks.push({
        check_type: 'duplicate_bills',
        status: duplicateInvoices.length > 0 ? 'warning' : 'passed',
        message: duplicateInvoices.length > 0 ? '发现重复票据' : '无重复票据',
        details: duplicateInvoices.length > 0 ? `重复发票号: ${duplicateInvoices.join(', ')}` : '所有票据唯一'
      });
      
      const hasDiagnosis = bills.some(bill => bill.has_diagnosis === 1);
      riskChecks.push({
        check_type: 'diagnosis_proof',
        status: hasDiagnosis ? 'passed' : 'warning',
        message: hasDiagnosis ? '已提供诊断证明' : '缺少诊断证明',
        details: hasDiagnosis ? '诊断证明已上传' : '需要补充诊断证明'
      });
      
      const hasInvoiceStamp = bills.some(bill => bill.has_invoice_stamp === 1);
      riskChecks.push({
        check_type: 'invoice_stamp',
        status: hasInvoiceStamp ? 'passed' : 'warning',
        message: hasInvoiceStamp ? '发票章已验证' : '缺少发票章',
        details: hasInvoiceStamp ? '发票章已确认' : '需要确认发票章是否齐全'
      });
      
      db.run('DELETE FROM risk_checks WHERE claim_id = ?', [claimId], (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        const stmt = db.prepare(`INSERT INTO risk_checks 
          (claim_id, check_type, status, message, details) 
          VALUES (?, ?, ?, ?, ?)`);
        
        riskChecks.forEach(check => {
          stmt.run([
            claimId,
            check.check_type,
            check.status,
            check.message,
            check.details
          ]);
        });
        
        stmt.finalize((err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          res.json({
            message: 'Risk check completed',
            checks: riskChecks
          });
        });
      });
    });
  });
});

app.get('/api/claims/:id/export/markdown', (req, res) => {
  const claimId = req.params.id;
  
  db.get('SELECT * FROM claims WHERE id = ?', [claimId], (err, claim) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    
    db.all('SELECT * FROM missing_items WHERE claim_id = ?', [claimId], (err, missingItems) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      db.all('SELECT * FROM notes WHERE claim_id = ?', [claimId], (err, notes) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        let markdown = `# 理赔案件补件清单\n\n`;
        markdown += `## 案件信息\n\n`;
        markdown += `- **案件编号**: ${claim.case_number}\n`;
        markdown += `- **客户姓名**: ${claim.customer_name}\n`;
        markdown += `- **保单号**: ${claim.policy_number || '无'}\n`;
        markdown += `- **当前状态**: ${claim.status}\n`;
        markdown += `- **创建时间**: ${claim.created_at}\n\n`;
        
        markdown += `## 缺件清单\n\n`;
        if (missingItems.length === 0) {
          markdown += `暂无缺件\n\n`;
        } else {
          const pendingItems = missingItems.filter(item => item.status === 'pending');
          const resolvedItems = missingItems.filter(item => item.status === 'resolved');
          
          if (pendingItems.length > 0) {
            markdown += `### 待补充\n\n`;
            pendingItems.forEach((item, index) => {
              markdown += `${index + 1}. **${item.item_type}** - ${item.description}\n`;
              markdown += `   - 优先级: ${item.priority}\n`;
              if (item.notes) {
                markdown += `   - 备注: ${item.notes}\n`;
              }
              markdown += `\n`;
            });
          }
          
          if (resolvedItems.length > 0) {
            markdown += `### 已补充\n\n`;
            resolvedItems.forEach((item, index) => {
              markdown += `${index + 1}. **${item.item_type}** - ${item.description}\n`;
              if (item.notes) {
                markdown += `   - 备注: ${item.notes}\n`;
              }
              markdown += `\n`;
            });
          }
        }
        
        markdown += `## 人工备注\n\n`;
        if (notes.length === 0) {
          markdown += `暂无备注\n\n`;
        } else {
          notes.forEach((note, index) => {
            markdown += `### 备注 ${index + 1} (${note.created_at})\n\n`;
            markdown += `${note.content}\n\n`;
          });
        }
        
        const fileName = `补件清单-${claim.case_number}-${Date.now()}.md`;
        const filePath = path.join(exportsDir, fileName);
        
        fs.writeFile(filePath, markdown, 'utf8', (err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          res.download(filePath, fileName, (err) => {
            if (err) {
              console.error('Download error:', err);
            }
          });
        });
      });
    });
  });
});

app.get('/api/claims/:id/export/json', (req, res) => {
  const claimId = req.params.id;
  
  db.get('SELECT * FROM claims WHERE id = ?', [claimId], (err, claim) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    
    db.all('SELECT * FROM bills WHERE claim_id = ?', [claimId], (err, bills) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      db.all('SELECT * FROM policies WHERE claim_id = ?', [claimId], (err, policies) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        db.all('SELECT * FROM missing_items WHERE claim_id = ?', [claimId], (err, missingItems) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          db.all('SELECT * FROM notes WHERE claim_id = ?', [claimId], (err, notes) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            
            db.all('SELECT * FROM risk_checks WHERE claim_id = ?', [claimId], (err, riskChecks) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              
              const auditPackage = {
                export_version: '1.0',
                export_date: new Date().toISOString(),
                claim: claim,
                bills: bills,
                policies: policies,
                missing_items: missingItems,
                notes: notes,
                risk_checks: riskChecks,
                summary: {
                  total_bills: bills.length,
                  total_amount: bills.reduce((sum, bill) => sum + (bill.amount || 0), 0),
                  missing_items_count: missingItems.length,
                  pending_missing_items: missingItems.filter(item => item.status === 'pending').length,
                  risk_warnings: riskChecks.filter(check => check.status === 'warning').length
                }
              };
              
              const fileName = `审计包-${claim.case_number}-${Date.now()}.json`;
              const filePath = path.join(exportsDir, fileName);
              
              fs.writeFile(filePath, JSON.stringify(auditPackage, null, 2), 'utf8', (err) => {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }
                
                res.download(filePath, fileName, (err) => {
                  if (err) {
                    console.error('Download error:', err);
                  }
                });
              });
            });
          });
        });
      });
    });
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Claim Assistant server running on http://localhost:${PORT}`);
});
