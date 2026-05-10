const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { getProcessStatus } = require('./processLogService');

const exportsDir = path.join(__dirname, '../../exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function writeExcel(workbook, filename) {
  const filePath = path.join(exportsDir, filename);
  XLSX.writeFile(workbook, filePath);
  return filePath;
}

async function exportMealPlanReview(mealPlanId) {
  const plan = (await queryAsync('SELECT * FROM meal_plans WHERE id = ?', [mealPlanId]))[0];
  if (!plan) throw new Error('配餐计划不存在');

  const items = await queryAsync(`
    SELECT mpi.*, s.name as school_name, c.name as class_name, dr.name as route_name,
           ar.allergen_types
    FROM meal_plan_items mpi
    JOIN schools s ON mpi.school_id = s.id
    JOIN classes c ON mpi.class_id = c.id
    LEFT JOIN delivery_routes dr ON mpi.route_id = dr.id
    LEFT JOIN (
      SELECT class_id, GROUP_CONCAT(allergen_type, '、') as allergen_types
      FROM allergen_rules WHERE status = 'active'
      GROUP BY class_id
    ) ar ON ar.class_id = mpi.class_id
    WHERE mpi.meal_plan_id = ?
    ORDER BY s.name, c.name
  `, [mealPlanId]);

  const processStatus = await getProcessStatus(mealPlanId);

  const wb = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet([{
    '配餐计划ID': plan.id,
    '配餐日期': plan.plan_date,
    '计划状态': plan.status,
    '总份数': plan.total_meals,
    '流程状态': processStatus.currentStatus,
    '是否卡阻': processStatus.isBlocked ? '是' : '否',
    '当前卡点': processStatus.blockedStep ? processStatus.blockedStep.name : '无',
    '备注': plan.notes || ''
  }]);
  XLSX.utils.book_append_sheet(wb, summarySheet, '计划概览');

  const itemsSheet = XLSX.utils.json_to_sheet(items.map(item => ({
    '学校': item.school_name,
    '班级': item.class_name,
    '配送线路': item.route_name || '未分配',
    '配餐份数': item.meal_count,
    '班级过敏源': item.allergen_types || '无',
    '过敏源检查': item.allergen_checked ? '通过' : '未通过',
    '线路检查': item.route_checked ? '通过' : '未通过',
    '项目状态': item.status
  })));
  XLSX.utils.book_append_sheet(wb, itemsSheet, '配餐明细');

  const filename = `配餐计划复核_计划${plan.id}_${plan.plan_date}.xlsx`;
  return writeExcel(wb, filename);
}

async function exportDeliveryReceipts(mealPlanId) {
  const plan = (await queryAsync('SELECT * FROM meal_plans WHERE id = ?', [mealPlanId]))[0];
  if (!plan) throw new Error('配餐计划不存在');

  const receipts = await queryAsync(`
    SELECT dr.*, s.name as school_name, rl.route_id, route.name as route_name,
           rl.total_meals as route_total
    FROM delivery_receipts dr
    JOIN schools s ON dr.school_id = s.id
    JOIN route_loads rl ON dr.route_load_id = rl.id
    JOIN delivery_routes route ON rl.route_id = route.id
    WHERE rl.meal_plan_id = ?
    ORDER BY route.name, dr.created_at
  `, [mealPlanId]);

  const loads = await queryAsync(`
    SELECT rl.*, route.name as route_name
    FROM route_loads rl
    JOIN delivery_routes route ON rl.route_id = route.id
    WHERE rl.meal_plan_id = ?
  `, [mealPlanId]);

  const wb = XLSX.utils.book_new();

  const loadsSheet = XLSX.utils.json_to_sheet(loads.map(l => ({
    '装载ID': l.id,
    '配送线路': l.route_name,
    '总份数': l.total_meals,
    '装载人': l.loaded_by || '',
    '装载时间': l.load_time || '',
    '状态': l.status,
    '确认人': l.confirmed_by || '',
    '确认时间': l.confirmed_at || ''
  })));
  XLSX.utils.book_append_sheet(wb, loadsSheet, '线路装载清单');

  const receiptsSheet = XLSX.utils.json_to_sheet(receipts.map(r => ({
    '签收ID': r.id,
    '配送线路': r.route_name,
    '学校': r.school_name,
    '签收人': r.received_by,
    '签收份数': r.received_count,
    '线路总份数': r.route_total,
    '份数差异': r.received_count - r.route_total,
    '餐品状况': r.condition || '',
    '签收时间': r.created_at
  })));
  XLSX.utils.book_append_sheet(wb, receiptsSheet, '签收回执明细');

  const filename = `配送签收复核_计划${plan.id}_${plan.plan_date}.xlsx`;
  return writeExcel(wb, filename);
}

