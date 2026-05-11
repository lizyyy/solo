const http = require('http');
const { sequelize, Supplier, ToleranceRule } = require('../src/models');
const PurchaseOrderService = require('../src/services/PurchaseOrderService');
const ArrivalService = require('../src/services/ArrivalService');
const InspectionService = require('../src/services/InspectionService');
const DiscrepancyService = require('../src/services/DiscrepancyService');
const InventoryService = require('../src/services/InventoryService');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  console.log(` ${title}`);
  console.log('='.repeat(70));
}

function logStep(step, description) {
  console.log(`\n[步骤 ${step}] ${description}`);
}

function logResult(message, data = null) {
  console.log(`  ✓ ${message}`);
  if (data) {
    console.log(`    详情: ${JSON.stringify(data, null, 2)}`);
  }
}

async function initTestData() {
  await sequelize.sync({ force: true });
  
  const supplierA = await Supplier.create({
    name: '优质供应商A',
    code: 'SUP-A-001',
    contact: '王经理',
    phone: '13900139001'
  });
  
  const supplierB = await Supplier.create({
    name: '普通供应商B',
    code: 'SUP-B-002',
    contact: '李经理',
    phone: '13900139002'
  });
  
  await ToleranceRule.create({
    ruleName: '默认容差规则',
    toleranceType: 'percentage',
    toleranceValue: 5,
    isDefault: true
  });
  
  await ToleranceRule.create({
    ruleName: '原材料A容差',
    productCode: 'MAT-A-001',
    toleranceType: 'quantity',
    toleranceValue: 2
  });
  
  logResult('测试数据初始化完成');
  
  return { supplierA, supplierB };
}

async function flow1_NormalArrival(supplierA) {
  logSection('流程一：正常到货 - 完全符合采购单，无差异，直接入库');
  
  logStep('1.1', '创建采购单');
  const poData = {
    poNo: 'PO-2026-001',
    supplierId: supplierA.id,
    items: [
      {
        productCode: 'MAT-A-001',
        productName: '原材料A',
        spec: '规格100',
        quantity: 100,
        unitPrice: 10.5
      }
    ]
  };
  const po = await PurchaseOrderService.create(poData, 'USER-001');
  logResult('采购单创建成功', { 
    poNo: po.poNo, 
    status: po.status, 
    itemsCount: po.items.length 
  });
  
  logStep('1.2', '登记到货单（与采购单数量一致）');
  const arrivalData = {
    arrivalNo: 'ARR-2026-001',
    poNo: 'PO-2026-001',
    supplierId: supplierA.id,
    items: [
      {
        poItemId: po.items[0].id,
        quantity: 100,
        spec: '规格100',
        batchNo: 'BATCH-001'
      }
    ]
  };
  const arrivalResult = await ArrivalService.create(arrivalData, 'USER-002');
  logResult('到货单登记成功', { 
    arrivalNo: arrivalResult.arrivalNote.arrivalNo, 
    isDuplicate: arrivalResult.isDuplicate 
  });
  
  logStep('1.3', '验收到货（完全符合，无差异）');
  const inspectionData = {
    arrivalNoteId: arrivalResult.arrivalNote.id,
    inspectorId: 'INS-001',
    inspectorName: '质检员张三',
    items: [
      {
        arrivalNoteItemId: arrivalResult.arrivalNote.items[0].id,
        qualifiedQuantity: 100,
        defectQuantity: 0
      }
    ]
  };
  const inspectionResult = await InspectionService.inspect(inspectionData);
  logResult('验收完成', { 
    discrepancyType: inspectionResult.results[0].discrepancyInfo.discrepancyType,
    isWithinTolerance: inspectionResult.results[0].discrepancyInfo.isWithinTolerance
  });
  
  logStep('1.4', '创建差异处理记录（正常处理）');
  const handling = await DiscrepancyService.createHandling(
    inspectionResult.results[0].id,
    'normal',
    100,
    '正常到货，无差异',
    false
  );
  logResult('差异处理记录创建（无差异）', { 
    handlingType: handling.handlingType,
    approvalStatus: handling.approvalStatus
  });
  
  logStep('1.5', '入库操作');
  const stockInResult = await InventoryService.stockIn(
    arrivalResult.arrivalNote.id,
    'WAREHOUSE-001',
    'A区-01货架'
  );
  logResult('入库成功', { 
    stockedCount: stockInResult.items.length,
    items: stockInResult.items.map(i => ({
      product: i.productName,
      quantity: i.quantity
    }))
  });
  
  logStep('1.6', '验证库存');
  const inventory = await InventoryService.getInventory({ productCode: 'MAT-A-001' });
  logResult('库存验证', { 
    product: inventory[0].productName,
    spec: inventory[0].spec,
    quantity: inventory[0].quantity
  });
  
  return { po, arrivalResult, inspectionResult };
}

