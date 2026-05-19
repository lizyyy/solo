#!/usr/bin/env node

import { Command } from 'commander';
import { createObjectCsvWriter } from 'csv-writer';
import { format } from 'date-fns';
import { 
  initStorage, 
  addRecord, 
  getRecords, 
  saveRecords, 
  updateInventory, 
  queryRecords,
  getInventory 
} from './storage.js';
import { validateRecord, reviewRecord, RULES } from './rules.js';

const program = new Command();

program
  .name('pharmacy')
  .description('社区药房疫苗和胰岛素库存管理CLI工具')
  .version('1.0.0');

program
  .command('init')
  .description('初始化存储系统')
  .action(async () => {
    const result = await initStorage();
    console.log(`✅ ${result.message}`);
  });

program
  .command('import')
  .description('导入到货记录')
  .requiredOption('-t, --type <type>', '产品类型: vaccine/insulin')
  .requiredOption('-n, --name <name>', '产品名称')
  .requiredOption('-b, --batch <batch>', '批号')
  .requiredOption('-q, --quantity <quantity>', '数量', parseInt)
  .requiredOption('-T, --temperature <temperature>', '到货温度', parseFloat)
  .requiredOption('-H, --handler <handler>', '签收人')
  .option('-p, --photo <photo>', '照片凭证路径')
  .option('-D, --damage <damage>', '破损情况说明')
  .action(async (options) => {
    const record = {
      productType: options.type,
      productName: options.name,
      batchNumber: options.batch,
      quantity: options.quantity,
      temperature: options.temperature,
      handler: options.handler,
      photoProof: options.photo || null,
      damage: options.damage || null
    };
    
    const validation = await validateRecord(record);
    
    if (!validation.passed) {
      console.log(`⚠️  预警拦截: ${validation.reasons}`);
      console.log('记录已保存，等待人工复核');
    } else {
      console.log(`✅ 预检通过: ${validation.reasons}`);
    }
    
    const savedRecord = await addRecord({
      ...record,
      reviewReason: validation.reasons
    });
    
    console.log(`📦 记录ID: ${savedRecord.id}`);
    console.log(`👤 签收人: ${savedRecord.handler}`);
    console.log(`📊 当前状态: ${savedRecord.status}`);
  });

program
  .command('review')
  .description('复核待处理记录')
  .option('-i, --id <id>', '指定记录ID复核')
  .option('-a, --approve', '通过复核')
  .option('-r, --reject', '驳回记录')
  .option('-l, --list', '列出所有待复核记录')
  .action(async (options) => {
    if (options.list) {
      const records = await getRecords();
      const pending = records.filter(r => r.status === 'pending');
      
      if (pending.length === 0) {
        console.log('✅ 暂无待复核记录');
        return;
      }
      
      console.log(`📋 待复核记录 (${pending.length}条):`);
      pending.forEach(r => {
        console.log(`\n  ID: ${r.id}`);
        console.log(`  产品: ${r.productName} (${r.productType})`);
        console.log(`  批号: ${r.batchNumber}`);
        console.log(`  数量: ${r.quantity}`);
        console.log(`  温度: ${r.temperature}℃`);
        console.log(`  签收人: ${r.handler}`);
        console.log(`  原因: ${r.reviewReason}`);
      });
      return;
    }
    
    if (!options.id) {
      console.log('❌ 请指定记录ID，使用 -i <id>');
      return;
    }
    
    if (!options.approve && !options.reject) {
      console.log('❌ 请指定操作: -a (通过) 或 -r (驳回)');
      return;
    }
    
    const records = await getRecords();
    const recordIndex = records.findIndex(r => r.id === options.id);
    
    if (recordIndex === -1) {
      console.log('❌ 未找到该记录');
      return;
    }
    
    const record = records[recordIndex];
    const approve = options.approve;
    
    const result = await reviewRecord(record, approve);
    
    records[recordIndex].status = result.status;
    records[recordIndex].reviewReason = result.reason;
    records[recordIndex].reviewedAt = new Date().toISOString();
    
    await saveRecords(records);
    
    if (approve && result.success) {
      await updateInventory(record.batchNumber, record.quantity, record.productName);
      console.log(`✅ 记录${record.id}已通过复核`);
      console.log(`📦 库存已更新`);
    } else if (!approve) {
      console.log(`❌ 记录${record.id}已驳回`);
    } else {
      console.log(`❌ ${result.reason}`);
    }
    
    console.log(`📝 原因: ${result.reason}`);
  });

