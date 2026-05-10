const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const chalk = require('chalk');
const { getDb, databaseExists } = require('../database');

function validateField(value, fieldName, required = true) {
  if (required && (value === undefined || value === null || value === '')) {
    return { valid: false, message: `字段 '${fieldName}' 不能为空` };
  }
  return { valid: true };
}

function parseDate(dateStr, fieldName) {
  if (!dateStr) return { valid: false, message: `字段 '${fieldName}' 不能为空` };
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return { valid: false, message: `字段 '${fieldName}' 日期格式无效: ${dateStr}` };
  }
  return { valid: true, value: date.toISOString().split('T')[0] };
}

function parseNumber(numStr, fieldName, min = 0) {
  if (numStr === undefined || numStr === null || numStr === '') {
    return { valid: false, message: `字段 '${fieldName}' 不能为空` };
  }
  const num = parseFloat(numStr);
  if (isNaN(num)) {
    return { valid: false, message: `字段 '${fieldName}' 不是有效数字: ${numStr}` };
  }
  if (num < min) {
    return { valid: false, message: `字段 '${fieldName}' 不能小于 ${min}: ${numStr}` };
  }
  return { valid: true, value: num };
}

async function readCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function validateAndTransformLocations(row, index) {
  const errors = [];
  const idCheck = validateField(row.id, 'id');
  if (!idCheck.valid) errors.push(`行 ${index + 1}: ${idCheck.message}`);
  
  const nameCheck = validateField(row.name, 'name');
  if (!nameCheck.valid) errors.push(`行 ${index + 1}: ${nameCheck.message}`);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      id: row.id.trim(),
      name: row.name.trim(),
      address: row.address ? row.address.trim() : null
    }
  };
}

function validateAndTransformProducts(row, index) {
  const errors = [];
  const idCheck = validateField(row.id, 'id');
  if (!idCheck.valid) errors.push(`行 ${index + 1}: ${idCheck.message}`);
  
  const nameCheck = validateField(row.name, 'name');
  if (!nameCheck.valid) errors.push(`行 ${index + 1}: ${nameCheck.message}`);

  const priceCheck = parseNumber(row.price, 'price', 0);
  if (!priceCheck.valid) errors.push(`行 ${index + 1}: ${priceCheck.message}`);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      id: row.id.trim(),
      name: row.name.trim(),
      category: row.category ? row.category.trim() : null,
      unit: row.unit ? row.unit.trim() : null,
      price: priceCheck.value
    }
  };
}

function validateAndTransformInventory(row, index) {
  const errors = [];
  const locCheck = validateField(row.location_id, 'location_id');
  if (!locCheck.valid) errors.push(`行 ${index + 1}: ${locCheck.message}`);
  
  const prodCheck = validateField(row.product_id, 'product_id');
  if (!prodCheck.valid) errors.push(`行 ${index + 1}: ${prodCheck.message}`);

  const qtyCheck = parseNumber(row.quantity, 'quantity', 0);
  if (!qtyCheck.valid) errors.push(`行 ${index + 1}: ${qtyCheck.message}`);

  const expiryCheck = parseDate(row.expiry_date, 'expiry_date');
  if (!expiryCheck.valid) errors.push(`行 ${index + 1}: ${expiryCheck.message}`);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      location_id: row.location_id.trim(),
      product_id: row.product_id.trim(),
      quantity: Math.floor(qtyCheck.value),
      batch_number: row.batch_number ? row.batch_number.trim() : null,
      expiry_date: expiryCheck.value
    }
  };
}

function validateAndTransformExpiryScans(row, index) {
  const errors = [];
  const locCheck = validateField(row.location_id, 'location_id');
  if (!locCheck.valid) errors.push(`行 ${index + 1}: ${locCheck.message}`);
  
  const prodCheck = validateField(row.product_id, 'product_id');
  if (!prodCheck.valid) errors.push(`行 ${index + 1}: ${prodCheck.message}`);

  const expiryCheck = parseDate(row.expiry_date, 'expiry_date');
  if (!expiryCheck.valid) errors.push(`行 ${index + 1}: ${expiryCheck.message}`);

  const scanCheck = parseDate(row.scan_date, 'scan_date');
  if (!scanCheck.valid) errors.push(`行 ${index + 1}: ${scanCheck.message}`);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      location_id: row.location_id.trim(),
      product_id: row.product_id.trim(),
      batch_number: row.batch_number ? row.batch_number.trim() : null,
      expiry_date: expiryCheck.value,
      scan_date: scanCheck.value,
      source: row.source ? row.source.trim() : 'manual'
    }
  };
}