async function flow2_ShortagePending(supplierA) {
  logSection('流程二：短到待补 - 供应商少送，创建待补记录，等待补货');
  
  logStep('2.1', '创建采购单');
  const poData = {
    poNo: 'PO-2026-002',
    supplierId: supplierA.id,
    items: [
      {
        productCode: 'MAT-B-002',
        productName: '原材料B',
        spec: '标准规格',
        quantity: 100,
        unitPrice: 20.0
      }
    ]
  };
  const po = await PurchaseOrderService.create(poData, 'USER-001');
  logResult('采购单创建成功', { poNo: po.poNo });
  
  logStep('2.2', '登记到货单（少送20箱，超出5%容差）');
  const arrivalData = {
    arrivalNo: 'ARR-2026-002',
    poNo: 'PO-2026-002',
    supplierId: supplierA.id,
    items: [
      {
        poItemId: po.items[0].id,
        quantity: 80,
        spec: '标准规格',
        batchNo: 'BATCH-002'
      }
    ]
  };
  const arrivalResult = await ArrivalService.create(arrivalData, 'USER-002');
  logResult('到货单登记成功');
  
  logStep('2.3', '验收（检测到短到差异）');
  const inspectionData = {
    arrivalNoteId: arrivalResult.arrivalNote.id,
    inspectorId: 'INS-001',
    inspectorName: '质检员张三',
    items: [
      {
        arrivalNoteItemId: arrivalResult.arrivalNote.items[0].id,
        qualifiedQuantity: 80,
        defectQuantity: 0
      }
    ]
  };
  const inspectionResult = await InspectionService.inspect(inspectionData);
  logResult('验收发现短到', { 
    ordered: inspectionResult.results[0].discrepancyInfo.orderedQuantity,
    received: inspectionResult.results[0].discrepancyInfo.receivedQuantity,
    discrepancy: inspectionResult.results[0].discrepancyInfo.discrepancyType,
    quantity: inspectionResult.results[0].discrepancyInfo.discrepancyQuantity
  });
  
  logStep('2.4', '创建待补处理（需要审批）');
  const handling = await DiscrepancyService.createHandling(
    inspectionResult.results[0].id,
    'shortage_pending',
    80,
    '少送20箱，要求供应商补货',
    true
  );
  logResult('待补处理创建', { 
    handlingType: handling.handlingType,
    approvalStatus: handling.approvalStatus
  });
  
  logStep('2.5', '审批通过待补处理');
  const approved = await DiscrepancyService.approve(
    handling.id,
    'MGR-001',
    '采购经理王总',
    true,
    '同意待补，已通知供应商'
  );
  logResult('审批完成', { 
    approver: approved.approverName,
    approvalStatus: approved.approvalStatus,
    approvalTime: approved.approvalTime
  });
  
  logStep('2.6', '入库已到货的80箱');
  const stockInResult = await InventoryService.stockIn(
    arrivalResult.arrivalNote.id,
    'WAREHOUSE-001',
    'A区-02货架'
  );
  logResult('80箱已入库，20箱待补', { 
    stockedQuantity: stockInResult.items[0].quantity
  });
  
  logStep('2.7', '查看审计追溯信息');
  const auditTrail = await DiscrepancyService.getAuditTrail(inspectionResult.results[0].id);
  logResult('审计追溯', {
    inspector: auditTrail.inspectorName,
    inspectionTime: auditTrail.inspectionTime,
    approver: auditTrail.approverName,
    approvalTime: auditTrail.approvalTime
  });
  
  return { po, arrivalResult, inspectionResult };
}

