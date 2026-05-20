const fs = require('fs');
const csv = require('csv-parser');
const Case = require('../models/Case');
const BorrowRecord = require('../models/BorrowRecord');
const UserPermission = require('../models/UserPermission');
const Batch = require('../models/Batch');
const { generateId, validateCSVRow, parseDate, calculateOverdueDays, canAccessSecretLevel, getReadableSecretMessage } = require('../utils/helpers');

const importBorrowCSV = async (filePath, operator = '系统管理员') => {
  const results = [];
  const errors = [];
  let successCount = 0;
  let failCount = 0;
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        results.push(row);
      })
      .on('end', async () => {
        try {
          const batchId = generateId('BATCH');
          const batch = new Batch({
            batchId,
            batchName: `借阅导入_${new Date().toLocaleDateString('zh-CN')}`,
            batchType: '借阅申请',
            description: `CSV文件导入，共${results.length}条记录`,
            totalRecords: results.length,
            createdBy: operator
          });
          
          const recordIds = [];
          
          for (let i = 0; i < results.length; i++) {
            const row = results[i];
            const rowErrors = validateCSVRow(row, 'borrow');
            
            if (rowErrors.length > 0) {
              errors.push({ row: i + 1, errors: rowErrors, data: row });
              failCount++;
              continue;
            }
            
            try {
              const recordId = generateId('REC');
              const borrowDate = parseDate(row.borrowDate);
              const dueDate = parseDate(row.dueDate);
              const overdueDays = calculateOverdueDays(dueDate);
              
              let caseInfo = await Case.findOne({ caseId: row.caseId });
              let userInfo = await UserPermission.findOne({ userId: row.borrowerId });
              
              const isSecretCase = caseInfo && ['秘密', '机密', '绝密'].includes(caseInfo.securityLevel);
              const needSpecialApproval = isSecretCase && userInfo && !canAccessSecretLevel(userInfo.maxSecurityLevel, caseInfo.securityLevel);
              
              const borrowRecord = new BorrowRecord({
                recordId,
                batchId,
                caseId: row.caseId,
                caseTitle: caseInfo?.title || row.caseTitle || '未知案件',
                securityLevel: caseInfo?.securityLevel || row.securityLevel || '内部',
                borrowerId: row.borrowerId,
                borrowerName: row.borrowerName,
                borrowerDepartment: row.department || userInfo?.department,
                borrowDate,
                dueDate,
                purpose: row.purpose || '',
                renewCount: parseInt(row.renewCount) || 0,
                status: needSpecialApproval ? '涉密待审' : (overdueDays > 0 ? '超期' : '待处理'),
                isOverdue: overdueDays > 0,
                overdueDays,
                isSecretCase,
                flags: {
                  specialApprovalRequired: needSpecialApproval
                }
              });
              
              borrowRecord.addAction(
                '提交',
                operator,
                'CSV批量导入',
                `通过CSV文件第${i + 1}行批量导入`,
                row.notes || ''
              );
              
              if (needSpecialApproval) {
                borrowRecord.addAction(
                  '涉密拦截',
                  '系统',
                  '涉密案件自动拦截',
                  getReadableSecretMessage(caseInfo.securityLevel, userInfo.maxSecurityLevel, caseInfo.title),
                  ''
                );
              }
              
              await borrowRecord.save();
              recordIds.push(recordId);
              successCount++;
            } catch (err) {
              errors.push({ row: i + 1, errors: [err.message], data: row });
              failCount++;
            }
          }
          
          batch.recordIds = recordIds;
          batch.processedRecords = successCount;
          batch.status = successCount > 0 ? '处理中' : '已完成';
          await batch.save();
          
          fs.unlinkSync(filePath);
          
          resolve({
            success: true,
            batchId,
            successCount,
            failCount,
            totalCount: results.length,
            errors
          });
        } catch (error) {
          reject(error);
        }
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

const importCaseJSON = async (filePath, operator = '系统管理员') => {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const cases = JSON.parse(fileContent);
    const errors = [];
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < cases.length; i++) {
      const caseData = cases[i];
      const rowErrors = validateCSVRow(caseData, 'case');
      
      if (rowErrors.length > 0) {
        errors.push({ index: i, errors: rowErrors, data: caseData });
        failCount++;
        continue;
      }
      
      try {
        const existingCase = await Case.findOne({ caseId: caseData.caseId });
        
        if (existingCase) {
          Object.assign(existingCase, caseData, { updatedAt: new Date() });
          await existingCase.save();
        } else {
          const newCase = new Case({
            ...caseData,
            createDate: parseDate(caseData.createDate),
            archiveDate: parseDate(caseData.archiveDate)
          });
          await newCase.save();
        }
        successCount++;
      } catch (err) {
        errors.push({ index: i, errors: [err.message], data: caseData });
        failCount++;
      }
    }
    
    fs.unlinkSync(filePath);
    
    return {
      success: true,
      successCount,
      failCount,
      totalCount: cases.length,
      errors
    };
  } catch (error) {
    throw error;
  }
};

const importPermissionCSV = async (filePath, operator = '系统管理员') => {
  const results = [];
  const errors = [];
  let successCount = 0;
  let failCount = 0;
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        results.push(row);
      })
      .on('end', async () => {
        try {
          for (let i = 0; i < results.length; i++) {
            const row = results[i];
            const rowErrors = validateCSVRow(row, 'permission');
            
            if (rowErrors.length > 0) {
              errors.push({ row: i + 1, errors: rowErrors, data: row });
              failCount++;
              continue;
            }
            
            try {
              const existingUser = await UserPermission.findOne({ userId: row.userId });
              
              if (existingUser) {
                Object.assign(existingUser, row, { updatedAt: new Date() });
                await existingUser.save();
              } else {
                const userPermission = new UserPermission({
                  ...row,
                  maxBorrowCount: parseInt(row.maxBorrowCount) || 10
                });
                await userPermission.save();
              }
              successCount++;
            } catch (err) {
              errors.push({ row: i + 1, errors: [err.message], data: row });
              failCount++;
            }
          }
          
          fs.unlinkSync(filePath);
          
          resolve({
            success: true,
            successCount,
            failCount,
            totalCount: results.length,
            errors
          });
        } catch (error) {
          reject(error);
        }
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

module.exports = {
  importBorrowCSV,
  importCaseJSON,
  importPermissionCSV
};
