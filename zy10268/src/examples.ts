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
  console.log('=== 网络专线开通变更 API 示例 ===\n');

  const orderNo = `LINE-${Date.now()}`;
  const operator = '张三';

  console.log('1. 查询可用设备');
  const devicesResult = await getAvailableDevices();
  console.log('  可用设备数:', devicesResult.data?.length);
  const deviceId = devicesResult.data?.[0]?.id;
  console.log();

  console.log('2. 创建专线订单');
  const createResult = await createOrder(orderNo, 'ABC科技有限公司', 100, operator, 'req-' + Date.now());
  console.log('  结果:', createResult.success ? '成功' : '失败', createResult.data?.orderId);
  const orderId = createResult.data?.orderId;
  console.log();

  if (!orderId) {
    console.log('订单创建失败，终止示例');
    return;
  }

  console.log('3. 【验证】跳过前置节点直接完成客户验收（预期失败）');
  const skipNodeResult = await updateConstructionNode(
    orderId, ConstructionNode.CUSTOMER_ACCEPTANCE, 'COMPLETED', operator, 'req-skip-' + Date.now()
  );
  console.log('  预期失败:', !skipNodeResult.success, '-', skipNodeResult.message);
  console.log();

  console.log('4. 完成合同签署节点（销售部）');
  const node1Result = await updateConstructionNode(
    orderId, ConstructionNode.CONTRACT_SIGNED, 'COMPLETED', operator, 'req-node1-' + Date.now()
  );
  console.log('  结果:', node1Result.success ? '成功' : '失败', '-', node1Result.data?.status);
  console.log();

  console.log('5. 【验证】设备绑定前尝试开通（预期失败 - 无设备绑定）');
  const earlyActivateResult = await confirmActivation(orderId, operator, 'req-early-activate-' + Date.now());
  console.log('  预期失败:', !earlyActivateResult.success, '-', earlyActivateResult.message);
  console.log();

  console.log('6. 绑定设备（工程部）');
  const bindResult = await bindDevice(orderId, deviceId, operator, 'req-bind-' + Date.now());
  console.log('  结果:', bindResult.success ? '成功' : '失败');
  console.log();

  console.log('7. 完成设备安装节点');
  const node2Result = await updateConstructionNode(
    orderId, ConstructionNode.DEVICE_INSTALLATION, 'COMPLETED', operator, 'req-node2-' + Date.now()
  );
  console.log('  结果:', node2Result.success ? '成功' : '失败');
  console.log();

  console.log('8. 完成线路测试节点（运维部）');
  const node3Result = await updateConstructionNode(
    orderId, ConstructionNode.LINE_TESTING, 'COMPLETED', operator, 'req-node3-' + Date.now()
  );
  console.log('  结果:', node3Result.success ? '成功' : '失败');
  console.log();

  console.log('9. 完成客户验收节点（销售部）');
  const node4Result = await updateConstructionNode(
    orderId, ConstructionNode.CUSTOMER_ACCEPTANCE, 'COMPLETED', operator, 'req-node4-' + Date.now()
  );
  console.log('  结果:', node4Result.success ? '成功' : '失败', '-', node4Result.data?.status);
  console.log();

  console.log('10. 确认开通，开始计费');
  const activateResult = await confirmActivation(orderId, operator, 'req-activate-' + Date.now());
  console.log('  结果:', activateResult.success ? '成功' : '失败', '- 计费:', activateResult.data?.isBilling);
  console.log();

  console.log('11. 查询订单详情 - 查看当前进度');
  const detailResult1 = await getOrderDetail(orderId);
  console.log('  当前阻塞部门:', detailResult1.data?.currentBlockedDepartment);
  console.log('  订单状态:', detailResult1.data?.order.status);
  console.log('  是否计费:', detailResult1.data?.order.isBilling);
  console.log();

  console.log('12. 带宽变更 - 从 100M -> 200M');
  const changeResult = await changeBandwidth(orderId, 200, operator, 'req-change-' + Date.now());
  console.log('  结果:', changeResult.success ? '成功' : '失败', '-', changeResult.message);
  console.log();

  console.log('13. 暂停计费');
  const suspendResult = await suspendBilling(orderId, operator, 'req-suspend-' + Date.now(), '客户临时停用');
  console.log('  结果:', suspendResult.success ? '成功' : '失败', '- 状态:', suspendResult.data?.status);
  console.log();

  console.log('14. 【验证】暂停期间尝试变更带宽（预期失败）');
  const failedChangeResult = await changeBandwidth(orderId, 300, operator, 'req-failed-change-' + Date.now());
  console.log('  预期失败:', !failedChangeResult.success, '-', failedChangeResult.message);
  console.log();

  console.log('15. 恢复计费');
  const resumeResult = await resumeBilling(orderId, operator, 'req-resume-' + Date.now());
  console.log('  结果:', resumeResult.success ? '成功' : '失败', '- 状态:', resumeResult.data?.status);
  console.log();

  console.log('16. 【验证】重复请求（预期失败）');
  const duplicateResult = await createOrder(orderNo, '重复测试公司', 50, operator, 'req-dup-' + Date.now());
  console.log('  预期失败:', !duplicateResult.success, '-', duplicateResult.message);
  console.log();

  console.log('\n=== 测试施工失败场景 ===\n');
  const orderNo2 = `LINE-${Date.now()}-FAIL`;
  
  console.log('17. 创建新订单用于测试施工失败');
  const createResult2 = await createOrder(orderNo2, '测试公司', 50, operator, 'req2-' + Date.now());
  const orderId2 = createResult2.data?.orderId;
  console.log('  订单ID:', orderId2);
  console.log();

  if (orderId2) {
    console.log('18. 完成合同签署节点');
    await updateConstructionNode(
      orderId2, ConstructionNode.CONTRACT_SIGNED, 'COMPLETED', operator, 'req2-node1-' + Date.now()
    );
    console.log('  完成');
    console.log();

    console.log('19. 绑定设备');
    await bindDevice(orderId2, devicesResult.data?.[1]?.id, operator, 'req2-bind-' + Date.now());
    console.log('  完成');
    console.log();

    console.log('20. 完成设备安装节点');
    await updateConstructionNode(
      orderId2, ConstructionNode.DEVICE_INSTALLATION, 'COMPLETED', operator, 'req2-node2-' + Date.now()
    );
    console.log('  完成');
    console.log();

    console.log('21. 标记线路测试节点为失败');
    const failResult = await updateConstructionNode(
      orderId2, ConstructionNode.LINE_TESTING, 'FAILED', operator, 'req2-fail-' + Date.now(), '光纤断裂'
    );
    console.log('  结果:', failResult.success ? '成功' : '失败', '- 状态:', failResult.data?.status);
    console.log();

    console.log('22. 【验证】施工失败后尝试继续完成其他节点（预期失败）');
    const afterFailResult = await updateConstructionNode(
      orderId2, ConstructionNode.CUSTOMER_ACCEPTANCE, 'COMPLETED', operator, 'req2-after-' + Date.now()
    );
    console.log('  预期失败:', !afterFailResult.success, '-', afterFailResult.message);
    console.log();

    console.log('23. 【验证】施工失败后尝试开通（预期失败）');
    const activateFailResult = await confirmActivation(orderId2, operator, 'req2-activate-' + Date.now());
    console.log('  预期失败:', !activateFailResult.success, '-', activateFailResult.message);
    console.log();
  }

  console.log('24. 最终订单详情 - 查看完整历史');
  const finalDetail = await getOrderDetail(orderId);
  console.log('  操作历史记录数:', finalDetail.data?.operationHistory?.length);
  console.log('  最终状态:', finalDetail.data?.order.status);
  console.log();

  console.log('\n=== 示例执行完成，所有边界校验已通过 ===');
}

runExamples().catch(console.error);
