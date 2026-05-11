const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3001;

let prescriptionId = null;
let batchId = null;
let workOrderIds = [];
let returnId = null;
let responsibilityId = null;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, ...parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function printStep(step, title) {
  console.log('\n' + '='.repeat(60));
  console.log(`步骤 ${step}: ${title}`);
  console.log('='.repeat(60));
}

function printResult(result, successMsg) {
  if (result.code === 0) {
    console.log('✓', successMsg);
  } else {
    console.log('✗ 操作失败');
    console.log('  错误码:', result.code);
    console.log('  错误信息:', result.message);
    if (result.details) {
      console.log('  详情:', result.details);
    }
  }
}

async function runMainFlow() {
  console.log('\n' + '#'.repeat(60));
  console.log('#   口腔技工义齿返修管理系统 - 主流程演示');
  console.log('#'.repeat(60));
  
  try {
    printStep(1, '创建医生处方');
    const prescResult = await request('POST', '/api/prescriptions', {
      doctorName: '张医生',
      patientName: '李明',
      clinic: '北京口腔医院',
      toothPosition: '左上6,7',
      dentureType: '烤瓷冠',
      dueDate: '2026-05-20',
      notes: '患者要求颜色与自然牙匹配'
    });
    printResult(prescResult, '处方创建成功');
    if (prescResult.code === 0) {
      prescriptionId = prescResult.data.id;
      console.log('  处方ID:', prescriptionId);
      console.log('  处方状态:', prescResult.data.status, '(待生产)');
    }

    printStep(2, '创建模型批次');
    const batchResult = await request('POST', '/api/batches', {
      prescriptionId,
      batchNumber: 'BATCH-2026-0511-001',
      modelNumber: 'MDL-001',
      technician: '王技工',
      expectedFinishDate: '2026-05-18',
      notes: '标准流程'
    });
    printResult(batchResult, '批次创建成功');
    if (batchResult.code === 0) {
      batchId = batchResult.data.batch.id;
      workOrderIds = batchResult.data.workOrders.map(wo => wo.id);
      console.log('  批次ID:', batchId);
      console.log('  批次号:', batchResult.data.batch.batchNumber);
      console.log('  模型号:', batchResult.data.batch.modelNumber);
      console.log('  生成工序数:', batchResult.data.workOrders.length);
      batchResult.data.workOrders.forEach(wo => {
        console.log(`    - ${wo.sequence}. ${wo.processName} [${wo.status}]`);
      });
    }

    printStep(3, '开始生产');
    const startResult = await request('POST', `/api/batches/${batchId}/start`);
    printResult(startResult, '开始生产成功');
    if (startResult.code === 0) {
      console.log('  批次状态:', startResult.data.status, '(生产中)');
    }

    printStep(4, '完成所有工序');
    for (let i = 0; i < workOrderIds.length; i++) {
      const woId = workOrderIds[i];
      const completeResult = await request('POST', `/api/batches/workorders/${woId}/complete`, {
        operator: `技师${i + 1}`,
        notes: `工序${i + 1}完成，质量合格`
      });
      if (completeResult.code === 0) {
        const allComplete = completeResult.allCompleted;
        console.log(`  ✓ 工序${i + 1}完成${allComplete ? ' - 所有工序已完成!' : ''}`);
        if (allComplete) {
          console.log('  批次和处方状态自动更新为已完成');
        }
      }
    }

    printStep(5, '检查完成后状态');
    const batchCheck = await request('GET', `/api/batches/${batchId}`);
    const prescCheck = await request('GET', `/api/prescriptions/${prescriptionId}`);
    console.log('  批次状态:', batchCheck.data.status, '(已完成)');
    console.log('  处方状态:', prescCheck.data.status, '(已完成)');

    printStep(6, '提交返修申请');
    const returnResult = await request('POST', '/api/returns', {
      prescriptionId,
      batchId,
      reason: 'color_mismatch',
      reasonDetail: '烤瓷冠颜色与自然牙存在偏差，患者不满意',
      returnedBy: '门诊护士小李',
      notes: '需要重新上瓷调色'
    });
    printResult(returnResult, '返修申请提交成功');
    if (returnResult.code === 0) {
      returnId = returnResult.data.id;
      console.log('  返修ID:', returnId);
      console.log('  返修原因:', returnResult.data.reason, '-', returnResult.data.reasonLabel);
      console.log('  返修状态:', returnResult.data.status, '-', returnResult.data.statusLabel);
    }

    printStep(7, '检查返修后状态变化');
    const returnBatchCheck = await request('GET', `/api/batches/${batchId}`);
    const returnPrescCheck = await request('GET', `/api/prescriptions/${prescriptionId}`);
    console.log('  批次状态:', returnBatchCheck.data.status, '(已退回)');
    console.log('  处方状态:', returnPrescCheck.data.status, '(已退回)');
    console.log('  处方返修次数:', returnPrescCheck.data.returnCount);

    printStep(8, '责任归因');
    const respResult = await request('POST', `/api/returns/${returnId}/assign-responsibility`, {
      primaryDepartment: 'porcelain',
      secondaryDepartments: ['qc'],
      operator: '上瓷技师小张',
      processCode: 'porcelain',
      processName: '上瓷',
      description: '上瓷时颜色配比不准确，比色板选择偏差',
      severity: 'medium'
    });
    printResult(respResult, '责任归因成功');
    if (respResult.code === 0) {
      responsibilityId = respResult.data.responsibility.id;
      console.log('  主要责任部门:', respResult.data.responsibility.primaryDepartmentLabel);
      console.log('  次要责任部门:', respResult.data.responsibility.secondaryDepartmentLabels.join(', '));
      console.log('  责任人:', respResult.data.responsibility.operator);
      console.log('  严重程度:', respResult.data.responsibility.severity);
      console.log('  返修状态:', respResult.data.returnRecord.status, '-', respResult.data.returnRecord.statusLabel);
    }

    printStep(9, '开始返工');
    const reworkResult = await request('POST', `/api/returns/${returnId}/start-rework`);
    printResult(reworkResult, '开始返工成功');
    if (reworkResult.code === 0) {
      console.log('  返修状态:', reworkResult.data.status, '-', reworkResult.data.statusLabel);
    }

    printStep(10, '完成返工工序');
    const reworkBatch = await request('GET', `/api/batches/${batchId}/workorders`);
    const reworkWorkOrders = reworkBatch.data.workOrders.filter(wo => 
      ['design', 'porcelain'].includes(wo.processCode)
    );
    
    for (const wo of reworkWorkOrders) {
      const completeResult = await request('POST', `/api/batches/workorders/${wo.id}/complete`, {
        operator: '返工技师',
        notes: '返工完成，已重新调色'
      });
      if (completeResult.code === 0) {
        console.log(`  ✓ 工序 ${wo.processName} 返工完成`);
      }
    }

    printStep(11, '解决返修');
    const resolveResult = await request('POST', `/api/returns/${returnId}/resolve`, {
      resolvedBy: '质检主管',
      resolutionNotes: '返工后颜色匹配度符合要求，患者确认满意'
    });
    printResult(resolveResult, '返修已解决');
    if (resolveResult.code === 0) {
      console.log('  返修状态:', resolveResult.data.status, '-', resolveResult.data.statusLabel);
      console.log('  解决人:', resolveResult.data.resolvedBy);
    }

    printStep(12, '查看返修详情');
    const returnDetails = await request('GET', `/api/returns/${returnId}/details`);
    console.log('  返修信息:');
    console.log('    - 患者:', returnDetails.data.prescription.patientName);
    console.log('    - 医生:', returnDetails.data.prescription.doctorName);
    console.log('    - 返修原因:', returnDetails.data.reasonLabel);
    console.log('    - 责任归因数:', returnDetails.data.responsibilities.length);
    returnDetails.data.responsibilities.forEach((r, idx) => {
      console.log(`    - 责任${idx + 1}: ${r.primaryDepartmentLabel} - ${r.operator} (${r.severity})`);
    });

    printStep(13, '查看总体统计报表');
    const overview = await request('GET', '/api/reports/overview');
    console.log('  处方统计:');
    console.log('    - 总数:', overview.data.prescriptions.total);
    console.log('    - 返修率:', overview.data.prescriptions.returnRate);
    console.log('  批次统计:');
    console.log('    - 总数:', overview.data.batches.total);
    console.log('    - 返工率:', overview.data.batches.reworkRate);
    console.log('  返修统计:');
    console.log('    - 总数:', overview.data.returns.total);
    overview.data.returns.byReason.forEach(r => {
      console.log(`    - ${r.reasonLabel}: ${r.count}次`);
    });

    printStep(14, '查看责任归因报表');
    const respReport = await request('GET', '/api/reports/responsibility');
    console.log('  责任归因统计:');
    console.log('    - 总归因数:', respReport.data.total);
    respReport.data.byDepartment.forEach(d => {
      console.log(`    - ${d.departmentLabel}: ${d.count}次 (${d.percentage})`);
    });

    console.log('\n' + '#'.repeat(60));
    console.log('#   主流程演示完成！');
    console.log('#'.repeat(60));
    console.log('\n关键数据记录:');
    console.log('  - 处方ID:', prescriptionId);
    console.log('  - 批次ID:', batchId);
    console.log('  - 返修ID:', returnId);
    console.log('  - 责任归因ID:', responsibilityId);
    
  } catch (error) {
    console.error('测试失败:', error.message);
    console.error('请确保服务已启动: npm start');
    process.exit(1);
  }
}

runMainFlow();
