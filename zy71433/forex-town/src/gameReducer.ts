import type { GameState, GameAction, RoundResult, CorrectionRecord, ExceptionItem, Transaction } from './types';
import { getInitialState } from './mockData';

export const initialState: GameState = getInitialState();

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_TAB': {
      return { ...state, selectedTab: action.payload };
    }

    case 'CONFIRM_ORDER': {
      const orderId = action.payload;
      return {
        ...state,
        orders: state.orders.map((order) =>
          order.id === orderId
            ? { ...order, status: 'confirmed' as const, hasMissingFields: false, missingFields: undefined }
            : order
        ),
      };
    }

    case 'SHIP_ORDER': {
      const orderId = action.payload;
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) return state;

      const inventoryItem = state.inventory.find((inv) => inv.productId === order.productId);
      if (!inventoryItem || inventoryItem.quantity < order.quantity) return state;

      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === orderId ? { ...o, status: 'shipped' as const } : o
        ),
        inventory: state.inventory.map((inv) =>
          inv.productId === order.productId
            ? {
                ...inv,
                quantity: inv.quantity - order.quantity,
                totalValue: (inv.quantity - order.quantity) * inv.unitCost,
                isOverstock: inv.quantity - order.quantity >= inv.overstockThreshold,
              }
            : inv
        ),
      };
    }

    case 'COMPLETE_ORDER': {
      const orderId = action.payload;
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) return state;

      const cnyAmount = order.totalAmount * state.currentRate.rate;
      const newTransaction: Transaction = {
        id: `txn_${Date.now()}`,
        transactionNo: `TXN-2024-${String(state.transactions.length + 1).padStart(3, '0')}`,
        type: 'sale',
        amount: order.totalAmount,
        currency: order.currency,
        cnyEquivalent: cnyAmount,
        exchangeRateUsed: state.currentRate.rate,
        description: `${order.customerName}货款`,
        relatedOrderId: order.id,
        status: 'normal',
        round: state.currentRound,
        createTime: new Date(),
      };

      return {
        ...state,
        cash: state.cash + cnyAmount,
        orders: state.orders.map((o) =>
          o.id === orderId
            ? { ...o, status: 'delivered' as const, actualDeliveryRound: state.currentRound }
            : o
        ),
        transactions: [...state.transactions, newTransaction],
      };
    }

    case 'PROCESS_DEBT_COLLECTION': {
      const orderId = action.payload.orderId;
      const actionType = action.payload.action;
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) return state;

      if (actionType === 'write_off') {
        const cnyAmount = order.totalAmount * state.currentRate.rate;
        const newException: ExceptionItem = state.exceptions.find((e) => e.relatedOrderId === orderId)!;
        
        return {
          ...state,
          cash: state.cash - cnyAmount,
          orders: state.orders.map((o) =>
            o.id === orderId ? { ...o, status: 'defaulted' as const } : o
          ),
          exceptions: state.exceptions.map((e) =>
            e.id === newException.id
              ? { ...e, status: 'resolved' as const, resolvedRound: state.currentRound, resolution: '已计提坏账损失' }
              : e
          ),
        };
      }

      if (actionType === 'negotiate') {
        const recoveredAmount = order.totalAmount * 0.6;
        const cnyAmount = recoveredAmount * state.currentRate.rate;
        const newException: ExceptionItem = state.exceptions.find((e) => e.relatedOrderId === orderId)!;

        const newTransaction: Transaction = {
          id: `txn_${Date.now()}`,
          transactionNo: `TXN-2024-${String(state.transactions.length + 1).padStart(3, '0')}`,
          type: 'sale',
          amount: recoveredAmount,
          currency: order.currency,
          cnyEquivalent: cnyAmount,
          exchangeRateUsed: state.currentRate.rate,
          description: `${order.customerName}债务协商回款（60%）`,
          relatedOrderId: order.id,
          status: 'normal',
          round: state.currentRound,
          createTime: new Date(),
        };

        return {
          ...state,
          cash: state.cash + cnyAmount,
          orders: state.orders.map((o) =>
            o.id === orderId ? { ...o, status: 'defaulted' as const, remarks: '协商回收60%货款' } : o
          ),
          transactions: [...state.transactions, newTransaction],
          exceptions: state.exceptions.map((e) =>
            e.id === newException.id
              ? { ...e, status: 'resolved' as const, resolvedRound: state.currentRound, resolution: '协商回收60%货款' }
              : e
          ),
        };
      }

      return state;
    }

    case 'PURCHASE_INVENTORY': {
      const { productId, quantity, unitCost, currency } = action.payload;
      const totalForeign = quantity * unitCost;
      const cnyAmount = totalForeign * state.currentRate.rate;

      if (state.cash < cnyAmount) return state;

      const existingInventory = state.inventory.find((inv) => inv.productId === productId);
      const productName = existingInventory?.productName || action.payload.productName;

      const newTransaction: Transaction = {
        id: `txn_${Date.now()}`,
        transactionNo: `TXN-2024-${String(state.transactions.length + 1).padStart(3, '0')}`,
        type: 'purchase',
        amount: -totalForeign,
        currency,
        cnyEquivalent: -cnyAmount,
        exchangeRateUsed: state.currentRate.rate,
        description: `采购${productName} ${quantity}件`,
        relatedInventoryId: existingInventory?.id,
        status: 'normal',
        round: state.currentRound,
        createTime: new Date(),
      };

      let newInventory;
      if (existingInventory) {
        const newQuantity = existingInventory.quantity + quantity;
        const newUnitCost =
          (existingInventory.totalValue + totalForeign) / newQuantity;
        newInventory = state.inventory.map((inv) =>
          inv.productId === productId
            ? {
                ...inv,
                quantity: newQuantity,
                unitCost: newUnitCost,
                totalValue: existingInventory.totalValue + totalForeign,
                isOverstock: newQuantity >= inv.overstockThreshold,
              }
            : inv
        );
      } else {
        newInventory = [
          ...state.inventory,
          {
            id: `inv_${Date.now()}`,
            productId,
            productName,
            quantity,
            unitCost,
            totalValue: totalForeign,
            currency,
            purchaseRound: state.currentRound,
            overstockThreshold: quantity * 1.5,
            isOverstock: false,
          },
        ];
      }

      return {
        ...state,
        cash: state.cash - cnyAmount,
        inventory: newInventory,
        transactions: [...state.transactions, newTransaction],
      };
    }

    case 'FOREX_EXCHANGE': {
      const { amount, fromCurrency, toCurrency } = action.payload;
      const rate = state.currentRate.rate;
      const cnyAmount = amount * rate;

      const newTransaction: Transaction = {
        id: `txn_${Date.now()}`,
        transactionNo: `TXN-2024-${String(state.transactions.length + 1).padStart(3, '0')}`,
        type: 'forex_exchange',
        amount,
        currency: fromCurrency,
        cnyEquivalent: cnyAmount,
        exchangeRateUsed: rate,
        description: `${fromCurrency}结汇${amount}，兑换为${toCurrency}`,
        status: 'normal',
        round: state.currentRound,
        createTime: new Date(),
      };

      return {
        ...state,
        cash: state.cash + cnyAmount,
        transactions: [...state.transactions, newTransaction],
      };
    }

    case 'RESOLVE_EXCEPTION': {
      const { exceptionId, resolution, operator } = action.payload;
      return {
        ...state,
        exceptions: state.exceptions.map((e) =>
          e.id === exceptionId
            ? {
                ...e,
                status: 'resolved' as const,
                resolvedRound: state.currentRound,
                resolution,
                operator,
              }
            : e
        ),
      };
    }

    case 'CONFIRM_EXCEPTION': {
      const { exceptionId } = action.payload;
      const exception = state.exceptions.find((e) => e.id === exceptionId);
      if (!exception) return state;

      let cashAdjustment = 0;
      if (exception.type === 'forex_loss' && exception.amount) {
        cashAdjustment = -exception.amount;
      }

      const newTransaction: Transaction = {
        id: `txn_${Date.now()}`,
        transactionNo: `TXN-2024-${String(state.transactions.length + 1).padStart(3, '0')}`,
        type: 'forex_exchange',
        amount: cashAdjustment / state.currentRate.rate,
        currency: exception.currency || 'USD',
        cnyEquivalent: cashAdjustment,
        exchangeRateUsed: state.currentRate.rate,
        description: exception.title,
        reversedTransactionId: exception.relatedTransactionId,
        status: 'normal',
        round: state.currentRound,
        createTime: new Date(),
      };

      return {
        ...state,
        cash: state.cash + cashAdjustment,
        transactions: [...state.transactions, newTransaction],
        exceptions: state.exceptions.map((e) =>
          e.id === exceptionId
            ? { ...e, status: 'confirmed' as const, resolvedRound: state.currentRound }
            : e
        ),
      };
    }

    case 'CORRECT_TRANSACTION': {
      const { transactionId, fieldName, oldValue, newValue, reason, operator } = action.payload;
      
      const correctionRecord: CorrectionRecord = {
        id: `corr_${Date.now()}`,
        transactionId,
        fieldName,
        oldValue,
        newValue,
        reason,
        operator,
        timestamp: new Date(),
        round: state.currentRound,
      };

      const transaction = state.transactions.find((t) => t.id === transactionId);
      if (!transaction) return state;

      let cashAdjustment = 0;
      if (fieldName === 'amount' || fieldName === 'cnyEquivalent') {
        cashAdjustment = newValue - oldValue;
      }

      return {
        ...state,
        cash: state.cash + cashAdjustment,
        transactions: state.transactions.map((t) =>
          t.id === transactionId
            ? {
                ...t,
                [fieldName]: newValue,
                correctionHistory: [...(t.correctionHistory || []), correctionRecord],
              }
            : t
        ),
        correctionRecords: [...state.correctionRecords, correctionRecord],
      };
    }

    case 'REVERSE_TRANSACTION': {
      const { transactionId, reason } = action.payload;
      const transaction = state.transactions.find((t) => t.id === transactionId);
      if (!transaction || transaction.isReversed) return state;

      const reversalTransaction: Transaction = {
        id: `txn_${Date.now()}`,
        transactionNo: `TXN-2024-${String(state.transactions.length + 1).padStart(3, '0')}`,
        type: transaction.type,
        amount: -transaction.amount,
        currency: transaction.currency,
        cnyEquivalent: -transaction.cnyEquivalent,
        exchangeRateUsed: transaction.exchangeRateUsed,
        description: `冲正：${transaction.description}`,
        relatedOrderId: transaction.relatedOrderId,
        relatedInventoryId: transaction.relatedInventoryId,
        status: 'reversed' as const,
        round: state.currentRound,
        createTime: new Date(),
        isReversed: true,
        reversedTransactionId: transactionId,
        reversalReason: reason,
      };

      return {
        ...state,
        cash: state.cash - transaction.cnyEquivalent,
        transactions: state.transactions.map((t) =>
          t.id === transactionId
            ? { ...t, status: 'reversed' as const, isReversed: true, reversalReason: reason }
            : t
        ).concat(reversalTransaction),
      };
    }

    case 'SUPPLEMENT_TRANSACTION': {
      const { originalTransactionId, amount, currency, reason } = action.payload;
      const original = state.transactions.find((t) => t.id === originalTransactionId);
      if (!original) return state;

      const cnyAmount = amount * state.currentRate.rate;
      const supplementTransaction: Transaction = {
        id: `txn_${Date.now()}`,
        transactionNo: `TXN-2024-${String(state.transactions.length + 1).padStart(3, '0')}`,
        type: original.type,
        amount,
        currency,
        cnyEquivalent: cnyAmount,
        exchangeRateUsed: state.currentRate.rate,
        description: `补录：${original.description}`,
        relatedOrderId: original.relatedOrderId,
        relatedInventoryId: original.relatedInventoryId,
        status: 'supplement' as const,
        round: state.currentRound,
        createTime: new Date(),
        isSupplement: true,
        supplementReason: reason,
        supplementRound: original.round,
      };

      return {
        ...state,
        cash: state.cash + (original.type === 'sale' ? cnyAmount : -cnyAmount),
        transactions: [...state.transactions, supplementTransaction],
      };
    }

    case 'NEXT_ROUND': {
      if (state.currentRound >= state.totalRounds) {
        return {
          ...state,
          isGameOver: true,
          gameResult: state.cash >= state.targetCash ? 'win' : 'lose',
          finalAnalysis: generateFinalAnalysis(state),
        };
      }

      const nextRound = state.currentRound + 1;
      const nextRate = state.exchangeRates[nextRound - 1] || state.currentRate;

      const roundResult: RoundResult = calculateRoundResult(state);

      const newExceptions = generateRoundExceptions(state, nextRound);

      return {
        ...state,
        currentRound: nextRound,
        currentRate: nextRate,
        roundHistory: [...state.roundHistory, roundResult],
        exceptions: [...state.exceptions, ...newExceptions],
      };
    }

    case 'RESTART_GAME': {
      return getInitialState();
    }

    default:
      return state;
  }
}

