const fs = require('fs');
const csv = require('csv-parser');
const BatchModel = require('../models/batchModel');
const WorkOrderModel = require('../models/workOrderModel');
const FuelRecordModel = require('../models/fuelRecordModel');
const RateConfigModel = require('../models/rateConfigModel');
const ErrorRecordModel = require('../models/errorRecordModel');
const { validateWorkOrder, validateFuelRecord, validateRateConfig } = require('../utils/validators');

const importWorkOrders = (filePath, fileName) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const errors = [];
    let rowNumber = 0;

    BatchModel.create(fileName, 'work_order', (err, batchId) => {
      if (err) return reject(err);

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          rowNumber++;
          const validation = validateWorkOrder(row, rowNumber);
          
          if (validation.isValid) {
            results.push({
              ...validation.cleanedData,
              batch_id: batchId,
              row_number: rowNumber
            });
          } else {
            errors.push({
              batch_id: batchId,
              file_type: 'work_order',
              row_number: rowNumber,
              original_data: row,
              error_type: 'validation_error',
              error_message: validation.errors.join('; '),
              suggestion: validation.suggestions.join('; ')
            });
          }
        })
        .on('end', () => {
          let successCount = 0;
          let errorCount = errors.length;

          const savePromises = results.map((record) => {
            return new Promise((resolveRecord) => {
              WorkOrderModel.create(record, (err) => {
                if (!err) successCount++;
                resolveRecord();
              });
            });
          });

          const errorPromises = errors.map((error) => {
            return new Promise((resolveError) => {
              ErrorRecordModel.create(error, (err) => {
                resolveError();
              });
            });
          });

          Promise.all([...savePromises, ...errorPromises]).then(() => {
            BatchModel.updateStats(batchId, rowNumber, successCount, errorCount, () => {
              fs.unlink(filePath, () => {});
              resolve({
                batch_id: batchId,
                total: rowNumber,
                success: successCount,
                errors: errorCount
              });
            });
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  });
};

const importFuelRecords = (filePath, fileName) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const errors = [];
    let rowNumber = 0;

    BatchModel.create(fileName, 'fuel_record', (err, batchId) => {
      if (err) return reject(err);

      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return reject(err);

        try {
          const records = JSON.parse(data);
          
          records.forEach((record) => {
            rowNumber++;
            const validation = validateFuelRecord(record, rowNumber);
            
            if (validation.isValid) {
              results.push({
                ...validation.cleanedData,
                batch_id: batchId,
                row_number: rowNumber
              });
            } else {
              errors.push({
                batch_id: batchId,
                file_type: 'fuel_record',
                row_number: rowNumber,
                original_data: record,
                error_type: 'validation_error',
                error_message: validation.errors.join('; '),
                suggestion: validation.suggestions.join('; ')
              });
            }
          });

          let successCount = 0;
          let errorCount = errors.length;

          const savePromises = results.map((record) => {
            return new Promise((resolveRecord) => {
              FuelRecordModel.create(record, (err) => {
                if (!err) successCount++;
                resolveRecord();
              });
            });
          });

          const errorPromises = errors.map((error) => {
            return new Promise((resolveError) => {
              ErrorRecordModel.create(error, (err) => {
                resolveError();
              });
            });
          });

          Promise.all([...savePromises, ...errorPromises]).then(() => {
            BatchModel.updateStats(batchId, rowNumber, successCount, errorCount, () => {
              fs.unlink(filePath, () => {});
              resolve({
                batch_id: batchId,
                total: rowNumber,
                success: successCount,
                errors: errorCount
              });
            });
          });

        } catch (parseErr) {
          reject(parseErr);
        }
      });
    });
  });
};

const importRateConfigs = (filePath, fileName) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const errors = [];
    let rowNumber = 0;

    BatchModel.create(fileName, 'rate_config', (err, batchId) => {
      if (err) return reject(err);

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          rowNumber++;
          const validation = validateRateConfig(row, rowNumber);
          
          if (validation.isValid) {
            results.push({
              ...validation.cleanedData,
              batch_id: batchId,
              row_number: rowNumber
            });
          } else {
            errors.push({
              batch_id: batchId,
              file_type: 'rate_config',
              row_number: rowNumber,
              original_data: row,
              error_type: 'validation_error',
              error_message: validation.errors.join('; '),
              suggestion: validation.suggestions.join('; ')
            });
          }
        })
        .on('end', () => {
          let successCount = 0;
          let errorCount = errors.length;

          const savePromises = results.map((record) => {
            return new Promise((resolveRecord) => {
              RateConfigModel.create(record, (err) => {
                if (!err) successCount++;
                resolveRecord();
              });
            });
          });

          const errorPromises = errors.map((error) => {
            return new Promise((resolveError) => {
              ErrorRecordModel.create(error, (err) => {
                resolveError();
              });
            });
          });

          Promise.all([...savePromises, ...errorPromises]).then(() => {
            BatchModel.updateStats(batchId, rowNumber, successCount, errorCount, () => {
              fs.unlink(filePath, () => {});
              resolve({
                batch_id: batchId,
                total: rowNumber,
                success: successCount,
                errors: errorCount
              });
            });
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  });
};

module.exports = {
  importWorkOrders,
  importFuelRecords,
  importRateConfigs
};