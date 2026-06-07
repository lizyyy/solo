#!/usr/bin/env node

const {
  importDesensitizationRule,
  addGrayBatch,
  getDesensitizationRules,
  getGrayBatches,
  getInspectionRecords,
  getExportResults,
  getPhoneMaskIssues,
  getAuditLogs,
  updatePhoneMaskIssue,
  clearAllData
} = require('./models');
const { runInspection, rerunInspection } = require('./inspectionEngine');

const args = process.argv.slice(2);
const operator = process.env.RAG_OPERATOR || '算法运营老唐';

function printHelp() {
  console.log(`
📋 RAG 引用缺失巡检 - 命令行工具

用法:
  node src/cli.js <command> [options]

命令:
  run                    执行一次巡检
  rerun <inspectionId>   重跑指定巡检
  rules                  查看脱敏规则列表
  batches                查看灰度批次列表
  phone-issues           查看手机号漏遮问题
  reports                查看导出报告
  audit                  查看审计日志
  dashboard              查看数据概览
  demo                   生成演示数据
  clear                  清空所有数据

  import-rule <name> <remark> <content>
                         导入脱敏规则
  add-batch <batchNo> <ruleId> <sceneStatement> <content>
                         补录灰度批次
  review-phone <issueId> [note]
                         算法同事复核手机号问题

环境变量:
  RAG_OPERATOR           设置当前操作人 (默认: 算法运营老唐)

示例:
  RAG_OPERATOR="系统管理员" node src/cli.js run
  node src/cli.js import-rule "测试规则" "主流程说明" "规则内容"
  node src/cli.js review-phone phone_xxx "确认漏遮，已修复"
`);
}