function calculateRoundResult(state: GameState): RoundResult {
  const prevRound = state.roundHistory[state.roundHistory.length - 1];
  const startCash = prevRound ? prevRound.endCash : state.initialCash;

  const roundTransactions = state.transactions.filter((t) => t.round === state.currentRound);
  const revenue = roundTransactions
    .filter((t) => t.type === 'sale' && !t.isReversed)
    .reduce((sum, t) => sum + t.cnyEquivalent, 0);
  const costs = roundTransactions
    .filter((t) => t.type === 'purchase' && !t.isReversed)
    .reduce((sum, t) => sum + Math.abs(t.cnyEquivalent), 0);
  const forexGainLoss = roundTransactions
    .filter((t) => t.type === 'forex_exchange' && !t.isReversed)
    .reduce((sum, t) => sum + t.cnyEquivalent, 0);

  const inventoryValue = state.inventory.reduce(
    (sum, inv) => sum + inv.totalValue * state.currentRate.rate,
    0
  );

  const ordersCompleted = state.orders.filter(
    (o) => o.actualDeliveryRound === state.currentRound
  ).length;
  const ordersDefaulted = state.orders.filter(
    (o) => o.status === 'defaulted' && o.expectedDeliveryRound === state.currentRound - 1
  ).length;

  const roundExceptions = state.exceptions.filter((e) => e.discoveredRound === state.currentRound);

  return {
    round: state.currentRound,
    startCash,
    endCash: state.cash,
    cashChange: state.cash - startCash,
    revenue,
    costs,
    forexGainLoss,
    inventoryValue,
    ordersCompleted,
    ordersDefaulted,
    exceptionsGenerated: roundExceptions.map((e) => e.id),
    decisions: [],
    resultAnalysis: generateRoundAnalysis(state, revenue, costs, forexGainLoss),
  };
}

