const { ImportLog, sequelize } = require('../models');
const ReceivableService = require('./receivableService');
const { v4: uuidv4 } = require('uuid');

class ImportService {
  static async importReceivables(rows, operator) {
    const batchNo = `BATCH_${Date.now()}`;
    const results = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;
      
      try {
        const validation = this.validateRow(row);
        if (!validation.valid) {
          throw new Error(validation.message);
        }

        const receivable = await ReceivableService.createReceivable({
          ...row,
          operationSource: '导入',
          operator,
          operatorId: uuidv4()
        });

        await ImportLog.create({
          id: uuidv4(),
          batchNo,
          rowNumber,
          rowData: row,
          status: 'SUCCESS',
          operator
        });

        results.push({
          rowNumber,
          status: 'SUCCESS',
          receivableNo: receivable.receivableNo
        });
      } catch (error) {
        await ImportLog.create({
          id: uuidv4(),
          batchNo,
          rowNumber,
          rowData: row,
          status: 'FAILED',
          errorMessage: error.message,
          operator
        });

        results.push({
          rowNumber,
          status: 'FAILED',
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.status === 'SUCCESS').length;
    const failCount = results.filter(r => r.status === 'FAILED').length;

    return {
      batchNo,
      successCount,
      failCount,
      total: rows.length,
      results
    };
  }

  static validateRow(row) {
    const errors = [];

    if (!row.receivableNo) {
      errors.push('账款编号不能为空');
    }
    if (!row.customerId) {
      errors.push('客户ID不能为空');
    }
    if (!row.customerName) {
      errors.push('客户名称不能为空');
    }
    if (!row.amount) {
      errors.push('账款金额不能为空');
    } else if (isNaN(parseFloat(row.amount)) || parseFloat(row.amount) <= 0) {
      errors.push('账款金额必须为正数');
    }
    if (!row.dueDate) {
      errors.push('到期日不能为空');
    } else if (isNaN(new Date(row.dueDate).getTime())) {
      errors.push('到期日格式不正确');
    }
    if (!row.lockReason) {
      errors.push('锁定原因不能为空');
    }

    return {
      valid: errors.length === 0,
      message: errors.join('; ')
    };
  }

  static async getImportLogs(params = {}) {
    const { page = 1, pageSize = 20, batchNo, status } = params;
    const where = {};
    
    if (batchNo) where.batchNo = batchNo;
    if (status) where.status = status;

    return await ImportLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });
  }

  static async getBadRows(batchNo) {
    return await ImportLog.findAll({
      where: {
        batchNo,
        status: 'FAILED'
      },
      order: [['rowNumber', 'ASC']]
    });
  }
}

module.exports = ImportService;