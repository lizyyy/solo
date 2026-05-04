const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const DataImporter = require('../controllers/dataImporter');
const IssueDetector = require('../controllers/issueDetector');
const DataStore = require('../controllers/dataStore');

// 初始化控制器
const dataImporter = new DataImporter();
const issueDetector = new IssueDetector();
const dataStore = new DataStore();

// 启动自动保存
dataStore.startAutoSave();

// 配置文件上传
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.json', '.gcode', '.g'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

// 获取系统状态
router.get('/status', (req, res) => {
  try {
    const allData = dataStore.getAllData();
    const stats = {
      materials: allData.materials.length,
      materialInventories: allData.materialInventories.length,
      machines: allData.machines.length,
      tasks: allData.tasks.length,
      maintenanceRecords: allData.maintenanceRecords.length,
      issues: allData.issues.length,
      lastImportTime: allData.lastImportTime,
      lastDetectionTime: allData.lastDetectionTime
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 导入数据文件
router.post('/import/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请选择要上传的文件'
      });
    }

    const { dataType } = req.body;
    const filePath = req.file.path;
    const originalName = req.file.originalname;
    
    let importedData;
    
    // 根据文件类型处理
    const ext = path.extname(originalName).toLowerCase();
    
    if (ext === '.gcode' || ext === '.g') {
      // 处理G-code文件
      const gcodeInfo = dataImporter.parseGCodeHeader(filePath);
      if (!gcodeInfo) {
        throw new Error('无法解析G-code文件');
      }
      importedData = { gcodeFiles: [gcodeInfo] };
    } else {
      // 处理CSV或JSON文件
      importedData = await dataImporter.importFromFile(filePath, dataType);
      
      // 根据数据类型包装
      if (dataType === 'materials') {
        importedData = { materials: importedData };
      } else if (dataType === 'materialInventories') {
        importedData = { materialInventories: importedData };
      } else if (dataType === 'machines') {
        importedData = { machines: importedData };
      } else if (dataType === 'tasks') {
        importedData = { tasks: importedData };
      } else if (dataType === 'maintenanceRecords') {
        importedData = { maintenanceRecords: importedData };
      }
    }
    
    // 导入到数据存储
    const importStats = dataStore.importData(importedData);
    
    // 清理上传的文件
    fs.unlinkSync(filePath);
    
    res.json({
      success: true,
      message: `文件 ${originalName} 导入成功`,
      data: importStats
    });
  } catch (error) {
    // 清理上传的文件（如果存在）
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 导入文件夹
router.post('/import/directory', async (req, res) => {
  try {
    const { directoryPath } = req.body;
    
    if (!directoryPath) {
      return res.status(400).json({
        success: false,
        error: '请提供文件夹路径'
      });
    }
    
    if (!fs.existsSync(directoryPath)) {
      return res.status(400).json({
        success: false,
        error: '文件夹路径不存在'
      });
    }
    
    if (!fs.statSync(directoryPath).isDirectory()) {
      return res.status(400).json({
        success: false,
        error: '路径不是文件夹'
      });
    }
    
    // 从文件夹导入数据
    const importedData = await dataImporter.importFromDirectory(directoryPath);
    
    // 导入到数据存储
    const importStats = dataStore.importData(importedData);
    
    res.json({
      success: true,
      message: `文件夹 ${directoryPath} 导入成功`,
      data: importStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 运行问题检测
router.post('/detect-issues', (req, res) => {
  try {
    const allData = dataStore.getAllData();
    
    // 准备检测数据
    const detectionData = {
      tasks: dataStore.data.tasks,
      materials: dataStore.data.materials,
      materialInventories: dataStore.data.materialInventories,
      machines: dataStore.data.machines,
      maintenanceRecords: dataStore.data.maintenanceRecords
    };
    
    // 检测所有问题
    const issues = issueDetector.detectAllIssues(detectionData);
    
    // 保存问题
    dataStore.setIssues(issues);
    
    // 获取统计信息
    const stats = issueDetector.getIssueStats(issues);
    
    res.json({
      success: true,
      message: `检测完成，共发现 ${issues.length} 个问题`,
      data: {
        total: issues.length,
        stats: stats,
        issues: issues.map(i => i.toJSON())
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取所有问题
router.get('/issues', (req, res) => {
  try {
    const { status, type, severity } = req.query;
    
    let issues = dataStore.getIssues();
    
    // 过滤
    if (status) {
      issues = issues.filter(i => i.status === status);
    }
    if (type) {
      issues = issues.filter(i => i.type === type);
    }
    if (severity) {
      issues = issues.filter(i => i.severity === severity);
    }
    
    // 按严重程度排序
    issues = issueDetector.sortIssuesBySeverity(issues);
    
    res.json({
      success: true,
      data: {
        issues: issues,
        total: issues.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取单个问题详情
router.get('/issues/:id', (req, res) => {
  try {
    const { id } = req.params;
    const issues = dataStore.getIssues();
    const issue = issues.find(i => i.id === id);
    
    if (!issue) {
      return res.status(404).json({
        success: false,
        error: '问题不存在'
      });
    }
    
    res.json({
      success: true,
      data: issue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 更新问题状态（解决/忽略）
router.put('/issues/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { action, resolvedBy, notes } = req.body;
    
    if (!action || !['resolve', 'dismiss'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: '请提供有效的操作类型: resolve 或 dismiss'
      });
    }
    
    const updatedIssue = dataStore.updateIssueStatus(id, action, resolvedBy || '夜班管理员', notes || '');
    
    res.json({
      success: true,
      message: action === 'resolve' ? '问题已标记为已解决' : '问题已标记为已忽略',
      data: updatedIssue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 更新问题备注
router.put('/issues/:id/notes', (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    if (notes === undefined) {
      return res.status(400).json({
        success: false,
        error: '请提供备注内容'
      });
    }
    
    const updatedIssue = dataStore.updateIssueNotes(id, notes);
    
    res.json({
      success: true,
      message: '备注已更新',
      data: updatedIssue
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取所有数据
router.get('/data/all', (req, res) => {
  try {
    const allData = dataStore.getAllData();
    res.json({
      success: true,
      data: allData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取任务列表
router.get('/tasks', (req, res) => {
  try {
    const allData = dataStore.getAllData();
    res.json({
      success: true,
      data: {
        tasks: allData.tasks,
        total: allData.tasks.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取机器列表
router.get('/machines', (req, res) => {
  try {
    const allData = dataStore.getAllData();
    res.json({
      success: true,
      data: {
        machines: allData.machines,
        total: allData.machines.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 导出审计包
router.get('/export/audit', (req, res) => {
  try {
    const auditPackage = dataStore.exportAuditPackage();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=audit-package-${Date.now()}.json`);
    
    res.json(auditPackage);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 导出夜班开机单
router.get('/export/night-shift-report', (req, res) => {
  try {
    const reportData = dataStore.exportNightShiftReport();
    
    // 生成Markdown格式
    let markdown = `# 夜班开机单\n\n`;
    markdown += `**生成时间**: ${new Date(reportData.reportDate).toLocaleString('zh-CN')}\n\n`;
    markdown += `**班次**: ${reportData.shift}\n\n`;
    
    // 摘要
    markdown += `## 摘要\n\n`;
    markdown += `- 今日任务: ${reportData.summary.totalTasksToday} 个\n`;
    markdown += `- 未解决问题: ${reportData.summary.openIssues} 个\n`;
    markdown += `- 需要维护的机器: ${reportData.summary.machinesNeedingMaintenance} 台\n`;
    markdown += `- 低耗材: ${reportData.summary.lowMaterials} 项\n\n`;
    
    // 今日任务
    if (reportData.todayTasks.length > 0) {
      markdown += `## 今日任务\n\n`;
      reportData.todayTasks.forEach((task, index) => {
        markdown += `### 任务 ${index + 1}: ${task.userName}\n\n`;
        markdown += `- **机器ID**: ${task.machineId}\n`;
        markdown += `- **预约时间**: ${new Date(task.scheduledStartTime).toLocaleString('zh-CN')} - ${new Date(task.scheduledEndTime).toLocaleString('zh-CN')}\n`;
        markdown += `- **预约时长**: ${Math.round(task.scheduledDuration)} 分钟\n`;
        if (task.gcodeInfo) {
          markdown += `- **G-code文件**: ${task.gcodeInfo.fileName}\n`;
          markdown += `- **预计打印时间**: ${task.gcodeInfo.estimatedPrintTime} 分钟\n`;
          markdown += `- **喷嘴温度**: ${task.gcodeInfo.nozzleTemp}°C\n`;
          markdown += `- **热床温度**: ${task.gcodeInfo.bedTemp}°C\n`;
          markdown += `- **材料类型**: ${task.gcodeInfo.materialType}\n`;
        }
        if (task.isTimeOverdue) {
          markdown += `- **⚠️ 超时警告**: 预计打印时间超过预约时长\n`;
        }
        markdown += `\n`;
      });
    }
    
    // 未解决问题
    if (reportData.openIssues.length > 0) {
      markdown += `## 未解决问题\n\n`;
      reportData.openIssues.forEach((issue, index) => {
        const severityEmoji = {
          critical: '🔴',
          high: '🟠',
          medium: '🟡',
          low: '🟢'
        }[issue.severity] || '⚪';
        
        markdown += `### ${severityEmoji} 问题 ${index + 1}\n\n`;
        markdown += `- **类型**: ${issue.type}\n`;
        markdown += `- **严重程度**: ${issue.severity}\n`;
        markdown += `- **描述**: ${issue.description}\n`;
        if (issue.notes) {
          markdown += `- **备注**: ${issue.notes}\n`;
        }
        markdown += `\n`;
      });
    }
    
    // 需要维护的机器
    if (reportData.machinesNeedingMaintenance.length > 0) {
      markdown += `## 需要维护的机器\n\n`;
      reportData.machinesNeedingMaintenance.forEach((machine, index) => {
        markdown += `### ${index + 1}. ${machine.name}\n\n`;
        markdown += `- **机器ID**: ${machine.id}\n`;
        markdown += `- **型号**: ${machine.model}\n`;
        if (machine.nozzle) {
          markdown += `- **喷嘴尺寸**: ${machine.nozzle.size}\n`;
          markdown += `- **喷嘴材质**: ${machine.nozzle.material}\n`;
          markdown += `- **已使用**: ${machine.nozzle.printHoursSinceChange} 小时\n`;
          markdown += `- **最大推荐**: ${machine.nozzle.maxPrintHours} 小时\n`;
          markdown += `- **⚠️ 维护逾期**: 已超过 ${machine.nozzle.printHoursSinceChange - machine.nozzle.maxPrintHours} 小时\n`;
        }
        markdown += `\n`;
      });
    }
    
    // 低耗材
    if (reportData.lowMaterials.length > 0) {
      markdown += `## 低耗材提醒\n\n`;
      reportData.lowMaterials.forEach((inventory, index) => {
        markdown += `### ${index + 1}. 料卷 ${inventory.spoolId}\n\n`;
        markdown += `- **材料ID**: ${inventory.materialId}\n`;
        markdown += `- **剩余重量**: ${inventory.remainingWeight}g / ${inventory.totalWeight}g\n`;
        markdown += `- **剩余百分比**: ${inventory.remainingPercentage.toFixed(1)}%\n`;
        markdown += `- **存放位置**: ${inventory.location}\n`;
        markdown += `\n`;
      });
    }
    
    // 底部备注
    markdown += `---\n\n`;
    markdown += `*此开机单由3D打印夜班管理系统自动生成*\n`;
    markdown += `*生成时间: ${new Date().toLocaleString('zh-CN')}*\n`;
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=night-shift-report-${Date.now()}.md`);
    
    res.send(markdown);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 清空所有数据
router.delete('/data/all', (req, res) => {
  try {
    dataStore.clearAllData();
    
    res.json({
      success: true,
      message: '所有数据已清空'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 手动保存数据
router.post('/save', (req, res) => {
  try {
    dataStore.saveAllData();
    
    res.json({
      success: true,
      message: '数据已保存'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
