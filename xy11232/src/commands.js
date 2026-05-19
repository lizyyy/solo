const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const storage = require('./storage');
const rules = require('./rules');

function init() {
  storage.init();
  console.log('✅ 数据存储初始化完成');
  console.log('📦 默认试剂已加载:');
  storage.getReagents().forEach(r => {
    const dangerInfo = rules.DANGER_LEVELS[r.dangerLevel] || { name: '未知' };
    console.log(`   ${r.id} - ${r.name} (${dangerInfo.name}) - 库存: ${storage.getInventory()[r.id]} ${r.unit}`);
  });
}

function importFile(filePath) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error('❌ 文件不存在:', absolutePath);
    return;
  }

  const results = [];
  const successItems = [];
  const failedItems = [];

  fs.createReadStream(absolutePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      console.log(`📋 共读取 ${results.length} 条申请`);

      results.forEach((row, index) => {
        try {
          const application = {
            reagentId: row.reagentId || row['试剂ID'],
            quantity: parseInt(row.quantity || row['数量']) || 0,
            applicant: row.applicant || row['申请人'],
            department: row.department || row['部门'],
            purpose: row.purpose || row['用途']
          };

          const validation = rules.validateApplication(application);
          
          if (validation.valid) {
            const newApp = storage.addApplication(application);
            successItems.push({ index: index + 1, ...newApp, warnings: validation.warnings });
          } else {
            failedItems.push({ index: index + 1, data: row, errors: validation.errors });
          }
        } catch (e) {
          failedItems.push({ index: index + 1, data: row, errors: [e.message] });
        }
      });

      const batch = storage.addBatch({
        type: 'import',
        total: results.length,
        success: successItems.length,
        failed: failedItems.length,
        successItems: successItems.map(i => ({ id: i.id, reagentId: i.reagentId })),
        failedItems: failedItems
      });

      if (successItems.length > 0) {
        console.log(`✅ 成功导入 ${successItems.length} 条申请:`);
        successItems.forEach(item => {
          console.log(`   #${item.index} ${item.reagentId} x${item.quantity} - ${item.applicant}`);
          item.warnings.forEach(w => console.log(`     ⚠️  ${w}`));
        });
      }

      if (failedItems.length > 0) {
        console.log(`❌ 导入失败 ${failedItems.length} 条:`);
        failedItems.forEach(item => {
          console.log(`   #${item.index}`);
          item.errors.forEach(e => console.log(`     ❌ ${e}`));
        });
      }

      console.log(`\n🔄 批量操作ID: ${batch.id} (可使用 reagent retry ${batch.id} 重试失败项)`);
      storage.addHistory('import', { file: filePath, batchId: batch.id, success: successItems.length, failed: failedItems.length });
    });
}

function review(options) {
  if (options.list) {
    const pending = storage.getApplications().filter(a => a.status === 'pending');
    if (pending.length === 0) {
      console.log('✅ 没有待审批的申请');
      return;
    }

    console.log(`📋 待审批申请 (${pending.length} 条):`);
    pending.forEach(app => {
      const reagent = storage.getReagent(app.reagentId);
      const dangerInfo = rules.DANGER_LEVELS[reagent?.dangerLevel || 0] || { name: '未知' };
      const approvals = storage.getApprovals().filter(a => a.applicationId === app.id && a.status === 'approved');
      
      console.log(`\n   申请ID: ${app.id}`);
      console.log(`   试剂: ${reagent?.name || app.reagentId} (${dangerInfo.name})`);
      console.log(`   数量: ${app.quantity} ${reagent?.unit || ''}`);
      console.log(`   申请人: ${app.applicant} (${app.department})`);
      console.log(`   用途: ${app.purpose}`);
      console.log(`   审批进度: ${approvals.length}/${dangerInfo.requiresDoubleApproval ? 2 : 1}`);
    });
    return;
  }

  if (options.approve) {
    const result = rules.approveApplication(options.approve, options.by, options.reason || '审批通过');
    if (result.success) {
      console.log('✅', result.message);
      console.log(`   审批人: ${options.by}`);
      console.log(`   审批进度: ${result.approvalsCount}/${result.requiredApprovals}`);
    } else {
      console.log('❌', result.error);
    }
    return;
  }

  if (options.reject) {
    const result = rules.rejectApplication(options.reject, options.by, options.reason || '审批驳回');
    if (result.success) {
      console.log('✅', result.message);
      console.log(`   驳回人: ${options.by}`);
    } else {
      console.log('❌', result.error);
    }
    return;
  }

  console.log('请使用 --list, --approve, 或 --reject 参数');
}

function exportFile(outputPath, options) {
  const applications = storage.getApplications();
  let filtered = applications;
  
  if (options.type === 'approved') {
    filtered = applications.filter(a => a.status === 'approved');
  } else if (options.type === 'rejected') {
    filtered = applications.filter(a => a.status === 'rejected');
  } else if (options.type === 'pending') {
    filtered = applications.filter(a => a.status === 'pending');
  }

  const exportData = filtered.map(app => {
    const reagent = storage.getReagent(app.reagentId);
    const approvals = storage.getApprovals().filter(a => a.applicationId === app.id);
    const dangerInfo = rules.DANGER_LEVELS[reagent?.dangerLevel || 0] || { name: '未知' };
    
    return {
      申请ID: app.id,
      试剂ID: app.reagentId,
      试剂名称: reagent?.name || '',
      危险等级: dangerInfo.name,
      申请数量: app.quantity,
      单位: reagent?.unit || '',
      申请人: app.applicant,
      部门: app.department,
      用途: app.purpose,
      状态: app.status === 'approved' ? '已通过' : app.status === 'rejected' ? '已驳回' : '待审批',
      创建时间: app.createdAt,
      审批记录: approvals.map(a => `${a.approver}:${a.status === 'approved' ? '通过' : '驳回'}(${a.reason || ''})`).join('; ')
    };
  });

  try {
    const parser = new Parser();
    const csv = parser.parse(exportData);
    fs.writeFileSync(path.resolve(outputPath), csv, 'utf8');
    console.log(`✅ 已导出 ${exportData.length} 条记录到 ${outputPath}`);
    storage.addHistory('export', { file: outputPath, type: options.type, count: exportData.length });
  } catch (e) {
    console.error('❌ 导出失败:', e.message);
  }
}

