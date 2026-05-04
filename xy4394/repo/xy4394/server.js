const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage });

let appData = {
  borrowRecords: [],
  bookTags: [],
  sterilizationRecords: [],
  reservations: [],
  anomalies: [],
  decisions: {},
  lastProcessed: null
};

function loadData() {
  const dataPath = path.join(DATA_DIR, 'app-data.json');
  if (fs.existsSync(dataPath)) {
    try {
      const data = fs.readFileSync(dataPath, 'utf8');
      appData = JSON.parse(data);
    } catch (e) {
      console.error('加载数据失败:', e);
    }
  }
}

function saveData() {
  const dataPath = path.join(DATA_DIR, 'app-data.json');
  fs.writeFileSync(dataPath, JSON.stringify(appData, null, 2), 'utf8');
}

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        resolve(results);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

function parseJSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

function detectOverdue(borrowRecords, today) {
  const anomalies = [];
  const overdueDays = 14;
  
  borrowRecords.forEach(record => {
    if (record.action === 'borrow' && record.returnTime === undefined) {
      const borrowDate = new Date(record.borrowTime || record.time);
      const dueDate = new Date(borrowDate);
      dueDate.setDate(dueDate.getDate() + overdueDays);
      
      if (today > dueDate) {
        const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        anomalies.push({
          id: `overdue-${record.bookId}-${Date.now()}`,
          type: 'overdue',
          bookId: record.bookId,
          bookName: record.bookName,
          borrowerId: record.borrowerId,
          borrowerName: record.borrowerName,
          borrowTime: record.borrowTime || record.time,
          dueDate: dueDate.toISOString().split('T')[0],
          daysOverdue,
          cabinetId: record.cabinetId,
          description: `图书逾期${daysOverdue}天`,
          status: 'pending',
          operator: null,
          decisionTime: null
        });
      }
    }
  });
  
  return anomalies;
}

function detectDuplicateOccupancy(borrowRecords, bookTags) {
  const anomalies = [];
  const bookStatus = {};
  
  borrowRecords.forEach(record => {
    if (!bookStatus[record.bookId]) {
      bookStatus[record.bookId] = { actions: [] };
    }
    bookStatus[record.bookId].actions.push(record);
  });
  
  Object.keys(bookStatus).forEach(bookId => {
    const actions = bookStatus[bookId].actions.sort((a, b) => 
      new Date(a.time) - new Date(b.time)
    );
    
    let isBorrowed = false;
    let lastBorrowRecord = null;
    
    actions.forEach(action => {
      if (action.action === 'borrow') {
        if (isBorrowed) {
          anomalies.push({
            id: `duplicate-${bookId}-${Date.now()}`,
            type: 'duplicate_occupancy',
            bookId: bookId,
            bookName: action.bookName,
            currentBorrower: lastBorrowRecord ? lastBorrowRecord.borrowerName : '未知',
            newBorrower: action.borrowerName,
            lastBorrowTime: lastBorrowRecord ? lastBorrowRecord.time : null,
            newBorrowTime: action.time,
            cabinetId: action.cabinetId,
            description: '图书被重复借出，存在占用冲突',
            status: 'pending',
            operator: null,
            decisionTime: null
          });
        }
        isBorrowed = true;
        lastBorrowRecord = action;
      } else if (action.action === 'return') {
        isBorrowed = false;
      }
    });
  });
  
  bookTags.forEach(tag => {
    if (tag.status === 'in_cabinet') {
      const bookRecord = bookStatus[tag.bookId];
      if (bookRecord) {
        const actions = bookRecord.actions.sort((a, b) => 
          new Date(a.time) - new Date(b.time)
        );
        const lastAction = actions[actions.length - 1];
        
        if (lastAction && lastAction.action === 'borrow') {
          anomalies.push({
            id: `inconsistent-${tag.bookId}-${Date.now()}`,
            type: 'duplicate_occupancy',
            bookId: tag.bookId,
            bookName: tag.bookName,
            borrowerName: lastAction.borrowerName,
            borrowTime: lastAction.time,
            cabinetId: tag.cabinetId,
            tagStatus: 'in_cabinet',
            recordStatus: 'borrowed',
            description: '系统状态不一致：标签显示在柜但记录显示已借出',
            status: 'pending',
            operator: null,
            decisionTime: null
          });
        }
      }
    }
  });
  
  return anomalies;
}

