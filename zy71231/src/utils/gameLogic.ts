import type {
  GameState,
  PurchaseDecision,
  PriceAdjustment,
  GameEvent,
  DailyReport
} from '../types/game';
import { vinylCatalog } from '../data/vinylCatalog';
import { customerPreferences } from '../data/customerPreferences';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const createInitialGameState = (): GameState => {
  return {
    day: 1,
    maxDays: 14,
    cash: 500,
    initialCash: 500,
    inventory: [],
    customerPreferences: [...customerPreferences],
    vinylCatalog: [...vinylCatalog],
    dailyReports: [],
    gameEvents: [],
    isGameOver: false,
    gameId: generateId(),
    createdAt: Date.now(),
    lastSavedAt: Date.now()
  };
};

export const processPurchases = (
  state: GameState,
  decisions: PurchaseDecision[]
): { newState: GameState; events: GameEvent[] } => {
  const events: GameEvent[] = [];
  let newCash = state.cash;
  const newInventory = [...state.inventory];

  for (const decision of decisions) {
    const record = state.vinylCatalog.find(r => r.id === decision.recordId);
    if (!record) continue;

    const totalCost = record.purchasePrice * decision.quantity;

    if (newCash < totalCost) {
      events.push({
        id: generateId(),
        type: 'danger',
        message: `现金不足，无法购买 ${record.title}！需要 ¥${totalCost}，但只有 ¥${newCash}`,
        suggestion: '减少进货数量或者选择更便宜的唱片',
        source: '进货决策系统',
        timestamp: Date.now()
      });
      continue;
    }

    const existingItem = newInventory.find(item => item.recordId === decision.recordId);
    if (existingItem) {
      events.push({
        id: generateId(),
        type: 'warning',
        message: `重复进货 ${record.title}。当前库存已有 ${existingItem.quantity} 张`,
        suggestion: '考虑该唱片的销售速度，避免积压过多库存',
        source: '库存管理系统',
        timestamp: Date.now()
      });

      const avgPrice = (existingItem.purchasePrice * existingItem.quantity + totalCost) / 
                       (existingItem.quantity + decision.quantity);
      existingItem.purchasePrice = Math.round(avgPrice * 100) / 100;
      existingItem.quantity += decision.quantity;
      existingItem.purchaseHistory.push({
        day: state.day,
        quantity: decision.quantity,
        price: record.purchasePrice
      });
    } else {
      newInventory.push({
        recordId: decision.recordId,
        quantity: decision.quantity,
        purchasePrice: record.purchasePrice,
        currentPrice: record.suggestedPrice,
        daysInStock: 0,
        purchaseHistory: [{
          day: state.day,
          quantity: decision.quantity,
          price: record.purchasePrice
        }]
      });
    }

    newCash -= totalCost;

    events.push({
      id: generateId(),
      type: 'info',
      message: `成功进货 ${record.title} x${decision.quantity}，花费 ¥${totalCost}`,
      suggestion: '设定合理售价，确保有足够利润空间',
      source: '采购系统',
      timestamp: Date.now()
    });
  }

  return {
    newState: {
      ...state,
      cash: newCash,
      inventory: newInventory
    },
    events
  };
};

export const adjustPrices = (
  state: GameState,
  adjustments: PriceAdjustment[]
): { newState: GameState; events: GameEvent[] } => {
  const events: GameEvent[] = [];
  const newInventory = state.inventory.map(item => {
    const adjustment = adjustments.find(a => a.recordId === item.recordId);
    if (adjustment) {
      const record = state.vinylCatalog.find(r => r.id === item.recordId);
      if (adjustment.newPrice < item.purchasePrice) {
        events.push({
          id: generateId(),
          type: 'warning',
          message: `${record?.title || '唱片'} 售价低于成本价！将造成亏损`,
          suggestion: '除非清仓否则不建议这样定价',
          source: '定价策略系统',
          timestamp: Date.now()
        });
      }
      return { ...item, currentPrice: adjustment.newPrice };
    }
    return item;
  });

  return {
    newState: { ...state, inventory: newInventory },
    events
  };
};