async function importCommand(file, options) {
  const { type, dryRun } = options;
  
  if (!databaseExists()) {
    console.log(chalk.yellow('数据库不存在，请先运行: vending-transfer init'));
    return;
  }

  if (!fs.existsSync(file)) {
    console.log(chalk.red(`文件不存在: ${file}`));
    return;
  }

  const validTypes = ['locations', 'products', 'inventory', 'expiry-scans'];
  if (!validTypes.includes(type)) {
    console.log(chalk.red(`无效的类型: ${type}。有效类型: ${validTypes.join(', ')}`));
    return;
  }

  console.log(chalk.cyan(`正在导入 ${type} 数据...`));
  if (dryRun) {
    console.log(chalk.yellow('  (试运行模式，不会实际写入数据库)'));
  }

  try {
    const rows = await readCsvFile(file);
    console.log(chalk.gray(`  读取到 ${rows.length} 条记录`));

    let validator;
    switch (type) {
      case 'locations':
        validator = validateAndTransformLocations;
        break;
      case 'products':
        validator = validateAndTransformProducts;
        break;
      case 'inventory':
        validator = validateAndTransformInventory;
        break;
      case 'expiry-scans':
        validator = validateAndTransformExpiryScans;
        break;
    }

    const validRecords = [];
    const validationErrors = [];

    rows.forEach((row, index) => {
      const result = validator(row, index);
      if (result.valid) {
        validRecords.push(result.data);
      } else {
        validationErrors.push(...result.errors);
      }
    });

    if (validationErrors.length > 0) {
      console.log(chalk.red(`  发现 ${validationErrors.length} 个验证错误:`));
      validationErrors.slice(0, 10).forEach(err => {
        console.log(chalk.red(`    - ${err}`));
      });
      if (validationErrors.length > 10) {
        console.log(chalk.red(`    ... 还有 ${validationErrors.length - 10} 个错误`));
      }
    }

    if (validRecords.length === 0) {
      console.log(chalk.red('没有有效的记录可导入'));
      return;
    }

    console.log(chalk.green(`  ${validRecords.length} 条记录验证通过`));

    if (!dryRun) {
      const db = getDb();
      const insertImportRecord = db.prepare(`
        INSERT INTO import_records (file_name, record_type, total_records, successful_records, failed_records)
        VALUES (?, ?, ?, ?, ?)
      `);

      let successCount = 0;
      let failCount = 0;
      const failReasons = [];

      const transaction = db.transaction(() => {
        let insertStmt;
        
        switch (type) {
          case 'locations':
            insertStmt = db.prepare(`
              INSERT OR REPLACE INTO locations (id, name, address)
              VALUES (?, ?, ?)
            `);
            break;
          case 'products':
            insertStmt = db.prepare(`
              INSERT OR REPLACE INTO products (id, name, category, unit, price)
              VALUES (?, ?, ?, ?, ?)
            `);
            break;
          case 'inventory':
            insertStmt = db.prepare(`
              INSERT OR REPLACE INTO inventory (location_id, product_id, quantity, batch_number, expiry_date)
              VALUES (?, ?, ?, ?, ?)
            `);
            break;
          case 'expiry-scans':
            insertStmt = db.prepare(`
              INSERT INTO expiry_scans (location_id, product_id, batch_number, expiry_date, scan_date, source)
              VALUES (?, ?, ?, ?, ?, ?)
            `);
            break;
        }

        validRecords.forEach((record, index) => {
          try {
            switch (type) {
              case 'locations':
                insertStmt.run(record.id, record.name, record.address);
                break;
              case 'products':
                insertStmt.run(record.id, record.name, record.category, record.unit, record.price);
                break;
              case 'inventory':
                insertStmt.run(record.location_id, record.product_id, record.quantity, record.batch_number, record.expiry_date);
                break;
              case 'expiry-scans':
                insertStmt.run(record.location_id, record.product_id, record.batch_number, record.expiry_date, record.scan_date, record.source);
                break;
            }
            successCount++;
          } catch (err) {
            failCount++;
            failReasons.push(`记录 ${index + 1}: ${err.message}`);
          }
        });

        insertImportRecord.run(
          path.basename(file),
          type,
          validRecords.length,
          successCount,
          failCount
        );
      });

      transaction();
      db.close();

      console.log(chalk.green(`\n✓ 导入完成！`));
      console.log(`  成功: ${chalk.green(successCount)} 条`);
      console.log(`  失败: ${failCount > 0 ? chalk.red(failCount) : chalk.gray(failCount)} 条`);

      if (failReasons.length > 0) {
        console.log(chalk.red('\n  失败原因:'));
        failReasons.slice(0, 5).forEach(reason => {
          console.log(chalk.red(`    - ${reason}`));
        });
      }
    } else {
      console.log(chalk.yellow('\n✓ 试运行完成。上述记录将会被导入。'));
    }

  } catch (err) {
    console.log(chalk.red(`导入失败: ${err.message}`));
  }
}

module.exports = importCommand;