program
  .command('query')
  .description('查询历史记录')
  .option('-H, --handler <handler>', '按负责人筛选')
  .option('-s, --status <status>', '按状态筛选: pending/approved/rejected')
  .option('-e, --exception <type>', '按异常类型筛选')
  .option('--start <date>', '开始日期')
  .option('--end <date>', '结束日期')
  .option('-S, --summary', '仅显示摘要')
  .action(async (options) => {
    const filters = {
      handler: options.handler,
      status: options.status,
      exceptionType: options.exception,
      startDate: options.start,
      endDate: options.end
    };
    
    const records = await queryRecords(filters);
    
    if (options.summary) {
      const total = records.length;
      const approved = records.filter(r => r.status === 'approved').length;
      const rejected = records.filter(r => r.status === 'rejected').length;
      const pending = records.filter(r => r.status === 'pending').length;
      
      console.log(`📊 查询摘要:`);
      console.log(`  总数: ${total}`);
      console.log(`  通过: ${approved}`);
      console.log(`  驳回: ${rejected}`);
      console.log(`  待审: ${pending}`);
      return;
    }
    
    if (records.length === 0) {
      console.log('📭 未找到匹配记录');
      return;
    }
    
    console.log(`🔍 查询结果 (${records.length}条):`);
    records.forEach(r => {
      const date = format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm');
      console.log(`\n  [${date}] ID: ${r.id}`);
      console.log(`  产品: ${r.productName}`);
      console.log(`  批号: ${r.batchNumber}`);
      console.log(`  状态: ${r.status}`);
      console.log(`  签收人: ${r.handler}`);
      console.log(`  原因: ${r.reviewReason}`);
    });
  });

program
  .command('export')
  .description('导出查询结果为CSV')
  .requiredOption('-o, --output <path>', '输出文件路径')
  .option('-H, --handler <handler>', '按负责人筛选')
  .option('-s, --status <status>', '按状态筛选')
  .option('-e, --exception <type>', '按异常类型筛选')
  .option('--start <date>', '开始日期')
  .option('--end <date>', '结束日期')
  .action(async (options) => {
    const filters = {
      handler: options.handler,
      status: options.status,
      exceptionType: options.exception,
      startDate: options.start,
      endDate: options.end
    };
    
    const records = await queryRecords(filters);
    
    const csvWriter = createObjectCsvWriter({
      path: options.output,
      header: [
        { id: 'id', title: '记录ID' },
        { id: 'createdAt', title: '创建时间' },
        { id: 'productName', title: '产品名称' },
        { id: 'productType', title: '产品类型' },
        { id: 'batchNumber', title: '批号' },
        { id: 'quantity', title: '数量' },
        { id: 'temperature', title: '温度(℃)' },
        { id: 'handler', title: '签收人' },
        { id: 'damage', title: '破损情况' },
        { id: 'status', title: '状态' },
        { id: 'reviewReason', title: '复核原因' },
        { id: 'reviewedAt', title: '复核时间' }
      ]
    });
    
    const formattedRecords = records.map(r => ({
      ...r,
      createdAt: format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm:ss'),
      reviewedAt: r.reviewedAt ? format(new Date(r.reviewedAt), 'yyyy-MM-dd HH:mm:ss') : ''
    }));
    
    await csvWriter.writeRecords(formattedRecords);
    console.log(`✅ 已导出 ${records.length} 条记录到 ${options.output}`);
  });

program
  .command('inventory')
  .description('查看当前库存')
  .action(async () => {
    const inventory = await getInventory();
    const items = Object.values(inventory);
    
    if (items.length === 0) {
      console.log('📦 当前库存为空');
      return;
    }
    
    console.log(`📦 当前库存 (${items.length}种):`);
    items.forEach(item => {
      const date = format(new Date(item.lastUpdated), 'yyyy-MM-dd HH:mm');
      console.log(`\n  批号: ${item.batchNumber}`);
      console.log(`  产品: ${item.productName}`);
      console.log(`  数量: ${item.quantity}`);
      console.log(`  更新: ${date}`);
    });
  });

program.parseAsync();
