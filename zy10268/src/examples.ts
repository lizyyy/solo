import {
  createOrder,
  bindDevice,
  updateConstructionNode,
  confirmActivation,
  changeBandwidth,
  suspendBilling,
  resumeBilling,
  getOrderDetail,
  getAvailableDevices
} from './service';
import { ConstructionNode } from './types';

async function runExamples() {
  console.log('=== 网络专线开通变更 API 示例\n');

  const orderNo = `LINE-${Date.now()}`;
  const operator = '张三';

  console.log('1. 查询可用设备');
  const devicesResult = await getAvailableDevices();
  console.log('  可用设备:', JSON.stringify(devicesResult.data, null, 2));
  const deviceId = devicesResult.data?.[0]?.id;
  console.log();

  console.log('2. 创建专线订单');
  const createResult = await createOrder(orderNo, 'ABC科技有限公司', 100, operator, 'req-' + Date.now());
  console.log('  结果:', JSON.stringify(createResult, null, 2));
  const orderId = createResult.data?.orderId;
  console.log();

  if (!orderId) {
    console.log('订单创建失败，终止示例');
    return;
  }

  console.log('3. 完成合同签署节点（销售部）');
  const node1Result = await updateConstructionNode(
    orderId, ConstructionNode.CONTRACT_SIGNED, 'COMPLETED', operator, 'req-node1-' + Date.now()
  );
  console.log('  结果:', JSON.stringify(node1Result, null, 2));
  console.log();

  console.log('4. 绑定设备（工程部）');
  const bindResult = await bindDevice(orderId, deviceId, operator, 'req-bind-' + Date.now());
  console.log('  结果:', JSON.stringify(bindResult, null, 2));
  console.log();

  console.log('5. 完成设备安装节点');
  const node2Result = await updateConstructionNode(
    orderId, ConstructionNode.DEVICE_INSTALLATION, 'COMPLETED', operator, 'req-node2-' + Date.now()
  );
  console.log('  结果:', JSON.stringify(node2Result, null, 2));
  console.log();

  console.log('6. 完成线路测试节点（运维部）');
  const node3Result = await updateConstructionNode(
    orderId, ConstructionNode.LINE_TESTING, 'COMPLETED', operator, 'req-node3-' + Date.now()
  );
  console.log('  结果:', JSON.stringify(node3Result, null, 2));
  console.log();

  console.log('7. 完成客户验收节点（销售部）');
  const node4Result = await updateConstructionNode(
    orderId, ConstructionNode.CUSTOMER_ACCEPTANCE, 'COMPLETED', operator, 'req-node4-' + Date.now()
  );
  console.log('  结果:', JSON.stringify(node4Result, null, 2));
  console.log();

  console.log('8. 确认开通，开始计费');
  const activateResult = await confirmActivation(orderId, operator, 'req-activate-' + Date.now());
  console.log('  结果:', JSON.stringify(activateResult, null, 2));
  console.log();

  console.log('9. 查询订单详情 - 查看当前进度');
  const detailResult1 = await getOrderDetail(orderId);
  console.log('  当前阻塞部门:', detailResult1.data?.currentBlockedDepartment);
  console.log('  订单状态:', detailResult1.data?.order.status);
  console.log('  是否计费:', detailResult1.data?.order.isBilling);
  console.log();

  console.log('10. 带宽变更 - 从 100M -> 200M');
  const changeResult = await changeBandwidth(orderId, 200, operator, 'req-change-' + Date.now());
  console.log('  结果:', JSON.stringify(changeResult, null, 2));
  console.log();

  console.log('11. 暂停计费');
  const suspendResult = await suspendBilling(orderId, operator, 'req-suspend-' + Date.now(), '客户临时停用');
  console.log('  结果:', JSON.stringify(suspendResult, null, 2));
  console.log();

  console.log('12. 【验证：暂停期间尝试变更带宽（预期失败）');
  const failedChangeResult = await changeBandwidth(orderId, 300, operator, 'req-failed-change-' + Date.now());
  console.log('  预期失败结果:', JSON.stringify(failedChangeResult, null, 2));
  console.log();

  console.log('13. 恢复计费');
  const resumeResult = await resumeBilling(orderId, operator, 'req-resume-' + Date.now());
  console.log('  结果:', JSON.stringify(resumeResult, null, 2));
  console.log();

  console.log('14. 【验证】重复请求（预期失败）');
  const duplicateResult = await createOrder(orderNo, '重复测试公司', 50, operator, 'req-' + Date.now());
  console.log('  预期失败结果:', JSON.stringify(duplicateResult, null, 2));
  console.log();

  console.log('15. 最终订单详情 - 查看完整历史');
  const finalDetail = await getOrderDetail(orderId);
  console.log('  操作历史记录数:', finalDetail.data?.operationHistory?.length);
  console.log('  最终状态:', finalDetail.data?.order.status);
  console.log();

  console.log('\n=== 示例执行完成 ===');
}

runExamples().catch(console.error);
