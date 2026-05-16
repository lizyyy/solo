#!/usr/bin/env node

import { Command } from 'commander';
import {
  queryOfflineMemberRenewals,
  queryWhitelistRecords,
  queryLabSamples,
  queryAbnormalSamples,
  initDatabase,
  closeDatabase
} from './database';
import { generateDemoData, getDemoDataInfo } from './demo-data';
import { exportAbnormalSamples, exportRenewalReport, ExportFormat } from './export';
import { signArtifact, verifySignature, generateKeyPair, calculateFileChecksum } from './signature';

const program = new Command();

program
  .name('audit-sign')
  .description('构建产物签名与审计流水管理工具')
  .version('1.0.0');

program
  .command('init-demo')
  .description('生成演示数据')
  .option('--batch-id <batchId>', '指定批次号')
  .action(async (options) => {
    try {
      console.log('正在生成演示数据...');
      const result = await generateDemoData(options.batchId);
      console.log('✅ 演示数据生成成功！');
      console.log(`   批次号: ${result.batchId}`);
      console.log(`   会员续费记录: ${result.renewalsCount} 条`);
      console.log(`   白名单记录: ${result.whitelistCount} 条`);
      console.log(`   实验室样本: ${result.labSamplesCount} 条`);
      console.log(`   异常样本: ${result.abnormalCount} 条`);
      console.log('\n' + getDemoDataInfo());
    } catch (error) {
      console.error('❌ 生成演示数据失败:', error);
      process.exit(1);
    }
  });

program
  .command('query-renewals')
  .description('查询会员续费记录')
  .option('--batch-id <batchId>', '按批次号过滤')
  .option('--operator-id <operatorId>', '按操作员ID过滤')
  .option('--risk-type <riskType>', '按风险类型过滤')
  .option('--format <format>', '输出格式 (table|json)', 'table')
  .option('--limit <number>', '限制返回数量', '50')
  .action(async (options) => {
    try {
      const filter: any = {};
      if (options.batchId) filter.batchId = options.batchId;
      if (options.operatorId) filter.operatorId = options.operatorId;
      if (options.riskType) filter.riskType = options.riskType;
      
      const records = await queryOfflineMemberRenewals(filter);
      const limitedRecords = records.slice(0, parseInt(options.limit));
      
      if (options.format === 'json') {
        console.log(JSON.stringify(limitedRecords, null, 2));
      } else {
        console.log('\n📋 会员续费记录');
        console.log('='.repeat(100));
        console.log(`共 ${records.length} 条记录${options.limit ? `，显示前 ${options.limit} 条` : ''}`);
        console.log('');
        
        console.table(limitedRecords.map((r: any) => ({
          '会员ID': r.memberId,
          '姓名': r.memberName,
          '套餐': r.renewedPlan,
          '金额': r.renewalAmount,
          '支付方式': r.paymentMethod,
          '操作员': r.operatorName,
          '门店': r.storeName,
          '风险类型': r.riskType,
          '风险等级': r.riskLevel,
          '白名单': r.isWhitelisted ? '是' : '否'
        })));
      }
    } catch (error) {
      console.error('❌ 查询失败:', error);
      process.exit(1);
    }
  });

program
  .command('query-whitelist')
  .description('查询白名单记录')
  .option('--batch-id <batchId>', '按批次号过滤')
  .option('--status <status>', '按状态过滤 (active|revoked)')
  .option('--format <format>', '输出格式 (table|json)', 'table')
  .action(async (options) => {
    try {
      const filter: any = {};
      if (options.batchId) filter.batchId = options.batchId;
      if (options.status) filter.status = options.status;
      
      const records = await queryWhitelistRecords(filter);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(records, null, 2));
      } else {
        console.log('\n📋 白名单记录');
        console.log('='.repeat(100));
        console.log(`共 ${records.length} 条记录`);
        console.log('');
        
        console.table(records.map((r: any) => ({
          '会员ID': r.memberId,
          '姓名': r.memberName,
          '原因': r.reason.substring(0, 15),
          '创建人': r.operatorName,
          '创建日期': new Date(r.createdAt).toLocaleDateString(),
          '有效期至': new Date(r.expiryDate).toLocaleDateString(),
          '状态': r.isRevoked ? '已撤销' : '有效'
        })));
        
        const activeRecords = records.filter(r => !r.isRevoked);
        if (activeRecords.length > 0) {
          console.log('\n⚠️  注意：以下白名单记录尚未撤销，请及时复核：');
          activeRecords.forEach(r => {
            console.log(`   - ${r.memberId} (${r.memberName}): ${r.reason}`);
          });
        }
      }
    } catch (error) {
      console.error('❌ 查询失败:', error);
      process.exit(1);
    }
  });

