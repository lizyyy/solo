/**
 * 工位状态管理系统
 * 负责管理各个工位的状态、分配订单、处理步骤等
 */

export class StationManager {
  constructor(levelConfig) {
    this.levelConfig = levelConfig;
    this.stations = this._initializeStations();
  }

  /**
   * 初始化工位
   * @private
   */
  _initializeStations() {
    const stations = [];
    const availableStations = this.levelConfig.availableStations;
    
    availableStations.forEach((stationType, index) => {
      stations.push({
        id: `station-${index}`,
        type: stationType,
        status: 'available', // available, busy, completed, burned
        currentOrder: null,
        currentStep: null,
        stepStartTime: null,
        stepEndTime: null,
        progress: 0
      });
    });
    
    return stations;
  }

  /**
   * 获取所有工位
   * @returns {Array} 工位列表
   */
  getStations() {
    return [...this.stations];
  }

  /**
   * 根据类型获取可用工位
   * @param {string} stationType 工位类型
   * @returns {Object|null} 可用工位对象
   */
  getAvailableStation(stationType) {
    return this.stations.find(
      station => station.type === stationType && station.status === 'available'
    ) || null;
  }

  /**
   * 分配订单到工位
   * @param {string} stationId 工位ID
   * @param {Object} order 订单对象
   * @returns {boolean} 是否成功分配
   */
  assignOrderToStation(stationId, order) {
    const station = this.stations.find(s => s.id === stationId);
    
    if (!station || station.status !== 'available') {
      return false;
    }
    
    const currentStep = order.steps[order.currentStepIndex];
    
    station.status = 'busy';
    station.currentOrder = order;
    station.currentStep = currentStep;
    station.stepStartTime = Date.now();
    station.stepEndTime = Date.now() + (currentStep.duration * 1000);
    station.progress = 0;
    
    order.assignedStation = stationId;
    order.status = 'in_progress';
    currentStep.startTime = Date.now();
    
    return true;
  }

  /**
   * 更新工位进度
   * @param {string} stationId 工位ID
   * @returns {Object|null} 更新后的工位对象
   */
  updateStationProgress(stationId) {
    const station = this.stations.find(s => s.id === stationId);
    
    if (!station || station.status !== 'busy') {
      return null;
    }
    
    const now = Date.now();
    const stepDuration = station.currentStep.duration * 1000;
    const elapsed = now - station.stepStartTime;
    
    station.progress = Math.min(elapsed / stepDuration, 1);
    
    // 检查是否完成
    if (station.progress >= 1) {
      station.status = 'completed';
      station.currentStep.endTime = now;
      station.currentStep.completed = true;
    }
    
    // 检查是否糊了（超过一定时间）
    const maxBurnTime = stepDuration * 1.5;
    if (elapsed > maxBurnTime) {
      station.status = 'burned';
      station.currentOrder.isBurned = true;
    }
    
    return station;
  }

  /**
   * 完成当前步骤，进入下一步
   * @param {string} stationId 工位ID
   * @returns {Object|null} 更新后的订单对象
   */
  completeCurrentStep(stationId) {
    const station = this.stations.find(s => s.id === stationId);
    
    if (!station || !station.currentOrder) {
      return null;
    }
    
    const order = station.currentOrder;
    const now = Date.now();
    const stepDuration = station.currentStep.duration * 1000;
    const elapsed = now - station.stepStartTime;
    
    // 检查是否是完美时机
    const perfectWindow = this.levelConfig.perfectWindow;
    const perfectStart = stepDuration * (1 - perfectWindow);
    const perfectEnd = stepDuration * (1 + perfectWindow * 0.5);
    
    if (elapsed >= perfectStart && elapsed <= perfectEnd) {
      order.isPerfect = true;
      order.satisfaction = Math.min(order.satisfaction + 10, 100);
    }
    
    // 检查是否太早或太晚
    if (elapsed < stepDuration * 0.5) {
      // 太早
      order.satisfaction = Math.max(order.satisfaction - 20, 0);
    } else if (elapsed > stepDuration * 1.2) {
      // 太晚
      order.satisfaction = Math.max(order.satisfaction - 15, 0);
    }
    
    // 更新当前步骤状态
    const currentStep = order.steps[order.currentStepIndex];
    currentStep.completed = true;
    currentStep.endTime = now;
    currentStep.current = false;
    
    // 进入下一步
    order.currentStepIndex++;
    
    if (order.currentStepIndex >= order.steps.length) {
      // 订单完成
      order.status = 'completed';
      order.completedAt = now;
      
      // 释放工位
      this._resetStation(stationId);
    } else {
      // 有下一步，需要检查是否需要换工位
      const nextStep = order.steps[order.currentStepIndex];
      nextStep.current = true;
      nextStep.startTime = now;
      
      // 这里简化处理：同一道菜的所有步骤都在同一个工位完成
      station.currentStep = nextStep;
      station.stepStartTime = now;
      station.stepEndTime = now + (nextStep.duration * 1000);
      station.progress = 0;
      station.status = 'busy';
    }
    
    return order;
  }

  /**
   * 重置工位
   * @private
   * @param {string} stationId 工位ID
   */
  _resetStation(stationId) {
    const station = this.stations.find(s => s.id === stationId);
    if (station) {
      station.status = 'available';
      station.currentOrder = null;
      station.currentStep = null;
      station.stepStartTime = null;
      station.stepEndTime = null;
      station.progress = 0;
    }
  }

  /**
   * 取消订单
   * @param {string} orderId 订单ID
   * @returns {boolean} 是否成功取消
   */
  cancelOrder(orderId) {
    const station = this.stations.find(s => s.currentOrder && s.currentOrder.id === orderId);
    
    if (station) {
      this._resetStation(station.id);
      return true;
    }
    
    return false;
  }

  /**
   * 获取所有忙碌的工位
   * @returns {Array} 忙碌工位列表
   */
  getBusyStations() {
    return this.stations.filter(s => s.status === 'busy');
  }

  /**
   * 检查是否有工位需要处理
   * @returns {Array} 需要处理的工位列表
   */
  getStationsNeedingAction() {
    return this.stations.filter(s => s.status === 'completed' || s.status === 'burned');
  }
}
