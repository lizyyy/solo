const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const { initDatabase } = require('./config/database');
const planService = require('./services/planService');
const settlementService = require('./services/settlementService');
const reportService = require('./services/reportService');
const taskService = require('./services/taskService');
const {
  formatCurrency,
  getMealTypeLabel,
  getSettlementStatusLabel,
  getWorkflowStepLabel,
  getDifferenceReasonLabel,
  getAdjustmentTypeLabel
} = require('./utils/common');

function printSeparator() {
  console.log('='.repeat(70));
}

function printSection(title) {
  console.log('\n' + '='.repeat(70));
  console.log(title);
  console.log('='.repeat(70));
}

function showHelp() {
  printSeparator();
  console.log('团餐结算差异 API 工具链 - 命令行工具');
  printSeparator();
  console.log('\n可用命令:');
  console.log('');
  console.log('【基础数据管理】');
  console.log('  org:list                    - 列出所有组织');
  console.log('  org:create <name>           - 创建组织');
  console.log('  emp:list <orgId>            - 列出组织员工');
  console.log('  plan:list <orgId> <year> <month>  - 列出订餐计划');
  console.log('  verify:list <orgId> <year> <month> - 列出取餐核销记录');
  console.log('  subsidy:list <orgId>        - 列出补贴规则');
  console.log('');
  console.log('【结算周期管理】');
  console.log('  settle:create <orgId> <year> <month>  - 创建结算周期');
  console.log('  settle:list <orgId>         - 列出结算周期');
  console.log('  settle:calc <cycleId>       - 计算结算差异');
  console.log('  settle:detail <cycleId>     - 查看结算详情');
  console.log('  settle:steps <cycleId>      - 查看流程步骤');
  console.log('  settle:status <cycleId>     - 查看当前卡点和历史记录');
  console.log('');
  console.log('【审核流程】');
  console.log('  settle:submit <cycleId> <role> <handlerId> <handlerName>  - 提交审核');
  console.log('  settle:approve <cycleId> <stepCode> <role> <handlerId> <handlerName>  - 审核通过');
  console.log('  settle:reject <cycleId> <stepCode> <reason> <role> <handlerId> <handlerName>  - 审核驳回');
  console.log('  settle:resubmit <cycleId> <role> <handlerId> <handlerName>  - 重新提交');
  console.log('');
  console.log('【差异调整】');
  console.log('  adjust:create <cycleId> <recordId> <type> <amount> <reason> <opId> <opName>  - 创建调整');
  console.log('  adjust:list <cycleId>       - 列出调整记录');
  console.log('  adjust:approve <adjustId>   - 审批调整');
  console.log('');
  console.log('【报表】');
  console.log('  settle:report <cycleId>     - 生成并显示结算报表');
  console.log('');
  console.log('【后台任务】');
  console.log('  task:list [status]          - 列出后台任务');
  console.log('  task:status <taskId>        - 查看任务状态');
  console.log('  task:run <taskId>           - 执行任务');
  console.log('  task:retry <taskId>         - 重试失败任务');
  console.log('  task:run-all                - 执行所有待执行任务');
  printSeparator();
}

function printSettlementSummary(detail) {
  const cycle = detail.cycle;
  const summary = detail.summary;
  
  console.log(`\n【结算周期】 ${cycle.cycle_year}年${cycle.cycle_month}月`);
  console.log(`状态: ${getSettlementStatusLabel(cycle.status)}`);
  console.log('');
  console.log('【汇总数据】');
  console.log(`  订餐份数: ${summary.plannedCount} 份`);
  console.log(`  取餐份数: ${summary.verifiedCount} 份`);
  console.log(`  差异份数: ${summary.differenceCount} 份`);
  console.log('');
  console.log(`  订餐金额: ${formatCurrency(summary.plannedAmount)}`);
  console.log(`  补贴金额: ${formatCurrency(summary.subsidyAmount)}`);
  console.log(`  实际金额: ${formatCurrency(summary.actualAmount)}`);
  console.log(`  差异金额: ${formatCurrency(summary.differenceAmount)}`);
}