async function flow3_OverageConcession(supplierB) {
  logSection('流程三：溢到让步接收 - 供应商多送，申请让步接收，审批后入库');
  
  logStep('3.1', '创建采购单');
  const poData = {
    poNo: 'PO-2026-003',
    supplierId: supplierB.id,
    items: [
      {
        productCode: 'MAT-C-003',
        productName: '原材料C',
        spec: '大型',
        quantity: 50,
        unitPrice: 50.0
      }
    ]
  };
  const po = await PurchaseOrderService.create(poData, 'USER-001');
  logResult('采购单创建成功', { poNo: po.poNo });
  
  logStep('3.2', '登记到货单（多送10箱，超出5%容差）');
  const arrivalData = {
    arrivalNo: 'ARR-2026-003',
    poNo: 'PO-2026-003',
    supplierId: supplierB.id,
    items: [
      {
        poItemId: po.items[0].id,
        quantity: 60,
        spec: '大型',
        batchNo: 'BATCH-003'
      }
    ]
  };
  const arrivalResult = await ArrivalService.create(arrivalData, 'USER-002');
  logResult('到货单登记成功');
  
  logStep('3.3', '验收（检测到溢到差异）');
  const inspectionData = {
    arrivalNoteId: arrivalResult.arrivalNote.id,
    inspectorId: 'INS-002',
    inspectorName: '质检员李四',
    items: [
      {
        arrivalNoteItemId: arrivalResult.arrivalNote.items[0].id,
        qualifiedQuantity: 60,
        defectQuantity: 0
      }
    ]
  };
  const inspectionResult = await InspectionService.inspect(inspectionData);
  logResult('验收发现溢到', { 
    ordered: inspectionResult.results[0].discrepancyInfo.orderedQuantity,
    received: inspectionResult.results[0].discrepancyInfo.receivedQuantity,
    discrepancy: inspectionResult.results[0].discrepancyInfo.discrepancyType
  });
  
  logStep('3.4', '发起让步接收申请');
  const handling = await DiscrepancyService.createHandling(
    inspectionResult.results[0].id,
    'concession',
    60,
    '多送10箱，申请让步接收，按实际数量结算',
    true
  );
  logResult('让步接收申请创建', { 
    handlingType: handling.handlingType,
    approvalStatus: handling.approvalStatus
  });
  
  logStep('3.5', '审批让步接收');
  const approved = await DiscrepancyService.approve(
    handling.id,
    'DIR-001',
    '仓库总监陈总',
    true,
    '同意让步接收，按60箱结算'
  );
  logResult('审批通过');
  
  logStep('3.6', '入库60箱（含让步接收的10箱）');
  const stockInResult = await InventoryService.stockIn(
    arrivalResult.arrivalNote.id,
    'WAREHOUSE-002',
    'B区-01货架'
  );
  logResult('入库成功（含让步接收）', { 
    quantity: stockInResult.items[0].quantity
  });
  
  return { po, arrivalResult, inspectionResult };
}

async function flow4_RejectNoStockIn(supplierB) {
  logSection('流程四：规格不符拒收 - 供应商送错规格，拒收退回，不入库');
  
  logStep('4.1', '创建采购单');
  const poData = {
    poNo: 'PO-2026-004',
    supplierId: supplierB.id,
    items: [
      {
        productCode: 'MAT-D-004',
        productName: '原材料D',
        spec: '型号X',
        quantity: 30,
        unitPrice: 100.0
      }
    ]
  };
  const po = await PurchaseOrderService.create(poData, 'USER-001');
  logResult('采购单创建成功（型号X）', { poNo: po.poNo });
  
  logStep('4.2', '登记到货单（送错规格：型号Y）');
  const arrivalData = {
    arrivalNo: 'ARR-2026-004',
    poNo: 'PO-2026-004',
    supplierId: supplierB.id,
    items: [
      {
        poItemId: po.items[0].id,
        quantity: 30,
        spec: '型号Y',
        batchNo: 'BATCH-004'
      }
    ]
  };
  const arrivalResult = await ArrivalService.create(arrivalData, 'USER-002');
  logResult('到货单登记（送错规格）');
  
  logStep('4.3', '验收（检测到规格不符）');
  const inspectionData = {
    arrivalNoteId: arrivalResult.arrivalNote.id,
    inspectorId: 'INS-002',
    inspectorName: '质检员李四',
    items: [
      {
        arrivalNoteItemId: arrivalResult.arrivalNote.items[0].id,
        qualifiedQuantity: 30,
        defectQuantity: 0,
        spec: '型号Y'
      }
    ]
  };
  const inspectionResult = await InspectionService.inspect(inspectionData);
  logResult('验收发现规格不符', { 
    orderedSpec: inspectionResult.results[0].discrepancyInfo.orderedSpec,
    receivedSpec: inspectionResult.results[0].discrepancyInfo.receivedSpec,
    discrepancy: inspectionResult.results[0].discrepancyInfo.discrepancyType
  });
  
  logStep('4.4', '创建拒收处理');
  const handling = await DiscrepancyService.createHandling(
    inspectionResult.results[0].id,
    'reject',
    0,
    '规格不符，拒收退回供应商',
    true
  );
  logResult('拒收处理创建', { 
    handlingType: handling.handlingType,
    approvalStatus: handling.approvalStatus
  });
  
  logStep('4.5', '审批拒收');
  const approved = await DiscrepancyService.approve(
    handling.id,
    'DIR-001',
    '仓库总监陈总',
    true,
    '同意拒收，已联系供应商退货'
  );
  logResult('审批通过拒收');
  
  logStep('4.6', '尝试入库（应该失败）');
  try {
    await InventoryService.stockIn(
      arrivalResult.arrivalNote.id,
      'WAREHOUSE-002',
      'B区-02货架'
    );
    logResult('错误：入库应该失败！');
  } catch (error) {
    logResult('入库被正确阻止', { reason: error.message });
  }
  
  logStep('4.7', '验证库存（应该没有原材料D）');
  const inventory = await InventoryService.getInventory({ productCode: 'MAT-D-004' });
  logResult('库存验证', { 
    hasInventory: inventory.length > 0,
    count: inventory.length
  });
  
  return { po, arrivalResult, inspectionResult };
}

