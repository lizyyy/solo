const { Issue } = require('../models');

class IssueDetector {
  constructor() {
    this.issueTypes = {
      TEMPERATURE_INCOMPATIBLE: 'temperature_incompatible',
      TIME_OVERDUE: 'time_overdue',
      MAINTENANCE_OVERDUE: 'maintenance_overdue',
      QUEUE_CONFLICT: 'queue_conflict',
      MATERIAL_LOW: 'material_low',
      NOZZLE_MAINTENANCE_OVERDUE: 'nozzle_maintenance_overdue'
    };
    
    this.severityLevels = {
      LOW: 'low',
      MEDIUM: 'medium',
      HIGH: 'high',
      CRITICAL: 'critical'
    };
  }

  detectAllIssues(data) {
    const issues = [];
    
    // 检测所有类型的问题
    issues.push(...this.detectTemperatureIncompatible(data.tasks, data.materials));
    issues.push(...this.detectTimeOverdue(data.tasks));
    issues.push(...this.detectMaintenanceOverdue(data.maintenanceRecords));
    issues.push(...this.detectNozzleMaintenanceOverdue(data.machines));
    issues.push(...this.detectQueueConflicts(data.tasks));
    issues.push(...this.detectMaterialLow(data.materialInventories));
    
    return issues;
  }

  detectTemperatureIncompatible(tasks, materials) {
    const issues = [];
    
    if (!tasks || !materials) return issues;
    
    // 创建材料ID到材料对象的映射
    const materialMap = new Map();
    materials.forEach(material => {
      materialMap.set(material.id, material);
    });
    
    // 也按材料类型创建映射，用于没有指定materialId的情况
    const materialTypeMap = new Map();
    materials.forEach(material => {
      const type = material.type.toUpperCase();
      if (!materialTypeMap.has(type)) {
        materialTypeMap.set(type, []);
      }
      materialTypeMap.get(type).push(material);
    });
    
    tasks.forEach(task => {
      if (!task.gcodeInfo) return;
      
      const gcodeInfo = task.gcodeInfo;
      let material = null;
      
      // 首先尝试通过materialId查找
      if (task.materialId && materialMap.has(task.materialId)) {
        material = materialMap.get(task.materialId);
      } 
      // 然后尝试通过材料类型查找
      else if (gcodeInfo.materialType) {
        const type = gcodeInfo.materialType.toUpperCase();
        if (materialTypeMap.has(type) && materialTypeMap.get(type).length > 0) {
          // 使用该类型的第一个材料作为参考
          material = materialTypeMap.get(type)[0];
        }
      }
      
      // 如果没有找到材料信息，但有喷嘴温度，也可以标记为潜在问题
      if (!material) {
        if (gcodeInfo.nozzleTemp > 0) {
          issues.push(new Issue(
            this.issueTypes.TEMPERATURE_INCOMPATIBLE,
            this.severityLevels.MEDIUM,
            `任务 ${task.userName} 的G-code指定喷嘴温度 ${gcodeInfo.nozzleTemp}°C，但未找到匹配的材料信息，无法验证温度兼容性`,
            'task',
            task.id,
            {
              taskId: task.id,
              userName: task.userName,
              nozzleTemp: gcodeInfo.nozzleTemp,
              bedTemp: gcodeInfo.bedTemp,
              materialType: gcodeInfo.materialType,
              missingMaterialInfo: true
            }
          ));
        }
        return;
      }
      
      // 检查喷嘴温度兼容性
      const isNozzleTempCompatible = material.isCompatible(gcodeInfo.nozzleTemp);
      
      if (!isNozzleTempCompatible) {
        issues.push(new Issue(
          this.issueTypes.TEMPERATURE_INCOMPATIBLE,
          this.severityLevels.HIGH,
          `任务 ${task.userName} 的喷嘴温度 ${gcodeInfo.nozzleTemp}°C 与材料 ${material.name} (${material.type}) 不兼容。材料要求温度范围: ${material.nozzleTempMin}°C - ${material.nozzleTempMax}°C`,
          'task',
          task.id,
          {
            taskId: task.id,
            userName: task.userName,
            nozzleTemp: gcodeInfo.nozzleTemp,
            materialName: material.name,
            materialType: material.type,
            materialTempMin: material.nozzleTempMin,
            materialTempMax: material.nozzleTempMax,
            bedTemp: gcodeInfo.bedTemp,
            materialBedTemp: material.bedTemp
          }
        ));
      }
      
      // 检查热床温度（如果材料指定了热床温度）
      if (material.bedTemp > 0 && gcodeInfo.bedTemp > 0) {
        // 允许±10°C的误差
        const bedTempDiff = Math.abs(gcodeInfo.bedTemp - material.bedTemp);
        if (bedTempDiff > 10) {
          issues.push(new Issue(
            this.issueTypes.TEMPERATURE_INCOMPATIBLE,
            this.severityLevels.MEDIUM,
            `任务 ${task.userName} 的热床温度 ${gcodeInfo.bedTemp}°C 与材料 ${material.name} 推荐的 ${material.bedTemp}°C 差异较大`,
            'task',
            task.id,
            {
              taskId: task.id,
              userName: task.userName,
              bedTemp: gcodeInfo.bedTemp,
              materialBedTemp: material.bedTemp,
              temperatureDiff: bedTempDiff
            }
          ));
        }
      }
    });
    
    return issues;
  }