function detectSterilizationIncomplete(borrowRecords, sterilizationRecords, bookTags) {
  const anomalies = [];
  const today = new Date();
  
  const pendingReturn = borrowRecords.filter(r => r.action === 'return');
  
  pendingReturn.forEach(returnRecord => {
    const returnTime = new Date(returnRecord.time);
    const timeDiff = (today - returnTime) / (1000 * 60 * 60);
    
    if (timeDiff < 72) {
      const sterilization = sterilizationRecords.find(s => 
        s.bookId === returnRecord.bookId && 
        new Date(s.startTime) > returnTime
      );
      
      if (!sterilization || sterilization.status !== 'completed') {
        anomalies.push({
          id: `sterilization-${returnRecord.bookId}-${Date.now()}`,
          type: 'sterilization_incomplete',
          bookId: returnRecord.bookId,
          bookName: returnRecord.bookName,
          returnTime: returnRecord.time,
          sterilizationStatus: sterilization ? sterilization.status : 'not_started',
          cabinetId: returnRecord.cabinetId,
          description: sterilization ? 
            `消毒未完成，当前状态：${sterilization.status}` : 
            '未开始消毒流程',
          status: 'pending',
          operator: null,
          decisionTime: null
        });
      }
    }
  });
  
  return anomalies;
}

function detectCabinetConflict(reservations, borrowRecords, bookTags) {
  const anomalies = [];
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const todayReservations = reservations.filter(r => {
    const pickupDate = new Date(r.pickupTime || r.time);
    return pickupDate.toISOString().split('T')[0] === todayStr;
  });
  
  const cabinetReservations = {};
  todayReservations.forEach(res => {
    if (!cabinetReservations[res.cabinetId]) {
      cabinetReservations[res.cabinetId] = [];
    }
    cabinetReservations[res.cabinetId].push(res);
  });
  
  Object.keys(cabinetReservations).forEach(cabinetId => {
    const reserves = cabinetReservations[cabinetId];
    
    for (let i = 0; i < reserves.length; i++) {
      for (let j = i + 1; j < reserves.length; j++) {
        const r1 = reserves[i];
        const r2 = reserves[j];
        
        const time1 = new Date(r1.pickupTime || r1.time);
        const time2 = new Date(r2.pickupTime || r2.time);
        const timeDiff = Math.abs(time1 - time2) / (1000 * 60);
        
        if (timeDiff < 30) {
          anomalies.push({
            id: `conflict-${cabinetId}-${Date.now()}-${i}-${j}`,
            type: 'cabinet_conflict',
            cabinetId: cabinetId,
            reservation1: {
              borrowerName: r1.borrowerName,
              bookName: r1.bookName,
              pickupTime: r1.pickupTime || r1.time
            },
            reservation2: {
              borrowerName: r2.borrowerName,
              bookName: r2.bookName,
              pickupTime: r2.pickupTime || r2.time
            },
            timeDiffMinutes: Math.round(timeDiff),
            description: `同一书柜${cabinetId}在${Math.round(timeDiff)}分钟内有两个取书预约`,
            status: 'pending',
            operator: null,
            decisionTime: null
          });
        }
      }
    }
  });
  
  return anomalies;
}