program
  .command('query-lab')
  .description('查询实验室样本记录')
  .option('--batch-id <batchId>', '按批次号过滤')
  .option('--status <status>', '按状态过滤')
  .option('--format <format>', '输出格式 (table|json)', 'table')
  .action(async (options) => {
    try {
      const filter: any = {};
      if (options.batchId) filter.batchId = options.batchId;
      if (options.status) filter.status = options.status;
      
      const records = await queryLabSamples(filter);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(records, null, 2));
      } else {
        console.log('\n📋 实验室样本记录');
        console.log('='.repeat(100));
        console.log(`共 ${records.length} 条记录`);
        console.log('');
        
        console.table(records.map((r: any) => ({
          '样本编号': r.sampleCode,
          '样本类型': r.sampleType,
          '采集日期': r.collectionDate,
          '采集地点': r.collectionSite,
          '采集人': r.collector,
          '检测人': r.tester,
          '检测结果': r.testResult,
          '状态': r.status,
          '人工备注': r.manualNotes.substring(0, 20)
        })));
      }
    } catch (error) {
      console.error('❌ 查询失败:', error);
      process.exit(1);
    }
  });

program
  .command('query-abnormal')
  .description('查询异常样本记录')
  .option('--batch-id <batchId>', '按批次号过滤')
  .option('--risk-type <riskType>', '按风险类型过滤')
  .option('--status <status>', '按状态过滤 (pending|reviewed|resolved)')
  .option('--format <format>', '输出格式 (table|json)', 'table')
  .action(async (options) => {
    try {
      const filter: any = {};
      if (options.batchId) filter.batchId = options.batchId;
      if (options.riskType) filter.riskType = options.riskType;
      if (options.status) filter.status = options.status;
      
      const records = await queryAbnormalSamples(filter);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(records, null, 2));
      } else {
        console.log('\n📋 异常样本记录');
        console.log('='.repeat(100));
        console.log(`共 ${records.length} 条记录`);
        console.log('');
        
        console.table(records.map((r: any) => ({
          '来源类型': r.sourceType,
          '来源ID': r.sourceId,
          '批次号': r.batchId.substring(0, 15),
          '风险类型': r.riskType,
          '风险等级': r.riskLevel,
          '发现时间': new Date(r.detectedAt).toLocaleDateString(),
          '状态': r.status === 'pending' ? '待处理' : r.status === 'reviewed' ? '已审核' : '已解决',
          '负责人': r.assignee || '未分配',
          '导出状态': r.exportStatus === 'exported' ? '已导出' : '未导出'
        })));
      }
    } catch (error) {
      console.error('❌ 查询失败:', error);
      process.exit(1);
    }
  });

program
  .command('export-abnormal')
  .description('导出异常样本')
  .requiredOption('--format <format>', '导出格式 (csv|xlsx|json)')
  .option('--batch-id <batchId>', '按批次号过滤')
  .option('--risk-type <riskType>', '按风险类型过滤')
  .option('--output <path>', '输出路径')
  .option('--mark-exported', '标记为已导出')
  .option('--include-raw', '包含原始输入数据')
  .action(async (options) => {
    try {
      console.log('正在导出异常样本...');
      
      const filter: any = {};
      if (options.batchId) filter.batchId = options.batchId;
      if (options.riskType) filter.riskType = options.riskType;
      
      const result = await exportAbnormalSamples({
        format: options.format as ExportFormat,
        outputPath: options.output,
        filter,
        markExported: options.markExported,
        includeRawData: options.includeRaw
      });
      
      console.log(`✅ 成功导出 ${result.count} 条异常样本`);
      console.log(`   文件路径: ${result.filePath}`);
      
      if (options.markExported) {
        console.log('   已标记为已导出状态');
      }
    } catch (error) {
      console.error('❌ 导出失败:', error);
      process.exit(1);
    }
  });