function generateRoundAnalysis(
  state: GameState,
  revenue: number,
  costs: number,
  forexGainLoss: number
): string {
  const parts: string[] = [];
  
  if (revenue > 0) {
    parts.push(`本期营收 ${revenue.toLocaleString()} 元`);
  }
  if (costs > 0) {
    parts.push(`采购支出 ${costs.toLocaleString()} 元`);
  }
  if (forexGainLoss !== 0) {
    parts.push(`汇兑损益 ${forexGainLoss > 0 ? '+' : ''}${forexGainLoss.toLocaleString()} 元`);
  }

  const pendingExceptions = state.exceptions.filter((e) => e.status === 'pending');
  if (pendingExceptions.length > 0) {
    parts.push(`待处理异常 ${pendingExceptions.length} 项`);
  }

  return parts.length > 0 ? parts.join('，') + '。' : '本期无重大经营活动。';
}

function generateRoundExceptions(state: GameState, round: number): ExceptionItem[] {
  const exceptions: ExceptionItem[] = [];

  const overstockItems = state.inventory.filter((inv) => inv.isOverstock);
  overstockItems.forEach((item, index) => {
    if (Math.random() < 0.3) {
      exceptions.push({
        id: `ex_${Date.now()}_${index}`,
        type: 'inventory_overstock',
        status: 'pending',
        title: `${item.productName}库存积压`,
        description: `${item.productName}当前库存${item.quantity}件，已超过警戒线${item.overstockThreshold}件。建议降价促销。`,
        amount: item.totalValue,
        currency: item.currency,
        relatedInventoryId: item.id,
        round,
        discoveredRound: round,
      });
    }
  });

  const pendingOrders = state.orders.filter(
    (o) => o.status === 'pending' && o.expectedDeliveryRound === round
  );
  pendingOrders.forEach((order, index) => {
    if (Math.random() < order.defaultRisk) {
      exceptions.push({
        id: `ex_${Date.now()}_${index + 10}`,
        type: 'customer_default',
        status: 'pending',
        title: `${order.customerName}存在违约风险`,
        description: `${order.customerName}的订单${order.orderNo}即将到期，客户信用评级下调，建议加强催收。`,
        amount: order.totalAmount,
        currency: order.currency,
        relatedOrderId: order.id,
        round,
        discoveredRound: round,
      });
    }
  });

  return exceptions;
}

