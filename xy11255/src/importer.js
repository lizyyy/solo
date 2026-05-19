const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const Order = require('../models/Order');
const OutOfStockItem = require('../models/OutOfStockItem');
const CompensationRule = require('../models/CompensationRule');
const ImportError = require('../models/ImportError');

class Validator {
  static validateOrder(data, rowNumber) {
    const errors = [];
    const suggestions = [];

    if (!data.order_no || data.order_no.trim() === '') {
      errors.push('订单号不能为空');
      suggestions.push('请填写订单号字段，格式如：DD20240101001');
    }

    if (!data.user_id || data.user_id.trim() === '') {
      errors.push('用户ID不能为空');
      suggestions.push('请填写用户ID字段');
    }

    if (!data.user_name || data.user_name.trim() === '') {
      errors.push('用户姓名不能为空');
      suggestions.push('请填写用户姓名字段');
    }

    if (!data.product_id || data.product_id.trim() === '') {
      errors.push('商品ID不能为空');
      suggestions.push('请填写商品ID字段');
    }

    if (!data.product_name || data.product_name.trim() === '') {
      errors.push('商品名称不能为空');
      suggestions.push('请填写商品名称字段');
    }

    const quantity = parseInt(data.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      errors.push('商品数量必须是正整数');
      suggestions.push('请检查数量字段，确保是大于0的整数');
    }

    const price = parseFloat(data.price);
    if (isNaN(price) || price < 0) {
      errors.push('商品单价必须是非负数');
      suggestions.push('请检查单价字段，确保是大于等于0的数字');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.join('; '),
      suggestions: suggestions.join('; ')
    };
  }

  static validateOutOfStock(data, rowNumber) {
    const errors = [];
    const suggestions = [];

    if (!data.product_id || data.product_id.trim() === '') {
      errors.push('商品ID不能为空');
      suggestions.push('请填写商品ID字段');
    }

    if (!data.product_name || data.product_name.trim() === '') {
      errors.push('商品名称不能为空');
      suggestions.push('请填写商品名称字段');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.join('; '),
      suggestions: suggestions.join('; ')
    };
  }

  static validateCompensationRule(data, index) {
    const errors = [];
    const suggestions = [];

    if (!data.rule_type || data.rule_type.trim() === '') {
      errors.push('规则类型不能为空');
      suggestions.push('规则类型可选值：refund(退款), exchange(换货), coupon(补券)');
    }

    if (!data.action || data.action.trim() === '') {
      errors.push('处理动作不能为空');
      suggestions.push('请填写处理动作字段');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.join('; '),
      suggestions: suggestions.join('; ')
    };
  }
}

class Importer {
  static async importOrders(filePath) {
    const fileName = path.basename(filePath);
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    await ImportError.clearByType('order');

    return new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          for (let i = 0; i < results.length; i++) {
            const row = results[i];
            const rowNumber = i + 2;
            const validation = Validator.validateOrder(row, rowNumber);

            if (validation.isValid) {
              try {
                const existing = await Order.findByOrderNo(row.order_no);
                if (!existing) {
                  await Order.create({
                    order_no: row.order_no,
                    user_id: row.user_id,
                    user_name: row.user_name,
                    phone: row.phone || '',
                    product_id: row.product_id,
                    product_name: row.product_name,
                    quantity: parseInt(row.quantity),
                    price: parseFloat(row.price),
                    total_amount: parseFloat(row.quantity) * parseFloat(row.price)
                  });
                  successCount++;
                }
              } catch (e) {
                await ImportError.create({
                  import_type: 'order',
                  file_name: fileName,
                  row_number: rowNumber,
                  raw_data: JSON.stringify(row),
                  error_message: e.message,
                  suggestion: '请检查数据格式是否正确'
                });
                errorCount++;
              }
            } else {
              await ImportError.create({
                import_type: 'order',
                file_name: fileName,
                row_number: rowNumber,
                raw_data: JSON.stringify(row),
                error_message: validation.errors,
                suggestion: validation.suggestions
              });
              errorCount++;
            }
          }

          resolve({ successCount, errorCount, total: results.length });
        });
    });
  }

  static async importOutOfStock(filePath) {
    const fileName = path.basename(filePath);
    let successCount = 0;
    let errorCount = 0;

    await ImportError.clearByType('out_of_stock');

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;
      const validation = Validator.validateOutOfStock(row, rowNumber);

      if (validation.isValid) {
        try {
          const existing = await OutOfStockItem.findByProductId(row.product_id);
          if (!existing) {
            await OutOfStockItem.create({
              product_id: row.product_id,
              product_name: row.product_name,
              stock_quantity: parseInt(row.stock_quantity) || 0,
              affected_orders: parseInt(row.affected_orders) || 0
            });
            successCount++;
          }
        } catch (e) {
          await ImportError.create({
            import_type: 'out_of_stock',
            file_name: fileName,
            row_number: rowNumber,
            raw_data: JSON.stringify(row),
            error_message: e.message,
            suggestion: '请检查数据格式是否正确'
          });
          errorCount++;
        }
      } else {
        await ImportError.create({
          import_type: 'out_of_stock',
          file_name: fileName,
          row_number: rowNumber,
          raw_data: JSON.stringify(row),
          error_message: validation.errors,
          suggestion: validation.suggestions
        });
        errorCount++;
      }
    }

    return { successCount, errorCount, total: data.length };
  }

  static async importCompensationRules(filePath) {
    const fileName = path.basename(filePath);
    let successCount = 0;
    let errorCount = 0;

    await ImportError.clearByType('compensation_rule');

    const content = fs.readFileSync(filePath, 'utf8');
    const rules = JSON.parse(content);

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const validation = Validator.validateCompensationRule(rule, i);

      if (validation.isValid) {
        try {
          await CompensationRule.create({
            rule_type: rule.rule_type,
            condition: rule.condition || '',
            action: rule.action,
            value: rule.value || 0,
            description: rule.description || ''
          });
          successCount++;
        } catch (e) {
          await ImportError.create({
            import_type: 'compensation_rule',
            file_name: fileName,
            row_number: i + 1,
            raw_data: JSON.stringify(rule),
            error_message: e.message,
            suggestion: '请检查JSON格式是否正确'
          });
          errorCount++;
        }
      } else {
        await ImportError.create({
          import_type: 'compensation_rule',
          file_name: fileName,
          row_number: i + 1,
          raw_data: JSON.stringify(rule),
          error_message: validation.errors,
          suggestion: validation.suggestions
        });
        errorCount++;
      }
    }

    return { successCount, errorCount, total: rules.length };
  }
}

module.exports = { Importer, Validator };
