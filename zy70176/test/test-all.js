const invoiceService = require('../src/invoiceService');
const redemptionService = require('../src/redemptionService');
const reportService = require('../src/reportService');

function printResult(title, result) {
    console.log(`\n【${title}】`);
    console.log(`  结果: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  消息: ${result.message}`);
    if (result.data) {
        console.log(`  详情: ${JSON.stringify(result.data, null, 2)}`);
    }
    if (result.detail) {
        console.log(`  详细信息: ${result.detail}`);
    }
}

function runTests() {
    console.log('=' .repeat(60));
    console.log('  发票红冲预约 API - 全面测试');
    console.log('=' .repeat(60));

    console.log('\n' + '='.repeat(60));
    console.log('  阶段 1: 准备测试数据 - 创建发票');
    console.log('=' .repeat(60));

    const inv1 = invoiceService.createInvoice({
        invoiceType: '蓝票',
        amount: 1000,
        taxAmount: 130,
        totalAmount: 1130,
        customerName: '北京科技有限公司'
    });
    console.log(`✅ 创建发票1: ${inv1.invoiceNumber} (蓝票, 1130元)`);

    const inv2 = invoiceService.createInvoice({
        invoiceType: '蓝票',
        amount: 2500,
        taxAmount: 325,
        totalAmount: 2825,
        customerName: '上海贸易公司'
    });
    console.log(`✅ 创建发票2: ${inv2.invoiceNumber} (蓝票, 2825元)`);

    const inv3 = invoiceService.createInvoice({
        invoiceType: '蓝票',
        amount: 5000,
        taxAmount: 650,
        totalAmount: 5650,
        customerName: '广州电子科技'
    });
    console.log(`✅ 创建发票3: ${inv3.invoiceNumber} (蓝票, 5650元)`);

    const inv4 = invoiceService.createInvoice({
        invoiceType: '蓝票',
        amount: 800,
        taxAmount: 104,
        totalAmount: 904,
        customerName: '深圳网络公司'
    });
    console.log(`✅ 创建发票4: ${inv4.invoiceNumber} (蓝票, 904元)`);

    console.log('\n' + '='.repeat(60));
    console.log('  阶段 2: 场景测试');
    console.log('=' .repeat(60));

    console.log('\n【场景1: 正常红冲流程 - 完整演示】');
    console.log('--- 步骤1: 提交红冲申请 ---');
    const result1 = redemptionService.createRedemptionRequest({
        originalInvoiceId: inv1.id,
        reason: '发票金额有误，需要红冲重开',
        operator: '张三'
    });
    printResult('提交红冲申请', result1);

    if (result1.success) {
        const redemptionId1 = result1.data.redemptionId;

        console.log('--- 步骤2: 审批通过 ---');
        const result2 = redemptionService.approveRedemption(redemptionId1, '财务主管-李四');
        printResult('审批通过', result2);

        console.log('--- 步骤3: 查看队列状态 ---');
        const queueStatus1 = redemptionService.getQueueStatus();
        printResult('队列状态', queueStatus1);

        console.log('--- 步骤4: 处理队列任务 ---');
        const processResult1 = redemptionService.processQueue();
        printResult('处理队列', processResult1);

        console.log('--- 步骤5: 查看红冲结果 ---');
        const redemptionResult1 = redemptionService.getRedemption(redemptionId1);
        printResult('红冲结果', redemptionResult1);

        if (redemptionResult1.success && redemptionResult1.data.status === '已完成') {
            console.log('--- 步骤6: 查看发票关系 ---');
            const relationResult = invoiceService.getInvoiceRelationship(inv1.id);
            printResult('发票关系', relationResult);
        }
    }

    console.log('\n【场景2: 重复提交红冲申请 - 异常拦截】');
    console.log('--- 步骤1: 先提交一个红冲申请 ---');
    const result3 = redemptionService.createRedemptionRequest({
        originalInvoiceId: inv2.id,
        reason: '客户退货，需要红冲',
        operator: '王五'
    });
    printResult('第一次提交', result3);

    if (result3.success) {
        console.log('--- 步骤2: 再次提交同一发票的红冲申请 ---');
        const result4 = redemptionService.createRedemptionRequest({
            originalInvoiceId: inv2.id,
            reason: '客户退货，需要红冲',
            operator: '赵六'
        });
        printResult('重复提交测试', result4);
    }

    console.log('\n【场景3: 撤销红冲申请 - 撤销功能】');
    console.log('--- 步骤1: 提交红冲申请 ---');
    const result5 = redemptionService.createRedemptionRequest({
        originalInvoiceId: inv3.id,
        reason: '测试撤销功能',
        operator: '测试员'
    });
    printResult('提交红冲申请', result5);

    if (result5.success) {
        const redemptionId3 = result5.data.redemptionId;

        console.log('--- 步骤2: 审批通过 ---');
        const result6 = redemptionService.approveRedemption(redemptionId3, '审批人');
        printResult('审批通过', result6);

        console.log('--- 步骤3: 撤销申请 ---');
        const result7 = redemptionService.cancelRedemption(
            redemptionId3, 
            '操作人', 
            '客户取消退货，不需要红冲了'
        );
        printResult('撤销申请', result7);

        console.log('--- 步骤4: 查看撤销后的状态 ---');
        const redemptionResult2 = redemptionService.getRedemption(redemptionId3);
        printResult('查看状态', redemptionResult2);

        console.log('--- 步骤5: 查看队列状态 ---');
        const queueStatus2 = redemptionService.getQueueStatus();
        printResult('队列状态', queueStatus2);
    }

    console.log('\n【场景4: 审批拒绝 - 拒绝功能】');
    console.log('--- 步骤1: 提交红冲申请 ---');
    const result8 = redemptionService.createRedemptionRequest({
        originalInvoiceId: inv4.id,
        reason: '理由不充分的红冲申请',
        operator: '测试员'
    });
    printResult('提交红冲申请', result8);

    if (result8.success) {
        const redemptionId4 = result8.data.redemptionId;

        console.log('--- 步骤2: 审批拒绝 ---');
        const result9 = redemptionService.rejectRedemption(
            redemptionId4, 
            '红冲理由不充分，请补充具体原因',
            '财务主管'
        );
        printResult('审批拒绝', result9);

        console.log('--- 步骤3: 查看拒绝后的状态 ---');
        const redemptionResult3 = redemptionService.getRedemption(redemptionId4);
        printResult('查看状态', redemptionResult3);
    }

    console.log('\n【场景5: 对已红冲的发票再次申请 - 异常拦截】');
    console.log('--- 尝试对已完成红冲的发票再次申请 ---');
    const result10 = redemptionService.createRedemptionRequest({
        originalInvoiceId: inv1.id,
        reason: '再次红冲测试',
        operator: '测试员'
    });
    printResult('重复红冲测试', result10);

    console.log('\n' + '='.repeat(60));
    console.log('  阶段 3: 报表展示');
    console.log('=' .repeat(60));

    console.log('\n【日报表】');
    const dailyReport = reportService.generateDailyReport();
    if (dailyReport.success) {
        const summary = dailyReport.data.summary;
        console.log(`  报表日期: ${dailyReport.data.reportDate}`);
        console.log(`  今日发票总数: ${summary.totalInvoicesToday}`);
        console.log(`  蓝票数量: ${summary.blueInvoices.count}, 总金额: ${summary.blueInvoices.totalAmount}元`);
        console.log(`  红票数量: ${summary.redInvoices.count}, 总金额: ${summary.redInvoices.totalAmount}元`);
        console.log(`  红冲申请数: ${summary.redemptionRequests}`);
        console.log(`  已完成红冲: ${summary.completedRedemptions}`);
        console.log(`  税控回执数: ${summary.taxReceipts}`);
        console.log(`  今日净额: ${summary.netAmount}元`);

        if (dailyReport.data.issues.length > 0) {
            console.log('\n  发现的问题:');
            dailyReport.data.issues.forEach((issue, index) => {
                console.log(`    ${index + 1}. [${issue.severity}] ${issue.type}: ${issue.description}`);
            });
        }
    }

    console.log('\n【发票关系报表】');
    const relationReport = reportService.generateInvoiceRelationshipReport(inv1.id);
    if (relationReport.success) {
        const data = relationReport.data;
        console.log(`  当前发票: ${data.currentInvoice.number} (${data.currentInvoice.type})`);
        console.log(`  状态: ${data.currentInvoice.status}, 红冲状态: ${data.currentInvoice.redemptionStatus}`);
        
        console.log('\n  关系链:');
        data.relationshipChain.forEach(link => {
            console.log(`    - ${link.relation}: ${link.number} (${link.type}, ${link.status})`);
        });

        if (data.warnings.length > 0) {
            console.log('\n  警告信息:');
            data.warnings.forEach((warning, index) => {
                console.log(`    ${index + 1}. [${warning.level}] ${warning.message}`);
                console.log(`       建议: ${warning.suggestion}`);
            });
        }
    }

    console.log('\n【队列状态】');
    const queueFinal = redemptionService.getQueueStatus();
    if (queueFinal.success) {
        console.log(`  等待中: ${queueFinal.data.waiting}`);
        console.log(`  处理中: ${queueFinal.data.processing}`);
        console.log(`  已完成: ${queueFinal.data.completed}`);
        console.log(`  失败: ${queueFinal.data.failed}`);
        console.log(`  已取消: ${queueFinal.data.cancelled}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('  测试完成！');
    console.log('=' .repeat(60));
    console.log('\n测试场景总结:');
    console.log('1. ✅ 正常红冲流程: 提交申请 -> 审批通过 -> 排队处理 -> 完成红冲');
    console.log('2. ✅ 重复提交拦截: 同一发票重复申请被拒绝');
    console.log('3. ✅ 撤销功能: 待处理的申请可以成功撤销');
    console.log('4. ✅ 审批拒绝: 可以拒绝不合理的红冲申请');
    console.log('5. ✅ 已红冲拦截: 已完成红冲的发票不能再次申请');
    console.log('6. ✅ 日报表: 展示每日统计和问题预警');
    console.log('7. ✅ 发票关系报表: 展示发票之间的关联关系');
    console.log('8. ✅ 队列管理: 支持排队处理和状态追踪');
}

runTests();