function printCurrentStatus(detail) {
  console.log('\n【当前流程状态】');
  
  if (detail.currentStep) {
    const step = detail.currentStep;
    console.log(`当前卡点: ${getWorkflowStepLabel(step.step_code)}`);
    console.log(`步骤状态: ${step.status === 'rejected' ? '已驳回' : '待处理'}`);
    if (step.rejection_reason) {
      console.log(`驳回原因: ${step.rejection_reason}`);
    }
    if (step.handler_name) {
      console.log(`处理人: ${step.handler_name}`);
    }
  } else {
    console.log('流程已完成');
  }
  
  console.log('\n【最近处理记录】');
  if (detail.previousProcessing && detail.previousProcessing.length > 0) {
    detail.previousProcessing.forEach((h, i) => {
      const actionLabel = {
        complete: '完成',
        submit: '提交',
        approve: '通过',
        reject: '驳回',
        resubmit: '重提'
      }[h.action] || h.action;
      
      console.log(`  ${i + 1}. [${h.processed_at}] ${getWorkflowStepLabel(h.step_code)} - ${actionLabel}`);
      if (h.note) {
        console.log(`     ${h.note}`);
      }
    });
  } else {
    console.log('  暂无处理记录');
  }
}

async function main() {
  await initDatabase();
  
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  const command = args[0];

  try {
    switch (command) {
      case 'org:list': {
        const orgs = planService.listOrganizations();
        printSection('组织列表');
        orgs.forEach(o => console.log(`  ID: ${o.id} | 名称: ${o.name}`));
        if (orgs.length === 0) console.log('  暂无组织');
        break;
      }
      
      case 'org:create': {
        const name = args[1];
        if (!name) {
          console.log('请提供组织名称');
          process.exit(1);
        }
        const org = planService.createOrganization(name);
        console.log(`创建组织成功: ${org.name} (ID: ${org.id})`);
        break;
      }
      
      case 'emp:list': {
        const orgId = args[1];
        const emps = planService.listEmployees(orgId);
        printSection('员工列表');
        emps.forEach(e => console.log(`  ${e.employee_no} | ${e.name} | ${e.department || '-'} | ID: ${e.id}`));
        if (emps.length === 0) console.log('  暂无员工');
        break;
      }
      
      case 'plan:list': {
        const [orgId, year, month] = [args[1], parseInt(args[2]), parseInt(args[3])];
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().slice(0, 10);
        const plans = planService.listMealPlans(orgId, startDate, endDate);
        printSection(`订餐计划 (${year}年${month}月)`);
        plans.forEach(p => {
          const verified = planService.getVerificationCountByPlan(p.id);
          console.log(`  ${p.plan_date} ${getMealTypeLabel(p.meal_type)} | 订餐:${p.planned_count} 取餐:${verified} | 单价:${formatCurrency(p.unit_price)}`);
        });
        if (plans.length === 0) console.log('  暂无订餐计划');
        break;
      }
      
      case 'subsidy:list': {
        const orgId = args[1];
        const rules = planService.listAllSubsidyRules(orgId);
        printSection('补贴规则');
        rules.forEach(r => {
          const typeLabel = {
            fixed_per_meal: '按份固定',
            percentage: '按比例',
            fixed_total: '总额固定'
          }[r.rule_type] || r.rule_type;
          console.log(`  ${r.rule_name} | 类型:${typeLabel} | 有效期:${r.effective_date} ~ ${r.end_date || '永久'}`);
        });
        if (rules.length === 0) console.log('  暂无补贴规则');
        break;
      }
      
      case 'settle:create': {
        const [orgId, year, month] = [args[1], parseInt(args[2]), parseInt(args[3])];
        const cycle = settlementService.createSettlementCycle(orgId, year, month);
        console.log(`创建结算周期: ${year}年${month}月 (ID: ${cycle.id})`);
        console.log('状态: 待计算');
        break;
      }
      
      case 'settle:list': {
        const orgId = args[1];
        const cycles = settlementService.listSettlementCycles(orgId);
        printSection('结算周期列表');
        cycles.forEach(c => {
          console.log(`  ${c.cycle_year}年${c.cycle_month}月 | 状态:${getSettlementStatusLabel(c.status)} | 差异:${formatCurrency(c.total_difference_amount)} | ID:${c.id}`);
        });
        if (cycles.length === 0) console.log('  暂无结算周期');
        break;
      }
      
      case 'settle:calc': {
        const cycleId = args[1];
        console.log('开始计算结算差异...');
        const detail = settlementService.calculateSettlement(cycleId);
        printSection('计算完成');
        printSettlementSummary(detail);
        break;
      }
      
      case 'settle:detail': {
        const cycleId = args[1];
        const detail = settlementService.getSettlementDetail(cycleId);
        printSection('结算详情');
        printSettlementSummary(detail);
        
        console.log('\n【明细记录】');
        console.log('日期\t\t餐别\t订餐\t取餐\t订餐额\t实际额\t差异\t\t原因');
        detail.records.forEach(r => {
          console.log(`${r.plan_date}\t${getMealTypeLabel(r.meal_type)}\t${r.planned_count}\t${r.verified_count}\t${formatCurrency(r.planned_amount)}\t${formatCurrency(r.actual_amount)}\t${formatCurrency(r.difference_amount)}\t${r.difference_reason || '-'}`);
        });
        break;
      }
      
      case 'settle:steps': {
        const cycleId = args[1];
        const steps = settlementService.getWorkflowSteps(cycleId);
        printSection('流程步骤');
        const statusLabels = {
          pending: '待处理',
          in_progress: '进行中',
          completed: '已完成',
          rejected: '已驳回'
        };
        steps.forEach(s => {
          const marker = s.status === 'completed' ? '[✓]' : s.status === 'in_progress' ? '[→]' : s.status === 'rejected' ? '[✗]' : '[ ]';
          console.log(`  ${marker} ${s.step_order}. ${getWorkflowStepLabel(s.step_code)} - ${statusLabels[s.status]}`);
          if (s.rejection_reason) console.log(`     驳回原因: ${s.rejection_reason}`);
          if (s.handler_name) console.log(`     处理人: ${s.handler_name} (${s.processed_at || ''})`);
        });
        break;
      }
      
      case 'settle:status': {
        const cycleId = args[1];
        const detail = settlementService.getSettlementDetail(cycleId);
        printSection('结算状态');
        printCurrentStatus(detail);
        break;
      }
      
      case 'settle:submit': {
        const [cycleId, role, handlerId, handlerName] = [args[1], args[2], args[3], args[4]];
        const detail = settlementService.submitForReview(cycleId, role, handlerId, handlerName);
        printSection('提交审核成功');
        printCurrentStatus(detail);
        break;
      }
      
      case 'settle:approve': {
        const [cycleId, stepCode, role, handlerId, handlerName] = [args[1], args[2], args[3], args[4], args[5]];
        const detail = settlementService.reviewStep(cycleId, stepCode, true, null, role, handlerId, handlerName);
        printSection('审核通过');
        printCurrentStatus(detail);
        break;
      }
      
      case 'settle:reject': {
        const [cycleId, stepCode, reason, role, handlerId, handlerName] = [args[1], args[2], args[3], args[4], args[5], args[6]];
        const detail = settlementService.reviewStep(cycleId, stepCode, false, reason, role, handlerId, handlerName);
        printSection('审核驳回');
        printCurrentStatus(detail);
        break;
      }
      
      case 'settle:resubmit': {
        const [cycleId, role, handlerId, handlerName] = [args[1], args[2], args[3], args[4]];
        const detail = settlementService.resubmitAfterRejection(cycleId, null, role, handlerId, handlerName);
        printSection('重新提交成功');
        printCurrentStatus(detail);
        break;
      }
      
      case 'adjust:create': {
        const [cycleId, recordId, type, amount, reason, opId, opName] = [args[1], args[2], args[3], parseFloat(args[4]), args[5], args[6], args[7]];
        const adj = settlementService.createAdjustment(cycleId, recordId, type, amount, reason, opId, opName);
        console.log(`创建调整成功: ${getAdjustmentTypeLabel(type)} ${formatCurrency(amount)}`);
        console.log(`原因: ${reason}`);
        console.log(`状态: 待审批`);
        break;
      }
      
      case 'adjust:list': {
        const cycleId = args[1];
        const adjustments = settlementService.listAdjustments(cycleId);
        printSection('调整记录');
        adjustments.forEach(a => {
          console.log(`  ${getAdjustmentTypeLabel(a.adjustment_type)}: ${formatCurrency(a.amount)} | ${a.reason} | 状态:${a.status}`);
        });
        if (adjustments.length === 0) console.log('  暂无调整记录');
        break;
      }
      
      case 'adjust:approve': {
        const adjustId = args[1];
        const adj = settlementService.approveAdjustment(adjustId, true);
        console.log(`调整审批通过: ${getAdjustmentTypeLabel(adj.adjustment_type)} ${formatCurrency(adj.amount)}`);
        break;
      }
      
      case 'settle:report': {
        const cycleId = args[1];
        console.log('正在生成报表...\n');
        const result = reportService.generateSettlementReport(cycleId);
        console.log(result.formattedText);
        break;
      }
      
      case 'task:list': {
        const status = args[1];
        const tasks = taskService.listTasks(status);
        printSection('后台任务列表');
        const statusLabels = {
          pending: '待执行',
          running: '执行中',
          completed: '已完成',
          failed: '失败'
        };
        tasks.forEach(t => {
          console.log(`  ID: ${t.id} | ${t.task_name} | 状态:${statusLabels[t.status]} | 重试:${t.retry_count}/${t.max_retries}`);
          if (t.error_message) console.log(`     错误: ${t.error_message}`);
        });
        if (tasks.length === 0) console.log('  暂无任务');
        break;
      }
      
      case 'task:status': {
        const taskId = args[1];
        const task = taskService.getTask(taskId);
        const desc = taskService.getTaskStatusDescription(task);
        printSection('任务状态');
        console.log(`任务名称: ${task.task_name}`);
        console.log(`类型: ${task.task_type}`);
        console.log(`状态: ${desc.statusLabel}`);
        console.log(`重试次数: ${desc.retryCount}/${desc.maxRetries}`);
        if (desc.error) console.log(`错误信息: ${desc.error}`);
        if (desc.action) console.log(`下一步: ${desc.action}`);
        break;
      }
      
      case 'task:run': {
        const taskId = args[1];
        console.log('开始执行任务...');
        const result = taskService.executeTask(taskId);
        printSection('任务执行结果');
        console.log(`成功: ${result.success}`);
        console.log(`消息: ${result.message}`);
        if (result.error) console.log(`错误: ${result.error}`);
        if (result.retryCount !== undefined) {
          console.log(`重试: ${result.retryCount}/${result.maxRetries}`);
          console.log(`是否自动重试: ${result.willRetry ? '是' : '否'}`);
        }
        break;
      }
      
      case 'task:retry': {
        const taskId = args[1];
        const task = taskService.retryTask(taskId);
        console.log('任务已重置为待执行状态');
        console.log('可以使用 task:run 命令执行任务');
        break;
      }
      
      case 'task:run-all': {
        console.log('执行所有待执行任务...');
        const results = taskService.executePendingTasks();
        printSection('执行结果');
        results.forEach(r => {
          console.log(`  任务 ${r.taskId}: ${r.success ? '成功' : '失败'} - ${r.message}`);
        });
        if (results.length === 0) console.log('  没有待执行的任务');
        break;
      }
      
      default:
        console.log(`未知命令: ${command}`);
        console.log('使用 help 查看可用命令');
        process.exit(1);
    }
  } catch (error) {
    console.error('\n错误:');
    console.error(`  ${error.message}`);
    console.error('\n堆栈:');
    console.error(error.stack);
    process.exit(1);
  }
}

main();