async function flow5_IdempotencyTest(supplierA) {
  logSection('流程五：幂等性测试 - 重复提交到货单，系统返回已有记录');
  
  logStep('5.1', '创建采购单');
  const poData = {
    poNo: 'PO-2026-005',
    supplierId: supplierA.id,
    items: [
      {
        productCode: 'MAT-E-005',
        productName: '原材料E',
        spec: '标准',
        quantity: 200,
        unitPrice: 15.0
      }
    ]
  };
  const po = await PurchaseOrderService.create(poData, 'USER-001');
  logResult('采购单创建成功');
  
  logStep('5.2', '第一次提交到货单');
  const arrivalData = {
    arrivalNo: 'ARR-2026-005',
    poNo: 'PO-2026-005',
    supplierId: supplierA.id,
    items: [
      {
        poItemId: po.items[0].id,
        quantity: 200,
        spec: '标准',
        batchNo: 'BATCH-005'
      }
    ]
  };
  const result1 = await ArrivalService.create(arrivalData, 'USER-002');
  logResult('第一次到货登记', { 
    isDuplicate: result1.isDuplicate,
    arrivalNo: result1.arrivalNote.arrivalNo
  });
  
  logStep('5.3', '第二次提交相同到货单（测试幂等性）');
  const result2 = await ArrivalService.create(arrivalData, 'USER-003');
  logResult('第二次到货登记（幂等性）', { 
    isDuplicate: result2.isDuplicate,
    sameId: result1.arrivalNote.id === result2.arrivalNote.id
  });
  
  return { po, result1, result2 };
}

async function queryStatistics() {
  logSection('查询统计：供应商差异分析');
  
  logStep('统计1', '查询所有供应商差异统计');
  const stats = await DiscrepancyService.getSupplierStatistics();
  logResult('供应商差异统计', {
    totalSuppliers: stats.length,
    details: stats.map(s => ({
      supplierId: s.supplierId,
      discrepancyCount: s.discrepancyCount,
      totalAmount: s.totalAmount.toFixed(2),
      pendingApproval: s.pendingApproval
    }))
  });
  
  logStep('统计2', '查询待处理差异清单');
  const pending = await DiscrepancyService.listPending();
  logResult('待处理差异清单', {
    pendingCount: pending.length
  });
}

async function main() {
  console.log('\n🚀 供应商到货短溢 API - 样例流程演示\n');
  
  try {
    const { supplierA, supplierB } = await initTestData();
    
    await sleep(500);
    await flow1_NormalArrival(supplierA);
    
    await sleep(500);
    await flow2_ShortagePending(supplierA);
    
    await sleep(500);
    await flow3_OverageConcession(supplierB);
    
    await sleep(500);
    await flow4_RejectNoStockIn(supplierB);
    
    await sleep(500);
    await flow5_IdempotencyTest(supplierA);
    
    await sleep(500);
    await queryStatistics();
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ 所有样例流程演示完成！');
    console.log('='.repeat(70));
    console.log('\n涵盖的场景：');
    console.log('  1. 正常到货 - 无差异直接入库');
    console.log('  2. 短到待补 - 少送，创建待补记录');
    console.log('  3. 溢到让步接收 - 多送，审批后入库');
    console.log('  4. 规格不符拒收 - 送错规格，拒收不入库');
    console.log('  5. 幂等性 - 重复到货单返回已有记录');
    console.log('\n核心特性：');
    console.log('  ✓ 容差规则判断（百分比/数量）');
    console.log('  ✓ 审批流程控制（未经审批不能入库）');
    console.log('  ✓ 幂等性机制（重复到货单处理）');
    console.log('  ✓ 审计追溯（验收人/审批人记录）');
    console.log('  ✓ 供应商差异统计（次数/金额/待处理）');
    console.log('\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试流程出错:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
