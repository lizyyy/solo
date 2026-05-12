const fs = require('fs');
const chalk = require('chalk');
const dataStore = require('../utils/dataStore');
const ruleEngine = require('../core/rules');
const samples = require('../data/samples');

const TYPE_MAPPING = {
  temperature: 'temperature',
  temp: 'temperature',
  door: 'door',
  maintenance: 'maintenance',
  batch: 'batch',
  alert: 'alerts'
};

const importSamples = () => {
  console.log(chalk.cyan('正在导入内置样例数据...'));
  console.log('');
  
  const results = [];
  
  samples.batches.forEach(item => {
    try {
      if (!dataStore.exists('batch', item.id)) {
        dataStore.create('batch', item, item.id, 'system');
        results.push({ type: 'batch', id: item.id, status: 'created' });
      } else {
        results.push({ type: 'batch', id: item.id, status: 'skipped', reason: '已存在' });
      }
    } catch (err) {
      results.push({ type: 'batch', id: item.id, status: 'error', error: err.message });
    }
  });
  
  samples.maintenance.forEach(item => {
    try {
      if (!dataStore.exists('maintenance', item.id)) {
        dataStore.create('maintenance', item, item.id, 'system');
        results.push({ type: 'maintenance', id: item.id, status: 'created' });
      } else {
        results.push({ type: 'maintenance', id: item.id, status: 'skipped', reason: '已存在' });
      }
    } catch (err) {
      results.push({ type: 'maintenance', id: item.id, status: 'error', error: err.message });
    }
  });
  
  samples.door.forEach(item => {
    try {
      if (!dataStore.exists('door', item.id)) {
        dataStore.create('door', item, item.id, 'system');
        results.push({ type: 'door', id: item.id, status: 'created' });
      } else {
        results.push({ type: 'door', id: item.id, status: 'skipped', reason: '已存在' });
      }
    } catch (err) {
      results.push({ type: 'door', id: item.id, status: 'error', error: err.message });
    }
  });
  
  samples.temperature.forEach(item => {
    try {
      if (!dataStore.exists('temperature', item.id)) {
        const dup = ruleEngine.detectDuplicateSensor(item);
        const gaps = ruleEngine.detectBreakpoint(item);
        const enriched = {
          ...item,
          hasDuplicate: dup,
          hasBreakpoint: !!gaps,
          breakpoints: gaps
        };
        dataStore.create('temperature', enriched, item.id, 'system');
        results.push({ 
          type: 'temperature', 
          id: item.id, 
          status: 'created',
          warnings: []
        });
        if (dup) results[results.length - 1].warnings.push('检测到重复传感器数据');
        if (gaps) results[results.length - 1].warnings.push(`检测到 ${gaps.length} 个断点`);
      } else {
        results.push({ type: 'temperature', id: item.id, status: 'skipped', reason: '已存在' });
      }
    } catch (err) {
      results.push({ type: 'temperature', id: item.id, status: 'error', error: err.message });
    }
  });
  
  samples.alerts.forEach(item => {
    try {
      if (!dataStore.exists('alerts', item.id)) {
        dataStore.create('alerts', item, item.id, 'system');
        results.push({ type: 'alerts', id: item.id, status: 'created' });
      } else {
        results.push({ type: 'alerts', id: item.id, status: 'skipped', reason: '已存在' });
      }
    } catch (err) {
      results.push({ type: 'alerts', id: item.id, status: 'error', error: err.message });
    }
  });
  
  return results;
};

const importFromFile = (type, filePath) => {
  if (!TYPE_MAPPING[type]) {
    throw new Error(`不支持的数据类型: ${type}。支持: ${Object.keys(TYPE_MAPPING).join(', ')}`);
  }
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  
  const actualType = TYPE_MAPPING[type];
  let data;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    data = JSON.parse(content);
  } catch (err) {
    throw new Error(`文件解析失败: ${err.message}`);
  }
  
  const items = Array.isArray(data) ? data : [data];
  const results = [];
  
  items.forEach((item, index) => {
    try {
      const id = item.id || `${actualType}-${Date.now()}-${index}`;
      if (!dataStore.exists(actualType, id)) {
        if (actualType === 'temperature') {
          const dup = ruleEngine.detectDuplicateSensor(item);
          const gaps = ruleEngine.detectBreakpoint(item);
          const enriched = { ...item, hasDuplicate: dup, hasBreakpoint: !!gaps, breakpoints: gaps };
          dataStore.create(actualType, enriched, id, 'system');
        } else {
          dataStore.create(actualType, item, id, 'system');
        }
        results.push({ type: actualType, id, status: 'created' });
      } else {
        results.push({ type: actualType, id, status: 'skipped', reason: '已存在' });
      }
    } catch (err) {
      results.push({ type: actualType, id: item.id || `item-${index}`, status: 'error', error: err.message });
    }
  });
  
  return results;
};

const printResults = (results) => {
  const created = results.filter(r => r.status === 'created').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const errors = results.filter(r => r.status === 'error').length;
  
  results.forEach(r => {
    if (r.status === 'created') {
      console.log(chalk.green(`  ✓ [${r.type}] ${r.id} - 已导入`));
      if (r.warnings && r.warnings.length > 0) {
        r.warnings.forEach(w => console.log(chalk.yellow(`    ⚠ ${w}`)));
      }
    } else if (r.status === 'skipped') {
      console.log(chalk.gray(`  - [${r.type}] ${r.id} - 已跳过 (${r.reason})`));
    } else {
      console.log(chalk.red(`  ✗ [${r.type}] ${r.id} - ${r.error}`));
    }
  });
  
  console.log('');
  console.log(chalk.bold('导入结果:'));
  console.log(`  ${chalk.green('成功:')} ${created}`);
  console.log(`  ${chalk.gray('跳过:')} ${skipped}`);
  if (errors > 0) console.log(`  ${chalk.red('失败:')} ${errors}`);
};

module.exports = async (options) => {
  if (options.sample) {
    const results = importSamples();
    console.log(chalk.cyan('内置样例数据导入完成'));
    console.log('');
    printResults(results);
    console.log('');
    console.log(chalk.bold('样例包含:'));
    console.log('  ' + chalk.cyan('ALERT-NORMAL') + ' - 正常波动，应判定为低风险');
    console.log('  ' + chalk.cyan('ALERT-DOOR') + ' - 开门升温，需确认关门后恢复');
    console.log('  ' + chalk.cyan('ALERT-MAINT') + ' - 维护窗口波动，应自动降级');
    console.log('  ' + chalk.cyan('ALERT-REAL') + ' - 真正超温，应判定为高风险');
    console.log('  ' + chalk.cyan('ALERT-GAP') + ' - 断点记录，需人工确认');
  } else if (options.type && options.file) {
    const results = importFromFile(options.type, options.file);
    console.log(chalk.cyan(`从文件导入: ${options.file}`));
    console.log('');
    printResults(results);
  } else {
    console.log(chalk.yellow('请指定导入方式:'));
    console.log('  --sample              导入内置样例数据');
    console.log('  --type <type> --file <path>  从文件导入');
    console.log('');
    console.log('数据类型:');
    console.log('  temperature  温度曲线');
    console.log('  door         开门记录');
    console.log('  maintenance  维护计划');
    console.log('  batch        库存批次');
  }
};
