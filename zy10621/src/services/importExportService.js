const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { CompensationRecord, Room, User } = require('../models');
const { validateImportRow, validateRecord } = require('./validationService');
const compensationService = require('./compensationService');

async function importFromCsv(filePath) {
  const results = [];
  const errors = [];
  let rowNumber = 0;

  return new Promise((resolve) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', async (row) => {
        rowNumber++;
        const rowValidation = validateImportRow(row, rowNumber);
        
        if (!rowValidation.isValid) {
          errors.push(...rowValidation.errors);
          results.push({
            row: rowNumber,
            success: false,
            errors: rowValidation.errors,
            data: row
          });
          return;
        }

        try {
          const data = {
            reservationId: row.reservationId,
            roomId: parseInt(row.roomId),
            userId: parseInt(row.userId),
            startTime: new Date(row.startTime),
            endTime: new Date(row.endTime),
            releaseReason: row.releaseReason || null,
            releaseReasonDetail: row.releaseReasonDetail || null,
            affectedEquipment: row.affectedEquipment ? row.affectedEquipment.split(',') : [],
            chargedAmount: row.chargedAmount ? parseFloat(row.chargedAmount) : 0,
            importRowId: `import_${Date.now()}_${rowNumber}`
          };

          const recordValidation = await validateRecord(data);
          
          if (!recordValidation.isValid) {
            errors.push(...recordValidation.errors.map(e => ({
              row: rowNumber,
              field: e.field,
              message: e.message
            })));
            results.push({
              row: rowNumber,
              success: false,
              errors: recordValidation.errors,
              data
            });
          } else {
            const result = await compensationService.createRecord(data);
            results.push({
              row: rowNumber,
              success: result.success,
              errors: result.errors || [],
              data: result.data || data
            });
          }
        } catch (e) {
          errors.push({
            row: rowNumber,
            field: 'system',
            message: e.message
          });
          results.push({
            row: rowNumber,
            success: false,
            errors: [{ message: e.message }],
            data: row
          });
        }
      })
      .on('end', () => {
        resolve({
          total: rowNumber,
          success: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          errors,
          results
        });
      });
  });
}

async function exportToCsv(filePath, query = {}) {
  const { data } = await compensationService.getRecords({
    ...query,
    pageSize: 10000
  });

  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'id', title: 'ID' },
      { id: 'reservationId', title: '预约ID' },
      { id: 'roomName', title: '会议室' },
      { id: 'userName', title: '预约人' },
      { id: 'department', title: '部门' },
      { id: 'startTime', title: '开始时间' },
      { id: 'endTime', title: '结束时间' },
      { id: 'status', title: '状态' },
      { id: 'releaseReason', title: '释放原因' },
      { id: 'affectedEquipment', title: '受影响设备' },
      { id: 'chargedAmount', title: '扣费金额' },
      { id: 'compensationAmount', title: '补偿金额' },
      { id: 'explanation', title: '说明' },
      { id: 'createdAt', title: '创建时间' }
    ]
  });

  const records = data.map(record => ({
    id: record.id,
    reservationId: record.reservationId,
    roomName: record.Room ? record.Room.name : '',
    userName: record.User ? record.User.name : '',
    department: record.User ? record.User.department : '',
    startTime: record.startTime.toISOString(),
    endTime: record.endTime.toISOString(),
    status: record.status,
    releaseReason: record.releaseReason || '',
    affectedEquipment: record.affectedEquipment ? record.affectedEquipment.join(',') : '',
    chargedAmount: record.chargedAmount,
    compensationAmount: record.compensationAmount,
    explanation: record.explanation || '',
    createdAt: record.createdAt.toISOString()
  }));

  await csvWriter.writeRecords(records);

  return {
    success: true,
    filePath,
    count: records.length
  };
}

async function exportErrorsToCsv(filePath, errors) {
  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'row', title: '行号' },
      { id: 'field', title: '字段' },
      { id: 'message', title: '错误信息' }
    ]
  });

  await csvWriter.writeRecords(errors);

  return {
    success: true,
    filePath,
    count: errors.length
  };
}

module.exports = {
  importFromCsv,
  exportToCsv,
  exportErrorsToCsv
};
