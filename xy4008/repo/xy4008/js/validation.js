(function(global) {
  'use strict';

  const { Item, BorrowRecord, HISTORY_TYPES } = global.Models || {};
  const Storage = global.Storage;

  // 校验结果类
  class ValidationResult {
    constructor(valid = true, message = '', data = null) {
      this.valid = valid;
      this.message = message;
      this.data = data;
    }

    static success(data = null) {
      return new ValidationResult(true, '', data);
    }

    static error(message, data = null) {
      return new ValidationResult(false, message, data);
    }
  }

  // 业务校验器
  class Validator {
    constructor() {
      this.storage = Storage;
    }

    // ===== 物料校验 =====

    validateItem(itemData) {
      const errors = [];

      if (!itemData.name || !itemData.name.trim()) {
        errors.push('物料名称不能为空');
      } else {
        const duplicate = this.checkDuplicateName(
          itemData.name.trim(),
          itemData.id
        );
        if (duplicate) {
          errors.push(`物料名称 "${itemData.name}" 已存在`);
        }
      }

      if (itemData.totalQuantity === undefined || itemData.totalQuantity === null) {
        errors.push('库存数量不能为空');
      } else if (itemData.totalQuantity < 0) {
        errors.push('库存数量不能为负数');
      }

      if (itemData.totalQuantity < itemData.borrowedQuantity) {
        errors.push('总库存不能小于已借出数量');
      }

      if (errors.length > 0) {
        return ValidationResult.error(errors.join('；'), { errors });
      }

      return ValidationResult.success();
    }

    checkDuplicateName(name, excludeId = null) {
      const items = this.storage.getItems();
      return items.some(item => 
        item.name === name && item.id !== excludeId
      );
    }

    validateNewItem(itemData) {
      const baseValidation = this.validateItem(itemData);
      if (!baseValidation.valid) {
        return baseValidation;
      }

      if (itemData.totalQuantity <= 0) {
        return ValidationResult.error('新增物料库存数量必须大于0');
      }

      return ValidationResult.success();
    }

    validateUpdateItem(itemData, existingItem) {
      if (!existingItem) {
        return ValidationResult.error('物料不存在');
      }

      const baseValidation = this.validateItem(itemData);
      if (!baseValidation.valid) {
        return baseValidation;
      }

      const activeRecords = this.storage.getActiveBorrowRecordsByItemId(existingItem.id);
      const currentBorrowed = activeRecords.reduce((sum, r) => sum + r.quantity, 0);
      
      if (itemData.totalQuantity < currentBorrowed) {
        return ValidationResult.error(
          `库存数量不能小于当前已借出数量 (${currentBorrowed})`
        );
      }

      return ValidationResult.success();
    }

    validateDeleteItem(itemId) {
      const item = this.storage.getItemById(itemId);
      if (!item) {
        return ValidationResult.error('物料不存在');
      }

      const activeRecords = this.storage.getActiveBorrowRecordsByItemId(itemId);
      if (activeRecords.length > 0) {
        return ValidationResult.error(
          '该物料当前有借出记录，无法删除。请先归还所有借出物品后再删除。'
        );
      }

      return ValidationResult.success();
    }

    // ===== 借还校验 =====

    validateBorrow(borrowData) {
      const errors = [];

      if (!borrowData.itemId) {
        errors.push('请选择物料');
      }

      if (!borrowData.project || !borrowData.project.trim()) {
        errors.push('请填写所属项目');
      }

      if (!borrowData.person || !borrowData.person.trim()) {
        errors.push('请填写借用人');
      }

      if (!borrowData.expectedReturnAt) {
        errors.push('请填写预计归还时间');
      }

      if (errors.length > 0) {
        return ValidationResult.error(errors.join('；'), { errors });
      }

      const item = this.storage.getItemById(borrowData.itemId);
      if (!item) {
        return ValidationResult.error('物料不存在');
      }

      const quantity = parseInt(borrowData.quantity) || 1;
      if (quantity <= 0) {
        return ValidationResult.error('借出数量必须大于0');
      }

      if (!item.canBorrow(quantity)) {
        return ValidationResult.error(
          `库存不足！当前可用数量: ${item.availableQuantity}，尝试借出: ${quantity}`
        );
      }

      const expectedReturn = new Date(borrowData.expectedReturnAt);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expectedReturn.setHours(0, 0, 0, 0);

      if (expectedReturn < today) {
        return ValidationResult.error('预计归还时间不能早于今天');
      }

      return ValidationResult.success();
    }

    validateReturn(borrowRecordId) {
      const borrowRecord = this.storage.getBorrowRecordById(borrowRecordId);
      
      if (!borrowRecord) {
        return ValidationResult.error('借还记录不存在');
      }

      if (borrowRecord.status === 'returned') {
        return ValidationResult.error('该物品已归还，请勿重复操作');
      }

      const item = this.storage.getItemById(borrowRecord.itemId);
      if (!item) {
        return ValidationResult.error('关联物料不存在');
      }

      return ValidationResult.success({
        borrowRecord,
        item
      });
    }

    validatePartialReturn(borrowRecordId, returnQuantity) {
      const result = this.validateReturn(borrowRecordId);
      if (!result.valid) {
        return result;
      }

      const { borrowRecord } = result.data;
      const quantity = parseInt(returnQuantity) || 0;

      if (quantity <= 0) {
        return ValidationResult.error('归还数量必须大于0');
      }

      if (quantity > borrowRecord.quantity) {
        return ValidationResult.error(
          `归还数量不能大于借出数量。当前借出: ${borrowRecord.quantity}，尝试归还: ${quantity}`
        );
      }

      return ValidationResult.success({
        borrowRecord: result.data.borrowRecord,
        item: result.data.item,
        returnQuantity: quantity
      });
    }

    // ===== 导入校验 =====

    validateCSVRow(row, index) {
      const errors = [];
      const warnings = [];

      if (!row.name || !String(row.name).trim()) {
        errors.push(`第 ${index + 1} 行：物料名称不能为空`);
      }

      let quantity = 0;
      if (row.quantity === undefined || row.quantity === null || row.quantity === '') {
        warnings.push(`第 ${index + 1} 行：库存数量为空，默认设置为 0`);
        quantity = 0;
      } else {
        quantity = parseInt(row.quantity);
        if (isNaN(quantity) || quantity < 0) {
          errors.push(`第 ${index + 1} 行：库存数量必须是非负整数`);
        }
      }

      const category = String(row.category || '').trim();
      const validCategories = ['道具', '灯光', '录音', '摄影', '其他', ''];
      if (category && !validCategories.includes(category)) {
        warnings.push(`第 ${index + 1} 行：分类 "${category}" 不是标准分类，将作为自定义分类处理`);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        data: {
          name: String(row.name || '').trim(),
          category,
          totalQuantity: quantity,
          description: String(row.description || '').trim()
        }
      };
    }

    // ===== 工具方法 =====

    isOverdue(expectedReturnAt) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expected = new Date(expectedReturnAt);
      expected.setHours(0, 0, 0, 0);
      return today > expected;
    }

    getOverdueRecords() {
      const activeRecords = this.storage.getActiveBorrowRecords();
      return activeRecords.filter(record => 
        this.isOverdue(record.expectedReturnAt)
      );
    }
  }

  // 创建单例
  const Validation = new Validator();

  // 导出到全局
  global.Validation = Validation;
  global.ValidationResult = ValidationResult;
  global.Validator = Validator;

})(window);