function generateFinalAnalysis(state: GameState): string {
  const profit = state.cash - state.initialCash;
  const profitRate = ((profit / state.initialCash) * 100).toFixed(2);
  const targetGap = state.targetCash - state.cash;

  const analysis: string[] = [];

  analysis.push(`经营周期结束，最终现金余额：${state.cash.toLocaleString()} 元`);
  analysis.push(`累计${profit >= 0 ? '盈利' : '亏损'}：${Math.abs(profit).toLocaleString()} 元（${profitRate}%）`);

  if (state.gameResult === 'win') {
    analysis.push(`恭喜！已达成目标现金 ${state.targetCash.toLocaleString()} 元`);
  } else {
    analysis.push(`未达成目标，距目标还差 ${targetGap.toLocaleString()} 元`);
  }

  const totalOrders = state.orders.length;
  const completedOrders = state.orders.filter((o) => o.status === 'delivered').length;
  const defaultedOrders = state.orders.filter((o) => o.status === 'defaulted').length;
  analysis.push(`订单完成率：${((completedOrders / totalOrders) * 100).toFixed(1)}%，违约率：${((defaultedOrders / totalOrders) * 100).toFixed(1)}%`);

  const resolvedExceptions = state.exceptions.filter((e) => e.status === 'resolved' || e.status === 'confirmed').length;
  analysis.push(`异常处理率：${((resolvedExceptions / state.exceptions.length) * 100).toFixed(1)}%`);

  const corrections = state.correctionRecords.length;
  if (corrections > 0) {
    analysis.push(`期间共进行 ${corrections} 次人工修正`);
  }

  return analysis.join('。');
}