  detectTimeOverdue(tasks) {
    const issues = [];
    
    if (!tasks) return issues;
    
    tasks.forEach(task => {
      if (!task.gcodeInfo) return;
      
      if (task.isTimeOverdue()) {
        const estimatedMinutes = task.gcodeInfo.estimatedPrintTime;
        const scheduledMinutes = task.scheduledDuration;
        const overdueMinutes = estimatedMinutes - scheduledMinutes;
        
        const severity = overdueMinutes > 60 ? this.severityLevels.CRITICAL : 
                         overdueMinutes > 30 ? this.severityLevels.HIGH : 
                         this.severityLevels.MEDIUM;
        
        issues.push(new Issue(
          this.issueTypes.TIME_OVERDUE,
          severity,
          `任务 ${task.userName} 预计打印时间 ${this.formatMinutes(estimatedMinutes)} 超过预约时长 ${this.formatMinutes(scheduledMinutes)}，超时 ${this.formatMinutes(overdueMinutes)}`,
          'task',
          task.id,
          {
            taskId: task.id,
            userName: task.userName,
            machineId: task.machineId,
            estimatedPrintTime: estimatedMinutes,
            scheduledDuration: scheduledMinutes,
            overdueMinutes: overdueMinutes,
            scheduledStartTime: task.scheduledStartTime,
            scheduledEndTime: task.scheduledEndTime
          }
        ));
      }
    });
    
    return issues;
  }

  detectMaintenanceOverdue(maintenanceRecords) {
    const issues = [];
    
    if (!maintenanceRecords) return issues;
    
    maintenanceRecords.forEach(record => {
      if (record.isOverdue()) {
        const today = new Date();
        const nextDate = new Date(record.nextMaintenanceDate);
        const overdueDays = Math.floor((today - nextDate) / (1000 * 60 * 60 * 24));
        
        const severity = overdueDays > 14 ? this.severityLevels.CRITICAL :
                         overdueDays > 7 ? this.severityLevels.HIGH :
                         this.severityLevels.MEDIUM;
        
        issues.push(new Issue(
          this.issueTypes.MAINTENANCE_OVERDUE,
          severity,
          `机器 ${record.machineId} 的 ${record.type} 维护已逾期 ${overdueDays} 天`,
          'maintenance',
          record.id,
          {
            maintenanceRecordId: record.id,
            machineId: record.machineId,
            maintenanceType: record.type,
            description: record.description,
            performedDate: record.performedDate,
            nextMaintenanceDate: record.nextMaintenanceDate,
            overdueDays: overdueDays,
            performedBy: record.performedBy
          }
        ));
      }
    });
    
    return issues;
  }

