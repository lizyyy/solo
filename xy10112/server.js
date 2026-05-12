const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const dataStore = require('./utils/dataStore');
const fileParser = require('./utils/fileParser');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.static('public'));
app.use(express.json());

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 CSV、Excel 文件'));
    }
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ 
      success: false, 
      message: '请选择要上传的文件' 
    });
  }

  try {
    const filePath = req.file.path;
    const originalName = req.file.originalname;
    
    const records = await fileParser.parseFile(filePath);
    
    if (records.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: '文件为空，请检查文件内容'
      });
    }
    
    const result = dataStore.addRecords(records, originalName);
    
    fs.unlinkSync(filePath);
    
    res.json({
      success: true,
      data: result,
      message: `成功导入 ${result.successCount} 条记录${result.duplicateCount > 0 ? `，发现 ${result.duplicateCount} 条重复记录已跳过` : ''}${result.errorCount > 0 ? `，有 ${result.errorCount} 条记录存在格式错误` : ''}`
    });
    
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    let status = 400;
    let message = '导入失败';
    let errors = null;
    
    if (error.type === 'file_missing') {
      message = error.message;
    } else if (error.type === 'field_missing') {
      message = error.message;
    } else if (error.type === 'parse_error') {
      message = error.message;
    } else if (error.type === 'unsupported_format') {
      message = error.message;
    } else if (error.type === 'validation_error') {
      message = error.message;
      errors = error.errors;
    } else if (error.message) {
      message = error.message;
    }
    
    const response = { success: false, message, type: error.type };
    if (errors) {
      response.errors = errors;
    }
    
    res.status(status).json(response);
  }
});

app.get('/api/records', (req, res) => {
  const { status, importId } = req.query;
  let records = dataStore.getRecords();
  
  if (status) {
    records = records.filter(r => r.status === status);
  }
  
  if (importId) {
    records = records.filter(r => r.importId === importId);
  }
  
  records.sort((a, b) => new Date(b.importedAt) - new Date(a.importedAt));
  
  res.json({ success: true, data: records });
});

app.get('/api/records/:id', (req, res) => {
  const records = dataStore.getRecords();
  const record = records.find(r => r.id === req.params.id);
  
  if (!record) {
    return res.status(404).json({ success: false, message: '记录不存在' });
  }
  
  res.json({ success: true, data: record });
});

app.put('/api/records/:id/status', (req, res) => {
  const { status } = req.body;
  
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ 
      success: false, 
      message: '无效的状态值，仅支持 approved 或 rejected' 
    });
  }
  
  const result = dataStore.updateRecordStatus(req.params.id, status);
  
  if (!result.success) {
    return res.status(404).json(result);
  }
  
  res.json({
    success: true,
    data: result.record,
    message: status === 'approved' ? '记录已通过审核' : '记录已拒绝'
  });
});

app.put('/api/records/batch/status', (req, res) => {
  const { ids, status } = req.body;
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: '请选择要操作的记录' 
    });
  }
  
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ 
      success: false, 
      message: '无效的状态值' 
    });
  }
  
  const results = dataStore.batchUpdateStatus(ids, status);
  const successCount = results.filter(r => r.success).length;
  
  res.json({
    success: true,
    data: results,
    successCount,
    totalCount: ids.length,
    message: `成功${status === 'approved' ? '通过' : '拒绝'} ${successCount} 条记录`
  });
});

app.get('/api/history', (req, res) => {
  const history = dataStore.getHistory();
  res.json({ success: true, data: history });
});

app.get('/api/members', (req, res) => {
  const members = dataStore.getMembers();
  res.json({ success: true, data: members });
});

app.post('/api/members', (req, res) => {
  const { name, phone } = req.body;
  
  if (!name || !phone) {
    return res.status(400).json({
      success: false,
      message: '姓名和手机号为必填项'
    });
  }
  
  const result = dataStore.addMember({ name, phone });
  
  if (!result.success) {
    return res.status(400).json(result);
  }
  
  res.json({
    success: true,
    data: result.member,
    message: '会员添加成功'
  });
});

app.get('/api/export', (req, res) => {
  const { statuses, format } = req.query;
  
  let statusFilter = ['approved'];
  if (statuses) {
    statusFilter = statuses.split(',');
  }
  
  const records = dataStore.getExportableRecords(statusFilter);
  
  if (records.length === 0) {
    return res.status(400).json({
      success: false,
      message: '没有可导出的记录'
    });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const exportFormat = format || 'excel';
  
  let outputPath;
  let mimeType;
  let fileName;
  
  if (exportFormat === 'csv') {
    fileName = `会员消费记录_${timestamp}.csv`;
    outputPath = path.join(__dirname, 'uploads', fileName);
    fileParser.exportToCSV(records, outputPath);
    mimeType = 'text/csv';
  } else {
    fileName = `会员消费记录_${timestamp}.xlsx`;
    outputPath = path.join(__dirname, 'uploads', fileName);
    fileParser.exportToExcel(records, outputPath);
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  
  res.download(outputPath, fileName, (err) => {
    if (err) {
      console.error('下载失败:', err);
    }
    setTimeout(() => {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    }, 5000);
  });
});

app.get('/api/stats', (req, res) => {
  const records = dataStore.getRecords();
  const pending = records.filter(r => r.status === 'pending').length;
  const approved = records.filter(r => r.status === 'approved').length;
  const rejected = records.filter(r => r.status === 'rejected').length;
  const total = records.length;
  
  const totalAmount = records
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  
  res.json({
    success: true,
    data: {
      total,
      pending,
      approved,
      rejected,
      totalAmount
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: '文件大小超过限制（最大10MB）' });
    }
  }
  
  res.status(500).json({ 
    success: false, 
    message: '服务器内部错误，请稍后重试' 
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  小门店离线会员补录工具`);
  console.log(`  服务已启动: http://localhost:${PORT}`);
  console.log(`  按 Ctrl+C 停止服务`);
  console.log(`========================================\n`);
});
