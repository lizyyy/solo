const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const store = require('../data/store');
const { parseWarehouseCsv, parseRetrievalCsv } = require('../utils/csvParser');
const { 
  validateWarehouseData, 
  validateAccessControlRepair, 
  validateRetrievalTask 
} = require('../utils/validator');

class ImportService {
  async importWarehouseCsv(filePath) {
    try {
      const warehouseData = await parseWarehouseCsv(filePath);
      
      const validation = validateWarehouseData(warehouseData);
      if (!validation.valid) {
        throw new Error(`数据验证失败: ${validation.error}`);
      }

      const existingWarehouse = store.getWarehouse(warehouseData.warehouseId);
      const warehouse = {
        ...warehouseData,
        importedAt: dayjs().toISOString(),
        updatedAt: dayjs().toISOString()
      };

      if (existingWarehouse) {
        warehouse.createdAt = existingWarehouse.createdAt;
      } else {
        warehouse.createdAt = dayjs().toISOString();
      }

      store.saveWarehouse(warehouseData.warehouseId, warehouse);

      return {
        success: true,
        warehouseId: warehouseData.warehouseId,
        warehouseName: warehouseData.warehouseName,
        measurementsCount: warehouseData.measurements.length,
        message: `库房数据导入成功，共 ${warehouseData.measurements.length} 条测量记录`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async importAccessControlRepairs(jsonData) {
    try {
      let repairs = [];
      if (Array.isArray(jsonData)) {
        repairs = jsonData;
      } else if (jsonData.repairs && Array.isArray(jsonData.repairs)) {
        repairs = jsonData.repairs;
      } else {
        repairs = [jsonData];
      }

      const importResults = {
        success: 0,
        failed: 0,
        errors: [],
        warehouseRepairs: {}
      };

      for (const repair of repairs) {
        const validation = validateAccessControlRepair(repair);
        if (!validation.valid) {
          importResults.failed++;
          importResults.errors.push({
            repairId: repair.repairId || 'unknown',
            error: validation.error
          });
          continue;
        }

        const warehouseId = repair.warehouseId;
        if (!importResults.warehouseRepairs[warehouseId]) {
          importResults.warehouseRepairs[warehouseId] = [];
        }

        const warehouse = store.getWarehouse(warehouseId);
        if (!warehouse) {
          store.saveWarehouse(warehouseId, {
            warehouseId,
            warehouseName: `库房-${warehouseId}`,
            measurements: [],
            repairs: [],
            createdAt: dayjs().toISOString(),
            updatedAt: dayjs().toISOString()
          });
        }

        const warehouseData = store.getWarehouse(warehouseId) || {};
        if (!warehouseData.repairs) {
          warehouseData.repairs = [];
        }

        const existingRepairIndex = warehouseData.repairs.findIndex(r => r.repairId === repair.repairId);
        if (existingRepairIndex >= 0) {
          warehouseData.repairs[existingRepairIndex] = {
            ...repair,
            updatedAt: dayjs().toISOString()
          };
        } else {
          warehouseData.repairs.push({
            ...repair,
            createdAt: dayjs().toISOString(),
            updatedAt: dayjs().toISOString()
          });
        }

        warehouseData.updatedAt = dayjs().toISOString();
        store.saveWarehouse(warehouseId, warehouseData);

        importResults.warehouseRepairs[warehouseId].push(repair.repairId);
        importResults.success++;
      }

      return {
        success: importResults.failed === 0,
        imported: importResults.success,
        failed: importResults.failed,
        errors: importResults.errors,
        warehouseRepairs: importResults.warehouseRepairs,
        message: `门禁维修数据导入完成：成功 ${importResults.success} 条，失败 ${importResults.failed} 条`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async importRetrievalTasks(filePath, isCsv = false) {
    try {
      let tasks = [];
      
      if (isCsv) {
        tasks = await parseRetrievalCsv(filePath);
      } else {
        const fs = require('fs');
        const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (Array.isArray(jsonData)) {
          tasks = jsonData;
        } else if (jsonData.tasks && Array.isArray(jsonData.tasks)) {
          tasks = jsonData.tasks;
        } else {
          tasks = [jsonData];
        }
      }

      const importResults = {
        success: 0,
        failed: 0,
        errors: [],
        importedTasks: []
      };

      for (const task of tasks) {
        const validation = validateRetrievalTask(task);
        if (!validation.valid) {
          importResults.failed++;
          importResults.errors.push({
            taskId: task.taskId || 'unknown',
            error: validation.error
          });
          continue;
        }

        const existingTask = store.getTask(task.taskId);
        const taskData = {
          ...task,
          updatedAt: dayjs().toISOString()
        };

        if (existingTask) {
          taskData.createdAt = existingTask.createdAt;
        } else {
          taskData.createdAt = dayjs().toISOString();
        }

        store.saveTask(task.taskId, taskData);
        importResults.importedTasks.push(task.taskId);
        importResults.success++;
      }

      return {
        success: importResults.failed === 0,
        imported: importResults.success,
        failed: importResults.failed,
        errors: importResults.errors,
        taskIds: importResults.importedTasks,
        message: `调阅任务数据导入完成：成功 ${importResults.success} 条，失败 ${importResults.failed} 条`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async importAll(warehouseFiles, accessControlFile, retrievalFile) {
    const results = {
      warehouse: [],
      accessControl: null,
      retrieval: null
    };

    if (warehouseFiles && warehouseFiles.length > 0) {
      for (const file of warehouseFiles) {
        const result = await this.importWarehouseCsv(file.path);
        results.warehouse.push({
          fileName: file.originalname,
          ...result
        });
      }
    }

    if (accessControlFile) {
      const fs = require('fs');
      const jsonData = JSON.parse(fs.readFileSync(accessControlFile.path, 'utf8'));
      results.accessControl = await this.importAccessControlRepairs(jsonData);
    }

    if (retrievalFile) {
      const isCsv = retrievalFile.originalname.toLowerCase().endsWith('.csv');
      results.retrieval = await this.importRetrievalTasks(retrievalFile.path, isCsv);
    }

    return results;
  }
}

module.exports = new ImportService();
