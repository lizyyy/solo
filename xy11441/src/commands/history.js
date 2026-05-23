const { getDb } = require('../utils/database');
const { requirePermission, ROLES } = require('../utils/auth');
const { 
  printSuccess, 
  printInfo,
  formatDate
} = require('../utils/helpers');
const Table = require('cli-table3');
const chalk = require('chalk');

const ACTION_LABELS = {
  import: '导入数据',
  check: '质量检查',
  fix_edit: '修复-编辑',
  fix_mark: '修复-标记',
  fix_ignore: '修复-忽略',
  update_record: '更新记录',
  create_user: '创建用户',
  login: '登录',
  export: '导出'
};

async function historyCommand(options) {
  requirePermission('view');
  
  const db = getDb();
  const limit = options.limit || 50;
  const action = options.action;
  
  let whereClause = 'WHERE 1=1';
  let params = [];
  
  if (action) {
    whereClause += ' AND oh.action = ?';
    params.push(action);
  }
  
  if (options.userId) {
    whereClause += ' AND oh.user_id = ?';
    params.push(options.userId);
  }
  
  if (options.recordId) {
    whereClause += ' AND oh.record_id = ?';
    params.push(options.recordId);
  }
  
  params.push(limit);
  
  const records = db.prepare(`
    SELECT 
      oh.id,
      oh.action,
      oh.table_name,
      oh.record_id,
      oh.old_value,
      oh.new_value,
      oh.created_at,
      u.username,
      u.role
    FROM operation_history oh
    LEFT JOIN users u ON oh.user_id = u.id
    ${whereClause}
    ORDER BY oh.created_at DESC
    LIMIT ?
  `).all(...params);
  
  console.log('\n' + chalk.bold.cyan('='.repeat(70)));
  console.log(chalk.bold.cyan('  操作历史记录'));
  console.log(chalk.bold.cyan('='.repeat(70)));
  console.log('');
  
  if (records.length === 0) {
    printInfo('暂无操作记录');
    return;
  }
  
  const table = new Table({
    head: ['时间', '用户', '角色', '操作', '表名', '记录ID'],
    colWidths: [20, 10, 8, 12, 12, 8]
  });
  
  for (const r of records) {
    const roleConfig = ROLES[r.role];
    const actionLabel = ACTION_LABELS[r.action] || r.action;
    
    table.push([
      r.created_at ? r.created_at.substring(0, 19) : '-',
      r.username || '-',
      roleConfig ? roleConfig.name : r.role || '-',
      chalk.cyan(actionLabel),
      r.table_name || '-',
      r.record_id || '-'
    ]);
  }
  
  console.log(table.toString());
  console.log('');
  
  if (options.detail) {
    console.log(chalk.bold.magenta('📋 详细变更:'));
    console.log(chalk.gray('-'.repeat(70)));
    
    for (const r of records.slice(0, 10)) {
      console.log(`\n${chalk.yellow('#' + r.id)} ${chalk.cyan(ACTION_LABELS[r.action] || r.action)} by ${r.username}`);
      if (r.old_value) {
        console.log('  旧值:', JSON.stringify(JSON.parse(r.old_value), null, 2).replace(/\n/g, '\n  '));
      }
      if (r.new_value) {
        console.log('  新值:', JSON.stringify(JSON.parse(r.new_value), null, 2).replace(/\n/g, '\n  '));
      }
    }
  }
  
  printInfo(`共显示 ${records.length} 条记录`);
}

module.exports = historyCommand;