async function main() {
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  switch (command) {
    case 'run': {
      console.log(`🔍 执行巡检 (操作人: ${operator})...`);
      const result = runInspection(operator);
      console.log('');
      console.log(result.friendlyReport);
      break;
    }

    case 'rerun': {
      const inspectionId = args[1];
      if (!inspectionId) {
        console.error('❌ 请指定巡检 ID');
        process.exit(1);
      }
      console.log(`🔄 重跑巡检 ${inspectionId} (操作人: ${operator})...`);
      const result = rerunInspection(operator, inspectionId);
      console.log('');
      console.log(result.friendlyReport);
      break;
    }

    case 'rules': {
      const rules = getDesensitizationRules();
      console.log(`📜 脱敏规则列表 (共 ${rules.length} 条)`);
      console.log('');
      if (rules.length === 0) {
        console.log('  暂无数据');
        return;
      }
      rules.forEach((r, idx) => {
        console.log(`  ${idx + 1}. ${r.name}`);
        console.log(`     ID: ${r.id}`);
        console.log(`     备注: ${r.remark || '(未填写)'}`);
        console.log(`     导入人: ${r.importedBy} · ${new Date(r.importedAt).toLocaleString('zh-CN')}`);
        console.log('');
      });
      break;
    }

    case 'batches': {
      const batches = getGrayBatches();
      const rules = getDesensitizationRules();
      const ruleMap = {};
      rules.forEach(r => ruleMap[r.id] = r.name);
      console.log(`📦 灰度批次列表 (共 ${batches.length} 条)`);
      console.log('');
      if (batches.length === 0) {
        console.log('  暂无数据');
        return;
      }
      batches.forEach((b, idx) => {
        console.log(`  ${idx + 1}. ${b.batchNo}`);
        console.log(`     ID: ${b.id}`);
        console.log(`     关联规则: ${ruleMap[b.relatedRuleId] || '(未关联)'}`);
        console.log(`     现场说法: ${b.sceneStatement || '(未填写)'}`);
        console.log(`     录入人: ${b.addedBy} · ${new Date(b.addedAt).toLocaleString('zh-CN')}`);
        console.log('');
      });
      break;
    }

    case 'phone-issues': {
      const issues = getPhoneMaskIssues();
      console.log(`📱 手机号漏遮问题 (共 ${issues.length} 个)`);
      console.log('');
      if (issues.length === 0) {
        console.log('  暂无数据');
        return;
      }
      issues.forEach((issue, idx) => {
        const statusText = issue.status === 'pending_review' ? '⏳ 待算法同事复核' : '✅ 已确认';
        console.log(`  ${idx + 1}. 📱 ${issue.phoneNumber} - ${statusText}`);
        console.log(`     ID: ${issue.id}`);
        console.log(`     来源: ${issue.sourceName}`);
        console.log(`     发现时间: ${new Date(issue.detectedAt).toLocaleString('zh-CN')}`);
        console.log(`     说明: ${issue.note}`);
        if (issue.reviewedBy) {
          console.log(`     复核人: ${issue.reviewedBy}`);
          console.log(`     复核说明: ${issue.reviewNote || '无'}`);
        }
        console.log('');
      });
      break;
    }

    case 'reports': {
      const reports = getExportResults();
      console.log(`📄 导出报告 (共 ${reports.length} 份)`);
      console.log('');
      if (reports.length === 0) {
        console.log('  暂无数据');
        return;
      }
      reports.forEach((r, idx) => {
        console.log(`  ${idx + 1}. 导出报告 - ${new Date(r.createdAt).toLocaleString('zh-CN')}`);
        console.log(`     ID: ${r.id}`);
        console.log(`     巡检ID: ${r.inspectionId}`);
        console.log('');
      });
      if (reports.length > 0) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📄 最新报告内容:');
        console.log('');
        console.log(reports[reports.length - 1].content);
      }
      break;
    }

    case 'audit': {
      const logs = getAuditLogs();
      const actionMap = {
        'import_rule': '📥 导入脱敏规则',
        'add_gray_batch': '➕ 补录灰度批次',
        'run_inspection': '🔍 执行巡检',
        'update_phone_issue': '✏️  更新手机号问题',
        'rerun_inspection': '🔄 重跑巡检',
        'update_export': '📄 更新导出报告'
      };
      console.log(`📝 审计日志 (共 ${logs.length} 条，倒序显示)`);
      console.log('');
      if (logs.length === 0) {
        console.log('  暂无数据');
        return;
      }
      logs.slice().reverse().slice(0, 20).forEach((log, idx) => {
        console.log(`  ${idx + 1}. ${actionMap[log.action] || log.action}`);
        console.log(`     操作人: ${log.operator}`);
        console.log(`     时间: ${new Date(log.timestamp).toLocaleString('zh-CN')}`);
        console.log(`     详情: ${JSON.stringify(log.details)}`);
        console.log('');
      });
      break;
    }

    case 'dashboard': {
      const rules = getDesensitizationRules();
      const batches = getGrayBatches();
      const inspections = getInspectionRecords();
      const phoneIssues = getPhoneMaskIssues();
      const exports = getExportResults();
      const auditLogs = getAuditLogs();
      const pending = phoneIssues.filter(p => p.status === 'pending_review');

      console.log('📊 RAG 引用缺失巡检 - 数据概览');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log(`  📋 脱敏规则:       ${rules.length} 条`);
      console.log(`  📦 灰度批次:       ${batches.length} 条`);
      console.log(`  🔍 巡检次数:       ${inspections.length} 次`);
      console.log(`  📱 手机号问题:     ${phoneIssues.length} 个 (待复核: ${pending.length})`);
      console.log(`  📄 导出报告:       ${exports.length} 份`);
      console.log(`  📝 审计日志:       ${auditLogs.length} 条`);
      console.log('');

      if (inspections.length > 0) {
        const latest = inspections[inspections.length - 1];
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  🔍 最新巡检: ${latest.id}`);
        console.log(`     操作人: ${latest.operator} · ${new Date(latest.createdAt).toLocaleString('zh-CN')}`);
        console.log(`     发现问题: ${latest.gaps.length} 个引用缺失, ${latest.phoneIssues.length} 个手机号漏遮`);
        console.log('');
      }
      break;
    }

    case 'import-rule': {
      const [, name, remark, content] = args;
      if (!name) {
        console.error('❌ 请指定规则名称');
        process.exit(1);
      }
      console.log(`📥 导入脱敏规则: ${name} (操作人: ${operator})`);
      const rule = importDesensitizationRule({
        name,
        remark: remark || '',
        mainProcess: remark || '',
        content: content || ''
      }, operator);
      console.log(`✅ 导入成功! ID: ${rule.id}`);
      break;
    }

    case 'add-batch': {
      const [, batchNo, ruleId, sceneStatement, content] = args;
      if (!batchNo || !ruleId) {
        console.error('❌ 请指定批次号和关联规则ID');
        process.exit(1);
      }
      console.log(`➕ 补录灰度批次: ${batchNo} (操作人: ${operator})`);
      const batch = addGrayBatch({
        batchNo,
        relatedRuleId: ruleId,
        sceneStatement: sceneStatement || '',
        content: content || ''
      }, operator);
      console.log(`✅ 补录成功! ID: ${batch.id}`);
      break;
    }

    case 'review-phone': {
      const [, issueId, note] = args;
      if (!issueId) {
        console.error('❌ 请指定问题ID');
        process.exit(1);
      }
      console.log(`✏️  复核手机号问题: ${issueId} (操作人: ${operator})`);
      const updated = updatePhoneMaskIssue(issueId, {
        status: 'confirmed',
        reviewedBy: operator,
        reviewNote: note || '已复核确认'
      }, operator);
      if (updated) {
        console.log(`✅ 复核成功!`);
      } else {
        console.error('❌ 问题不存在');
      }
      break;
    }

    case 'demo': {
      console.log('📦 生成演示数据...');
      const { execSync } = require('child_process');
      execSync('node src/demo.js', { stdio: 'inherit' });
      break;
    }

    case 'clear': {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl.question('⚠️  确定要清空所有数据吗？(yes/no) ', (answer) => {
        if (answer === 'yes') {
          clearAllData();
          console.log('✅ 数据已清空');
        } else {
          console.log('已取消');
        }
        rl.close();
      });
      break;
    }

    default:
      console.error(`❌ 未知命令: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch(console.error);
