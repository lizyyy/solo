const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const Joi = require('joi');
const dayjs = require('dayjs');

const cylinderSchema = Joi.object({
  serialNumber: Joi.string().required().messages({
    'string.empty': '气瓶编号不能为空'
  }),
  gasType: Joi.string().valid('氧气', '笑气', '氮气', '二氧化碳', '其他').required().messages({
    'any.only': '气体类型必须是: 氧气, 笑气, 氮气, 二氧化碳, 其他'
  }),
  capacity: Joi.number().positive().optional(),
  manufacturer: Joi.string().optional(),
  manufactureDate: Joi.date().optional(),
  lastInspectionDate: Joi.date().optional(),
  nextInspectionDate: Joi.date().optional(),
  status: Joi.string().valid('in_stock', 'borrowed', 'scrapped', 'inspecting').default('in_stock'),
  location: Joi.string().optional()
});

const inspectionSchema = Joi.object({
  serialNumber: Joi.string().required(),
  inspectionDate: Joi.date().required(),
  inspector: Joi.string().optional(),
  result: Joi.string().valid('合格', '不合格', '需复检').required(),
  notes: Joi.string().optional(),
  nextInspectionDate: Joi.date().optional()
});

const transactionSchema = Joi.object({
  serialNumber: Joi.string().required(),
  type: Joi.string().valid('borrow', 'return', 'scrap').required(),
  department: Joi.string().optional(),
  person: Joi.string().optional(),
  quantity: Joi.number().integer().positive().default(1),
  notes: Joi.string().optional()
});

const transferSchema = Joi.object({
  transferNumber: Joi.string().required(),
  fromLocation: Joi.string().required(),
  toLocation: Joi.string().required(),
  transferDate: Joi.date().required(),
  sender: Joi.string().optional(),
  receiver: Joi.string().optional(),
  status: Joi.string().valid('pending', 'in_transit', 'completed', 'cancelled').default('pending'),
  items: Joi.array().items(Joi.object({
    serialNumber: Joi.string().required(),
    gasType: Joi.string().optional()
  })).default([]),
  notes: Joi.string().optional()
});

function validateCylinder(data) {
  const { error, value } = cylinderSchema.validate(data, { abortEarly: false });
  if (error) {
    return {
      valid: false,
      errors: error.details.map(d => d.message)
    };
  }
  return { valid: true, value };
}

function validateInspection(data) {
  const { error, value } = inspectionSchema.validate(data, { abortEarly: false });
  if (error) {
    return {
      valid: false,
      errors: error.details.map(d => d.message)
    };
  }
  return { valid: true, value };
}

function validateTransaction(data) {
  const { error, value } = transactionSchema.validate(data, { abortEarly: false });
  if (error) {
    return {
      valid: false,
      errors: error.details.map(d => d.message)
    };
  }
  return { valid: true, value };
}

function validateTransfer(data) {
  const { error, value } = transferSchema.validate(data, { abortEarly: false });
  if (error) {
    return {
      valid: false,
      errors: error.details.map(d => d.message)
    };
  }
  return { valid: true, value };
}

function parseCylinderLedgerCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        const cylinder = {
          serialNumber: data['气瓶编号'] || data['serial_number'] || data['serialNumber'],
          gasType: data['气体类型'] || data['gas_type'] || data['gasType'],
          capacity: parseFloat(data['容量'] || data['capacity']),
          manufacturer: data['制造商'] || data['manufacturer'],
          manufactureDate: data['制造日期'] || data['manufacture_date'] || data['manufactureDate'],
          lastInspectionDate: data['上次检验日期'] || data['last_inspection_date'] || data['lastInspectionDate'],
          nextInspectionDate: data['下次检验日期'] || data['next_inspection_date'] || data['nextInspectionDate'],
          status: data['状态'] || data['status'],
          location: data['位置'] || data['location']
        };
        
        if (cylinder.serialNumber) {
          results.push(cylinder);
        }
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

function parseInspectionRecordsJSON(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      
      try {
        const jsonData = JSON.parse(data);
        const inspections = Array.isArray(jsonData) ? jsonData : [jsonData];
        resolve(inspections);
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
}

function parseTransactionRecords(filePath) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.csv') {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          const transaction = {
            serialNumber: data['气瓶编号'] || data['serial_number'] || data['serialNumber'],
            type: data['类型'] || data['type'],
            department: data['科室'] || data['department'],
            person: data['经办人'] || data['person'],
            quantity: parseInt(data['数量'] || data['quantity']) || 1,
            notes: data['备注'] || data['notes']
          };
          
          if (transaction.serialNumber && transaction.type) {
            results.push(transaction);
          }
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (err) => {
          reject(err);
        });
    } else if (ext === '.json') {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        
        try {
          const jsonData = JSON.parse(data);
          const transactions = Array.isArray(jsonData) ? jsonData : [jsonData];
          resolve(transactions);
        } catch (parseErr) {
          reject(parseErr);
        }
      });
    } else {
      reject(new Error('不支持的文件格式'));
    }
  });
}

function parseTransferRecords(filePath) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.csv') {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          const transfer = {
            transferNumber: data['交接单号'] || data['transfer_number'] || data['transferNumber'],
            fromLocation: data['出发地'] || data['from_location'] || data['fromLocation'],
            toLocation: data['目的地'] || data['to_location'] || data['toLocation'],
            transferDate: data['交接日期'] || data['transfer_date'] || data['transferDate'],
            sender: data['发送人'] || data['sender'],
            receiver: data['接收人'] || data['receiver'],
            status: data['状态'] || data['status'] || 'pending',
            items: [],
            notes: data['备注'] || data['notes']
          };
          
          const serialNumbers = data['气瓶编号'] || data['serial_numbers'] || data['serialNumbers'];
          if (serialNumbers) {
            const numbers = serialNumbers.split(/[,，\s]+/).filter(n => n.trim());
            transfer.items = numbers.map(n => ({
              serialNumber: n.trim()
            }));
          }
          
          if (transfer.transferNumber) {
            results.push(transfer);
          }
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (err) => {
          reject(err);
        });
    } else if (ext === '.json') {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        
        try {
          const jsonData = JSON.parse(data);
          const transfers = Array.isArray(jsonData) ? jsonData : [jsonData];
          resolve(transfers);
        } catch (parseErr) {
          reject(parseErr);
        }
      });
    } else {
      reject(new Error('不支持的文件格式'));
    }
  });
}

module.exports = {
  validateCylinder,
  validateInspection,
  validateTransaction,
  validateTransfer,
  parseCylinderLedgerCSV,
  parseInspectionRecordsJSON,
  parseTransactionRecords,
  parseTransferRecords
};