function runRuleEngine() {
  const today = new Date();
  
  const overdueAnomalies = detectOverdue(appData.borrowRecords, today);
  const duplicateAnomalies = detectDuplicateOccupancy(appData.borrowRecords, appData.bookTags);
  const sterilizationAnomalies = detectSterilizationIncomplete(
    appData.borrowRecords, 
    appData.sterilizationRecords, 
    appData.bookTags
  );
  const conflictAnomalies = detectCabinetConflict(
    appData.reservations, 
    appData.borrowRecords, 
    appData.bookTags
  );
  
  const existingIds = new Set(appData.anomalies.map(a => a.id));
  const newAnomalies = [
    ...overdueAnomalies,
    ...duplicateAnomalies,
    ...sterilizationAnomalies,
    ...conflictAnomalies
  ].filter(a => !existingIds.has(a.id));
  
  appData.anomalies = [...appData.anomalies, ...newAnomalies];
  appData.lastProcessed = new Date().toISOString();
  
  saveData();
  
  return {
    total: appData.anomalies.length,
    new: newAnomalies.length,
    byType: {
      overdue: appData.anomalies.filter(a => a.type === 'overdue').length,
      duplicate_occupancy: appData.anomalies.filter(a => a.type === 'duplicate_occupancy').length,
      sterilization_incomplete: appData.anomalies.filter(a => a.type === 'sterilization_incomplete').length,
      cabinet_conflict: appData.anomalies.filter(a => a.type === 'cabinet_conflict').length
    }
  };
}

loadData();

app.post('/api/upload/borrow', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }
    
    const records = await parseCSV(req.file.path);
    appData.borrowRecords = [...appData.borrowRecords, ...records];
    saveData();
    
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      success: true, 
      count: records.length,
      message: `成功导入 ${records.length} 条借还记录`
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/upload/book-tags', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }
    
    const tags = parseJSON(req.file.path);
    const tagArray = Array.isArray(tags) ? tags : [tags];
    appData.bookTags = [...appData.bookTags, ...tagArray];
    saveData();
    
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      success: true, 
      count: tagArray.length,
      message: `成功导入 ${tagArray.length} 条书本标签`
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/upload/sterilization', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }
    
    const records = parseJSON(req.file.path);
    const recordArray = Array.isArray(records) ? records : [records];
    appData.sterilizationRecords = [...appData.sterilizationRecords, ...recordArray];
    saveData();
    
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      success: true, 
      count: recordArray.length,
      message: `成功导入 ${recordArray.length} 条消毒记录`
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/upload/reservations', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }
    
    const records = parseJSON(req.file.path);
    const recordArray = Array.isArray(records) ? records : [records];
    appData.reservations = [...appData.reservations, ...recordArray];
    saveData();
    
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      success: true, 
      count: recordArray.length,
      message: `成功导入 ${recordArray.length} 条预约记录`
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/process', (req, res) => {
  try {
    const result = runRuleEngine();
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/anomalies', (req, res) => {
  const { type, status } = req.query;
  
  let filtered = [...appData.anomalies];
  
  if (type) {
    filtered = filtered.filter(a => a.type === type);
  }
  
  if (status) {
    filtered = filtered.filter(a => a.status === status);
  }
  
  res.json({ 
    success: true, 
    data: filtered,
    total: filtered.length,
    lastProcessed: appData.lastProcessed
  });
});

app.get('/api/anomalies/:id', (req, res) => {
  const anomaly = appData.anomalies.find(a => a.id === req.params.id);
  if (!anomaly) {
    return res.status(404).json({ error: '未找到异常记录' });
  }
  res.json({ success: true, data: anomaly });
});

app.put('/api/anomalies/:id/decision', (req, res) => {
  const { id } = req.params;
  const { decision, remark, operator } = req.body;
  
  const anomaly = appData.anomalies.find(a => a.id === id);
  if (!anomaly) {
    return res.status(404).json({ error: '未找到异常记录' });
  }
  
  anomaly.status = decision;
  anomaly.remark = remark || anomaly.remark;
  anomaly.operator = operator || '管理员';
  anomaly.decisionTime = new Date().toISOString();
  
  appData.decisions[id] = {
    decision,
    remark,
    operator: anomaly.operator,
    decisionTime: anomaly.decisionTime
  };
  
  saveData();
  
  res.json({ success: true, data: anomaly });
});

