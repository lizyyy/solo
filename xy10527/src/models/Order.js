const { generateOrderNo, generateId } = require('../utils/idGenerator');

class Order {
  constructor({
    orderNo = generateOrderNo(),
    userId,
    groupLeaderId,
    items = [],
    totalAmount,
    orderTime = new Date(),
    deliveryTime,
    status = 'PENDING_DELIVERY',
    weightConfirmations = [],
    leaderConfirmed = false,
    leaderConfirmTime
  }) {
    this.id = generateId();
    this.orderNo = orderNo;
    this.userId = userId;
    this.groupLeaderId = groupLeaderId;
    this.items = items.map(item => ({
      id: generateId(),
      productId: item.productId,
      productName: item.productName,
      expectedWeight: item.expectedWeight,
      unitPrice: item.unitPrice,
      quantity: item.quantity || 1,
      unit: item.unit || 'kg'
    }));
    this.totalAmount = totalAmount;
    this.orderTime = orderTime;
    this.deliveryTime = deliveryTime;
    this.status = status;
    this.weightConfirmations = weightConfirmations.map(wc => ({
      id: generateId(),
      itemId: wc.itemId,
      actualWeight: wc.actualWeight,
      weighTime: wc.weighTime || new Date(),
      photoUrl: wc.photoUrl
    }));
    this.leaderConfirmed = leaderConfirmed;
    this.leaderConfirmTime = leaderConfirmTime;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  confirmDelivery(deliveryTime) {
    this.status = 'DELIVERED';
    this.deliveryTime = deliveryTime || new Date();
    this.updatedAt = new Date();
  }

  addWeightConfirmation(itemId, actualWeight, photoUrl) {
    const existingIndex = this.weightConfirmations.findIndex(wc => wc.itemId === itemId);
    const newConfirmation = {
      id: generateId(),
      itemId,
      actualWeight,
      weighTime: new Date(),
      photoUrl
    };
    
    if (existingIndex >= 0) {
      this.weightConfirmations[existingIndex] = newConfirmation;
    } else {
      this.weightConfirmations.push(newConfirmation);
    }
    this.updatedAt = new Date();
  }

  confirmByLeader() {
    this.leaderConfirmed = true;
    this.leaderConfirmTime = new Date();
    this.updatedAt = new Date();
  }

  getExpectedWeight(itemId) {
    const item = this.items.find(i => i.id === itemId);
    return item ? item.expectedWeight : null;
  }

  getActualWeight(itemId) {
    const confirmation = this.weightConfirmations.find(wc => wc.itemId === itemId);
    return confirmation ? confirmation.actualWeight : null;
  }

  getWeightDiff(itemId) {
    const expected = this.getExpectedWeight(itemId);
    const actual = this.getActualWeight(itemId);
    if (expected === null || actual === null) return null;
    return actual - expected;
  }
}

module.exports = Order;
