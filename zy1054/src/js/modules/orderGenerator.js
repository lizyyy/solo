/**
 * 订单生成系统
 * 负责根据关卡配置生成随机订单
 */

export class OrderGenerator {
  constructor(levelConfig) {
    this.levelConfig = levelConfig;
    this.orderIdCounter = 0;
  }

  /**
   * 生成一个随机订单
   * @returns {Object} 订单对象
   */
  generateOrder() {
    const dishes = this.levelConfig.availableDishes;
    const dish = dishes[Math.floor(Math.random() * dishes.length)];
    
    const steps = this.levelConfig.orderSteps[dish];
    const stepDurations = this.levelConfig.stepDurations;
    
    const orderSteps = steps.map(stepName => ({
      name: stepName,
      duration: stepDurations[stepName],
      completed: false,
      current: false,
      startTime: null,
      endTime: null
    }));
    
    // 设置第一个步骤为当前步骤
    if (orderSteps.length > 0) {
      orderSteps[0].current = true;
    }
    
    const order = {
      id: `order-${++this.orderIdCounter}`,
      dish: dish,
      steps: orderSteps,
      currentStepIndex: 0,
      status: 'pending', // pending, in_progress, completed, canceled, burned
      createdAt: Date.now(),
      completedAt: null,
      price: this.levelConfig.basePrices[dish],
      satisfaction: 100, // 初始满意度 100%
      waitTime: 0,
      isBurned: false,
      isPerfect: false,
      assignedStation: null
    };
    
    return order;
  }

  /**
   * 计算订单总预计时间
   * @param {Object} order 订单对象
   * @returns {number} 总时间（秒）
   */
  calculateTotalTime(order) {
    return order.steps.reduce((total, step) => total + step.duration, 0);
  }

  /**
   * 检查订单是否可以生成
   * @param {number} currentOrders 当前订单数量
   * @returns {boolean} 是否可以生成新订单
   */
  canGenerateOrder(currentOrders) {
    return currentOrders < this.levelConfig.maxOrders;
  }
}