app.get('/api/stats', (req, res) => {
  const stats = {
    borrowRecords: appData.borrowRecords.length,
    bookTags: appData.bookTags.length,
    sterilizationRecords: appData.sterilizationRecords.length,
    reservations: appData.reservations.length,
    anomalies: {
      total: appData.anomalies.length,
      byType: {
        overdue: appData.anomalies.filter(a => a.type === 'overdue').length,
        duplicate_occupancy: appData.anomalies.filter(a => a.type === 'duplicate_occupancy').length,
        sterilization_incomplete: appData.anomalies.filter(a => a.type === 'sterilization_incomplete').length,
        cabinet_conflict: appData.anomalies.filter(a => a.type === 'cabinet_conflict').length
      },
      byStatus: {
        pending: appData.anomalies.filter(a => a.status === 'pending').length,
        approved: appData.anomalies.filter(a => a.status === 'approved').length,
        rejected: appData.anomalies.filter(a => a.status === 'rejected').length,
        noted: appData.anomalies.filter(a => a.status === 'noted').length
      }
    },
    lastProcessed: appData.lastProcessed
  };
  
  res.json({ success: true, data: stats });
});

app.get('/api/export/shelf-list', (req, res) => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const todayReturns = appData.borrowRecords.filter(r => {
    if (r.action !== 'return') return false;
    const returnDate = new Date(r.time).toISOString().split('T')[0];
    return returnDate === todayStr;
  });
  
  const sterilizedBooks = appData.sterilizationRecords.filter(s => 
    s.status === 'completed'
  ).map(s => s.bookId);
  
  const shelfReady = todayReturns.filter(r => 
    sterilizedBooks.includes(r.bookId)
  );
  
  const grouped = {};
  shelfReady.forEach(book => {
    if (!grouped[book.cabinetId]) {
      grouped[book.cabinetId] = [];
    }
    grouped[book.cabinetId].push(book);
  });
  
  let markdown = `# 图书上架清单\n\n`;
  markdown += `生成时间：${new Date().toLocaleString('zh-CN')}\n\n`;
  markdown += `---\n\n`;
  
  Object.keys(grouped).sort().forEach(cabinetId => {
    const books = grouped[cabinetId];
    markdown += `## 书柜 ${cabinetId}\n\n`;
    markdown += `| 序号 | 图书ID | 书名 | 归还时间 | 状态 |\n`;
    markdown += `|------|--------|------|----------|------|\n`;
    
    books.forEach((book, index) => {
      const returnTime = new Date(book.time).toLocaleString('zh-CN');
      markdown += `| ${index + 1} | ${book.bookId} | ${book.bookName || '未知'} | ${returnTime} | 已消毒 |\n`;
    });
    
    markdown += `\n`;
  });
  
  markdown += `---\n\n`;
  markdown += `**统计：** 今日归还 ${todayReturns.length} 本，已消毒可上架 ${shelfReady.length} 本\n`;
  
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=shelf-list-${todayStr}.md`);
  res.send(markdown);
});

app.get('/api/export/anomalies', (req, res) => {
  const todayStr = new Date().toISOString().split('T')[0];
  
  const exportData = {
    exportTime: new Date().toISOString(),
    anomalies: appData.anomalies,
    decisions: appData.decisions
  };
  
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=anomalies-${todayStr}.json`);
  res.send(JSON.stringify(exportData, null, 2));
});

app.delete('/api/data/clear', (req, res) => {
  appData = {
    borrowRecords: [],
    bookTags: [],
    sterilizationRecords: [],
    reservations: [],
    anomalies: [],
    decisions: {},
    lastProcessed: null
  };
  saveData();
  
  res.json({ success: true, message: '所有数据已清空' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`图书漂流柜预审工具已启动：http://localhost:${PORT}`);
});
