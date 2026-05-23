const { getDb } = require('../utils/database');
const { requirePermission, ROLES } = require('../utils/auth');
const { 
  printSuccess, 
  printInfo,
  ERROR_TYPES,
  SOURCE_TYPES,
  formatDate
} = require('../utils/helpers');
const Table = require('cli-table3');
const chalk = require('chalk');

function generateSummary(db, options) {
  const startDate = options.startDate;
  const endDate = options.endDate;
  
  let dateFilter = '';
  let params = [];
  
  if (startDate) {
    dateFilter += ' AND delivery_date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    dateFilter += ' AND delivery_date <= ?';
    params.push(endDate);
  }
  
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_records,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'fixed' THEN 1 ELSE 0 END) as fixed_count,
      SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) as reviewed_count,
      SUM(delivery_quantity) as total_delivery_qty,
      SUM(delivery_weight) as total_delivery_weight,
      SUM(sorted_quantity) as total_sorted_qty,
      SUM(loss_weight) as total_loss_weight,
      SUM(bad_fruit_amount) as total_bad_fruit_amount,
      SUM(second_sort_loss) as total_second_sort_loss,
      SUM(total_amount) as total_amount
    FROM fact_records
    WHERE 1=1 ${dateFilter}
  `).get(...params);
  
  const dirtyStats = db.prepare(`
    SELECT 
      error_type,
      COUNT(*) as count,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
      SUM(CASE WHEN status = 'fixed' THEN 1 ELSE 0 END) as fixed_count
    FROM dirty_records
    GROUP BY error_type
  `).all();
  
  return { stats, dirtyStats };
}

function generateFailureList(db, options) {
  const limit = options.limit || 50;
  
  const failures = db.prepare(`
    SELECT 
      dr.id as dirty_id,
      dr.error_type,
      dr.error_message,
      dr.status as dirty_status,
      fr.id as fact_id,
      fr.original_line_number,
      fr.supplier_name,
      fr.product_name,
      fr.delivery_date,
      fr.delivery_quantity,
      fr.total_amount,
      fr.status as fact_status,
      ds.name as source_name,
      ds.type as source_type
    FROM dirty_records dr
    LEFT JOIN fact_records fr ON dr.fact_id = fr.id
    LEFT JOIN data_sources ds ON fr.source_id = ds.id
    WHERE dr.status = 'open'
    ORDER BY dr.created_at DESC
    LIMIT ?
  `).all(limit);
  
  return failures;
}

function generateFixedRecords(db, options) {
  const limit = options.limit || 50;
  
  const fixed = db.prepare(`
    SELECT 
      dr.id as dirty_id,
      dr.error_type,
      dr.error_message,
      dr.fix_note,
      dr.fixed_at,
      u.username as fixed_by,
      fr.id as fact_id,
      fr.original_line_number,
      fr.supplier_name,
      fr.product_name,
      fr.status as fact_status
    FROM dirty_records dr
    LEFT JOIN fact_records fr ON dr.fact_id = fr.id
    LEFT JOIN users u ON dr.fixed_by = u.id
    WHERE dr.status = 'fixed'
    ORDER BY dr.fixed_at DESC
    LIMIT ?
  `).all(limit);
  
  return fixed;
}

function generateSourceBreakdown(db, options) {
  const breakdown = db.prepare(`
    SELECT 
      source_type,
      COUNT(*) as record_count,
      SUM(delivery_quantity) as total_qty,
      SUM(total_amount) as total_amount
    FROM fact_records
    GROUP BY source_type
    ORDER BY record_count DESC
  `).all();
  
  return breakdown;
}

async function reportCommand(options) {
  requirePermission('report');
  
  const db = getDb();
  const reportType = options.type || 'summary';
  
  console.log('\n' + chalk.bold.cyan('='.repeat(70)));
  console.log(chalk.bold.cyan('  生鲜分拣损耗巡检报告'));
  console.log(chalk.bold.cyan('='.repeat(70)));
  console.log(chalk.gray(`  生成时间: ${new Date().toLocaleString()}`));
  console.log('');
  
  if (reportType === 'summary' || reportType === 'all') {
    const { stats, dirtyStats } = generateSummary(db, options);
    
    console.log(chalk.bold.green('📊 数据汇总'));
    console.log(chalk.gray('-'.repeat(70)));
    
    const summaryTable = new Table({
      head: ['指标', '数值'],
      colWidths: [35, 30]
    });
    
    summaryTable.push(
      ['总记录数', stats.total_records || 0],
      ['待处理', chalk.yellow(stats.pending_count || 0)],
      ['已修复', chalk.green(stats.fixed_count || 0)],
      ['已复核', chalk.blue(stats.reviewed_count || 0)],
      ['总送货数量', (stats.total_delivery_qty || 0).toFixed(2)],
      ['总送货重量(kg)', (stats.total_delivery_weight || 0).toFixed(2)],
      ['总分拣数量', (stats.total_sorted_qty || 0).toFixed(2)],
      ['总损耗重量(kg)', chalk.red((stats.total_loss_weight || 0).toFixed(2))],
      ['坏果扣款金额(元)', chalk.red((stats.total_bad_fruit_amount || 0).toFixed(2))],
      ['二次分拣损耗', chalk.red((stats.total_second_sort_loss || 0).toFixed(2))],
      ['总金额(元)', (stats.total_amount || 0).toFixed(2)]
    );
    
    console.log(summaryTable.toString());
    console.log('');
    
    if (dirtyStats.length > 0) {
      console.log(chalk.bold.yellow('⚠ 脏记录统计'));
      console.log(chalk.gray('-'.repeat(70)));
      
      const dirtyTable = new Table({
        head: ['错误类型', '总数', '待处理', '已修复'],
        colWidths: [20, 12, 12, 12]
      });
      
      for (const ds of dirtyStats) {
        const errorType = ERROR_TYPES[ds.error_type];
        dirtyTable.push([
          errorType ? errorType.name : ds.error_type,
          ds.count,
          chalk.red(ds.open_count),
          chalk.green(ds.fixed_count)
        ]);
      }
      
      console.log(dirtyTable.toString());
      console.log('');
    }
  }
  
  if (reportType === 'source' || reportType === 'all') {
    const breakdown = generateSourceBreakdown(db, options);
    
    console.log(chalk.bold.blue('📁 数据源分布'));
    console.log(chalk.gray('-'.repeat(70)));
    
    const sourceTable = new Table({
      head: ['数据源', '记录数', '总数量', '总金额(元)'],
      colWidths: [20, 12, 15, 18]
    });
    
    for (const b of breakdown) {
      const sourceType = SOURCE_TYPES[b.source_type];
      sourceTable.push([
        sourceType ? sourceType.name : b.source_type,
        b.record_count,
        b.total_qty ? b.total_qty.toFixed(2) : '-',
        b.total_amount ? b.total_amount.toFixed(2) : '-'
      ]);
    }
    
    console.log(sourceTable.toString());
    console.log('');
  }
  
  if (reportType === 'failures' || reportType === 'all') {
    const failures = generateFailureList(db, options);
    
    console.log(chalk.bold.red('❌ 待处理失败清单'));
    console.log(chalk.gray('-'.repeat(70)));
    
    if (failures.length === 0) {
      printSuccess('没有待处理的失败记录');
    } else {
      const failTable = new Table({
        head: ['原始行号', '供应商', '商品', '错误类型', '错误信息'],
        colWidths: [10, 12, 12, 10, 30]
      });
      
      for (const f of failures) {
        const errorType = ERROR_TYPES[f.error_type];
        failTable.push([
          chalk.yellow(f.original_line_number || '-'),
          (f.supplier_name || '-').substring(0, 10),
          (f.product_name || '-').substring(0, 10),
          errorType ? chalk.red(errorType.name) : f.error_type,
          f.error_message.substring(0, 27) + '...'
        ]);
      }
      
      console.log(failTable.toString());
      printInfo(`共 ${failures.length} 条待处理记录，使用 fix 命令处理`);
    }
    console.log('');
  }
  
  if (reportType === 'fixed' || reportType === 'all') {
    const fixed = generateFixedRecords(db, options);
    
    console.log(chalk.bold.green('✅ 已修复记录'));
    console.log(chalk.gray('-'.repeat(70)));
    
    if (fixed.length === 0) {
      printInfo('暂无已修复记录');
    } else {
      const fixedTable = new Table({
        head: ['原始行号', '商品', '错误类型', '处理人', '处理意见', '处理时间'],
        colWidths: [10, 12, 10, 10, 18, 16]
      });
      
      for (const f of fixed) {
        const errorType = ERROR_TYPES[f.error_type];
        fixedTable.push([
          f.original_line_number || '-',
          (f.product_name || '-').substring(0, 10),
          errorType ? errorType.name : f.error_type,
          f.fixed_by || '-',
          (f.fix_note || '-').substring(0, 15),
          f.fixed_at ? f.fixed_at.substring(0, 16) : '-'
        ]);
      }
      
      console.log(fixedTable.toString());
    }
    console.log('');
  }
  
  if (reportType === 'detail' || reportType === 'all') {
    const limit = options.limit || 20;
    const records = db.prepare(`
      SELECT 
        id, original_line_number, supplier_name, product_name,
        delivery_date, delivery_quantity, sorted_quantity, loss_weight,
        bad_fruit_amount, status, source_type
      FROM fact_records
      ORDER BY delivery_date DESC, id DESC
      LIMIT ?
    `).all(limit);
    
    console.log(chalk.bold.magenta('📋 详细记录 (带原始行号)'));
    console.log(chalk.gray('-'.repeat(70)));
    
    const detailTable = new Table({
      head: ['原始行号', '供应商', '商品', '日期', '送货量', '损耗', '坏果扣款', '状态'],
      colWidths: [10, 10, 10, 12, 10, 10, 12, 8]
    });
    
    for (const r of records) {
      const statusColors = {
        pending: chalk.yellow,
        fixed: chalk.green,
        reviewed: chalk.blue,
        rejected: chalk.red
      };
      const statusColor = statusColors[r.status] || chalk.gray;
      
      detailTable.push([
        chalk.yellow(r.original_line_number || '-'),
        (r.supplier_name || '-').substring(0, 8),
        (r.product_name || '-').substring(0, 8),
        r.delivery_date || '-',
        r.delivery_quantity ? r.delivery_quantity.toFixed(1) : '-',
        chalk.red(r.loss_weight ? r.loss_weight.toFixed(1) : '-'),
        chalk.red(r.bad_fruit_amount ? r.bad_fruit_amount.toFixed(1) : '-'),
        statusColor(r.status)
      ]);
    }
    
    console.log(detailTable.toString());
    console.log('');
  }
  
  printSuccess('报告生成完成!');
}

module.exports = reportCommand;
