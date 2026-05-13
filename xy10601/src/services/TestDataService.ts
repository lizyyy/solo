import { v4 as uuidv4 } from 'uuid';
import { orderService } from './OrderService';
import { inventoryService } from './InventoryService';
import { dataStore } from './DataStore';
import { OrderStatus } from '../types';

export class TestDataService {
  async createNormalFlowOrder(): Promise<string> {
    const operatorId = 'op1';
    const operatorName = '王运营';

    const createResult = await orderService.createOrder(
      {
        communityId: 'c1',
        communityName: '阳光小区',
        groupLeaderId: 'g1',
        groupLeaderName: '张团长',
        userId: 'u1',
        userName: '李用户',
        phone: '13800138001',
        address: '阳光小区1号楼101',
        items: [
          { productId: 'p1', quantity: 2 },
          { productId: 'p3', quantity: 1 }
        ]
      },
      operatorId,
      operatorName
    );

    const orderId = createResult.order.id;

    await orderService.payOrder(orderId, operatorId, operatorName);
    await orderService.startPicking(orderId, 'g1', '张团长');

    const order = orderService.getOrder(orderId)!;
    for (const item of order.items) {
      await orderService.recordPicking(orderId, item.id, item.quantity, 'g1', '张团长', '拣货正常');
    }

    await orderService.completePicking(orderId, 'g1', '张团长');
    await orderService.deliverOrder(orderId, operatorId, operatorName);
    await orderService.completeOrder(orderId, operatorId, operatorName);

    return orderId;
  }

  async createProblemFlowOrder(): Promise<string> {
    const operatorId = 'op1';
    const operatorName = '王运营';
    const customerServiceId = 'cs1';
    const customerServiceName = '刘客服';

    const createResult = await orderService.createOrder(
      {
        communityId: 'c1',
        communityName: '阳光小区',
        groupLeaderId: 'g1',
        groupLeaderName: '张团长',
        userId: 'u2',
        userName: '王用户',
        phone: '13800138002',
        address: '阳光小区2号楼202',
        items: [
          { productId: 'p1', quantity: 5 },
          { productId: 'p2', quantity: 3 },
          { productId: 'p4', quantity: 2 }
        ]
      },
      operatorId,
      operatorName
    );

    const orderId = createResult.order.id;

    const product1 = dataStore.getProduct('p1')!;
    const originalStock = product1.availableStock;
    product1.availableStock = 3;
    dataStore.updateProduct(product1);

    const payResult = await orderService.payOrder(orderId, operatorId, operatorName);

    product1.availableStock = originalStock;
    dataStore.updateProduct(product1);

    if (!payResult.success) {
      const order = orderService.getOrder(orderId)!;
      const outOfStockItem = order.items.find((i) => i.productId === 'p1');
      if (outOfStockItem) {
        await orderService.confirmReplacement(
          orderId,
          outOfStockItem.id,
          'p6',
          customerServiceId,
          customerServiceName,
          '苹果缺货，替换为高级苹果'
        );
      }

      const bananaItem = order.items.find((i) => i.productId === 'p2');
      if (bananaItem) {
        const callbackId = uuidv4();
        await orderService.processRefundCallback({
          orderId,
          orderItemId: bananaItem.id,
          callbackId,
          refundAmount: bananaItem.amount,
          status: 'SUCCESS'
        });

        await orderService.processRefundCallback({
          orderId,
          orderItemId: bananaItem.id,
          callbackId,
          refundAmount: bananaItem.amount,
          status: 'SUCCESS'
        });
      }
    }

    const updatedOrder = orderService.getOrder(orderId)!;
    const normalItems = updatedOrder.items.filter((i) => i.status !== 'REFUNDED');

    if (normalItems.length > 0) {
      await orderService.startPicking(orderId, 'g1', '张团长');

      for (const item of normalItems) {
        await orderService.recordPicking(orderId, item.id, item.quantity, 'g1', '张团长', '拣货完成');
      }

      await orderService.completePicking(orderId, 'g1', '张团长');
      await orderService.deliverOrder(orderId, operatorId, operatorName);
    }

    return orderId;
  }

  async createReviewFlowOrder(): Promise<string> {
    const operatorId = 'op1';
    const operatorName = '王运营';
    const groupLeaderId = 'g2';
    const groupLeaderName = '李团长';

    const createResult = await orderService.createOrder(
      {
        communityId: 'c2',
        communityName: '幸福家园',
        groupLeaderId,
        groupLeaderName,
        userId: 'u3',
        userName: '赵用户',
        phone: '13800138003',
        address: '幸福家园A栋301',
        items: [
          { productId: 'p3', quantity: 2 },
          { productId: 'p5', quantity: 3 }
        ]
      },
      operatorId,
      operatorName
    );

    const orderId = createResult.order.id;

    await orderService.payOrder(orderId, operatorId, operatorName);

    const order = orderService.getOrder(orderId)!;
    const milkItem = order.items.find((i) => i.productId === 'p3')!;
    const vegItem = order.items.find((i) => i.productId === 'p5')!;

    await orderService.startPicking(orderId, groupLeaderId, groupLeaderName);

    await orderService.recordPicking(orderId, milkItem.id, milkItem.quantity, groupLeaderId, groupLeaderName, '包装完好');
    await orderService.recordPicking(orderId, vegItem.id, 2, groupLeaderId, groupLeaderName, '蔬菜部分缺货，只拣了2份');

    await orderService.completePicking(orderId, groupLeaderId, groupLeaderName);

    const callbackId = uuidv4();
    await orderService.processRefundCallback({
      orderId,
      orderItemId: vegItem.id,
      callbackId,
      refundAmount: vegItem.price * 1,
      status: 'SUCCESS'
    });

    await orderService.deliverOrder(orderId, operatorId, operatorName);

    return orderId;
  }

  async initializeAllTestData(): Promise<{
    normalFlowOrderId: string;
    problemFlowOrderId: string;
    reviewFlowOrderId: string;
  }> {
    const normalFlowOrderId = await this.createNormalFlowOrder();
    const problemFlowOrderId = await this.createProblemFlowOrder();
    const reviewFlowOrderId = await this.createReviewFlowOrder();

    return {
      normalFlowOrderId,
      problemFlowOrderId,
      reviewFlowOrderId
    };
  }
}

export const testDataService = new TestDataService();
