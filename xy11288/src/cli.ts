#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { materialService } from './services/MaterialService';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const admin = { id: 'cli-admin', name: 'CLI管理员', role: 'admin' as const };
const manager = { id: 'cli-manager', name: 'CLI经理', role: 'manager' as const };
const operator = { id: 'cli-operator', name: 'CLI操作员', role: 'operator' as const };

yargs(hideBin(process.argv))
  .command('import <file>', '导入物资CSV文件', (y) => {
    return y.positional('file', { type: 'string', describe: 'CSV文件路径' });
  }, async (argv) => {
    const csvContent = fs.readFileSync(argv.file as string, 'utf-8');
    const result = await materialService.importMaterials(csvContent, admin, uuidv4());
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  
  .command('occupy <materialCode> <boothId> <quantity>', '借用物资', (y) => {
    return y
      .positional('materialCode', { type: 'string', describe: '物资编码' })
      .positional('boothId', { type: 'string', describe: '展位ID' })
      .positional('quantity', { type: 'number', describe: '数量' })
      .option('reason', { alias: 'r', type: 'string', describe: '原因' });
  }, async (argv) => {
    const result = await materialService.occupy(
      argv.materialCode as string,
      argv.boothId as string,
      argv.quantity as number,
      operator,
      uuidv4(),
      argv.reason as string
    );
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  
  .command('transfer <materialCode> <fromBoothId> <toBoothId> <quantity>', '调拨物资', (y) => {
    return y
      .positional('materialCode', { type: 'string', describe: '物资编码' })
      .positional('fromBoothId', { type: 'string', describe: '来源展位ID' })
      .positional('toBoothId', { type: 'string', describe: '目标展位ID' })
      .positional('quantity', { type: 'number', describe: '数量' })
      .option('reason', { alias: 'r', type: 'string', describe: '原因' });
  }, async (argv) => {
    const result = await materialService.transfer(
      argv.materialCode as string,
      argv.fromBoothId as string,
      argv.toBoothId as string,
      argv.quantity as number,
      manager,
      uuidv4(),
      argv.reason as string
    );
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  
  .command('return <recordId> <quantity>', '归还物资', (y) => {
    return y
      .positional('recordId', { type: 'string', describe: '借用记录ID' })
      .positional('quantity', { type: 'number', describe: '数量' })
      .option('reason', { alias: 'r', type: 'string', describe: '原因' });
  }, async (argv) => {
    const result = await materialService.return(
      argv.recordId as string,
      argv.quantity as number,
      operator,
      uuidv4(),
      argv.reason as string
    );
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  
  .command('damage <recordId> <quantity> <damageType> <deductionAmount>', '报损物资', (y) => {
    return y
      .positional('recordId', { type: 'string', describe: '借用记录ID' })
      .positional('quantity', { type: 'number', describe: '数量' })
      .positional('damageType', { type: 'string', choices: ['broken', 'lost', 'worn'], describe: '损坏类型' })
      .positional('deductionAmount', { type: 'number', describe: '扣款金额' })
      .option('description', { alias: 'd', type: 'string', describe: '描述' });
  }, async (argv) => {
    const result = await materialService.reportDamage(
      argv.recordId as string,
      argv.quantity as number,
      argv.damageType as 'broken' | 'lost' | 'worn',
      argv.description as string || '',
      argv.deductionAmount as number,
      manager,
      uuidv4()
    );
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  
  .command('rollback <recordId>', '回滚操作', (y) => {
    return y
      .positional('recordId', { type: 'string', describe: '记录ID' })
      .option('reason', { alias: 'r', type: 'string', describe: '原因' });
  }, async (argv) => {
    const result = await materialService.rollback(
      argv.recordId as string,
      admin,
      uuidv4(),
      argv.reason as string
    );
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  
  .command('create-booth <code> <name> <exhibitor>', '创建展位', (y) => {
    return y
      .positional('code', { type: 'string', describe: '展位编码' })
      .positional('name', { type: 'string', describe: '展位名称' })
      .positional('exhibitor', { type: 'string', describe: '展商名称' })
      .option('contact', { alias: 'c', type: 'string', describe: '联系方式' });
  }, async (argv) => {
    const result = await materialService.createBooth(
      argv.code as string,
      argv.name as string,
      argv.exhibitor as string,
      argv.contact as string
    );
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  
  .command('list-materials', '列出所有物资', {}, async () => {
    const materials = await materialService.getMaterials();
    console.log(JSON.stringify(materials, null, 2));
    process.exit(0);
  })
  
  .command('list-booths', '列出所有展位', {}, async () => {
    const booths = await materialService.getBooths();
    console.log(JSON.stringify(booths, null, 2));
    process.exit(0);
  })
  
  .command('list-records', '列出借用记录', (y) => {
    return y
      .option('boothId', { type: 'string', describe: '展位ID过滤' })
      .option('materialCode', { type: 'string', describe: '物资编码过滤' })
      .option('status', { type: 'string', describe: '状态过滤' });
  }, async (argv) => {
    const records = await materialService.getBorrowRecords({
      boothId: argv.boothId as string,
      materialCode: argv.materialCode as string,
      status: argv.status as string
    });
    console.log(JSON.stringify(records, null, 2));
    process.exit(0);
  })
  
  .command('export <format>', '导出报表', (y) => {
    return y
      .positional('format', { type: 'string', choices: ['csv', 'json'], describe: '导出格式' })
      .option('output', { alias: 'o', type: 'string', describe: '输出文件路径' });
  }, async (argv) => {
    const content = await materialService.exportReport(argv.format as 'csv' | 'json');
    if (argv.output) {
      fs.writeFileSync(argv.output as string, content);
      console.log(`已导出到: ${argv.output}`);
    } else {
      console.log(content);
    }
    process.exit(0);
  })
  
  .demandCommand(1, '请指定命令')
  .help()
  .argv;
