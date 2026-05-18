const CompensationModel = require('../models/CompensationModel');
const { Parser } = require('json2csv');

class CompensationService {
  static validateCompensationData(data) {
    const errors = [];
    const warnings = [];

    if (!data.compensation_no) {
      errors.push('赔付单号不能为空');
    }
    if (!data.order_no) {
      errors.push('关联订单号不能为空');
    }
    if (!data.customer_name) {
      errors.push('客户姓名不能为空');
    }
    if (!data.customer_phone) {
      errors.push('客户电话不能为空');
    }
    if (!data.tent_model) {
      errors.push('帐篷型号不能为空');
    }
    if (!data.return_date) {
      errors.push('归还日期不能为空');
    }
    if (!data.check_person) {
      errors.push('验收人员不能为空');
    }
    if (data.total_compensation_amount === undefined || data.total_compensation_amount === null) {
      errors.push('赔付总金额不能为空');
    }
    if (data.total_compensation_amount < 0) {
      errors.push('赔付总金额不能为负数');
    }

    if (data.main_component_damage === 'yes' && data.accessory_missing === 'yes') {
      warnings.push('同时存在主件破损和配件缺失情况，请仔细核对赔付清单一致性');
    }

    if (data.main_component_damage === 'yes') {
      if (!data.main_damage_level) {
        errors.push('主件破损时必须填写破损等级');
      }
      if (!data.main_damage_description) {
        errors.push('主件破损时必须填写破损描述');
      }
      if (!data.main_compensation_amount || data.main_compensation_amount <= 0) {
        errors.push('主件破损时必须填写主件赔付金额且大于0');
      }
    }

    if (data.accessory_missing === 'yes') {
      if (!data.missing_accessory_list) {
        errors.push('配件缺失时必须填写缺失配件清单');
      }
      if (!data.accessory_compensation_amount || data.accessory_compensation_amount <= 0) {
        errors.push('配件缺失时必须填写配件赔付金额且大于0');
      }
    }

    const calculatedTotal = (data.main_compensation_amount || 0) + (data.accessory_compensation_amount || 0);
    if (Math.abs(calculatedTotal - data.total_compensation_amount) > 0.01) {
      errors.push(`赔付清单不一致：主件赔付(${data.main_compensation_amount || 0}) + 配件赔付(${data.accessory_compensation_amount || 0}) = ${calculatedTotal}，与总赔付(${data.total_compensation_amount})不符`);
    }

    return { errors, warnings };
  }

  static validateCompensationItems(items, data) {
    const errors = [];
    if (!items || items.length === 0) return errors;

    let calculatedTotal = 0;
    let mainItemTotal = 0;
    let accessoryItemTotal = 0;

    items.forEach((item, index) => {
      if (!item.item_type) {
        errors.push(`第${index + 1}行: 项目类型不能为空`);
      }
      if (!item.item_name) {
        errors.push(`第${index + 1}行: 项目名称不能为空`);
      }
      if (!item.quantity || item.quantity <= 0) {
        errors.push(`第${index + 1}行: 数量必须大于0`);
      }
      if (!item.unit_price || item.unit_price <= 0) {
        errors.push(`第${index + 1}行: 单价必须大于0`);
      }
      if (!item.reason) {
        errors.push(`第${index + 1}行: 赔付原因不能为空`);
      }

      const subtotal = item.quantity * item.unit_price;
      if (Math.abs(subtotal - item.subtotal) > 0.01) {
        errors.push(`第${index + 1}行: 小计金额不一致，计算应为${subtotal}，实际填写${item.subtotal}`);
      }

      calculatedTotal += subtotal;
      if (item.item_type === 'main') {
        mainItemTotal += subtotal;
      } else if (item.item_type === 'accessory') {
        accessoryItemTotal += subtotal;
      }
    });

    if (Math.abs(calculatedTotal - data.total_compensation_amount) > 0.01) {
      errors.push(`赔付清单总金额(${calculatedTotal})与赔付记录总金额(${data.total_compensation_amount})不一致`);
    }

    if (data.main_compensation_amount && Math.abs(mainItemTotal - data.main_compensation_amount) > 0.01) {
      errors.push(`主件赔付明细总额(${mainItemTotal})与主件赔付金额(${data.main_compensation_amount})不一致`);
    }

    if (data.accessory_compensation_amount && Math.abs(accessoryItemTotal - data.accessory_compensation_amount) > 0.01) {
      errors.push(`配件赔付明细总额(${accessoryItemTotal})与配件赔付金额(${data.accessory_compensation_amount})不一致`);
    }

    return errors;
  }