  detectNozzleMaintenanceOverdue(machines) {
    const issues = [];
    
    if (!machines) return issues;
    
    machines.forEach(machine => {
      if (machine.nozzle && machine.nozzle.isMaintenanceOverdue()) {
        const nozzle = machine.nozzle;
        const overdueHours = nozzle.printHoursSinceChange - nozzle.maxPrintHours;
        
        const severity = overdueHours > 200 ? this.severityLevels.CRITICAL :
                         overdueHours > 100 ? this.severityLevels.HIGH :
                         this.severityLevels.MEDIUM;
        
        issues.push(new Issue(
          this.issueTypes.NOZZLE_MAINTENANCE_OVERDUE,
          severity,
          `机器 ${machine.name} (${machine.id}) 的喷嘴已使用 ${nozzle.printHoursSinceChange} 小时，超过最大推荐使用时间 ${nozzle.maxPrintHours} 小时`,
          'machine',
          machine.id,
          {
            machineId: machine.id,
            machineName: machine.name,
            nozzleSize: nozzle.size,
            nozzleMaterial: nozzle.material,
            printHoursSinceChange: nozzle.printHoursSinceChange,
            maxPrintHours: nozzle.maxPrintHours,
            overdueHours: overdueHours,
            remainingHours: nozzle.remainingHours,
            lastChangedDate: nozzle.lastChangedDate
          }
        ));
      }
    });
    
    return issues;
  }

  detectQueueConflicts(tasks) {
    const issues = [];
    
    if (!tasks || tasks.length < 2) return issues;
    
    // 按机器分组
    const machineTasks = new Map();
    
    tasks.forEach(task => {
      if (!machineTasks.has(task.machineId)) {
        machineTasks.set(task.machineId, []);
      }
      machineTasks.get(task.machineId).push(task);
    });
    
    // 检查每台机器的任务时间冲突
    machineTasks.forEach((machineTaskList, machineId) => {
      // 按开始时间排序
      const sortedTasks = [...machineTaskList].sort((a, b) => 
        new Date(a.scheduledStartTime) - new Date(b.scheduledStartTime)
      );
      
      // 检查相邻任务是否有冲突
      for (let i = 0; i < sortedTasks.length - 1; i++) {
        const currentTask = sortedTasks[i];
        const nextTask = sortedTasks[i + 1];
        
        const currentEnd = new Date(currentTask.scheduledEndTime);
        const nextStart = new Date(nextTask.scheduledStartTime);
        
        // 检查是否有时间重叠
        if (currentEnd > nextStart) {
          const overlapMinutes = (currentEnd - nextStart) / (1000 * 60);
          
          // 也检查实际预计打印时间
          let actualOverlap = false;
          let actualOverlapMinutes = 0;
          
          if (currentTask.gcodeInfo && nextTask.gcodeInfo) {
            const currentActualEnd = new Date(currentTask.scheduledStartTime);
            currentActualEnd.setMinutes(currentActualEnd.getMinutes() + currentTask.gcodeInfo.estimatedPrintTime);
            
            if (currentActualEnd > nextStart) {
              actualOverlap = true;
              actualOverlapMinutes = (currentActualEnd - nextStart) / (1000 * 60);
            }
          }
          
          const severity = (overlapMinutes > 60 || actualOverlapMinutes > 60) ? this.severityLevels.CRITICAL :
                          (overlapMinutes > 30 || actualOverlapMinutes > 30) ? this.severityLevels.HIGH :
                          this.severityLevels.MEDIUM;
          
          issues.push(new Issue(
            this.issueTypes.QUEUE_CONFLICT,
            severity,
            `机器 ${machineId} 上存在任务时间冲突：${currentTask.userName} 和 ${nextTask.userName} 的任务时间重叠 ${this.formatMinutes(overlapMinutes)}`,
            'task',
            currentTask.id,
            {
              machineId: machineId,
              conflictingTasks: [
                {
                  taskId: currentTask.id,
                  userName: currentTask.userName,
                  scheduledStartTime: currentTask.scheduledStartTime,
                  scheduledEndTime: currentTask.scheduledEndTime,
                  estimatedPrintTime: currentTask.gcodeInfo?.estimatedPrintTime
                },
                {
                  taskId: nextTask.id,
                  userName: nextTask.userName,
                  scheduledStartTime: nextTask.scheduledStartTime,
                  scheduledEndTime: nextTask.scheduledEndTime,
                  estimatedPrintTime: nextTask.gcodeInfo?.estimatedPrintTime
                }
              ],
              scheduledOverlapMinutes: overlapMinutes,
              actualOverlap: actualOverlap,
              actualOverlapMinutes: actualOverlapMinutes
            }
          ));
        }
      }
    });
    
    return issues;
  }

