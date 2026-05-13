import { dataStore } from './DataStore';
import { OrderItem, TimelineEventType, Product } from '../types';

export class InventoryService {
  async blockInventory(orderId: string, items: OrderItem[], operatorId: string, operatorName: string): Promise<{ success: boolean; outOfStockItems: Array<{ productId: string; productName: string; requested: number; available: number }> }> {
    const outOfStockItems: Array<{ productId: string; productName: string; requested: number; available: number }> = [];

    for (const item of items) {
      const product = dataStore.getProduct(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }
      if (product.availableStock < item.quantity) {
        outOfStockItems.push({
          productId: item.productId,
          productName: product.name,
          requested: item.quantity,
          available: product.availableStock
        });
      }
    }

    if (outOfStockItems.length > 0) {
      return { success: false, outOfStockItems };
    }

    for (const item of items) {
      const product = dataStore.getProduct(item.productId)!;
      product.availableStock -= item.quantity;
      product.blockedStock += item.quantity;
      dataStore.updateProduct(product);
    }

    dataStore.addTimelineEvent(orderId, {
      eventType: TimelineEventType.INVENTORY_BLOCKED,
      eventName: '库存锁定',
      description: `锁定订单商品库存，共 ${items.length} 件商品`,
      operatorId,
      operatorName,
      details: { items: items.map((i) => ({ productId: i.productId, productName: i.productName, quantity: i.quantity })) }
    });

    return { success: true, outOfStockItems: [] };
  }

  async releaseInventory(orderId: string, items: OrderItem[], operatorId: string, operatorName: string, reason: string = '订单取消'): Promise<{ success: boolean; message: string }> {
    const order = dataStore.getOrder(orderId);
    if (!order) {
      return { success: false, message: '订单不存在' };
    }

    const nonFinalStatuses = ['COMPLETED', 'REFUNDED', 'CANCELLED'];
    if (nonFinalStatuses.includes(order.status) && order.status !== 'CANCELLED') {
      return { success: false, message: '库存释放拦截：订单已完成或已退款，不允许释放库存' };
    }

    for (const item of items) {
      const product = dataStore.getProduct(item.productId);
      if (!product) continue;

      const releaseQuantity = Math.min(item.quantity, product.blockedStock);
      if (releaseQuantity > 0) {
        product.availableStock += releaseQuantity;
        product.blockedStock -= releaseQuantity;
        dataStore.updateProduct(product);
      }
    }

    dataStore.addTimelineEvent(orderId, {
      eventType: TimelineEventType.INVENTORY_RELEASED,
      eventName: '库存释放',
      description: `释放订单商品库存，原因：${reason}`,
      operatorId,
      operatorName,
      details: { items: items.map((i) => ({ productId: i.productId, productName: i.productName, quantity: i.quantity })), reason }
    });

    return { success: true, message: '库存已释放' };
  }

  async deductInventory(orderId: string, items: OrderItem[], operatorId: string, operatorName: string): Promise<void> {
    for (const item of items) {
      const product = dataStore.getProduct(item.productId);
      if (!product) continue;

      const deductQuantity = Math.min(item.quantity, product.blockedStock);
      if (deductQuantity > 0) {
        product.blockedStock -= deductQuantity;
        dataStore.updateProduct(product);
      }
    }
  }

  getInventory(productId: string): Product | undefined {
    return dataStore.getProduct(productId);
  }

  getAllInventory(): Product[] {
    return dataStore.getAllProducts();
  }
}

export const inventoryService = new InventoryService();
