const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3000;

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function printSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function printResult(label, data) {
  console.log(`\n📌 ${label}:`);
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  console.log('🚀 开始供应商发票抵扣 API 演示...\n');

  try {
    const health = await request('GET', '/health');
    printResult('服务健康检查', health);
  } catch (e) {
    console.log('❌ 服务未启动，请先运行 npm start');
    console.log('   等待服务启动后再运行此脚本...');
    process.exit(1);
  }

  let poId, receiptId, invoiceId, invoiceId2;
  const supplierId = 'SUP001';

  printSection('场景1: 正常业务流程 - 创建采购单');
  
  const poResult = await request('POST', '/api/purchase-orders', {
    poNumber: `PO-DEMO-${Date.now()}`,
    supplierId: supplierId,
    supplierName: '演示供应商',
    totalAmount: 10000,
    taxRate: 0.13,
    items: [
      { productId: 'P001', productName: '演示商品A', quantity: 100, unitPrice: 100 }
    ]
  });
  poId = poResult.data.id;
  printResult('采购单创建成功', poResult.data);

  printSection('场景2: 创建入库单');
  
  const receiptResult = await request('POST', '/api/receipts', {
    receiptNumber: `RCP-DEMO-${Date.now()}`,
    poId: poId,
    supplierId: supplierId,
    totalAmount: 10000,
    taxAmount: 1300
  });
  receiptId = receiptResult.data.id;
  printResult('入库单创建成功', receiptResult.data);

  printSection('场景3: 查询可抵扣余额（退货前）');
  
  const deductibleBefore = await request('GET', `/api/deductible/${poId}/${supplierId}`);
  printResult('退货前可抵扣余额', deductibleBefore.data);

  printSection('场景4: 退货50%商品（测试退货未冲抵检测）');
  
  const returnResult = await request('POST', '/api/returns', {
    returnNumber: `RET-DEMO-${Date.now()}`,
    poId: poId,
    receiptId: receiptId,
    supplierId: supplierId,
    totalAmount: 5000,
    taxAmount: 650
  });
  printResult('退货单创建成功', returnResult.data);

  printSection('场景5: 查询可抵扣余额（退货后）');
  
  const deductibleAfter = await request('GET', `/api/deductible/${poId}/${supplierId}`);
  printResult('退货后可抵扣余额（已自动扣除退货金额）', deductibleAfter.data);

  printSection('场景6: 创建发票（全额发票，但货已退一半）');
  
  const invoiceResult = await request('POST', '/api/invoices', {
    invoiceNumber: `INV-DEMO-${Date.now()}`,
    supplierId: supplierId,
    supplierName: '演示供应商',
    poId: poId,
    invoiceDate: '2024-01-15',
    totalAmount: 10000,
    taxAmount: 1300,
    taxRate: 0.13
  });
  invoiceId = invoiceResult.data.id;
  printResult('发票创建成功', invoiceResult.data);

  printSection('场景7: 验证发票抵扣（超额检测）');
  
  const validation = await request('POST', '/api/deductions/validate', {
    invoiceId: invoiceId,
    poId: poId,
    supplierId: supplierId
  });
  printResult('验证结果（应该提示超额）', validation.data);

  printSection('场景8: 尝试全额抵扣（应该失败）');
  
  const deductFull = await request('POST', '/api/deductions', {
    invoiceId: invoiceId,
    poId: poId,
    supplierId: supplierId,
    amount: 10000,
    tax: 1300,
    operator: '演示财务'
  });
  printResult('全额抵扣结果（失败）', deductFull);

  printSection('场景9: 查询差异原因');
  
  const differences = await request('GET', `/api/deductions/differences?invoiceId=${invoiceId}&poId=${poId}&supplierId=${supplierId}`);
  printResult('差异原因分析', differences.data);

  printSection('场景10: 部分抵扣（按实际可抵扣金额）');
  
  const deductPartial = await request('POST', '/api/deductions', {
    invoiceId: invoiceId,
    poId: poId,
    supplierId: supplierId,
    amount: 5000,
    tax: 650,
    operator: '演示财务'
  });
  printResult('部分抵扣结果（成功）', deductPartial);

  printSection('场景11: 查询发票抵扣历史');
  
  const history = await request('GET', `/api/deductions/invoice/${invoiceId}/history`);
  printResult('抵扣历史记录', history.data);

  printSection('场景12: 创建第二张发票（测试税率不一致）');
  
  const invoice2Result = await request('POST', '/api/invoices', {
    invoiceNumber: `INV-DEMO-TAX-${Date.now()}`,
    supplierId: supplierId,
    supplierName: '演示供应商',
    poId: poId,
    invoiceDate: '2024-01-20',
    totalAmount: 5000,
    taxAmount: 450,
    taxRate: 0.09
  });
  invoiceId2 = invoice2Result.data.id;
  printResult('发票创建成功（税率9%）', invoice2Result.data);

  printSection('场景13: 验证税率不一致的发票');
  
  const validationTax = await request('POST', '/api/deductions/validate', {
    invoiceId: invoiceId2,
    poId: poId,
    supplierId: supplierId
  });
  printResult('验证结果（应该有税率警告）', validationTax.data);

  printSection('场景14: 抵扣税率不一致的发票（警告但允许）');
  
  const deductTax = await request('POST', '/api/deductions', {
    invoiceId: invoiceId2,
    poId: poId,
    supplierId: supplierId,
    amount: 3000,
    tax: 270,
    operator: '演示财务'
  });
  printResult('抵扣结果（有税率警告但成功）', deductTax);

  printSection('场景15: 测试重复导入发票');
  
  const duplicateInvoice = await request('POST', '/api/invoices', {
    invoiceNumber: invoiceResult.data.invoice_number,
    supplierId: supplierId,
    supplierName: '演示供应商',
    poId: poId,
    invoiceDate: '2024-01-15',
    totalAmount: 10000,
    taxAmount: 1300,
    taxRate: 0.13
  });
  printResult('重复导入发票结果（应该失败）', duplicateInvoice);

  printSection('场景16: 创建预付款');
  
  const prepaymentResult = await request('POST', '/api/prepayments', {
    prepaymentNumber: `PRE-DEMO-${Date.now()}`,
    poId: poId,
    supplierId: supplierId,
    amount: 2000,
    paymentDate: '2024-01-10'
  });
  printResult('预付款创建成功', prepaymentResult.data);

  printSection('场景17: 查询预付款后的可抵扣余额');
  
  const deductiblePrepay = await request('GET', `/api/deductible/${poId}/${supplierId}`);
  printResult('预付款后可抵扣余额（已扣除预付款）', deductiblePrepay.data);

  printSection('场景18: 测试重复核销');
  
  const repeatDeduct = await request('POST', '/api/deductions', {
    invoiceId: invoiceId,
    poId: poId,
    supplierId: supplierId,
    amount: 5000,
    tax: 650,
    operator: '演示财务'
  });
  printResult('重复抵扣结果', repeatDeduct);

  printSection('场景19: 查询所有发票');
  
  const allInvoices = await request('GET', '/api/invoices');
  printResult('所有发票列表', allInvoices.data);

  printSection('场景20: 查询所有抵扣记录');
  
  const allDeductions = await request('GET', '/api/deductions');
  printResult('所有抵扣记录', allDeductions.data);

  console.log('\n' + '🎉'.repeat(20));
  console.log('  演示完成！');
  console.log('  请查看上方的各个场景输出');
  console.log('🎉'.repeat(20) + '\n');

  console.log('📋 已测试的业务规则:');
  console.log('   ✅ 1. 退货自动冲抵可抵扣金额');
  console.log('   ✅ 2. 发票金额超额检测');
  console.log('   ✅ 3. 税率不一致警告');
  console.log('   ✅ 4. 发票重复导入检测');
  console.log('   ✅ 5. 重复核销检测');
  console.log('   ✅ 6. 预付款自动扣除');
  console.log('   ✅ 7. 差异原因查询');
  console.log('   ✅ 8. 抵扣历史追踪\n');
}

main().catch(console.error);
