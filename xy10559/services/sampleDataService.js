const cardService = require('./cardService');
const gateSyncService = require('./gateSyncService');
const { store, enums, generateId, now } = require('../models/store');

const sampleDataService = {
  createAllSamples: () => {
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const twoMonthsAgo = new Date(today);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const formatDate = (d) => d.toISOString().split('T')[0];

    const samples = [];

    const card1 = cardService.createCard(
      '张三', '13800000001', '京A12345', 300,
      formatDate(today), formatDate(nextMonth), 'sample_init'
    );
    gateSyncService.syncCardToGate(card1.id, 'sample_init');
    samples.push({
      name: '正常续费样例',
      card: card1,
      description: '刚创建的正常月卡，可用于演示续费流程',
      steps: [
        '1. 调用 /api/cards/:id 查看当前状态',
        '2. 调用 POST /api/cards/:id/renew 续费1个月',
        '3. 再次查询查看有效期延长',
        '4. 查看 /api/cards/:id 中的 transactions 和 operationLogs'
      ]
    });

    const card2 = cardService.createCard(
      '李四', '13800000002', '京B67890', 300,
      formatDate(today), formatDate(nextMonth), 'sample_init'
    );
    gateSyncService.syncCardToGate(card2.id, 'sample_init');
    samples.push({
      name: '车牌变更样例',
      card: card2,
      description: '可用于演示车牌变更流程',
      currentPlate: '京B67890',
      newPlate: '京B99999',
      steps: [
        '1. 调用 /api/cards/:id 查看当前绑定车牌',
        '2. 调用 POST /api/cards/:id/bind-plate 绑定新车牌',
        '3. 查看 operationLogs 中的车牌变更记录',
        '4. 调用 /api/gate/check-access?plate=京B99999 验证闸机状态'
      ]
    });

    const card3 = cardService.createCard(
      '王五', '13800000003', '京C11111', 300,
      formatDate(twoMonthsAgo), formatDate(lastMonth), 'sample_init'
    );
    cardService.freezeForOverdue(card3.id, 'sample_init');
    samples.push({
      name: '欠费冻结样例',
      card: card3,
      description: '已过期并冻结的月卡，演示欠费禁止通行',
      steps: [
        '1. 调用 /api/gate/check-access?plate=京C11111 验证禁止通行',
        '2. 调用 POST /api/cards/:id/renew 续费恢复',
        '3. 调用 /api/cards/:id 查看状态变更',
        '4. 调用 /api/gate/sync/:id 同步到闸机'
      ]
    });

    const card4 = cardService.createCard(
      '赵六', '13800000004', '京D22222', 300,
      formatDate(today), formatDate(nextMonth), 'sample_init'
    );
    gateSyncService.syncCardToGate(card4.id, 'sample_init');
    cardService.pauseCard(card4.id, '车主出国暂时不用', 'sample_init');
    samples.push({
      name: '暂停/恢复样例',
      card: card4,
      description: '已暂停的月卡，演示暂停恢复流程',
      steps: [
        '1. 调用 /api/cards/:id 查看暂停状态',
        '2. 调用 /api/gate/check-access?plate=京D22222 验证禁止通行',
        '3. 调用 POST /api/cards/:id/resume 恢复月卡',
        '4. 调用 /api/gate/sync/:id 同步闸机白名单'
      ]
    });

    const card5 = cardService.createCard(
      '孙七', '13800000005', '京E33333', 300,
      formatDate(today), formatDate(nextMonth), 'sample_init'
    );
    samples.push({
      name: '同步失败样例',
      card: card5,
      description: '创建后未同步或同步失败，演示闸机同步失败',
      steps: [
        '1. 调用 /api/gate/check-access?plate=京E33333 查看当前状态',
        '2. 调用 POST /api/cards/:id/renew 续费',
        '3. 调用 POST /api/gate/sync/:id 尝试同步(可能失败)',
        '4. 调用 GET /api/anomalies 查看异常记录',
        '5. 调用 POST /api/gate/retry-failed 重试失败同步'
      ]
    });

    return {
      totalSamples: samples.length,
      samples,
      summary: {
        totalCards: store.cards.length,
        activeCards: store.cards.filter(c => c.status === enums.CardStatus.ACTIVE).length,
        pausedCards: store.cards.filter(c => c.status === enums.CardStatus.PAUSED).length,
        suspendedCards: store.cards.filter(c => c.status === enums.CardStatus.SUSPENDED).length
      }
    };
  },

  resetAllData: () => {
    store.cards = [];
    store.plateBindings = [];
    store.transactions = [];
    store.gateSync = [];
    store.anomalies = [];
    store.operationLogs = [];
    store.gateStatus = {};
    store.idempotency = {};
    return { message: '所有数据已重置' };
  }
};

module.exports = sampleDataService;