  detectMaterialLow(materialInventories) {
    const issues = [];
    
    if (!materialInventories) return issues;
    
    materialInventories.forEach(inventory => {
      if (inventory.isLow()) {
        const severity = inventory.remainingPercentage < 10 ? this.severityLevels.HIGH : this.severityLevels.MEDIUM;
        
        issues.push(new Issue(
          this.issueTypes.MATERIAL_LOW,
          severity,
          `耗材 ${inventory.spoolId} (材料ID: ${inventory.materialId}) 剩余量不足: ${inventory.remainingPercentage.toFixed(1)}%`,
          'material',
          inventory.id,
          {
            inventoryId: inventory.id,
            materialId: inventory.materialId,
            spoolId: inventory.spoolId,
            remainingWeight: inventory.remainingWeight,
            totalWeight: inventory.totalWeight,
            remainingPercentage: inventory.remainingPercentage,
            location: inventory.location,
            lastUpdated: inventory.lastUpdated
          }
        ));
      }
    });
    
    return issues;
  }

  formatMinutes(minutes) {
    if (minutes < 60) {
      return `${Math.round(minutes)} 分钟`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours} 小时 ${mins} 分钟` : `${hours} 小时`;
  }

  // 辅助方法：按严重程度排序问题
  sortIssuesBySeverity(issues) {
    const severityOrder = {
      [this.severityLevels.CRITICAL]: 0,
      [this.severityLevels.HIGH]: 1,
      [this.severityLevels.MEDIUM]: 2,
      [this.severityLevels.LOW]: 3
    };
    
    return [...issues].sort((a, b) => {
      return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
    });
  }

  // 辅助方法：按类型分组问题
  groupIssuesByType(issues) {
    const groups = {};
    
    issues.forEach(issue => {
      if (!groups[issue.type]) {
        groups[issue.type] = [];
      }
      groups[issue.type].push(issue);
    });
    
    return groups;
  }

  // 辅助方法：获取问题统计
  getIssueStats(issues) {
    const stats = {
      total: issues.length,
      bySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      byType: {},
      byStatus: {
        open: 0,
        resolved: 0,
        dismissed: 0
      }
    };
    
    issues.forEach(issue => {
      // 按严重程度统计
      if (stats.bySeverity[issue.severity] !== undefined) {
        stats.bySeverity[issue.severity]++;
      }
      
      // 按类型统计
      if (!stats.byType[issue.type]) {
        stats.byType[issue.type] = 0;
      }
      stats.byType[issue.type]++;
      
      // 按状态统计
      if (stats.byStatus[issue.status] !== undefined) {
        stats.byStatus[issue.status]++;
      }
    });
    
    return stats;
  }
}

module.exports = IssueDetector;