program
  .command('export-report')
  .description('导出会员续费报告')
  .argument('<batchId>', '批次号')
  .option('--output <path>', '输出路径')
  .action(async (batchId, options) => {
    try {
      console.log(`正在导出批次 ${batchId} 的续费报告...`);
      
      const filePath = await exportRenewalReport(batchId, options.output);
      
      console.log('✅ 报告导出成功！');
      console.log(`   文件路径: ${filePath}`);
    } catch (error) {
      console.error('❌ 导出失败:', error);
      process.exit(1);
    }
  });

program
  .command('sign')
  .description('对构建产物进行签名')
  .argument('<path>', '产物路径（文件或目录）')
  .requiredOption('--signer <name>', '签名人姓名')
  .requiredOption('--version <version>', '版本号')
  .requiredOption('--build-number <number>', '构建号')
  .requiredOption('--branch <branch>', '分支名')
  .requiredOption('--commit <hash>', '提交哈希')
  .option('--private-key <path>', '私钥路径')
  .option('--build-agent <name>', '构建代理名', 'default-agent')
  .action(async (artifactPath, options) => {
    try {
      console.log('正在计算校验和并签名...');
      
      const result = await signArtifact(artifactPath, {
        privateKey: options.privateKey,
        signer: options.signer,
        version: options.version,
        buildNumber: options.buildNumber,
        branch: options.branch,
        commitHash: options.commit,
        buildAgent: options.buildAgent
      });
      
      console.log('✅ 签名成功！');
      console.log(`   产物名称: ${result.artifactName}`);
      console.log(`   校验和: ${result.checksum}`);
      console.log(`   签名: ${result.signature.substring(0, 50)}...`);
      console.log(`   签名人: ${result.signer}`);
      console.log(`   签名时间: ${result.signedAt}`);
    } catch (error) {
      console.error('❌ 签名失败:', error);
      process.exit(1);
    }
  });

