/**
 * 计分结算系统
 * 负责计算分数、收入、浪费、客人满意度等
 */

export class ScoreSystem {
  constructor(levelConfig) {
    this.levelConfig = levelConfig;
    this.reset();
  }

  /**
   * 重置计分系统
   */
  reset() {
    this.totalIncome = 0;
    this.totalWaste = 0;
    this.totalSatisfaction = 0;
    this.ordersCompleted = 0;
    this.ordersBurned = 0;
    this.ordersCanceled = 0;
    this.perfectOrders = 0;
    this.score = 0;
  }

  /**
   * 处理完成的订单
   * @param {Object} order 订单对象
   * @returns {number} 本次获得的分数
   */
  processCompletedOrder(order) {
    const basePrice = order.price;
    let finalIncome = basePrice;
    let orderScore = 0;

    // 计算满意度影响
    const satisfaction = order.satisfaction;
    
    // 满意度影响收入
    finalIncome = Math.floor(basePrice * (satisfaction / 100));
    
    // 完美订单奖励
    if (order.isPerfect) {
      finalIncome = Math.floor(finalIncome * 1.2);
      this.perfectOrders++;
    }

    // 计算分数
    // 基础分数 = 订单价格
    orderScore = basePrice;
    
    // 满意度加成
    orderScore += Math.floor(satisfaction * 0.5);
    
    // 完美订单额外分数
    if (order.isPerfect) {
      orderScore += 20;
    }

    // 等待时间惩罚
    const maxWaitTime = this.levelConfig.maxWaitTime;
    const waitTime = (Date.now() - order.createdAt) / 1000;
    if (waitTime > maxWaitTime * 0.5) {
      const waitPenalty = Math.floor((waitTime - maxWaitTime * 0.5) * 0.5);
      orderScore = Math.max(0, orderScore - waitPenalty);
    }

    this.totalIncome += finalIncome;
    this.totalSatisfaction += satisfaction;
    this.ordersCompleted++;
    this.score += orderScore;

    return orderScore;
  }

  /**
   * 处理糊掉的订单
   * @param {Object} order 订单对象
   * @returns {number} 损失的分数
   */
  processBurnedOrder(order) {
    const basePrice = order.price;
    const wasteCost = Math.floor(basePrice * 0.5);
    
    this.totalWaste += wasteCost;
    this.ordersBurned++;
    
    // 糊掉的订单扣分
    const penalty = basePrice + 10;
    this.score = Math.max(0, this.score - penalty);
    
    // 满意度降低
    this.totalSatisfaction = Math.max(0, this.totalSatisfaction - 50);
    
    return penalty;
  }

  /**
   * 处理取消的订单
   * @param {Object} order 订单对象
   * @returns {number} 损失的分数
   */
  processCanceledOrder(order) {
    const basePrice = order.price;
    
    this.ordersCanceled++;
    
    // 取消的订单扣分
    const penalty = Math.floor(basePrice * 0.3);
    this.score = Math.max(0, this.score - penalty);
    
    // 满意度降低
    this.totalSatisfaction = Math.max(0, this.totalSatisfaction - 30);
    
    return penalty;
  }

  /**
   * 计算最终结算数据
   * @returns {Object} 结算数据
   */
  calculateSummary() {
    const totalOrders = this.ordersCompleted + this.ordersBurned + this.ordersCanceled;
    
    // 计算平均满意度
    let avgSatisfaction = 0;
    if (totalOrders > 0) {
      avgSatisfaction = Math.round(this.totalSatisfaction / totalOrders);
    }
    
    // 计算最终分数
    let finalScore = this.score;
    
    // 完成率加成
    if (totalOrders > 0) {
      const completionRate = this.ordersCompleted / totalOrders;
      finalScore += Math.floor(completionRate * 50);
    }
    
    // 检查是否达到目标分数
    const targetScore = this.levelConfig.targetScore;
    const isPassed = finalScore >= targetScore;
    
    // 计算星级（基于目标分数的百分比）
    const scorePercent = Math.min(finalScore / targetScore, 2);
    let stars = 0;
    if (scorePercent >= 0.8) stars = 1;
    if (scorePercent >= 1.0) stars = 2;
    if (scorePercent >= 1.5) stars = 3;
    
    return {
      totalIncome: this.totalIncome,
      totalWaste: this.totalWaste,
      avgSatisfaction: avgSatisfaction,
      ordersCompleted: this.ordersCompleted,
      ordersBurned: this.ordersBurned,
      ordersCanceled: this.ordersCanceled,
      perfectOrders: this.perfectOrders,
      finalScore: finalScore,
      targetScore: targetScore,
      isPassed: isPassed,
      stars: stars,
      completionRate: totalOrders > 0 ? Math.round((this.ordersCompleted / totalOrders) * 100) : 0
    };
  }

  /**
   * 生成Markdown格式的报告
   * @param {Object} summary 结算数据
   * @param {Object} levelInfo 关卡信息
   * @returns {string} Markdown报告
   */
  generateMarkdownReport(summary, levelInfo) {
    const date = new Date().toLocaleString('zh-CN');
    
    let starsDisplay = '';
    for (let i = 0; i < 3; i++) {
      starsDisplay += i < summary.stars ? '★' : '☆';
    }
    
    const report = `
# 夜市出餐手忙脚乱 - 游戏报告

## 基本信息
- **关卡**: ${levelInfo.name}
- **难度**: ${levelInfo.difficulty}
- **游戏时间**: ${date}
- **目标分数**: ${summary.targetScore}
- **最终分数**: ${summary.finalScore}
- **评价**: ${starsDisplay} (${summary.isPassed ? '通关' : '未通关'})

## 经营统计
| 统计项 | 数值 |
|--------|------|
| 总收入 | ¥${summary.totalIncome} |
| 总浪费 | ¥${summary.totalWaste} |
| 净利润 | ¥${summary.totalIncome - summary.totalWaste} |
| 平均满意度 | ${summary.avgSatisfaction}% |
| 完成订单 | ${summary.ordersCompleted} |
| 糊掉订单 | ${summary.ordersBurned} |
| 取消订单 | ${summary.ordersCanceled} |
| 完美订单 | ${summary.perfectOrders} |
| 完成率 | ${summary.completionRate}% |

## 详细数据
- **完成订单**: ${summary.ordersCompleted} 单
- **失误订单**: ${summary.ordersBurned + summary.ordersCanceled} 单
- **完美订单占比**: ${summary.ordersCompleted > 0 ? Math.round((summary.perfectOrders / summary.ordersCompleted) * 100) : 0}%

---
报告生成时间: ${date}
`;
    
    return report.trim();
  }

  /**
   * 获取当前分数
   * @returns {number} 当前分数
   */
  getCurrentScore() {
    return this.score;
  }

  /**
   * 获取总收入
   * @returns {number} 总收入
   */
  getTotalIncome() {
    return this.totalIncome;
  }

  /**
   * 获取总浪费
   * @returns {number} 总浪费
   */
  getTotalWaste() {
    return this.totalWaste;
  }
}
