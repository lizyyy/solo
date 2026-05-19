const fs = require('fs');
const csv = require('csv-parser');
const storage = require('./storage');
const errorHandler = require('./errorHandler');

class Importer {
  async importApplicationsCSV(filePath) {
    const results = [];
    const errors = [];
    let rowNumber = 0;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath, 'utf8')
        .pipe(csv())
        .on('data', (row) => {
          rowNumber++;
          const rowErrors = errorHandler.validateApplication(row, rowNumber);
          
          if (rowErrors.length === 0) {
            results.push({
              reagentName: row.reagentName.trim(),
              applicant: row.applicant.trim(),
              quantity: parseFloat(row.quantity),
              applicationDate: row.applicationDate.trim(),
              department: row.department ? row.department.trim() : '',
              purpose: row.purpose ? row.purpose.trim() : '',
              approved: row.approved ? row.approved.toLowerCase() === 'true' : false,
              approver: row.approver ? row.approver.trim() : ''
            });
          } else {
            errors.push(...rowErrors);
          }
        })
        .on('end', () => {
          if (results.length > 0) {
            storage.addApplications(results);
          }
          
          storage.addImportHistory({
            type: 'applications',
            filePath,
            successCount: results.length,
            errorCount: errors.length
          });

          resolve({
            success: true,
            imported: results.length,
            errors: errors.length,
            data: results
          });
        })
        .on('error', (err) => {
          errorHandler.recordError({
            source: 'application',
            rowNumber: 0,
            originalData: { filePath },
            errorType: 'file_error',
            errorMessage: `文件读取失败: ${err.message}`,
            suggestion: '请检查文件路径和文件格式是否正确'
          });
          reject(err);
        });
    });
  }

  async importInventoryJSON(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      
      if (!Array.isArray(data)) {
        throw new Error('库存数据必须是数组格式');
      }

      const validItems = [];
      let errorCount = 0;

      data.forEach((item, index) => {
        const errors = errorHandler.validateInventory(item, index);
        if (errors.length === 0) {
          validItems.push({
            reagentName: item.reagentName.trim(),
            quantity: parseFloat(item.quantity),
            unit: item.unit || '瓶',
            location: item.location || '',
            batchNumber: item.batchNumber || '',
            expirationDate: item.expirationDate || ''
          });
        } else {
          errorCount += errors.length;
        }
      });

      storage.setInventory(validItems);
      storage.addImportHistory({
        type: 'inventory',
        filePath,
        successCount: validItems.length,
        errorCount
      });

      return {
        success: true,
        imported: validItems.length,
        errors: errorCount,
        data: validItems
      };
    } catch (err) {
      errorHandler.recordError({
        source: 'inventory',
        rowNumber: 0,
        originalData: { filePath },
        errorType: 'file_error',
        errorMessage: `文件读取或解析失败: ${err.message}`,
        suggestion: '请检查文件路径和JSON格式是否正确'
      });
      throw err;
    }
  }

  async importHazardRulesJSON(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      
      if (!Array.isArray(data)) {
        throw new Error('危化品规则数据必须是数组格式');
      }

      const validRules = [];
      let errorCount = 0;

      data.forEach((rule, index) => {
        const errors = errorHandler.validateHazardRule(rule, index);
        if (errors.length === 0) {
          validRules.push({
            reagentName: rule.reagentName.trim(),
            hazardLevel: rule.hazardLevel,
            requiresApproval: rule.requiresApproval !== undefined ? rule.requiresApproval : true,
            maxQuantity: rule.maxQuantity || 100,
            storageRequirements: rule.storageRequirements || ''
          });
        } else {
          errorCount += errors.length;
        }
      });

      storage.setHazardRules(validRules);
      storage.addImportHistory({
        type: 'hazardRules',
        filePath,
        successCount: validRules.length,
        errorCount
      });

      return {
        success: true,
        imported: validRules.length,
        errors: errorCount,
        data: validRules
      };
    } catch (err) {
      errorHandler.recordError({
        source: 'hazardRule',
        rowNumber: 0,
        originalData: { filePath },
        errorType: 'file_error',
        errorMessage: `文件读取或解析失败: ${err.message}`,
        suggestion: '请检查文件路径和JSON格式是否正确'
      });
      throw err;
    }
  }
}

module.exports = new Importer();
