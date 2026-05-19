const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const {
  ImportRecord,
  ImportError,
  Reagent,
  Inventory,
  User,
  Requisition,
  RequisitionItem
} = require('../models');
const { createAuditLog } = require('../middleware/audit');

function generateOrderNo(prefix) {
  const date = new Date();
  const timestamp = date.getTime().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${timestamp}${random}`;
}

class ImportService {
  async createImportRecord(type, filename, operator) {
    return await ImportRecord.create({
      import_no: generateOrderNo('IM'),
      import_type: type,
      file_name: filename,
      total_records: 0,
      success_records: 0,
      failed_records: 0,
      status: ImportRecord.IMPORT_STATUSES.PENDING,
      operator_id: operator.id,
      operator_name: operator.name
    });
  }

  async addImportError(import_id, rowNumber, fieldName, errorMessage, originalData, suggestion = null) {
    await ImportError.create({
      import_id,
      row_number: rowNumber,
      column_position: fieldName,
      original_data: typeof originalData === 'object' ? JSON.stringify(originalData) : originalData,
      error_message: errorMessage,
      suggestion,
      field_name: fieldName,
      field_value: originalData?.[fieldName]
    });
  }

  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  async parseJSON(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  }

  validateReagent(data, rowNumber) {
    const errors = [];

    if (!data.name || data.name.trim() === '') {
      errors.push({
        field: 'name',
        message: '试剂名称不能为空',
        suggestion: '请填写有效的试剂名称'
      });
    }

    if (!data.reagent_code || data.reagent_code.trim() === '') {
      errors.push({
        field: 'reagent_code',
        message: '试剂编码不能为空',
        suggestion: '请填写唯一的试剂编码'
      });
    }

    if (data.hazard_level && !['level_1', 'level_2', 'level_3', 'level_4'].includes(data.hazard_level)) {
      errors.push({
        field: 'hazard_level',
        message: '危险等级无效',
        suggestion: '请使用: level_1, level_2, level_3, level_4'
      });
    }

    if (data.unit && data.unit.length > 20) {
      errors.push({
        field: 'unit',
        message: '单位长度不能超过20个字符',
        suggestion: '请使用简短的单位表示'
      });
    }

    return errors;
  }

  validateInventory(data, rowNumber) {
    const errors = [];

    if (!data.batch_no || data.batch_no.trim() === '') {
      errors.push({
        field: 'batch_no',
        message: '批次号不能为空',
        suggestion: '请填写唯一的批次号'
      });
    }

    if (!data.reagent_code && !data.reagent_id) {
      errors.push({
        field: 'reagent',
        message: '必须指定试剂编码或试剂ID',
        suggestion: '请提供reagent_code或reagent_id'
      });
    }

    if (!data.quantity || isNaN(parseFloat(data.quantity)) || parseFloat(data.quantity) < 0) {
      errors.push({
        field: 'quantity',
        message: '数量必须为非负数字',
        suggestion: '请输入有效的数字'
      });
    }

    if (data.original_quantity && (isNaN(parseFloat(data.original_quantity)) || parseFloat(data.original_quantity) < 0)) {
      errors.push({
        field: 'original_quantity',
        message: '原始入库数量必须为非负数字',
        suggestion: '请输入有效的数字'
      });
    }

    return errors;
  }

  validateRequisition(data, rowNumber) {
    const errors = [];

    if (!data.applicant_name || data.applicant_name.trim() === '') {
      errors.push({
        field: 'applicant_name',
        message: '申请人姓名不能为空',
        suggestion: '请填写申请人姓名'
      });
    }

    if (!data.purpose || data.purpose.trim() === '') {
      errors.push({
        field: 'purpose',
        message: '申领用途不能为空',
        suggestion: '请填写详细的使用目的'
      });
    }

    if (!data.items || data.items.length === 0) {
      errors.push({
        field: 'items',
        message: '申领单至少需要包含一项试剂',
        suggestion: '请添加至少一项试剂'
      });
    }

    return errors;
  }

  async importReagents(filePath, operator, fileType = 'json') {
    const importRecord = await this.createImportRecord(ImportRecord.IMPORT_TYPES.REAGENTS, path.basename(filePath), operator);
    
    try {
      await importRecord.update({ 
        status: ImportRecord.IMPORT_STATUSES.PROCESSING,
        started_at: new Date()
      });

      let dataList;
      if (fileType === 'csv') {
        dataList = await this.parseCSV(filePath);
      } else {
        dataList = await this.parseJSON(filePath);
        if (!Array.isArray(dataList)) {
          dataList = [dataList];
        }
      }

      await importRecord.update({ total_records: dataList.length });

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < dataList.length; i++) {
        const rowNumber = i + 1;
        const data = dataList[i];

        const validationErrors = this.validateReagent(data, rowNumber);
        
        if (validationErrors.length > 0) {
          failCount++;
          for (const error of validationErrors) {
            await this.addImportError(
              importRecord.id,
              rowNumber,
              error.field,
              error.message,
              data,
              error.suggestion
            );
          }
          continue;
        }

        try {
          const existing = await Reagent.findOne({ where: { reagent_code: data.reagent_code } });
          
          if (existing) {
            await existing.update({
              name: data.name || existing.name,
              english_name: data.english_name || existing.english_name,
              cas_no: data.cas_no || existing.cas_no,
              formula: data.formula || existing.formula,
              molecular_weight: data.molecular_weight || existing.molecular_weight,
              hazard_level: data.hazard_level || existing.hazard_level,
              hazard_description: data.hazard_description || existing.hazard_description,
              safety_precautions: data.safety_precautions || existing.safety_precautions,
              storage_condition: data.storage_condition || existing.storage_condition,
              unit: data.unit || existing.unit,
              specification: data.specification || existing.specification,
              manufacturer: data.manufacturer || existing.manufacturer,
              category: data.category || existing.category,
              is_hazardous: data.is_hazardous !== undefined ? data.is_hazardous : existing.is_hazardous,
              approval_required: data.approval_required !== undefined ? data.approval_required : existing.approval_required,
              max_quantity_per_apply: data.max_quantity_per_apply || existing.max_quantity_per_apply
            });
          } else {
            await Reagent.create({
              reagent_code: data.reagent_code,
              name: data.name,
              english_name: data.english_name,
              cas_no: data.cas_no,
              formula: data.formula,
              molecular_weight: data.molecular_weight,
              hazard_level: data.hazard_level || 'level_4',
              hazard_description: data.hazard_description,
              safety_precautions: data.safety_precautions,
              storage_condition: data.storage_condition,
              unit: data.unit || '瓶',
              specification: data.specification,
              manufacturer: data.manufacturer,
              category: data.category,
              is_hazardous: data.is_hazardous || false,
              approval_required: data.approval_required || false,
              max_quantity_per_apply: data.max_quantity_per_apply
            });
          }
          successCount++;
        } catch (error) {
          failCount++;
          await this.addImportError(
            importRecord.id,
            rowNumber,
            'database',
            error.message,
            data,
            '请检查数据格式或联系管理员'
          );
        }
      }

      const finalStatus = failCount === 0 
        ? ImportRecord.IMPORT_STATUSES.COMPLETED 
        : (successCount > 0 ? ImportRecord.IMPORT_STATUSES.PARTIAL_SUCCESS : ImportRecord.IMPORT_STATUSES.FAILED);

      await importRecord.update({
        success_records: successCount,
        failed_records: failCount,
        status: finalStatus,
        completed_at: new Date()
      });

      await createAuditLog({
        action: 'import',
        module: 'import',
        recordId: importRecord.id,
        recordNo: importRecord.import_no,
        operatorId: operator.id,
        operatorName: operator.name,
        operatorRole: operator.role,
        description: `导入试剂数据: 成功 ${successCount}, 失败 ${failCount}`
      });

      return { importRecord, successCount, failCount };
    } catch (error) {
      await importRecord.update({
        status: ImportRecord.IMPORT_STATUSES.FAILED,
        error_message: error.message,
        completed_at: new Date()
      });
      throw error;
    }
  }

  async importInventory(filePath, operator, fileType = 'json') {
    const importRecord = await this.createImportRecord(ImportRecord.IMPORT_TYPES.INVENTORY_JSON, path.basename(filePath), operator);
    
    try {
      await importRecord.update({ 
        status: ImportRecord.IMPORT_STATUSES.PROCESSING,
        started_at: new Date()
      });

      let dataList;
      if (fileType === 'csv') {
        dataList = await this.parseCSV(filePath);
      } else {
        dataList = await this.parseJSON(filePath);
        if (!Array.isArray(dataList)) {
          dataList = [dataList];
        }
      }

      await importRecord.update({ total_records: dataList.length });

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < dataList.length; i++) {
        const rowNumber = i + 1;
        const data = dataList[i];

        const validationErrors = this.validateInventory(data, rowNumber);
        
        if (validationErrors.length > 0) {
          failCount++;
          for (const error of validationErrors) {
            await this.addImportError(
              importRecord.id,
              rowNumber,
              error.field,
              error.message,
              data,
              error.suggestion
            );
          }
          continue;
        }

        try {
          let reagent;
          if (data.reagent_code) {
            reagent = await Reagent.findOne({ where: { reagent_code: data.reagent_code } });
          } else if (data.reagent_id) {
            reagent = await Reagent.findByPk(data.reagent_id);
          }

          if (!reagent) {
            failCount++;
            await this.addImportError(
              importRecord.id,
              rowNumber,
              'reagent',
              '试剂不存在',
              data,
              '请先创建该试剂或检查试剂编码'
            );
            continue;
          }

          const existing = await Inventory.findOne({ where: { batch_no: data.batch_no } });
          const quantity = parseFloat(data.quantity);
          const original_quantity = data.original_quantity ? parseFloat(data.original_quantity) : quantity;
          
          if (existing) {
            await existing.update({
              reagent_id: reagent.id,
              quantity,
              original_quantity,
              location: data.location || existing.location,
              production_date: data.production_date,
              expiry_date: data.expiry_date,
              supplier: data.supplier || existing.supplier,
              purchase_price: data.purchase_price,
              warning_threshold: data.warning_threshold || existing.warning_threshold,
              remark: data.remark || existing.remark
            });
          } else {
            await Inventory.create({
              batch_no: data.batch_no,
              reagent_id: reagent.id,
              quantity,
              original_quantity,
              location: data.location,
              production_date: data.production_date,
              expiry_date: data.expiry_date,
              supplier: data.supplier,
              purchase_price: data.purchase_price,
              status: 'normal',
              warning_threshold: data.warning_threshold || 5,
              remark: data.remark
            });
          }
          successCount++;
        } catch (error) {
          failCount++;
          await this.addImportError(
            importRecord.id,
            rowNumber,
            'database',
            error.message,
            data,
            '请检查数据格式或联系管理员'
          );
        }
      }

      const finalStatus = failCount === 0 
        ? ImportRecord.IMPORT_STATUSES.COMPLETED 
        : (successCount > 0 ? ImportRecord.IMPORT_STATUSES.PARTIAL_SUCCESS : ImportRecord.IMPORT_STATUSES.FAILED);

      await importRecord.update({
        success_records: successCount,
        failed_records: failCount,
        status: finalStatus,
        completed_at: new Date()
      });

      await createAuditLog({
        action: 'import',
        module: 'import',
        recordId: importRecord.id,
        recordNo: importRecord.import_no,
        operatorId: operator.id,
        operatorName: operator.name,
        operatorRole: operator.role,
        description: `导入库存数据: 成功 ${successCount}, 失败 ${failCount}`
      });

      return { importRecord, successCount, failCount };
    } catch (error) {
      await importRecord.update({
        status: ImportRecord.IMPORT_STATUSES.FAILED,
        error_message: error.message,
        completed_at: new Date()
      });
      throw error;
    }
  }

  async importRequisitions(filePath, operator) {
    const importRecord = await this.createImportRecord(ImportRecord.IMPORT_TYPES.REQUISITION_CSV, path.basename(filePath), operator);
    
    try {
      await importRecord.update({ 
        status: ImportRecord.IMPORT_STATUSES.PROCESSING,
        started_at: new Date()
      });

      const dataList = await this.parseCSV(filePath);
      
      const requisitions = {};
      for (let i = 0; i < dataList.length; i++) {
        const data = dataList[i];
        const reqKey = data.requisition_no || data.applicant_name + data.purpose;
        
        if (!requisitions[reqKey]) {
          requisitions[reqKey] = {
            ...data,
            items: []
          };
        }
        
        if (data.reagent_code || data.reagent_name) {
          requisitions[reqKey].items.push({
            reagent_code: data.reagent_code,
            reagent_name: data.reagent_name,
            quantity: parseFloat(data.quantity) || 0,
            unit: data.unit
          });
        }
      }

      const requisitionList = Object.values(requisitions);
      await importRecord.update({ total_records: requisitionList.length });

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < requisitionList.length; i++) {
        const rowNumber = i + 1;
        const data = requisitionList[i];

        const validationErrors = this.validateRequisition(data, rowNumber);
        
        if (validationErrors.length > 0) {
          failCount++;
          for (const error of validationErrors) {
            await this.addImportError(
              importRecord.id,
              rowNumber,
              error.field,
              error.message,
              data,
              error.suggestion
            );
          }
          continue;
        }

        try {
          let user = await User.findOne({ where: { name: data.applicant_name } });
          if (!user) {
            user = await User.create({
              employee_id: 'U' + Date.now() + Math.floor(Math.random() * 1000),
              name: data.applicant_name,
              role: data.role || 'student',
              department: data.department
            });
          }

          const items = [];
          for (const item of data.items) {
            let reagent;
            if (item.reagent_code) {
              reagent = await Reagent.findOne({ where: { reagent_code: item.reagent_code } });
            }
            if (!reagent && item.reagent_name) {
              reagent = await Reagent.findOne({ where: { name: item.reagent_name } });
            }
            
            if (reagent) {
              items.push({
                reagent_id: reagent.id,
                reagent_code: reagent.reagent_code,
                reagent_name: reagent.name,
                hazard_level: reagent.hazard_level,
                unit: item.unit || reagent.unit,
                requested_quantity: item.quantity,
                status: 'pending'
              });
            }
          }

          if (items.length === 0) {
            failCount++;
            await this.addImportError(
              importRecord.id,
              rowNumber,
              'items',
              '没有找到有效的试剂项',
              data,
              '请检查试剂编码或名称是否正确'
            );
            continue;
          }

          const requisition = await Requisition.create({
            requisition_no: data.requisition_no || generateOrderNo('RQ'),
            applicant_id: user.id,
            applicant_name: user.name,
            department: data.department || user.department,
            purpose: data.purpose,
            experiment_name: data.experiment_name,
            status: 'draft',
            total_items: items.length,
            urgent: data.urgent === 'true' || data.urgent === true
          });

          for (const item of items) {
            item.requisition_id = requisition.id;
          }
          await RequisitionItem.bulkCreate(items);

          successCount++;
        } catch (error) {
          failCount++;
          await this.addImportError(
            importRecord.id,
            rowNumber,
            'database',
            error.message,
            data,
            '请检查数据格式或联系管理员'
          );
        }
      }

      const finalStatus = failCount === 0 
        ? ImportRecord.IMPORT_STATUSES.COMPLETED 
        : (successCount > 0 ? ImportRecord.IMPORT_STATUSES.PARTIAL_SUCCESS : ImportRecord.IMPORT_STATUSES.FAILED);

      await importRecord.update({
        success_records: successCount,
        failed_records: failCount,
        status: finalStatus,
        completed_at: new Date()
      });

      return { importRecord, successCount, failCount };
    } catch (error) {
      await importRecord.update({
        status: ImportRecord.IMPORT_STATUSES.FAILED,
        error_message: error.message,
        completed_at: new Date()
      });
      throw error;
    }
  }

  async getImportErrors(import_id) {
    return await ImportError.findAll({
      where: { import_id },
      order: [['row_number', 'ASC']]
    });
  }

  async listImports(filters = {}) {
    const where = {};
    if (filters.import_type) where.import_type = filters.import_type;
    if (filters.status) where.status = filters.status;

    return await ImportRecord.findAll({
      where,
      include: [{ model: ImportError, as: 'errors' }],
      order: [['created_at', 'DESC']]
    });
  }
}

module.exports = new ImportService();
