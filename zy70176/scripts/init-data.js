const invoiceService = require('../src/invoiceService');

function createSampleData() {
    console.log('正在创建样例数据...\n');

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

    console.log('\n样例数据创建完成！');
    console.log('-----------------------------------');
    console.log('发票清单:');
    console.log(`  ${inv1.invoiceNumber} - 北京科技有限公司 - 1130元`);
    console.log(`  ${inv2.invoiceNumber} - 上海贸易公司 - 2825元`);
    console.log(`  ${inv3.invoiceNumber} - 广州电子科技 - 5650元`);
    console.log(`  ${inv4.invoiceNumber} - 深圳网络公司 - 904元`);
    console.log('-----------------------------------');
    console.log('\n请使用这些发票进行红冲测试。');
}

createSampleData();
