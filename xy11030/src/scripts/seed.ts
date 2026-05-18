import { initDatabase } from '../database';
import { createReissueOrder, updateReissueStatus } from '../services/reissueService';
import { CreateReissueOrderRequest, ReissueStatus, IssueType } from '../types';

const seedData = async () => {
  console.log('开始填充样例数据...');

  await initDatabase();

  const normalOrder: CreateReissueOrderRequest = {
    groupBuyCode: 'GB202405001',
    groupBuyName: '2024年5月新鲜水果团购',
    leaderId: 'LD001',
    leaderName: '张三',
    leaderPhone: '13800138001',
    warehouseCode: 'WH001',
    warehouseName: '北京朝阳仓库',
    originalOrderNo: 'ORD20240501001',
    originalOrderDate: '2024-05-01',
    remark: '正常状态订单',
    createdBy: 'admin',
    items: [
      {
        productCode: 'PRD001',
        productName: '红富士苹果',
        skuCode: 'SKU001',
        skuName: '5斤装/袋',
        issueType: IssueType.MISSING,
        originalQuantity: 10,
        issueQuantity: 2,
        reissueQuantity: 2,
        unitPrice: 29.9,
        remark: '配送时少2袋苹果'
      }
    ]
  };

  const order1 = await createReissueOrder(normalOrder);
  console.log('✅ 创建正常状态订单:', order1.orderNo);

  const processingOrder: CreateReissueOrderRequest = {
    groupBuyCode: 'GB202405001',
    groupBuyName: '2024年5月新鲜水果团购',
    leaderId: 'LD002',
    leaderName: '李四',
    leaderPhone: '13800138002',
    warehouseCode: 'WH001',
    warehouseName: '北京朝阳仓库',
    originalOrderNo: 'ORD20240501002',
    originalOrderDate: '2024-05-01',
    remark: '处理中状态订单',
    createdBy: 'admin',
    items: [
      {
        productCode: 'PRD002',
        productName: '进口香蕉',
        skuCode: 'SKU002',
        skuName: '3斤装/把',
        issueType: IssueType.WRONG,
        originalQuantity: 5,
        issueQuantity: 1,
        reissueQuantity: 1,
        unitPrice: 19.9,
        remark: '发成了普通香蕉'
      },
      {
        productCode: 'PRD003',
        productName: '赣南脐橙',
        skuCode: 'SKU003',
        skuName: '10斤装/箱',
        issueType: IssueType.MISSING,
        originalQuantity: 3,
        issueQuantity: 1,
        reissueQuantity: 1,
        unitPrice: 39.9,
        remark: '缺少1箱橙子'
      }
    ]
  };

  const order2 = await createReissueOrder(processingOrder);
  await updateReissueStatus(order2.id, {
    status: ReissueStatus.PROCESSING,
    operatorId: 'op001',
    operatorName: '操作员A',
    remark: '开始处理补发'
  });
  console.log('✅ 创建处理中状态订单:', order2.orderNo);

  const rejectedOrder: CreateReissueOrderRequest = {
    groupBuyCode: 'GB202405002',
    groupBuyName: '2024年5月蔬菜团购',
    leaderId: 'LD003',
    leaderName: '王五',
    leaderPhone: '13800138003',
    warehouseCode: 'WH002',
    warehouseName: '上海浦东仓库',
    originalOrderNo: 'ORD20240502001',
    originalOrderDate: '2024-05-02',
    remark: '驳回状态订单',
    createdBy: 'admin',
    items: [
      {
        productCode: 'PRD004',
        productName: '有机番茄',
        skuCode: 'SKU004',
        skuName: '2斤装/盒',
        issueType: IssueType.DAMAGED,
        originalQuantity: 10,
        issueQuantity: 3,
        reissueQuantity: 3,
        unitPrice: 25.9,
        remark: '运输过程中有3盒损坏'
      }
    ]
  };

  const order3 = await createReissueOrder(rejectedOrder);
  await updateReissueStatus(order3.id, {
    status: ReissueStatus.REVIEWING,
    operatorId: 'op001',
    operatorName: '操作员A',
    remark: '提交复核'
  });
  await updateReissueStatus(order3.id, {
    status: ReissueStatus.REJECTED,
    operatorId: 'mgr001',
    operatorName: '经理A',
    remark: '驳回：缺少照片证明，请补充凭证后重新提交'
  });
  console.log('✅ 创建驳回状态订单:', order3.orderNo);

  const supplementedOrder: CreateReissueOrderRequest = {
    groupBuyCode: 'GB202405002',
    groupBuyName: '2024年5月蔬菜团购',
    leaderId: 'LD004',
    leaderName: '赵六',
    leaderPhone: '13800138004',
    warehouseCode: 'WH002',
    warehouseName: '上海浦东仓库',
    originalOrderNo: 'ORD20240502002',
    originalOrderDate: '2024-05-02',
    remark: '已补录状态订单',
    createdBy: 'admin',
    items: [
      {
        productCode: 'PRD005',
        productName: '有机黄瓜',
        skuCode: 'SKU005',
        skuName: '3斤装/包',
        issueType: IssueType.EXPIRED,
        originalQuantity: 8,
        issueQuantity: 2,
        reissueQuantity: 2,
        unitPrice: 15.9,
        remark: '收到时有2包已过期'
      }
    ]
  };

  const order4 = await createReissueOrder(supplementedOrder);
  await updateReissueStatus(order4.id, {
    status: ReissueStatus.PROCESSING,
    operatorId: 'op001',
    operatorName: '操作员A',
    remark: '开始处理'
  });
  await updateReissueStatus(order4.id, {
    status: ReissueStatus.SUPPLEMENTED,
    operatorId: 'op001',
    operatorName: '操作员A',
    remark: '已补录物流单号：SF1234567890'
  });
  console.log('✅ 创建已补录状态订单:', order4.orderNo);

  const completedOrder: CreateReissueOrderRequest = {
    groupBuyCode: 'GB202405003',
    groupBuyName: '2024年5月肉禽蛋团购',
    leaderId: 'LD005',
    leaderName: '孙七',
    leaderPhone: '13800138005',
    warehouseCode: 'WH003',
    warehouseName: '广州天河仓库',
    originalOrderNo: 'ORD20240503001',
    originalOrderDate: '2024-05-03',
    remark: '已完成状态订单',
    createdBy: 'admin',
    items: [
      {
        productCode: 'PRD006',
        productName: '土鸡蛋',
        skuCode: 'SKU006',
        skuName: '30枚/盒',
        issueType: IssueType.MISSING,
        originalQuantity: 5,
        issueQuantity: 1,
        reissueQuantity: 1,
        unitPrice: 35.9,
        remark: '少发1盒鸡蛋'
      },
      {
        productCode: 'PRD007',
        productName: '散养土鸡',
        skuCode: 'SKU007',
        skuName: '整只约2斤',
        issueType: IssueType.WRONG,
        originalQuantity: 2,
        issueQuantity: 1,
        reissueQuantity: 1,
        unitPrice: 59.9,
        remark: '发成了冷冻鸡，不是新鲜的'
      }
    ]
  };

  const order5 = await createReissueOrder(completedOrder);
  await updateReissueStatus(order5.id, {
    status: ReissueStatus.PROCESSING,
    operatorId: 'op002',
    operatorName: '操作员B',
    remark: '开始处理补发'
  });
  await updateReissueStatus(order5.id, {
    status: ReissueStatus.REVIEWING,
    operatorId: 'op002',
    operatorName: '操作员B',
    remark: '补发完成，提交复核'
  });
  await updateReissueStatus(order5.id, {
    status: ReissueStatus.COMPLETED,
    operatorId: 'mgr002',
    operatorName: '经理B',
    remark: '复核通过，补发完成，团长已签收'
  });
  console.log('✅ 创建已完成状态订单:', order5.orderNo);

  const mixedOrder: CreateReissueOrderRequest = {
    groupBuyCode: 'GB202405001',
    groupBuyName: '2024年5月新鲜水果团购',
    leaderId: 'LD006',
    leaderName: '周八',
    leaderPhone: '13800138006',
    warehouseCode: 'WH001',
    warehouseName: '北京朝阳仓库',
    originalOrderNo: 'ORD20240501003',
    originalOrderDate: '2024-05-01',
    remark: '错发缺件混合订单 - 测试用例',
    createdBy: 'admin',
    items: [
      {
        productCode: 'PRD001',
        productName: '红富士苹果',
        skuCode: 'SKU001',
        skuName: '5斤装/袋',
        issueType: IssueType.MISSING,
        originalQuantity: 20,
        issueQuantity: 3,
        reissueQuantity: 3,
        unitPrice: 29.9,
        remark: '缺件：少3袋苹果'
      },
      {
        productCode: 'PRD002',
        productName: '进口香蕉',
        skuCode: 'SKU002',
        skuName: '3斤装/把',
        issueType: IssueType.WRONG,
        originalQuantity: 10,
        issueQuantity: 2,
        reissueQuantity: 2,
        unitPrice: 19.9,
        remark: '错发：发成了国产普通香蕉'
      },
      {
        productCode: 'PRD003',
        productName: '赣南脐橙',
        skuCode: 'SKU003',
        skuName: '10斤装/箱',
        issueType: IssueType.DAMAGED,
        originalQuantity: 5,
        issueQuantity: 1,
        reissueQuantity: 1,
        unitPrice: 39.9,
        remark: '损坏：包装箱破损，橙子压坏'
      }
    ]
  };

  const order6 = await createReissueOrder(mixedOrder);
  console.log('✅ 创建错发缺件混合订单:', order6.orderNo);

  console.log('\n🎉 样例数据填充完成！');
  console.log('\n📊 统计信息：');
  console.log('  - 正常状态订单: 1');
  console.log('  - 处理中状态订单: 1');
  console.log('  - 驳回状态订单: 1');
  console.log('  - 已补录状态订单: 1');
  console.log('  - 已完成状态订单: 1');
  console.log('  - 错发缺件混合测试订单: 1');
  console.log('\n🚀 请运行 npm run dev 启动服务器');
};

seedData().catch(console.error);