  static async createCompensation(compensationData, items) {
    const validationResult = this.validateCompensationData(compensationData);
    const itemErrors = this.validateCompensationItems(items, compensationData);
    const allErrors = [...validationResult.errors, ...itemErrors];

    if (allErrors.length > 0) {
      throw { type: 'VALIDATION_ERROR', errors: allErrors, warnings: validationResult.warnings };
    }

    return { 
      compensation_no: await CompensationModel.create(compensationData, items),
      warnings: validationResult.warnings 
    };
  }

  static async getCompensation(compensation_no) {
    const record = await CompensationModel.findByNo(compensation_no);
    if (!record) {
      throw { type: 'NOT_FOUND', message: `赔付单号 ${compensation_no} 不存在` };
    }
    const items = await CompensationModel.getItems(compensation_no);
    return { ...record, items };
  }

  static async listCompensations(page, limit) {
    return await CompensationModel.findAll(page, limit);
  }

  static async updateCompensation(compensation_no, updateData, items) {
    const existing = await CompensationModel.findByNo(compensation_no);
    if (!existing) {
      throw { type: 'NOT_FOUND', message: `赔付单号 ${compensation_no} 不存在` };
    }

    const mergedData = { ...existing, ...updateData };
    const validationResult = this.validateCompensationData(mergedData);
    
    let itemErrors = [];
    if (items) {
      itemErrors = this.validateCompensationItems(items, mergedData);
    }

    const allErrors = [...validationResult.errors, ...itemErrors];
    if (allErrors.length > 0) {
      throw { type: 'VALIDATION_ERROR', errors: allErrors, warnings: validationResult.warnings };
    }

    return {
      version: await CompensationModel.update(compensation_no, updateData, items),
      warnings: validationResult.warnings
    };
  }

  static async exportToCSV() {
    const records = await CompensationModel.exportAll();
    const fields = [
      'compensation_no', 'order_no', 'customer_name', 'customer_phone',
      'tent_model', 'return_date', 'check_person', 'main_component_damage',
      'main_damage_level', 'main_damage_description', 'main_compensation_amount',
      'accessory_missing', 'missing_accessory_list', 'accessory_compensation_amount',
      'total_compensation_amount', 'compensation_status', 'payment_method',
      'payment_time', 'remarks', 'version', 'created_at'
    ];
    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(records);
  }

  static async importFromCSV(records) {
    const results = {
      success: [],
      failed: [],
      errors: []
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const lineNumber = i + 2;

      try {
        const compensationData = {
          compensation_no: record.compensation_no,
          order_no: record.order_no,
          customer_name: record.customer_name,
          customer_phone: record.customer_phone,
          tent_model: record.tent_model,
          return_date: record.return_date,
          check_person: record.check_person,
          main_component_damage: record.main_component_damage,
          main_damage_level: record.main_damage_level,
          main_damage_description: record.main_damage_description,
          main_compensation_amount: parseFloat(record.main_compensation_amount) || 0,
          accessory_missing: record.accessory_missing,
          missing_accessory_list: record.missing_accessory_list,
          accessory_compensation_amount: parseFloat(record.accessory_compensation_amount) || 0,
          total_compensation_amount: parseFloat(record.total_compensation_amount),
          compensation_status: record.compensation_status || 'pending',
          remarks: record.remarks || ''
        };

        const validationResult = this.validateCompensationData(compensationData);
        if (validationResult.errors.length > 0) {
          results.failed.push({ line: lineNumber, record: compensationData });
          results.errors.push({ line: lineNumber, errors: validationResult.errors, warnings: validationResult.warnings });
          continue;
        }

        await CompensationModel.create(compensationData, []);
        results.success.push({ line: lineNumber, compensation_no: compensationData.compensation_no });
      } catch (error) {
        if (error.type === 'DUPLICATE_RECORD') {
          results.failed.push({ line: lineNumber, record });
          results.errors.push({ line: lineNumber, errors: [error.message] });
        } else {
          results.failed.push({ line: lineNumber, record });
          results.errors.push({ line: lineNumber, errors: [error.message || '导入失败'] });
        }
      }
    }

    return results;
  }
}

module.exports = CompensationService;