export const simulateCustomerBehavior = (
  state: GameState
): { newState: GameState; report: DailyReport; events: GameEvent[] } => {
  const events: GameEvent[] = [];
  const sales: DailyReport['sales'] = [];
  const customerVisits: string[] = [];
  let newCash = state.cash;
  const newInventory = state.inventory.map(item => ({
    ...item,
    daysInStock: item.daysInStock + 1
  }));

  const numCustomers = Math.floor(Math.random() * 4) + 2;
  const shuffledCustomers = [...state.customerPreferences].sort(() => Math.random() - 0.5);
  const visitingCustomers = shuffledCustomers.slice(0, numCustomers);

  for (const customer of visitingCustomers) {
    customerVisits.push(customer.id);

    const matchingRecords = newInventory.filter(item => {
      const record = state.vinylCatalog.find(r => r.id === item.recordId);
      return record && customer.favoriteGenres.includes(record.genre) && item.quantity > 0;
    });

    if (matchingRecords.length === 0) continue;

    const sortedRecords = matchingRecords.sort((a, b) => {
      const recA = state.vinylCatalog.find(r => r.id === a.recordId)!;
      const recB = state.vinylCatalog.find(r => r.id === b.recordId)!;
      return recB.popularity - recA.popularity;
    });

    for (const item of sortedRecords) {
      const record = state.vinylCatalog.find(r => r.id === item.recordId)!;
      const effectivePrice = item.currentPrice / customer.willingnessToPay;

      if (effectivePrice <= customer.budget && item.quantity > 0) {
        const buyChance = (record.popularity / 100) * (1 - (item.daysInStock / 30));
        const adjustedChance = Math.max(0.2, Math.min(0.9, buyChance));

        if (Math.random() < adjustedChance) {
          item.quantity -= 1;
          newCash += item.currentPrice;

          sales.push({
            recordId: item.recordId,
            quantity: 1,
            totalRevenue: item.currentPrice,
            customerId: customer.id
          });

          events.push({
            id: generateId(),
            type: 'success',
            message: `${customer.name} 购买了 ${record.title}，收入 ¥${item.currentPrice}`,
            suggestion: '该顾客偏好这类音乐，可以考虑多进货',
            source: `顾客 ${customer.name}`,
            timestamp: Date.now()
          });
          break;
        }
      }
    }
  }

  const unsoldRecords: string[] = [];
  for (const item of newInventory) {
    if (item.daysInStock >= 7 && item.quantity > 0) {
      const record = state.vinylCatalog.find(r => r.id === item.recordId)!;
      unsoldRecords.push(item.recordId);

      if (item.daysInStock === 7 || item.daysInStock % 3 === 0) {
        events.push({
          id: generateId(),
          type: 'warning',
          message: `${record.title} 已滞销 ${item.daysInStock} 天，库存剩余 ${item.quantity} 张`,
          suggestion: '考虑降价促销或调整进货策略',
          source: '库存预警系统',
          timestamp: Date.now()
        });
      }
    }
  }

  const report: DailyReport = {
    day: state.day,
    startingCash: state.cash,
    endingCash: newCash,
    purchases: [],
    sales,
    priceAdjustments: [],
    unsoldRecords,
    events: [...events],
    customerVisits
  };

  let isGameOver = false;
  let gameOverReason = '';

  if (newCash < 20 && newInventory.every(i => i.quantity === 0)) {
    isGameOver = true;
    gameOverReason = '资金链断裂，且无库存可售';
    events.push({
      id: generateId(),
      type: 'danger',
      message: '⚠️ 现金断档警告！资金链断裂，无法继续经营',
      suggestion: '游戏结束。下次请注意控制进货成本，保持现金流健康',
      source: '财务管理系统',
      timestamp: Date.now()
    });
  }

  const finalDay = state.day >= state.maxDays;
  if (finalDay || isGameOver) {
    isGameOver = true;
    if (finalDay) {
      gameOverReason = '经营周期结束';
    }
  }

  return {
    newState: {
      ...state,
      day: state.day + 1,
      cash: newCash,
      inventory: newInventory,
      isGameOver,
      gameOverReason,
      dailyReports: [...state.dailyReports, report],
      lastSavedAt: Date.now()
    },
    report,
    events
  };
};

export const advanceDay = (
  state: GameState,
  purchases: PurchaseDecision[],
  priceAdjustments: PriceAdjustment[]
): { newState: GameState; allEvents: GameEvent[] } => {
  let allEvents: GameEvent[] = [];

  const { newState: stateAfterPurchases, events: purchaseEvents } = processPurchases(state, purchases);
  allEvents = [...allEvents, ...purchaseEvents];

  const { newState: stateAfterPrices, events: priceEvents } = adjustPrices(stateAfterPurchases, priceAdjustments);
  allEvents = [...allEvents, ...priceEvents];

  const { newState: finalState, report, events: customerEvents } = simulateCustomerBehavior(stateAfterPrices);
  allEvents = [...allEvents, ...customerEvents];

  const updatedReport = {
    ...report,
    purchases: purchases.map(p => {
      const record = state.vinylCatalog.find(r => r.id === p.recordId);
      return {
        recordId: p.recordId,
        quantity: p.quantity,
        totalCost: (record?.purchasePrice || 0) * p.quantity
      };
    }),
    priceAdjustments: priceAdjustments.map(pa => {
      const oldPrice = state.inventory.find(i => i.recordId === pa.recordId)?.currentPrice || 0;
      return {
        recordId: pa.recordId,
        oldPrice,
        newPrice: pa.newPrice
      };
    })
  };

  finalState.dailyReports[finalState.dailyReports.length - 1] = updatedReport;

  return {
    newState: {
      ...finalState,
      gameEvents: [...state.gameEvents, ...allEvents]
    },
    allEvents
  };
};

export const calculateGameStats = (state: GameState) => {
  const totalRevenue = state.dailyReports.reduce((sum, r) => 
    sum + r.sales.reduce((s, s2) => s + s2.totalRevenue, 0), 0);
  
  const totalCost = state.dailyReports.reduce((sum, r) =>
    sum + r.purchases.reduce((s, p) => s + p.totalCost, 0), 0);

  const totalSales = state.dailyReports.reduce((sum, r) =>
    sum + r.sales.length, 0);

  const bestSelling = state.vinylCatalog.map(record => {
    const sold = state.dailyReports.reduce((sum, r) =>
      sum + r.sales.filter(s => s.recordId === record.id).reduce((s, s2) => s + s2.quantity, 0), 0);
    return { record, sold };
  }).sort((a, b) => b.sold - a.sold)[0];

  const worstSelling = state.inventory
    .filter(i => i.quantity > 0)
    .sort((a, b) => b.daysInStock - a.daysInStock)[0];

  const profit = state.cash - state.initialCash;

  return {
    totalRevenue,
    totalCost,
    profit,
    totalSales,
    bestSelling,
    worstSelling,
    returnRate: totalCost > 0 ? (profit / totalCost * 100) : 0,
    isWin: profit > 100
  };
};
