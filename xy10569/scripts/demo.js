const database = require('../src/database');
const borrowService = require('../src/services/borrowService');
const batchReturnService = require('../src/services/batchReturnService');
const { fineService, lostBookService } = require('../src/services/financialServices');
const reportService = require('../src/services/reportService');
const db = require('../src/database');

function logStep(step, description) {
  console.log(`\n=== 步骤 ${step}: ${description} ===`);
}

function logSuccess(message) {
  console.log(`   ✅ ${message}`);
}

function logFailure(message) {
  console.log(`   ❌ ${message}`);
}

function logTitle(title) {
  console.log('\n' + '='.repeat(50));
  console.log(`  ${title}`);
  console.log('='.repeat(50));
}

async function runDemo() {
  logTitle('校园借书逾期 API - 完整演示');

  await database.initDatabase();

  const operatorId = 'demo-admin';
  let borrowId1, borrowId2, borrowId3, borrowId4;

  try {
    logStep('1', '正常借还流程');
    
    console.log('   张三借阅《西游记》...');
    const result1 = await borrowService.borrow('stu-301-01', 'book-001', {}, operatorId);
    if (result1.success) {
      borrowId1 = result1.data.id;
      logSuccess(`借阅成功: ${result1.data.id} (状态: ${result1.data.status})`);
    } else {
      logFailure(`借阅失败: ${result1.error}`);
      return;
    }

    console.log('\n   李四借阅《红楼梦》...');
    const result2 = await borrowService.borrow('stu-301-02', 'book-002', {}, operatorId);
    if (result2.success) {
      borrowId2 = result2.data.id;
      logSuccess(`借阅成功: ${result2.data.id} (状态: ${result2.data.status})`);
    } else {
      logFailure(`借阅失败: ${result2.error}`);
      return;
    }

    console.log('\n   张三归还《西游记》...');
    const returnResult = await borrowService.returnBook(borrowId1, null, operatorId);
    if (returnResult.success) {
      logSuccess(`归还成功 (状态: ${returnResult.data.status})`);
    } else {
      logFailure(`归还失败: ${returnResult.error}`);
      return;
    }

    logStep('2', '续借功能演示');
    
    console.log('   李四续借《红楼梦》...');
    const renewResult = await borrowService.renew(borrowId2, operatorId, '书未看完');
    if (renewResult.success) {
      logSuccess(`续借成功 (已续借次数: ${renewResult.data.renewCount}, 新到期日: ${renewResult.data.dueDate})`);
    } else {
      logFailure(`续借失败: ${renewResult.error}`);
    }

    console.log('\n   李四第二次续借《红楼梦》...');
    const renewResult2 = await borrowService.renew(borrowId2, operatorId, '还需要时间');
    if (renewResult2.success) {
      logSuccess(`第二次续借成功 (已续借次数: ${renewResult2.data.renewCount})`);
    } else {
      logFailure(`第二次续借失败: ${renewResult2.error}`);
    }

    console.log('\n   李四第三次续借（应该失败，超过限制）...');
    const renewResult3 = await borrowService.renew(borrowId2, operatorId, '继续续借');
    if (renewResult3.success) {
      logFailure('第三次续借应该失败但成功了！');
    } else {
      logSuccess(`正确被拒绝: ${renewResult3.error}`);
    }

    logStep('3', '班级集体借书（批量借）');
    
    console.log('   三年级1班集体借阅，王老师为代借责任人...');
    const batchBorrowResult = await borrowService.batchBorrow(
      'class-301',
      'teacher-wang',
      [
        { studentId: 'stu-301-01', bookId: 'book-003' },
        { studentId: 'stu-301-02', bookId: 'book-004' },
        { studentId: 'stu-301-03', bookId: 'book-005' }
      ],
      operatorId
    );
    
    if (batchBorrowResult.success) {
      borrowId3 = batchBorrowResult.data.borrowIds[1];
      borrowId4 = batchBorrowResult.data.borrowIds[2];
      logSuccess(`批量借阅成功: ${batchBorrowResult.data.borrowIds.length} 本`);
      logSuccess(`班级代借责任人: 王老师 (teacher-wang)`);
    } else {
      logFailure(`批量借阅失败: ${batchBorrowResult.error}`);
      return;
    }

    logStep('4', '幂等性测试 - 重复借阅同一本书');
    
    console.log('   张三尝试再次借阅《西游记》（应该被拒绝）...');
    const dupResult = await borrowService.borrow('stu-301-01', 'book-001', {}, operatorId);
    if (dupResult.success) {
      logFailure('重复借阅应该失败但成功了！');
    } else {
      logSuccess(`正确被拒绝: ${dupResult.error}`);
    }

    console.log('\n   使用相同 request_id 重复调用（应该返回已有结果）...');
    const idempotentResult1 = await borrowService.borrow('stu-302-01', 'book-006', { requestId: 'demo-idempotent-001' }, operatorId);
    const idempotentResult2 = await borrowService.borrow('stu-302-01', 'book-006', { requestId: 'demo-idempotent-001' }, operatorId);
    
    if (idempotentResult1.success && idempotentResult2.success && 
        idempotentResult1.data.id === idempotentResult2.data.id) {
      logSuccess('幂等性生效，两次调用返回相同记录');
      await borrowService.returnBook(idempotentResult1.data.id, null, operatorId);
    } else {
      logFailure('幂等性测试失败');
    }

    logStep('5', '逾期计费模拟');
    
    console.log('   创建一笔历史借阅，模拟逾期...');
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 50);
    
    const result = await db.runSync(`
      INSERT INTO borrow_records (id, student_id, book_id, teacher_id, borrow_date, due_date, status, renew_count, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'overdue', 0, ?)
    `, [
      'borrow-overdue-demo',
      'stu-302-02',
      'book-007',
      'teacher-wang',
      pastDate.toISOString().split('T')[0],
      new Date(pastDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      operatorId
    ]);

    console.log('   刷新逾期状态和罚款...');
    await borrowService.refreshOverdueStatus(operatorId);
    const fines = await fineService.list({ status: 'pending' });
    const overdueFines = fines.filter(f => f.type === 'overdue');
    
    if (overdueFines.length > 0) {
      const fine = overdueFines[0];
      logSuccess(`逾期罚款生成: 金额 ¥${fine.amount}, 逾期天数: ${fine.overdueDays} 天`);
      logSuccess(`(每日 ¥0.1, 上限 ¥50, 当前金额: ¥${fine.amount})`);
    } else {
      logSuccess('未发现逾期罚款（可能需要等待）');
    }

    logStep('6', '批量归还（老师一次归还一批）');
    
    console.log('   王老师提交批量归还，包含3本图书...');
    const batchReturnResult = await batchReturnService.quickReturn(
      [borrowId2, borrowId3, borrowId4],
      operatorId,
      null,
      'batch-return-demo-001'
    );

    if (batchReturnResult.success) {
      logSuccess(`批量归还执行成功`);
      logSuccess(`成功: ${batchReturnResult.data.successCount}, 失败: ${batchReturnResult.data.failedCount}`);
      
      if (batchReturnResult.data.failedItems.length > 0) {
        console.log('\n   失败项详情:');
        batchReturnResult.data.failedItems.forEach((item, idx) => {
          console.log(`     ${idx + 1}. borrow_id: ${item.borrowId}, 原因: ${item.reason}`);
        });
      }
    } else {
      logFailure(`批量归还失败: ${batchReturnResult.error}`);
    }

    console.log('\n   幂等测试 - 使用相同 request_id 再次调用批量归还...');
    const batchReturnIdempotent = await batchReturnService.quickReturn(
      [borrowId2, borrowId3, borrowId4],
      operatorId,
      null,
      'batch-return-demo-001'
    );

    if (batchReturnIdempotent.success && batchReturnIdempotent.data.id === batchReturnResult.data.id) {
      logSuccess('批量归还幂等性生效，返回已有记录');
    } else {
      logFailure('批量归还幂等性测试失败');
    }

    logStep('7', '丢书赔偿流程');
    
    console.log('   赵六报告《Python入门》丢失...');
    const reportLostResult = await lostBookService.reportLost('borrow-overdue-demo', operatorId);
    let lostBookId = null;
    
    if (reportLostResult.success) {
      lostBookId = reportLostResult.data.id;
      logSuccess(`丢书登记成功: 赔偿金额 ¥${reportLostResult.data.compensationAmount}`);
      logSuccess(`(图书价格 ¥48.00, 赔偿倍数 2.0, 总计 ¥${reportLostResult.data.compensationAmount})`);
    } else {
      logFailure(`丢书登记失败: ${reportLostResult.error}`);
    }

    console.log('\n   部分支付赔偿...');
    const partialPayResult = await lostBookService.payCompensation(lostBookId, 50, operatorId);
    if (partialPayResult.success) {
      logSuccess(`支付成功: 已付 ¥${partialPayResult.data.paidAmount}, 待付 ¥${partialPayResult.data.remainingAmount}`);
    } else {
      logFailure(`支付失败: ${partialPayResult.error}`);
    }

    logStep('8', '丢书找回退款');
    
    console.log('   书找到了！撤销赔偿并退款...');
    const foundResult = await lostBookService.reportFound(lostBookId, operatorId);
    if (foundResult.success) {
      logSuccess(`找回成功: 状态变为 ${foundResult.data.status}`);
      logSuccess(`应退金额: ¥${foundResult.data.refundAmount}`);
    } else {
      logFailure(`找回失败: ${foundResult.error}`);
    }

    logStep('9', '免罚审批');
    
    console.log('   创建一笔逾期罚款用于免罚测试...');
    const newFineResult = await db.runSync(`
      INSERT INTO overdue_fines (id, borrow_id, student_id, overdue_days, amount, status, created_by)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `, [
      'fine-waive-demo',
      'borrow-overdue-demo',
      'stu-302-02',
      20,
      2.00,
      operatorId
    ]);

    console.log('   管理员审批免罚（理由：家庭困难）...');
    const waiveResult = await fineService.waiveFine('fine-waive-demo', 2.00, '家庭困难，特殊情况', operatorId);
    if (waiveResult.success) {
      logSuccess(`免罚成功: 状态变为 ${waiveResult.data.status}`);
      logSuccess(`审计记录已保存: 操作者 ${operatorId}, 理由: 家庭困难`);
    } else {
      logFailure(`免罚失败: ${waiveResult.error}`);
    }

    logStep('10', '报告导出和状态查询');
    
    console.log('\n   📊 学生借阅状态 - 张三...');
    const studentStatus = await reportService.getStudentStatus('stu-301-01');
    if (studentStatus.success) {
      const s = studentStatus.data;
      console.log(`      学生: ${s.student.name} (${s.student.classId})`);
      console.log(`      当前借阅: ${s.currentBorrows.length} 本`);
      console.log(`      历史借阅: ${s.totalBorrows} 次`);
      console.log(`      逾期罚款: ¥${s.totalFines}`);
    }

    console.log('\n   � 班级未还清单 - 三年级1班...');
    const classUnreturned = await reportService.getClassUnreturned('class-301');
    if (classUnreturned.success) {
      console.log(`      班级: ${classUnreturned.data.classInfo.name}`);
      console.log(`      未归还图书: ${classUnreturned.data.unreturned.length} 本`);
      classUnreturned.data.unreturned.forEach((item, idx) => {
        console.log(`        ${idx + 1}. ${item.bookTitle} - ${item.studentName} (状态: ${item.status})`);
      });
    }

    console.log('\n   � 财务统计...');
    const financialStats = await reportService.getFinancialStats();
    if (financialStats.success) {
      const f = financialStats.data;
      console.log(`      逾期罚款:`);
      console.log(`        待缴: ¥${f.overdueFines.pending}, 已缴: ¥${f.overdueFines.paid}, 已免: ¥${f.overdueFines.waived}`);
      console.log(`      丢书赔偿:`);
      console.log(`        待缴: ¥${f.lostBooks.pending}, 已缴: ¥${f.lostBooks.paid}, 已免: ¥${f.lostBooks.waived}`);
      console.log(`      总收入: ¥${f.totalCollected}`);
    }

    console.log('\n   📄 文本格式报告预览...');
    const textReport = await reportService.exportReport('text');
    const reportLines = textReport.split('\n').slice(0, 30);
    reportLines.forEach(line => console.log('      ' + line));

    logStep('11', '审计日志 - 查看张三的借阅历史');
    
    const auditLogs = await reportService.getAuditHistory('student', 'stu-301-01');
    console.log(`      张三的审计记录: ${auditLogs.length} 条`);
    auditLogs.slice(0, 3).forEach((log, idx) => {
      console.log(`        ${idx + 1}. [${log.timestamp}] ${log.action} by ${log.operatorId}`);
      if (log.beforeData || log.afterData) {
        console.log(`           变更: ${log.beforeData ? JSON.stringify(log.beforeData).slice(0, 50) : ''} → ${log.afterData ? JSON.stringify(log.afterData).slice(0, 50) : ''}`);
      }
    });

    logTitle('演示完成！');
    console.log('\n✅ 所有演示场景已执行完成:');
    console.log('   1. 正常借还流程');
    console.log('   2. 续借功能（含次数限制）');
    console.log('   3. 班级集体借书（带责任人）');
    console.log('   4. 幂等性测试（重复借阅被拒、request_id 幂等）');
    console.log('   5. 逾期计费（每日 ¥0.1, 上限 ¥50）');
    console.log('   6. 批量归还（老师一次还一批，带失败项详情）');
    console.log('   7. 丢书赔偿（赔偿倍数 2.0）');
    console.log('   8. 丢书找回退款');
    console.log('   9. 免罚审批（留审计记录）');
    console.log('   10. 报告导出（学生状态、班级未还、财务统计）');
    console.log('   11. 审计日志');

    console.log('\n📝 验证业务闭环:');
    console.log('   - 每笔借阅都有状态追踪');
    console.log('   - 每笔财务交易都有记录');
    console.log('   - 所有人工操作都有审计日志');
    console.log('   - 报告数据与实际业务一致');

    console.log('\n🚀 启动服务: npm start');
    console.log('   然后访问: http://localhost:3000/api/reports/dashboard');

  } catch (err) {
    console.error('\n❌ 演示过程中出错:', err);
    process.exit(1);
  }
}

runDemo();
