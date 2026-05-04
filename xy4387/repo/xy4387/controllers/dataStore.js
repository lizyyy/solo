const fs = require('fs');
const path = require('path');
const { 
  Material, 
  MaterialInventory, 
  Machine, 
  Task, 
  MaintenanceRecord, 
  Issue 
} = require('../models');

class DataStore {
  constructor(dataDirectory = './data') {
    this.dataDirectory = path.resolve(dataDirectory);
    this.ensureDataDirectory();
    
    // 内存中的数据缓存
    this.data = {
      materials: [],
      materialInventories: [],
      machines: [],
      tasks: [],
      maintenanceRecords: [],
      issues: [],
      lastImportTime: null,
      lastDetectionTime: null
    };
    
    // 自动保存间隔（毫秒）
    this.autoSaveInterval = 30000; // 30秒
    this.autoSaveTimer = null;
    
    // 加载现有数据
    this.loadAllData();
  }

  ensureDataDirectory() {
    if (!fs.existsSync(this.dataDirectory)) {
      fs.mkdirSync(this.dataDirectory, { recursive: true });
    }
  }

  // 获取数据文件路径
  getDataFilePath(type) {
    return path.join(this.dataDirectory, `${type}.json`);
  }

  // 加载所有数据
  loadAllData() {
    try {
      this.data.materials = this.loadData('materials', Material);
      this.data.materialInventories = this.loadData('materialInventories', MaterialInventory);
      this.data.machines = this.loadData('machines', Machine);
      this.data.tasks = this.loadData('tasks', Task);
      this.data.maintenanceRecords = this.loadData('maintenanceRecords', MaintenanceRecord);
      this.data.issues = this.loadData('issues', Issue);
      
      // 加载元数据
      const metadataPath = this.getDataFilePath('metadata');
      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        this.data.lastImportTime = metadata.lastImportTime || null;
        this.data.lastDetectionTime = metadata.lastDetectionTime || null;
      }
      
      console.log('数据加载完成');
    } catch (error) {
      console.error('加载数据时出错:', error.message);
    }
  }

  // 加载特定类型的数据
  loadData(type, ModelClass) {
    const filePath = this.getDataFilePath(type);
    
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    try {
      const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // 如果有ModelClass，将JSON转换为模型实例
      if (ModelClass && ModelClass.fromJSON) {
        return jsonData.map(item => ModelClass.fromJSON(item));
      }
      
      return jsonData;
    } catch (error) {
      console.error(`加载 ${type} 数据时出错:`, error.message);
      return [];
    }
  }

  // 保存所有数据
  saveAllData() {
    try {
      this.saveData('materials', this.data.materials);
      this.saveData('materialInventories', this.data.materialInventories);
      this.saveData('machines', this.data.machines);
      this.saveData('tasks', this.data.tasks);
      this.saveData('maintenanceRecords', this.data.maintenanceRecords);
      this.saveData('issues', this.data.issues);
      
      // 保存元数据
      const metadata = {
        lastImportTime: this.data.lastImportTime,
        lastDetectionTime: this.data.lastDetectionTime,
        lastSavedTime: new Date().toISOString()
      };
      this.saveData('metadata', metadata);
      
      console.log('数据保存完成');
    } catch (error) {
      console.error('保存数据时出错:', error.message);
      throw error;
    }
  }

  // 保存特定类型的数据
  saveData(type, data) {
    const filePath = this.getDataFilePath(type);
    
    try {
      // 转换为JSON（处理模型实例）
      const jsonData = Array.isArray(data) 
        ? data.map(item => item.toJSON ? item.toJSON() : item)
        : (data.toJSON ? data.toJSON() : data);
      
      fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf8');
    } catch (error) {
      console.error(`保存 ${type} 数据时出错:`, error.message);
      throw error;
    }
  }

  // 启动自动保存
  startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setInterval(() => {
      this.saveAllData();
    }, this.autoSaveInterval);
    
    console.log(`自动保存已启动，间隔 ${this.autoSaveInterval / 1000} 秒`);
  }

  // 停止自动保存
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      console.log('自动保存已停止');
    }
  }

  // 导入数据
  importData(importedData) {
    // 合并或替换数据，这里采用替换策略
    if (importedData.materials && importedData.materials.length > 0) {
      this.data.materials = importedData.materials;
    }
    
    if (importedData.materialInventories && importedData.materialInventories.length > 0) {
      this.data.materialInventories = importedData.materialInventories;
    }
    
    if (importedData.machines && importedData.machines.length > 0) {
      this.data.machines = importedData.machines;
    }
    
    if (importedData.tasks && importedData.tasks.length > 0) {
      this.data.tasks = importedData.tasks;
    }
    
    if (importedData.maintenanceRecords && importedData.maintenanceRecords.length > 0) {
      this.data.maintenanceRecords = importedData.maintenanceRecords;
    }
    
    // 处理G-code文件 - 匹配到对应的任务
    if (importedData.gcodeFiles && importedData.gcodeFiles.length > 0) {
      this.matchGCodeToTasks(importedData.gcodeFiles);
    }
    
    this.data.lastImportTime = new Date().toISOString();
    
    // 保存数据
    this.saveAllData();
    
    return {
      materials: this.data.materials.length,
      materialInventories: this.data.materialInventories.length,
      machines: this.data.machines.length,
      tasks: this.data.tasks.length,
      maintenanceRecords: this.data.maintenanceRecords.length
    };
  }

  // 匹配G-code文件到任务
  matchGCodeToTasks(gcodeFiles) {
    gcodeFiles.forEach(gcodeInfo => {
      // 尝试通过文件名匹配任务
      const matchedTask = this.data.tasks.find(task => {
        if (!task.gcodeInfo) return false;
        return task.gcodeInfo.fileName === gcodeInfo.fileName ||
               gcodeInfo.fileName.includes(task.userName) ||
               task.userName.includes(gcodeInfo.fileName.replace(/\.[^.]+$/, ''));
      });
      
      if (matchedTask) {
        // 更新任务的G-code信息
        matchedTask.gcodeInfo = gcodeInfo;
        console.log(`已将G-code ${gcodeInfo.fileName} 匹配到任务 ${matchedTask.userName}`);
      }
    });
  }

  // 设置检测到的问题
  setIssues(issues) {
    this.data.issues = issues;
    this.data.lastDetectionTime = new Date().toISOString();
    this.saveAllData();
  }

  // 获取所有数据
  getAllData() {
    return {
      materials: this.data.materials.map(m => m.toJSON()),
      materialInventories: this.data.materialInventories.map(m => m.toJSON()),
      machines: this.data.machines.map(m => m.toJSON()),
      tasks: this.data.tasks.map(t => t.toJSON()),
      maintenanceRecords: this.data.maintenanceRecords.map(r => r.toJSON()),
      issues: this.data.issues.map(i => i.toJSON()),
      lastImportTime: this.data.lastImportTime,
      lastDetectionTime: this.data.lastDetectionTime
    };
  }

  // 获取问题列表
  getIssues(status = null) {
    let issues = this.data.issues;
    
    if (status) {
      issues = issues.filter(issue => issue.status === status);
    }
    
    return issues.map(i => i.toJSON());
  }

  // 更新问题状态
  updateIssueStatus(issueId, action, resolvedBy, notes = '') {
    const issue = this.data.issues.find(i => i.id === issueId);
    
    if (!issue) {
      throw new Error(`未找到问题: ${issueId}`);
    }
    
    if (action === 'resolve') {
      issue.resolve(resolvedBy, notes);
    } else if (action === 'dismiss') {
      issue.dismiss(resolvedBy, notes);
    } else {
      throw new Error(`未知的操作: ${action}`);
    }
    
    this.saveAllData();
    return issue.toJSON();
  }

  // 更新问题备注
  updateIssueNotes(issueId, notes) {
    const issue = this.data.issues.find(i => i.id === issueId);
    
    if (!issue) {
      throw new Error(`未找到问题: ${issueId}`);
    }
    
    issue.notes = notes;
    issue.update();
    
    this.saveAllData();
    return issue.toJSON();
  }

  // 获取任务详情
  getTask(taskId) {
    const task = this.data.tasks.find(t => t.id === taskId);
    return task ? task.toJSON() : null;
  }

  // 获取机器详情
  getMachine(machineId) {
    const machine = this.data.machines.find(m => m.id === machineId);
    return machine ? machine.toJSON() : null;
  }

  // 获取材料详情
  getMaterial(materialId) {
    const material = this.data.materials.find(m => m.id === materialId);
    return material ? material.toJSON() : null;
  }

  // 清空所有数据
  clearAllData() {
    this.data = {
      materials: [],
      materialInventories: [],
      machines: [],
      tasks: [],
      maintenanceRecords: [],
      issues: [],
      lastImportTime: null,
      lastDetectionTime: null
    };
    
    // 删除数据文件
    const files = ['materials', 'materialInventories', 'machines', 'tasks', 'maintenanceRecords', 'issues', 'metadata'];
    files.forEach(file => {
      const filePath = this.getDataFilePath(file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
    
    console.log('所有数据已清空');
  }

  // 导出审计包
  exportAuditPackage() {
    const auditData = {
      exportTime: new Date().toISOString(),
      version: '1.0.0',
      data: this.getAllData(),
      statistics: {
        totalMaterials: this.data.materials.length,
        totalMachines: this.data.machines.length,
        totalTasks: this.data.tasks.length,
        totalIssues: this.data.issues.length,
        openIssues: this.data.issues.filter(i => i.status === 'open').length,
        resolvedIssues: this.data.issues.filter(i => i.status === 'resolved').length,
        dismissedIssues: this.data.issues.filter(i => i.status === 'dismissed').length
      }
    };
    
    return auditData;
  }

  // 导出夜班开机单数据
  exportNightShiftReport() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // 获取今天的任务
    const todayTasks = this.data.tasks.filter(task => {
      const taskDate = new Date(task.scheduledStartTime).toISOString().split('T')[0];
      return taskDate === todayStr;
    });
    
    // 获取所有未解决的问题
    const openIssues = this.data.issues.filter(i => i.status === 'open');
    
    // 获取需要维护的机器
    const machinesNeedingMaintenance = this.data.machines.filter(m => 
      m.nozzle && m.nozzle.isMaintenanceOverdue()
    );
    
    // 获取低耗材
    const lowMaterials = this.data.materialInventories.filter(m => m.isLow());
    
    return {
      reportDate: today.toISOString(),
      shift: '夜班',
      todayTasks: todayTasks.map(t => t.toJSON()),
      openIssues: openIssues.map(i => i.toJSON()),
      machinesNeedingMaintenance: machinesNeedingMaintenance.map(m => m.toJSON()),
      lowMaterials: lowMaterials.map(m => m.toJSON()),
      summary: {
        totalTasksToday: todayTasks.length,
        openIssues: openIssues.length,
        machinesNeedingMaintenance: machinesNeedingMaintenance.length,
        lowMaterials: lowMaterials.length
      }
    };
  }
}

module.exports = DataStore;
