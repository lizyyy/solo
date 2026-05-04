import Papa from 'papaparse';
import productModel from '../models/productModel.js';
import transactionModel from '../models/transactionModel.js';
import subscriptionModel from '../models/subscriptionModel.js';
import payoutRuleModel from '../models/payoutRuleModel.js';
import accountModel from '../models/accountModel.js';
import holderModel from '../models/holderModel.js';
import {
  validateProduct,
  validateTransaction,
  validateSubscription,
  validateShareRatios,
  validatePayoutRule,
  ValidationError
} from '../utils/validators.js';
import db from '../config/database.js';

export const importProducts = (csvContent) => {
  const results = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    trimHeaders: true
  });

  const errors = [];
  const validRecords = [];

  results.data.forEach((row, index) => {
    const rowNumber = index + 2;
    
    const validation = validateProduct(row, rowNumber);
    if (!validation.isValid) {
      errors.push(...validation.errors);
    } else {
      validRecords.push(validation.cleanedData);
    }
  });

  if (errors.length > 0) {
    return {
      success: false,
      errors: errors.map(e => e.toJSON()),
      importedCount: 0,
      totalCount: results.data.length
    };
  }

  const imported = [];
  db.transaction(() => {
    validRecords.forEach(record => {
      const product = productModel.upsert(record);
      imported.push(product);
    });
  })();

  return {
    success: true,
    errors: [],
    importedCount: imported.length,
    totalCount: results.data.length,
    imported
  };
};

export const importTransactions = (csvContent) => {
  const results = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    trimHeaders: true
  });

  const errors = [];
  const validRecords = [];

  results.data.forEach((row, index) => {
    const rowNumber = index + 2;
    
    const validation = validateTransaction(row, rowNumber);
    if (!validation.isValid) {
      errors.push(...validation.errors);
    } else {
      validRecords.push(validation.cleanedData);
    }
  });

  if (errors.length > 0) {
    return {
      success: false,
      errors: errors.map(e => e.toJSON()),
      importedCount: 0,
      totalCount: results.data.length
    };
  }

  const imported = [];
  db.transaction(() => {
    validRecords.forEach(record => {
      let accountId = record.account_id;
      
      if (!accountId && record.account_name) {
        const account = accountModel.findOrCreate({
          account_name: record.account_name,
          bank_name: record.bank_name || '未知银行'
        });
        accountId = account.id;
      }

      if (accountId) {
        const transaction = transactionModel.create({
          ...record,
          account_id: accountId
        });
        imported.push(transaction);
      } else {
        errors.push(new ValidationError(
          '无法找到或创建账户',
          'account_name',
          record.account_name,
          rowNumber
        ));
      }
    });
  })();

  if (errors.length > 0) {
    return {
      success: false,
      errors: errors.map(e => e.toJSON()),
      importedCount: 0,
      totalCount: results.data.length
    };
  }

  return {
    success: true,
    errors: [],
    importedCount: imported.length,
    totalCount: results.data.length,
    imported
  };
};

export const importSubscriptions = (csvContent) => {
  const results = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    trimHeaders: true
  });

  const errors = [];
  const validRecords = [];

  results.data.forEach((row, index) => {
    const rowNumber = index + 2;
    
    const validation = validateSubscription(row, rowNumber);
    if (!validation.isValid) {
      errors.push(...validation.errors);
    } else {
      validRecords.push(validation.cleanedData);
    }
  });

  const ratioValidation = validateShareRatios(validRecords);
  if (!ratioValidation.isValid) {
    ratioValidation.errors.forEach(err => {
      errors.push(new ValidationError(
        err.error,
        'share_ratio',
        err.totalRatio,
        err.rows.join(', ')
      ));
    });
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors: errors.map(e => e.toJSON()),
      importedCount: 0,
      totalCount: results.data.length
    };
  }

  const imported = [];
  db.transaction(() => {
    validRecords.forEach(record => {
      let productId = record.product_id;
      let holderId = record.holder_id;
      let accountId = record.account_id;

      if (!productId && record.product_code) {
        const product = productModel.findByCode(record.product_code);
        if (product) {
          productId = product.id;
        } else {
          errors.push(new ValidationError(
            `产品代码 ${record.product_code} 不存在`,
            'product_code',
            record.product_code,
            validRecords.indexOf(record) + 2
          ));
          return;
        }
      }

      if (!holderId && record.holder_name) {
        const holder = holderModel.findOrCreate({
          holder_name: record.holder_name
        });
        holderId = holder.id;
      }

      if (!accountId && record.account_name) {
        const account = accountModel.findOrCreate({
          account_name: record.account_name,
          bank_name: record.bank_name || '未知银行'
        });
        accountId = account.id;
      }

      if (productId && holderId && accountId) {
        const subscription = subscriptionModel.create({
          ...record,
          product_id: productId,
          holder_id: holderId,
          account_id: accountId
        });
        imported.push(subscription);
      }
    });
  })();

  if (errors.length > 0) {
    return {
      success: false,
      errors: errors.map(e => e.toJSON()),
      importedCount: 0,
      totalCount: results.data.length
    };
  }

  return {
    success: true,
    errors: [],
    importedCount: imported.length,
    totalCount: results.data.length,
    imported
  };
};

export const importPayoutRules = (jsonContent) => {
  let rules;
  try {
    rules = JSON.parse(jsonContent);
    if (!Array.isArray(rules)) {
      rules = [rules];
    }
  } catch (e) {
    return {
      success: false,
      errors: [{
        error: 'JSON 格式错误: ' + e.message,
        field: 'json',
        value: jsonContent.substring(0, 100),
        rowNumber: null
      }],
      importedCount: 0,
      totalCount: 0
    };
  }

  const errors = [];
  const validRecords = [];

  rules.forEach((rule, index) => {
    const rowNumber = index + 1;
    
    const validation = validatePayoutRule(rule, rowNumber);
    if (!validation.isValid) {
      errors.push(...validation.errors);
    } else {
      validRecords.push(validation.cleanedData);
    }
  });

  if (errors.length > 0) {
    return {
      success: false,
      errors: errors.map(e => e.toJSON()),
      importedCount: 0,
      totalCount: rules.length
    };
  }

  const imported = [];
  db.transaction(() => {
    validRecords.forEach(record => {
      let productId = record.product_id;

      if (!productId && record.product_code) {
        const product = productModel.findByCode(record.product_code);
        if (product) {
          productId = product.id;
        } else {
          errors.push(new ValidationError(
            `产品代码 ${record.product_code} 不存在`,
            'product_code',
            record.product_code,
            validRecords.indexOf(record) + 1
          ));
          return;
        }
      }

      if (productId) {
        const rule = payoutRuleModel.upsert({
          ...record,
          product_id: productId
        });
        imported.push(rule);
      }
    });
  })();

  if (errors.length > 0) {
    return {
      success: false,
      errors: errors.map(e => e.toJSON()),
      importedCount: 0,
      totalCount: rules.length
    };
  }

  return {
    success: true,
    errors: [],
    importedCount: imported.length,
    totalCount: rules.length,
    imported
  };
};

export default {
  importProducts,
  importTransactions,
  importSubscriptions,
  importPayoutRules
};