async function exportExceptionReport(mealPlanId) {
  const plan = (await queryAsync('SELECT * FROM meal_plans WHERE id = ?', [mealPlanId]))[0];
  if (!plan) throw new Error('配餐计划不存在');

  const exceptions = await queryAsync(`
    SELECT * FROM exception_reports WHERE meal_plan_id = ? ORDER BY created_at DESC
  `, [mealPlanId]);

  const wb = XLSX.utils.book_new();

  const sheet = XLSX.utils.json_to_sheet(exceptions.map(e => ({
    '异常ID': e.id,
    '发生步骤': e.step_name,
    '异常类型': e.exception_type,
    '异常描述': e.description,
    '关联类型': e.related_entity_type || '',
    '关联ID': e.related_entity_id || '',
    '状态': e.status,
    '报告人': e.reported_by || '',
    '报告时间': e.created_at,
    '处理人': e.resolved_by || '',
    '处理时间': e.resolved_at || '',
    '处理方案': e.resolution || ''
  })));
  XLSX.utils.book_append_sheet(wb, sheet, '异常报告明细');

  const summarySheet = XLSX.utils.json_to_sheet([{
    '配餐计划ID': plan.id,
    '配餐日期': plan.plan_date,
    '异常总数': exceptions.length,
    '待处理': exceptions.filter(e => e.status === 'open').length,
    '已解决': exceptions.filter(e => e.status === 'resolved').length
  }]);
  XLSX.utils.book_append_sheet(wb, summarySheet, '异常统计');

  const filename = `异常报告_计划${plan.id}_${plan.plan_date}.xlsx`;
  return writeExcel(wb, filename);
}

async function exportProcessFlow(mealPlanId) {
  const plan = (await queryAsync('SELECT * FROM meal_plans WHERE id = ?', [mealPlanId]))[0];
  if (!plan) throw new Error('配餐计划不存在');

  const logs = await queryAsync(`
    SELECT * FROM process_flow_logs WHERE meal_plan_id = ? ORDER BY step_order, created_at
  `, [mealPlanId]);

  const processStatus = await getProcessStatus(mealPlanId);

  const wb = XLSX.utils.book_new();

  const statusSheet = XLSX.utils.json_to_sheet([{
    '配餐计划ID': plan.id,
    '配餐日期': plan.plan_date,
    '当前状态': processStatus.currentStatus,
    '是否卡阻': processStatus.isBlocked ? '是' : '否',
    '卡点步骤': processStatus.blockedStep ? processStatus.blockedStep.name : '无',
    '卡点信息': processStatus.blockedStep ? processStatus.blockedStep.latestMessage : '无',
    '最后成功步骤': processStatus.lastSuccessfulStep ? processStatus.lastSuccessfulStep.name : '无'
  }]);
  XLSX.utils.book_append_sheet(wb, statusSheet, '流程状态');

  const logsSheet = XLSX.utils.json_to_sheet(logs.map(l => ({
    '步骤名称': l.step_name,
    '步骤顺序': l.step_order,
    '状态': l.status,
    '结果信息': l.result_message,
    '操作人': l.operator,
    '处理时间': l.created_at
  })));
  XLSX.utils.book_append_sheet(wb, logsSheet, '流程日志');

  const stepSummary = processStatus.allSteps.map(step => ({
    '步骤': step.name,
    '顺序': step.order,
    '最新状态': step.latestStatus,
    '最新信息': step.latestMessage || '',
    '处理时间': step.latestTime || '',
    '执行次数': step.logs.length
  }));
  const summarySheet = XLSX.utils.json_to_sheet(stepSummary);
  XLSX.utils.book_append_sheet(wb, summarySheet, '步骤概览');

  const filename = `流程追溯_计划${plan.id}_${plan.plan_date}.xlsx`;
  return writeExcel(wb, filename);
}

async function exportFullReview(mealPlanId) {
  const mealPlanPath = await exportMealPlanReview(mealPlanId);
  const deliveryPath = await exportDeliveryReceipts(mealPlanId);
  const exceptionPath = await exportExceptionReport(mealPlanId);
  const processPath = await exportProcessFlow(mealPlanId);

  return {
    message: '所有复核文件已生成',
    files: [
      { name: '配餐计划复核', path: mealPlanPath },
      { name: '配送签收复核', path: deliveryPath },
      { name: '异常报告', path: exceptionPath },
      { name: '流程追溯', path: processPath }
    ],
    exportDir: exportsDir
  };
}

module.exports = {
  exportsDir,
  exportMealPlanReview,
  exportDeliveryReceipts,
  exportExceptionReport,
  exportProcessFlow,
  exportFullReview
};