function status(options) {
  if (options.reagent) {
    const reagent = storage.getReagent(options.reagent);
    if (!reagent) {
      console.log('❌ 试剂不存在');
      return;
    }
    const inventory = storage.getInventory();
    const dangerInfo = rules.DANGER_LEVELS[reagent.dangerLevel] || { name: '未知' };
    
    console.log(`📦 试剂详情:`);
    console.log(`   ID: ${reagent.id}`);
    console.log(`   名称: ${reagent.name}`);
    console.log(`   危险等级: ${dangerInfo.name} (${dangerInfo.requiresDoubleApproval ? '需要双人审批' : '单人审批'})`);
    console.log(`   单位: ${reagent.unit}`);
    console.log(`   当前库存: ${inventory[reagent.id] || 0} ${reagent.unit}`);
    console.log(`   描述: ${reagent.description}`);
    return;
  }

  console.log('📦 当前库存状态:');
  const reagents = storage.getReagents();
  const inventory = storage.getInventory();
  reagents.forEach(r => {
    const dangerInfo = rules.DANGER_LEVELS[r.dangerLevel] || { name: '未知' };
    const stock = inventory[r.id] || 0;
    const status = stock > 10 ? '✅' : stock > 0 ? '⚠️' : '❌';
    console.log(`   ${status} ${r.id} - ${r.name} (${dangerInfo.name}): ${stock} ${r.unit}`);
  });

  const apps = storage.getApplications();
  const stats = {
    pending: apps.filter(a => a.status === 'pending').length,
    approved: apps.filter(a => a.status === 'approved').length,
    rejected: apps.filter(a => a.status === 'rejected').length
  };

  console.log(`\n📋 申请统计:`);
  console.log(`   待审批: ${stats.pending}`);
  console.log(`   已通过: ${stats.approved}`);
  console.log(`   已驳回: ${stats.rejected}`);
}

function resubmit(applicationId) {
  const result = rules.resubmitApplication(applicationId);
  if (result.success) {
    console.log('✅', result.message);
    if (result.warnings && result.warnings.length > 0) {
      result.warnings.forEach(w => console.log(`   ⚠️  ${w}`));
    }
  } else {
    console.log('❌ 重新提交失败:');
    if (result.errors) {
      result.errors.forEach(e => console.log(`   ${e}`));
    } else {
      console.log(`   ${result.error}`);
    }
  }
}

function retry(batchId) {
  const batch = storage.getBatches().find(b => b.id === batchId);
  if (!batch) {
    console.log('❌ 批量操作记录不存在');
    return;
  }

  if (batch.failedItems.length === 0) {
    console.log('✅ 该批次没有失败项需要重试');
    return;
  }

  console.log(`🔄 重试批次 ${batchId} 的 ${batch.failedItems.length} 条失败项...`);

  const retrySuccess = [];
  const retryFailed = [];

  batch.failedItems.forEach(item => {
    try {
      const application = {
        reagentId: item.data.reagentId || item.data['试剂ID'],
        quantity: parseInt(item.data.quantity || item.data['数量']) || 0,
        applicant: item.data.applicant || item.data['申请人'],
        department: item.data.department || item.data['部门'],
        purpose: item.data.purpose || item.data['用途']
      };

      const validation = rules.validateApplication(application);
      
      if (validation.valid) {
        const newApp = storage.addApplication(application);
        retrySuccess.push({ originalIndex: item.index, ...newApp });
      } else {
        retryFailed.push({ originalIndex: item.index, data: item.data, errors: validation.errors });
      }
    } catch (e) {
      retryFailed.push({ originalIndex: item.index, data: item.data, errors: [e.message] });
    }
  });

  if (retrySuccess.length > 0) {
    console.log(`✅ 重试成功 ${retrySuccess.length} 条:`);
    retrySuccess.forEach(item => {
      console.log(`   原#${item.originalIndex} → 新申请ID: ${item.id}`);
    });
  }

  if (retryFailed.length > 0) {
    console.log(`❌ 重试仍然失败 ${retryFailed.length} 条:`);
    retryFailed.forEach(item => {
      console.log(`   原#${item.originalIndex}`);
      item.errors.forEach(e => console.log(`     ❌ ${e}`));
    });
  }

  storage.updateBatch(batchId, {
    failedItems: retryFailed,
    lastRetryAt: new Date().toISOString()
  });

  storage.addHistory('retry', { batchId, success: retrySuccess.length, failed: retryFailed.length });
}

function history(options) {
  const limit = parseInt(options.limit) || 10;
  const records = storage.getHistory(limit);
  
  console.log(`📜 操作历史 (最近 ${records.length} 条):`);
  records.forEach((record, i) => {
    const status = record.success ? '✅' : '❌';
    console.log(`\n   ${i + 1}. [${new Date(record.timestamp).toLocaleString()}] ${status} ${record.action}`);
    console.log(`      详情: ${JSON.stringify(record.details)}`);
    if (record.error) {
      console.log(`      错误: ${record.error}`);
    }
  });
}

module.exports = {
  init,
  importFile,
  review,
  exportFile,
  status,
  resubmit,
  retry,
  history
};
