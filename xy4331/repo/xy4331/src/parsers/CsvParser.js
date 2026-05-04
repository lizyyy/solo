const csv = require('csv-parser');
const { Readable } = require('stream');
const TransferRecord = require('../models/TransferRecord');
const Animal = require('../models/Animal');

class CsvParser {
  static parseTransferRecords(csvData) {
    return new Promise((resolve, reject) => {
      const results = {
        success: [],
        errors: [],
        warnings: []
      };

      let stream;
      if (Buffer.isBuffer(csvData)) {
        stream = Readable.from(csvData.toString());
      } else if (typeof csvData === 'string') {
        stream = Readable.from(csvData);
      } else {
        reject(new Error('CSV数据格式不支持'));
        return;
      }

      let rowIndex = 0;

      stream
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim().toLowerCase()
        }))
        .on('data', (row) => {
          rowIndex++;
          try {
            const parsedTransfer = this.validateAndTransformTransferRow(row, rowIndex);
            results.success.push(parsedTransfer);
          } catch (error) {
            results.errors.push({
              row: rowIndex,
              data: row,
              error: error.message
            });
          }
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (error) => {
          reject(new Error(`CSV解析失败: ${error.message}`));
        });
    });
  }

  static validateAndTransformTransferRow(row, rowIndex) {
    const fieldMappings = {
      'animal_id': ['animal_id', '动物编号', 'animalid', 'id'],
      'from_cage_id': ['from_cage_id', '原笼位', 'from_cage', 'from'],
      'to_cage_id': ['to_cage_id', '新笼位', 'to_cage', 'to', 'cage_id'],
      'transfer_date': ['transfer_date', '转笼日期', 'date', 'transferdate'],
      'transfer_reason': ['transfer_reason', '转笼原因', 'reason'],
      'performed_by': ['performed_by', '操作人员', 'operator', 'performedby']
    };

    const getFieldValue = (fieldName) => {
      const possibleNames = fieldMappings[fieldName] || [fieldName];
      for (const name of possibleNames) {
        if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
          return String(row[name]).trim();
        }
      }
      return undefined;
    };

    const animalId = getFieldValue('animal_id');
    const toCageId = getFieldValue('to_cage_id');
    const transferDate = getFieldValue('transfer_date');

    if (!animalId) {
      throw new Error(`缺少动物编号字段`);
    }
    if (!toCageId) {
      throw new Error(`缺少目标笼位字段`);
    }
    if (!transferDate) {
      throw new Error(`缺少转笼日期字段`);
    }

    const parsedDate = new Date(transferDate);
    if (isNaN(parsedDate.getTime())) {
      throw new Error(`无效的日期格式: ${transferDate}`);
    }

    const fromCageId = getFieldValue('from_cage_id') || null;
    const transferReason = getFieldValue('transfer_reason') || '常规转笼';
    const performedBy = getFieldValue('performed_by') || '系统导入';

    if (fromCageId && fromCageId === toCageId) {
      throw new Error(`原笼位与目标笼位相同: ${fromCageId}`);
    }

    return {
      transfer_id: `TRF-IMPORT-${Date.now()}-${rowIndex}`,
      animal_id: animalId,
      from_cage_id: fromCageId,
      to_cage_id: toCageId,
      transfer_date: parsedDate.toISOString(),
      transfer_reason: transferReason,
      performed_by: performedBy,
      status: 'pending'
    };
  }

  static async importTransferRecords(csvData, importedBy = 'system') {
    const parseResult = await this.parseTransferRecords(csvData);
    const imported = [];
    const errors = [];

    for (const transferData of parseResult.success) {
      try {
        let animal = await Animal.findByAnimalId(transferData.animal_id);
        if (!animal) {
          animal = await Animal.create({
            animal_id: transferData.animal_id,
            species: 'Unknown',
            status: 'active'
          });
        }

        const transfer = await TransferRecord.create(transferData);
        imported.push(transfer);
      } catch (error) {
        errors.push({
          data: transferData,
          error: error.message
        });
      }
    }

    return {
      total: parseResult.success.length + parseResult.errors.length,
      imported: imported.length,
      failed: errors.length + parseResult.errors.length,
      parse_errors: parseResult.errors,
      import_errors: errors,
      imported_records: imported
    };
  }

  static parseAnimals(csvData) {
    return new Promise((resolve, reject) => {
      const results = {
        success: [],
        errors: [],
        warnings: []
      };

      let stream;
      if (Buffer.isBuffer(csvData)) {
        stream = Readable.from(csvData.toString());
      } else if (typeof csvData === 'string') {
        stream = Readable.from(csvData);
      } else {
        reject(new Error('CSV数据格式不支持'));
        return;
      }

      let rowIndex = 0;

      stream
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim().toLowerCase()
        }))
        .on('data', (row) => {
          rowIndex++;
          try {
            const parsedAnimal = this.validateAndTransformAnimalRow(row, rowIndex);
            results.success.push(parsedAnimal);
          } catch (error) {
            results.errors.push({
              row: rowIndex,
              data: row,
              error: error.message
            });
          }
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (error) => {
          reject(new Error(`CSV解析失败: ${error.message}`));
        });
    });
  }

  static validateAndTransformAnimalRow(row, rowIndex) {
    const fieldMappings = {
      'animal_id': ['animal_id', '动物编号', 'animalid', 'id', '编号'],
      'species': ['species', '物种', '品种', 'species_name'],
      'strain': ['strain', '品系', 'strain_name'],
      'gender': ['gender', '性别', 'sex'],
      'birth_date': ['birth_date', '出生日期', 'birthdate'],
      'arrival_date': ['arrival_date', '入舍日期', 'arrivaldate'],
      'cage_id': ['cage_id', '笼位', 'cage']
    };

    const getFieldValue = (fieldName) => {
      const possibleNames = fieldMappings[fieldName] || [fieldName];
      for (const name of possibleNames) {
        if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
          return String(row[name]).trim();
        }
      }
      return undefined;
    };

    const animalId = getFieldValue('animal_id');
    const species = getFieldValue('species');

    if (!animalId) {
      throw new Error(`缺少动物编号字段`);
    }
    if (!species) {
      throw new Error(`缺少物种字段`);
    }

    const parseDate = (dateStr) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date.toISOString();
    };

    return {
      animal_id: animalId,
      species: species,
      strain: getFieldValue('strain') || null,
      gender: getFieldValue('gender') || 'unknown',
      birth_date: parseDate(getFieldValue('birth_date')),
      arrival_date: parseDate(getFieldValue('arrival_date')) || new Date().toISOString(),
      cage_id: getFieldValue('cage_id') || null,
      status: 'active'
    };
  }

  static parseCages(csvData) {
    return new Promise((resolve, reject) => {
      const results = {
        success: [],
        errors: [],
        warnings: []
      };

      let stream;
      if (Buffer.isBuffer(csvData)) {
        stream = Readable.from(csvData.toString());
      } else if (typeof csvData === 'string') {
        stream = Readable.from(csvData);
      } else {
        reject(new Error('CSV数据格式不支持'));
        return;
      }

      let rowIndex = 0;

      stream
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim().toLowerCase()
        }))
        .on('data', (row) => {
          rowIndex++;
          try {
            const parsedCage = this.validateAndTransformCageRow(row, rowIndex);
            results.success.push(parsedCage);
          } catch (error) {
            results.errors.push({
              row: rowIndex,
              data: row,
              error: error.message
            });
          }
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (error) => {
          reject(new Error(`CSV解析失败: ${error.message}`));
        });
    });
  }

  static validateAndTransformCageRow(row, rowIndex) {
    const fieldMappings = {
      'cage_id': ['cage_id', '笼位编号', 'cageid', 'id'],
      'rack_id': ['rack_id', '笼架编号', 'rackid', 'rack'],
      'position': ['position', '位置', 'pos'],
      'max_capacity': ['max_capacity', '最大容量', 'capacity', 'max']
    };

    const getFieldValue = (fieldName) => {
      const possibleNames = fieldMappings[fieldName] || [fieldName];
      for (const name of possibleNames) {
        if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
          return String(row[name]).trim();
        }
      }
      return undefined;
    };

    const cageId = getFieldValue('cage_id');
    const rackId = getFieldValue('rack_id');

    if (!cageId) {
      throw new Error(`缺少笼位编号字段`);
    }
    if (!rackId) {
      throw new Error(`缺少笼架编号字段`);
    }

    const maxCapacity = getFieldValue('max_capacity');
    const parsedCapacity = maxCapacity ? parseInt(maxCapacity, 10) : 5;

    return {
      cage_id: cageId,
      rack_id: rackId,
      position: getFieldValue('position') || null,
      max_capacity: isNaN(parsedCapacity) ? 5 : parsedCapacity,
      status: 'available'
    };
  }
}

module.exports = CsvParser;