program
  .command('verify-sign')
  .description('验证签名（仅演示功能）')
  .argument('<checksum>', '校验和')
  .argument('<signature>', '签名')
  .argument('<artifactName>', '产物名称')
  .argument('<version>', '版本号')
  .argument('<buildNumber>', '构建号')
  .argument('<buildDate>', '构建日期')
  .option('--public-key <path>', '公钥路径')
  .action((checksum, signature, artifactName, version, buildNumber, buildDate, options) => {
    try {
      console.log('正在验证签名...');
      
      const isValid = verifySignature(
        checksum, signature, artifactName, version, buildNumber, buildDate, options.publicKey
      );
      
      if (isValid) {
        console.log('✅ 签名验证通过！');
      } else {
        console.log('❌ 签名验证失败！');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ 验证失败:', error);
      process.exit(1);
    }
  });

program
  .command('checksum')
  .description('计算文件校验和')
  .argument('<file>', '文件路径')
  .option('--algorithm <algo>', '算法 (sha256|md5)', 'sha256')
  .action((file, options) => {
    try {
      const checksum = calculateFileChecksum(file, options.algorithm);
      console.log(`${options.algorithm.toUpperCase()}: ${checksum}`);
    } catch (error) {
      console.error('❌ 计算校验和失败:', error);
      process.exit(1);
    }
  });

program
  .command('generate-keys')
  .description('生成RSA密钥对')
  .option('--output <path>', '输出目录', './keys')
  .action((options) => {
    try {
      console.log('正在生成密钥对...');
      generateKeyPair(options.output);
      console.log(`✅ 密钥对已生成到 ${options.output} 目录`);
      console.log('   - private.pem: 私钥（请妥善保管）');
      console.log('   - public.pem:  公钥（可公开）');
    } catch (error) {
      console.error('❌ 生成密钥失败:', error);
      process.exit(1);
    }
  });

program
  .command('trace-raw')
  .description('追溯原始输入数据')
  .argument('<memberId>', '会员ID')
  .action(async (memberId) => {
    try {
      const records = await queryOfflineMemberRenewals({});
      const record = records.find(r => r.memberId === memberId);
      
      if (!record) {
        console.log(`❌ 未找到会员 ${memberId} 的记录`);
        process.exit(1);
      }
      
      console.log(`\n📋 会员 ${memberId} 的原始输入数据`);
      console.log('='.repeat(80));
      console.log(JSON.stringify(record.rawInput, null, 2));
      console.log('');
    } catch (error) {
      console.error('❌ 查询失败:', error);
      process.exit(1);
    }
  });

program
  .command('demo')
  .description('运行完整演示流程')
  .action(async () => {
    try {
      console.log('🚀 启动完整演示流程...\n');
      
      console.log('1️⃣  生成演示数据');
      console.log('-'.repeat(60));
      const result = await generateDemoData();
      console.log(`✅ 演示数据生成成功，批次号: ${result.batchId}\n`);
      
      console.log('2️⃣  查询会员续费记录');
      console.log('-'.repeat(60));
      const renewals = await queryOfflineMemberRenewals({ batchId: result.batchId });
      console.log(`✅ 找到 ${renewals.length} 条会员续费记录`);
      if (renewals.length > 0) {
        console.log(`   示例: ${renewals[0].memberName} - ${renewals[0].renewedPlan} - ¥${renewals[0].renewalAmount}`);
      }
      console.log('');
      
      console.log('3️⃣  查询白名单记录（重点关注未撤销记录）');
      console.log('-'.repeat(60));
      const whitelists = await queryWhitelistRecords({ batchId: result.batchId });
      const activeWhitelists = whitelists.filter(w => !w.isRevoked);
      console.log(`✅ 找到 ${whitelists.length} 条白名单记录，其中 ${activeWhitelists.length} 条有效`);
      activeWhitelists.forEach(w => {
        console.log(`   ⚠️  待复核: ${w.memberId} (${w.memberName}) - ${w.reason}`);
      });
      console.log('');
      
      console.log('4️⃣  查询实验室样本（查看人工备注）');
      console.log('-'.repeat(60));
      const labSamples = await queryLabSamples({ batchId: result.batchId });
      console.log(`✅ 找到 ${labSamples.length} 条实验室样本记录`);
      if (labSamples.length > 0) {
        console.log(`   示例: ${labSamples[0].sampleCode} - ${labSamples[0].sampleType}`);
        console.log(`   人工备注: ${labSamples[0].manualNotes}`);
      }
      console.log('');
      
      console.log('5️⃣  查询异常样本');
      console.log('-'.repeat(60));
      const abnormal = await queryAbnormalSamples({ batchId: result.batchId });
      console.log(`✅ 找到 ${abnormal.length} 条异常样本记录\n`);
      
      console.log('6️⃣  导出异常样本（给同事复核）');
      console.log('-'.repeat(60));
      if (abnormal.length > 0) {
        const exportResult = await exportAbnormalSamples({
          format: 'xlsx',
          filter: { batchId: result.batchId }
        });
        console.log(`✅ 已导出 ${exportResult.count} 条异常样本`);
        console.log(`   文件: ${exportResult.filePath}`);
      }
      console.log('');
      
      console.log('7️⃣  导出会员续费报告');
      console.log('-'.repeat(60));
      const reportPath = await exportRenewalReport(result.batchId);
      console.log(`✅ 已导出续费报告`);
      console.log(`   文件: ${reportPath}\n`);
      
      console.log('8️⃣  追溯原始输入示例');
      console.log('-'.repeat(60));
      if (renewals.length > 0) {
        console.log(`会员 ${renewals[0].memberId} 的原始导入数据已保存，可使用 audit-sign trace-raw ${renewals[0].memberId} 查看`);
      }
      console.log('');
      
      console.log('🎉 演示流程完成！');
      console.log('='.repeat(60));
      console.log('\n📝 下一步操作:');
      console.log(`   - 查看白名单待复核记录: audit-sign query-whitelist --batch-id ${result.batchId}`);
      console.log(`   - 查看异常样本: audit-sign query-abnormal --batch-id ${result.batchId}`);
      console.log(`   - 导出续费报告: audit-sign export-report ${result.batchId}`);
      console.log('   - 对构建产物签名: audit-sign sign --help');
      
    } catch (error) {
      console.error('❌ 演示失败:', error);
      process.exit(1);
    }
  });

process.on('beforeExit', async () => {
  await closeDatabase();
});

program.parseAsync(process.argv);
