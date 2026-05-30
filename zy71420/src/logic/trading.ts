import { Bond, Position, Transaction } from '../types/game';

export function calculateTotalBondValue(
  positions: Position[],
  bonds: Bond[]
): number {
  return positions.reduce((total, pos) => {
    const bond = bonds.find(b => b.id === pos.bondId);
    if (!bond) return total;
    return total + pos.quantity * bond.currentPrice;
  }, 0);
}

export function calculateTotalAssets(
  cash: number,
  positions: Position[],
  bonds: Bond[]
): number {
  return cash + calculateTotalBondValue(positions, bonds);
}

export function executeBuy(
  cash: number,
  positions: Position[],
  bonds: Bond[],
  bondId: string,
  quantity: number,
  currentRound: number
): {
  newCash: number;
  newPositions: Position[];
  transaction: Transaction;
  success: boolean;
  error?: string;
} {
  const bond = bonds.find(b => b.id === bondId);
  if (!bond) {
    return {
      newCash: cash,
      newPositions: positions,
      transaction: {} as Transaction,
      success: false,
      error: '债券不存在'
    };
  }

  const totalCost = bond.currentPrice * quantity;
  
  if (totalCost > cash) {
    return {
      newCash: cash - totalCost,
      newPositions: positions,
      transaction: {} as Transaction,
      success: false,
      error: '现金不足'
    };
  }

  const existingPos = positions.find(p => p.bondId === bondId);
  let newPositions: Position[];

  if (existingPos) {
    const newQuantity = existingPos.quantity + quantity;
    const newAvgCost = 
      (existingPos.avgCost * existingPos.quantity + totalCost) / newQuantity;
    
    newPositions = positions.map(p =>
      p.bondId === bondId
        ? { ...p, quantity: newQuantity, avgCost: Math.round(newAvgCost * 100) / 100 }
        : p
    );
  } else {
    newPositions = [
      ...positions,
      {
        bondId,
        quantity,
        avgCost: bond.currentPrice
      }
    ];
  }

  const transaction: Transaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    round: currentRound,
    type: 'buy',
    bondId,
    quantity,
    price: bond.currentPrice,
    timestamp: Date.now()
  };

  return {
    newCash: Math.round((cash - totalCost) * 100) / 100,
    newPositions,
    transaction,
    success: true
  };
}

export function executeSell(
  cash: number,
  positions: Position[],
  bonds: Bond[],
  bondId: string,
  quantity: number,
  currentRound: number
): {
  newCash: number;
  newPositions: Position[];
  transaction: Transaction;
  success: boolean;
  error?: string;
} {
  const bond = bonds.find(b => b.id === bondId);
  if (!bond) {
    return {
      newCash: cash,
      newPositions: positions,
      transaction: {} as Transaction,
      success: false,
      error: '债券不存在'
    };
  }

  const existingPos = positions.find(p => p.bondId === bondId);
  if (!existingPos || existingPos.quantity < quantity) {
    return {
      newCash: cash,
      newPositions: positions,
      transaction: {} as Transaction,
      success: false,
      error: '持仓不足'
    };
  }

  const totalRevenue = bond.currentPrice * quantity;
  let newPositions: Position[];

  if (existingPos.quantity === quantity) {
    newPositions = positions.filter(p => p.bondId !== bondId);
  } else {
    newPositions = positions.map(p =>
      p.bondId === bondId
        ? { ...p, quantity: p.quantity - quantity }
        : p
    );
  }

  const transaction: Transaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    round: currentRound,
    type: 'sell',
    bondId,
    quantity,
    price: bond.currentPrice,
    timestamp: Date.now()
  };

  return {
    newCash: Math.round((cash + totalRevenue) * 100) / 100,
    newPositions,
    transaction,
    success: true
  };
}

export function getPositionQuantity(
  positions: Position[],
  bondId: string
): number {
  const pos = positions.find(p => p.bondId === bondId);
  return pos ? pos.quantity : 0;
}

export function calculatePositionPnL(
  position: Position,
  bond: Bond
): { unrealizedPnL: number; unrealizedPnLPercent: number } {
  const currentValue = position.quantity * bond.currentPrice;
  const costValue = position.quantity * position.avgCost;
  const unrealizedPnL = Math.round((currentValue - costValue) * 100) / 100;
  const unrealizedPnLPercent = Math.round((unrealizedPnL / costValue) * 10000) / 100;
  
  return { unrealizedPnL, unrealizedPnLPercent };
}
