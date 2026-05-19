const fs = require('fs');
const csv = require('csv-parser');
const Joi = require('joi');
const logger = require('../config/logger');
const ImportBatch = require('../models/ImportBatch');
const Visitor = require('../models/Visitor');
const TemporaryPlate = require('../models/TemporaryPlate');
const Blacklist = require('../models/Blacklist');

const visitorSchema = Joi.object({
  visitorName: Joi.string().required(),
  phone: Joi.string().required(),
  idCard: Joi.string().allow(''),
  company: Joi.string().allow(''),
  visitReason: Joi.string().allow(''),
  visitDate: Joi.string().required(),
  visitTimeStart: Joi.string().allow(''),
  visitTimeEnd: Joi.string().allow(''),
  visitedPerson: Joi.string().allow(''),
  licensePlate: Joi.string().allow('')
}).unknown(true);

const plateSchema = Joi.object({
  plateNumber: Joi.string().required(),
  vehicleType: Joi.string().allow(''),
  ownerName: Joi.string().allow(''),
  ownerPhone: Joi.string().allow(''),
  validStartDate: Joi.string().required(),
  validEndDate: Joi.string().required(),
  issueReason: Joi.string().allow('')
}).unknown(true);

const blacklistSchema = Joi.object({
  type: Joi.string().valid('person', 'vehicle').required(),
  name: Joi.string().allow(''),
  phone: Joi.string().allow(''),
  idCard: Joi.string().allow(''),
  licensePlate: Joi.string().allow(''),
  reason: Joi.string().required(),
  level: Joi.string().valid('low', 'normal', 'high').default('normal')
}).unknown(true);

class ImportService {
  static async importFromCSV(filePath, type, fileName, operator = 'system') {
    const batchResult = await ImportBatch.create(type, fileName, operator);
    if (!batchResult.success) {
      throw new Error('Failed to create import batch');
    }
    
    const batchId = batchResult.id;
    
    try {
      const records = await this.parseCSV(filePath);
      const validationResults = this.validateRecords(records, type);
      const importResults = await this.bulkImport(validationResults.valid, type, batchId);
      
      await ImportBatch.complete(
        batchId, 
        validationResults.invalid.length === 0 ? 'completed' : 'completed_with_errors',
        validationResults.invalid.length > 0 ? `${validationResults.invalid.length} records failed validation` : null
      );
      
      await ImportBatch.updateProgress(
        batchId,
        records.length,
        importResults.success.length,
        importResults.failed.length + validationResults.invalid.length
      );
      
      return {
        batchId,
        total: records.length,
        valid: validationResults.valid.length,
        invalid: validationResults.invalid.length,
        imported: importResults.success.length,
        importFailed: importResults.failed.length,
        invalidRecords: validationResults.invalid,
        importErrors: importResults.failed
      };
    } catch (error) {
      await ImportBatch.complete(batchId, 'failed', error.message);
      throw error;
    }
  }

  static async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error));
    });
  }

  static validateRecords(records, type) {
    const valid = [];
    const invalid = [];
    let schema;
    
    switch (type) {
      case 'visitor':
        schema = visitorSchema;
        break;
      case 'temporary_plate':
        schema = plateSchema;
        break;
      case 'blacklist':
        schema = blacklistSchema;
        break;
      default:
        throw new Error(`Unknown import type: ${type}`);
    }
    
    records.forEach((record, index) => {
      const { error, value } = schema.validate(record);
      if (error) {
        invalid.push({
          index,
          record,
          errors: error.details.map(d => d.message)
        });
      } else {
        valid.push(value);
      }
    });
    
    return { valid, invalid };
  }

  static async bulkImport(records, type, batchId) {
    switch (type) {
      case 'visitor':
        return await Visitor.bulkCreate(records, batchId);
      case 'temporary_plate':
        return await TemporaryPlate.bulkCreate(records, batchId);
      case 'blacklist':
        return await Blacklist.bulkCreate(records, batchId);
      default:
        throw new Error(`Unknown import type: ${type}`);
    }
  }

  static async getBatchStatus(batchId) {
    return await ImportBatch.findById(batchId);
  }

  static async getAllBatches(filters = {}) {
    return await ImportBatch.findAll(filters);
  }
}

module.exports = ImportService;
