import { useCallback, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import {
  calculateBoxOfficeRisk,
  calculateInventoryRisk,
  calculateRouteRisk,
  calculateCashFlowRisk,
  calculateOverallRiskIndex,
} from '../utils/calculators/riskCalculator';
import { generateDisposalOptions } from '../utils/calculators/optionGenerator';
import type {
  Stop,
  MerchItem,
  StopResult,
  MerchSale,
  RiskEvent,
  DisposalOption,
  DecisionLog,
  RiskType,
  RiskLevel,
} from '../types/tour';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function useGameEngine() {
  const {
    currentTour,
    stops,
    merchItems,
    currentStopIndex,
    currentStopPhase,
    cashFlow,
    totalRevenue,
    totalExpense,
    riskIndex,
    decisions,
    riskEvents,
    stopResults,
    isGameOver,
    gameOverReason,
    dailySalesRate,
    startTour,
    processStop,
    recordDecision,
    recordRiskEvent,
    resolveRisk,
    dismissRisk,
    updateCashFlow,
    updateMerchStock,
    updateRiskIndex,
    setCurrentStopIndex,
    setCurrentStopPhase,
    goToPhase,
    resetGame,
  } = useGameStore();

  const currentStop = useMemo(() => {
    return stops[currentStopIndex] || null;
  }, [stops, currentStopIndex]);

  const remainingStops = useMemo(() => {
    return stops.slice(currentStopIndex);
  }, [stops, currentStopIndex]);

  const projectedExpenses = useMemo(() => {
    return remainingStops.map(
      (stop) => Number(stop.venueRent || 0) + Number(stop.transportCost || 0)
    );
  }, [remainingStops]);

  const checkPreShowRisks = useCallback(
    (stop: Stop): RiskEvent[] => {
      const detectedRisks: RiskEvent[] = [];

      const predictedRatio = 0.65 + Math.random() * 0.3;
      const estimatedAttendance = Math.round(stop.predictedAttendance * predictedRatio);

      const boxOfficeRisk = calculateBoxOfficeRisk(
        stop.predictedAttendance,
        estimatedAttendance
      );
      if (boxOfficeRisk !== 'low') {
        detectedRisks.push({
          id: generateId(),
          tourId: stop.tourId,
          stopId: stop.id,
          type: 'box_office',
          severity: boxOfficeRisk === 'high' ? 'critical' : 'warning',
          level: boxOfficeRisk,
          description: `票房预测偏高风险：预测${stop.predictedAttendance}人，预估实际约${estimatedAttendance}人，完成率可能仅${Math.round((estimatedAttendance / stop.predictedAttendance) * 100)}%，建议调整票价或加大宣传`,
          impact: Math.round((stop.predictedAttendance - estimatedAttendance) * stop.ticketPrice * (1 - (stop.venueSplit || 0))),
          triggeredAt: new Date().toISOString(),
        });
      }

      merchItems.forEach((item) => {
        const remainingDays = stops.length - currentStopIndex;
        const salesRate = dailySalesRate[item.id] || item.initialStock / Math.max(1, stops.length * 2);
        const inventoryRisk = calculateInventoryRisk(
          item.currentStock,
          salesRate,
          remainingDays
        );
        if (inventoryRisk !== 'low') {
          detectedRisks.push({
            id: generateId(),
            tourId: stop.tourId,
            stopId: stop.id,
            type: 'inventory',
            severity: inventoryRisk === 'high' ? 'critical' : 'warning',
            level: inventoryRisk,
            description: `库存压货风险：${item.name} 当前库存${item.currentStock}件，按当前销售速度需要${Math.round(item.currentStock / Math.max(1, salesRate))}天售完，剩余巡演仅${remainingDays}天，可能造成库存积压`,
            impact: Math.round(item.currentStock * item.costPrice * 0.3),
            triggeredAt: new Date().toISOString(),
          });
        }
      });

      if (stop.distanceFromPrev > 0 && currentStopIndex > 0) {
        const optimalDistance = 250;
        const routeRisk = calculateRouteRisk(stop.distanceFromPrev, optimalDistance);
        if (routeRisk !== 'low') {
          detectedRisks.push({
            id: generateId(),
            tourId: stop.tourId,
            stopId: stop.id,
            type: 'route',
            severity: routeRisk === 'high' ? 'critical' : 'warning',
            level: routeRisk,
            description: `路线绕远风险：本站距上一站${stop.distanceFromPrev}km，超出最优路线${Math.round(((stop.distanceFromPrev / optimalDistance) - 1) * 100)}%，交通成本和时间成本将增加`,
            impact: Math.round((stop.distanceFromPrev - optimalDistance) * 2.5),
            triggeredAt: new Date().toISOString(),
          });
        }
      }

      const cashFlowRisk = calculateCashFlowRisk(cashFlow, projectedExpenses);
      if (cashFlowRisk !== 'low') {
        const next3Expenses = projectedExpenses.slice(0, 3).reduce((a, b) => a + b, 0);
        detectedRisks.push({
          id: generateId(),
          tourId: stop.tourId,
          stopId: stop.id,
          type: 'cashflow',
          severity: cashFlowRisk === 'high' ? 'critical' : 'warning',
          level: cashFlowRisk,
          description: `现金流紧张风险：当前余额¥${cashFlow.toLocaleString()}，未来3站预计支出¥${next3Expenses.toLocaleString()}，资金可能不足以支撑后续巡演`,
          impact: next3Expenses - cashFlow,
          triggeredAt: new Date().toISOString(),
        });
      }

      return detectedRisks;
    },
    [merchItems, currentStopIndex, stops.length, cashFlow, projectedExpenses, dailySalesRate]
  );

  const currentStopRisks = useMemo(() => {
    if (!currentStop) return [];
    return riskEvents.filter(
      (r) => r.stopId === currentStop.id && !r.resolvedAt && !r.dismissed
    );
  }, [riskEvents, currentStop]);

  const hasUnresolvedRisks = useMemo(() => {
    return currentStopRisks.length > 0;
  }, [currentStopRisks]);

  const calculateStopResult = useCallback(
    (stop: Stop, actualAttendance: number): StopResult => {
      const ticketRevenue = Math.round(
        actualAttendance * stop.ticketPrice * (1 - (stop.venueSplit || 0))
      );

      const merchSales: MerchSale[] = [];
      let merchRevenue = 0;
      let merchCost = 0;

      merchItems.forEach((item) => {
        const conversionRate = 0.15 + Math.random() * 0.2;
        const quantity = Math.min(
          Math.round(actualAttendance * conversionRate * (item.sellingPrice > 100 ? 0.5 : 1)),
          item.currentStock
        );

        if (quantity > 0) {
          const sale: MerchSale = {
            id: generateId(),
            stopId: stop.id,
            merchItemId: item.id,
            quantity,
            unitPrice: item.sellingPrice,
            promotionType: 'none',
          };
          merchSales.push(sale);
          merchRevenue += quantity * item.sellingPrice;
          merchCost += quantity * item.costPrice;
        }
      });

      const totalRevenue = ticketRevenue + merchRevenue;
      const venueExpense = stop.venueRent;
      const transportExpense = stop.transportCost;
      const otherExpenses = Math.round(actualAttendance * 5);
      const totalExpense = venueExpense + transportExpense + merchCost + otherExpenses;
      const netProfit = totalRevenue - totalExpense;

      return {
        stopId: stop.id,
        ticketRevenue,
        merchRevenue,
        totalRevenue,
        venueExpense,
        transportExpense,
        merchCost,
        otherExpenses,
        totalExpense,
        netProfit,
        actualAttendance,
        merchSales,
        risks: [],
      };
    },
    [merchItems]
  );

  const simulateAttendance = useCallback(
    (stop: Stop, riskModifier: number = 0): number => {
      const baseVariation = 0.6 + Math.random() * 0.6;
      const riskFactor = 1 - riskModifier * 0.3;
      const actual = Math.round(stop.predictedAttendance * baseVariation * riskFactor);
      return Math.max(0, actual);
    },
    []
  );

  const detectPostShowRisks = useCallback(
    (stop: Stop, actualAttendance: number): RiskEvent[] => {
      const detectedRisks: RiskEvent[] = [];

      const boxOfficeRisk = calculateBoxOfficeRisk(
        stop.predictedAttendance,
        actualAttendance
      );
      if (boxOfficeRisk !== 'low') {
        detectedRisks.push({
          id: generateId(),
          tourId: stop.tourId,
          stopId: stop.id,
          type: 'box_office',
          severity: boxOfficeRisk === 'high' ? 'critical' : 'warning',
          level: boxOfficeRisk,
          description: `票房预测过高：预测${stop.predictedAttendance}人，实际${actualAttendance}人，完成率${Math.round((actualAttendance / stop.predictedAttendance) * 100)}%`,
          impact: Math.round((stop.predictedAttendance - actualAttendance) * stop.ticketPrice * (1 - (stop.venueSplit || 0))),
          triggeredAt: new Date().toISOString(),
        });
      }

      return detectedRisks;
    },
    []
  );

  const processCurrentStop = useCallback(
    (actualAttendance?: number) => {
      if (!currentStop || isGameOver) return null;

      const attendance = actualAttendance ?? simulateAttendance(currentStop, riskIndex / 100);
      const result = calculateStopResult(currentStop, attendance);

      result.merchSales.forEach((sale) => {
        updateMerchStock(sale.merchItemId, -sale.quantity);
      });

      const postRisks = detectPostShowRisks(currentStop, attendance);
      postRisks.forEach((risk) => {
        recordRiskEvent(risk);
      });

      result.risks = postRisks;

      const riskValues = postRisks.map((r) => ({
        type: r.type,
        level: r.level,
      }));
      const newRiskIndex = calculateOverallRiskIndex([
        ...riskEvents.map((r) => ({ type: r.type, level: r.level })),
        ...riskValues,
      ]);
      updateRiskIndex(newRiskIndex - riskIndex);

      const dismissedRisks = riskEvents.filter(
        (r) => r.stopId === currentStop.id && r.dismissed
      );
      if (dismissedRisks.length > 0) {
        recordDecision({
          tourId: currentStop.tourId,
          stopId: currentStop.id,
          decisionType: 'risk_mitigation',
          description: `本站共忽略${dismissedRisks.length}个风险预警，已自动扣除惩罚成本`,
          chosenOption: {
            id: 'dismiss',
            name: '忽略风险',
            description: '未处置的风险自动造成损失',
            riskLevel: 'aggressive',
            immediateImpact: { cashFlow: 0, riskIndex: 0 },
            projectedOutcome: { bestCase: 0, expectedCase: 0, worstCase: 0 },
          },
          alternatives: [],
          outcome: {
            actualImpact: dismissedRisks.reduce((sum, r) => sum + (r.dismissedImpact?.cashFlow || 0), 0),
            riskChange: dismissedRisks.length * 5,
            notes: `忽略了${dismissedRisks.length}个风险预警`,
          },
        });
      }

      processStop(currentStop.id, result);

      return result;
    },
    [
      currentStop,
      isGameOver,
      simulateAttendance,
      calculateStopResult,
      detectPostShowRisks,
      processStop,
      recordRiskEvent,
      recordDecision,
      updateMerchStock,
      updateRiskIndex,
      riskIndex,
      riskEvents,
    ]
  );

  const getDisposalOptions = useCallback(
    (riskType: RiskType, riskLevel: RiskLevel): DisposalOption[] => {
      const state = {
        cashFlow,
        currentStopIndex,
        totalStops: stops.length,
        riskIndex,
        merchItems,
      };
      return generateDisposalOptions(riskType, riskLevel, state);
    },
    [cashFlow, currentStopIndex, stops.length, riskIndex, merchItems]
  );

  const applyDisposalOption = useCallback(
    (riskEvent: RiskEvent, option: DisposalOption) => {
      const alternatives = getDisposalOptions(riskEvent.type, riskEvent.level);

      const decision: Omit<DecisionLog, 'id' | 'createdAt'> = {
        tourId: riskEvent.tourId,
        stopId: riskEvent.stopId,
        decisionType: 'risk_mitigation',
        description: `处置风险：${riskEvent.description}`,
        chosenOption: option,
        alternatives,
        outcome: {
          actualImpact: option.immediateImpact.cashFlow,
          riskChange: option.immediateImpact.riskIndex,
          notes: option.description,
        },
      };

      recordDecision(decision);
      updateCashFlow(option.immediateImpact.cashFlow);
      updateRiskIndex(option.immediateImpact.riskIndex);
      resolveRisk(riskEvent.id, option.id);

      if (option.riskLevel === 'conservative' && riskEvent.type === 'inventory') {
        const overstockedItem = merchItems.find(
          (m) => m.currentStock > m.initialStock * 0.7
        );
        if (overstockedItem) {
          const discount = Math.round(overstockedItem.sellingPrice * 0.2);
          recordDecision({
            tourId: riskEvent.tourId,
            stopId: riskEvent.stopId,
            decisionType: 'inventory',
            description: `库存促销：${overstockedItem.name} 打折${discount}元`,
            chosenOption: option,
            alternatives: [],
            outcome: {
              actualImpact: -discount * 10,
              riskChange: -5,
            },
          });
        }
      }
    },
    [getDisposalOptions, recordDecision, updateCashFlow, updateRiskIndex, resolveRisk, merchItems]
  );

  const dismissRiskEvent = useCallback(
    (riskEvent: RiskEvent) => {
      const penaltyMultiplier = riskEvent.level === 'high' ? 1.0 : riskEvent.level === 'medium' ? 0.6 : 0.3;
      const penaltyCashFlow = -Math.round(riskEvent.impact * penaltyMultiplier);
      const penaltyDescription = `忽略${riskEvent.type === 'box_office' ? '票房' : riskEvent.type === 'inventory' ? '库存' : riskEvent.type === 'route' ? '路线' : '现金流'}风险：${riskEvent.description.substring(0, 30)}...，自动扣除预估影响的${Math.round(penaltyMultiplier * 100)}%`;

      dismissRisk(riskEvent.id, {
        cashFlow: penaltyCashFlow,
        description: penaltyDescription,
      });

      recordDecision({
        tourId: riskEvent.tourId,
        stopId: riskEvent.stopId,
        decisionType: 'risk_mitigation',
        description: `忽略风险：${riskEvent.description}`,
        chosenOption: {
          id: 'dismiss',
          name: '忽略风险',
          description: penaltyDescription,
          riskLevel: 'aggressive',
          immediateImpact: { cashFlow: penaltyCashFlow, riskIndex: 10 },
          projectedOutcome: { bestCase: 0, expectedCase: penaltyCashFlow, worstCase: penaltyCashFlow * 2 },
        },
        alternatives: [],
        outcome: {
          actualImpact: penaltyCashFlow,
          riskChange: 10,
          notes: penaltyDescription,
        },
      });

      updateRiskIndex(10);
    },
    [dismissRisk, recordDecision, updateRiskIndex]
  );

  const initializeTour = useCallback(
    (
      tourData: {
        id: string;
        name: string;
        bandName?: string;
        initialBudget: number;
        startDate: string;
        endDate: string;
        notes?: string;
        rawData: any;
        processingLog: any[];
      },
      stopsData: Omit<Stop, 'id' | 'tourId' | 'status' | 'order'>[],
      merchData: Omit<MerchItem, 'id' | 'tourId'>[]
    ) => {
      const tourId = generateId();

      const tour = {
        ...tourData,
        id: tourId,
      };

      const stops: Stop[] = stopsData.map((stop, index) => ({
        ...stop,
        id: generateId(),
        tourId,
        status: 'pending' as const,
        order: index,
      }));

      const merch: MerchItem[] = merchData.map((item) => ({
        ...item,
        id: generateId(),
        tourId,
      }));

      startTour(tour, stops, merch);
    },
    [startTour]
  );

  const goToStop = useCallback(
    (index: number) => {
      if (index >= 0 && index < stops.length) {
        setCurrentStopIndex(index);
      }
    },
    [stops.length, setCurrentStopIndex]
  );

  const getGameStats = useCallback(() => {
    const completedStops = stops.filter((s) => s.status === 'completed');
    const successfulStops = stopResults.filter((r) => r.netProfit > 0);
    const highRiskEvents = riskEvents.filter((r) => r.level === 'high');

    const stopProfits = stopResults.map((r) => ({
      stopId: r.stopId,
      profit: r.netProfit,
    }));

    const bestStop = stopProfits.length
      ? stops.find((s) => s.id === stopProfits.sort((a, b) => b.profit - a.profit)[0]?.stopId)?.city || null
      : null;
    const worstStop = stopProfits.length
      ? stops.find((s) => s.id === stopProfits.sort((a, b) => a.profit - b.profit)[0]?.stopId)?.city || null
      : null;

    const avgDecisionRisk = decisions.length
      ? decisions.reduce((sum, d) => {
          const weight =
            d.chosenOption.riskLevel === 'conservative' ? 0 :
            d.chosenOption.riskLevel === 'balanced' ? 50 : 100;
          return sum + weight;
        }, 0) / decisions.length
      : 0;

    return {
      totalStops: stops.length,
      completedStops: completedStops.length,
      successfulStops: successfulStops.length,
      totalRiskEvents: riskEvents.length,
      highRiskEvents: highRiskEvents.length,
      decisionsMade: decisions.length,
      averageDecisionRisk: Math.round(avgDecisionRisk),
      bestPerformingStop: bestStop,
      worstPerformingStop: worstStop,
    };
  }, [stops, stopResults, riskEvents, decisions]);

  return {
    currentTour,
    currentStop,
    remainingStops,
    stops,
    merchItems,
    currentStopIndex,
    currentStopPhase,
    cashFlow,
    totalRevenue,
    totalExpense,
    riskIndex,
    decisions,
    riskEvents,
    stopResults,
    isGameOver,
    gameOverReason,
    currentStopRisks,
    hasUnresolvedRisks,

    initializeTour,
    processCurrentStop,
    checkPreShowRisks,
    getDisposalOptions,
    applyDisposalOption,
    dismissRiskEvent,
    goToStop,
    goToPhase,
    setCurrentStopPhase,
    resetGame,
    getGameStats,
    calculateStopResult,
  };
}
