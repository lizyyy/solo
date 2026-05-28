import {
  InventoryLot,
  FuturesPosition,
  ExposureConfig,
  ExposureResult,
  WarningItem,
  BasisRecord,
  RolloverRecord,
} from '../types';

export class ExposureCalculator {
  constructor(
    private config: ExposureConfig,
    private basisRecords: BasisRecord[] = [],
    private rolloverRecords: RolloverRecord[] = []
  ) {}

  calculate(
    lots: InventoryLot[],
    positions: FuturesPosition[]
  ): ExposureResult {
    const filteredLots = this.filterLots(lots);
    const filteredPositions = this.filterPositions(positions);

    const spotExposure = this.calculateSpotExposure(filteredLots);
    const futuresHedge = this.calculateFuturesHedge(filteredPositions);
    const netExposure = spotExposure - futuresHedge * this.config.hedgingRatio;

    const warnings = this.detectWarnings(
      filteredLots,
      filteredPositions
    );

    return {
      configId: this.config.id,
      calculationDate: new Date().toISOString(),
      totalSpotExposure: spotExposure,
      totalFuturesHedge: futuresHedge,
      netExposure,
      hedgingRatio: this.config.hedgingRatio,
      basisRisk: this.calculateBasisRisk(filteredPositions),
      byDeliveryMonth: this.groupByDeliveryMonth(filteredLots, filteredPositions),
      unmatchedLots: this.getUnmatchedLots(filteredLots),
      warnings,
    };
  }

  private filterLots(lots: InventoryLot[]): InventoryLot[] {
    return lots.filter((lot) => {
      const receiptDate = new Date(lot.receiptDate);
      const startDate = new Date(this.config.dateRange.start);
      const endDate = new Date(this.config.dateRange.end);

      if (receiptDate < startDate || receiptDate > endDate) {
        return false;
      }

      if (!this.config.includeUnmatched && lot.matchStatus === 'unmatched') {
        return false;
      }

      return true;
    });
  }

  private filterPositions(positions: FuturesPosition[]): FuturesPosition[] {
    return positions.filter((pos) => {
      if (
        this.config.deliveryMonths.length > 0 &&
        !this.config.deliveryMonths.includes(pos.deliveryMonth)
      ) {
        return false;
      }

      const openDate = new Date(pos.openDate);
      const startDate = new Date(this.config.dateRange.start);
      const endDate = new Date(this.config.dateRange.end);

      return openDate >= startDate && openDate <= endDate;
    });
  }

  private calculateSpotExposure(lots: InventoryLot[]): number {
    return lots.reduce((sum, lot) => {
      if (this.config.calculationMethod === 'gross') {
        return sum + lot.quantity;
      }
      if (lot.matchStatus === 'matched' || lot.matchStatus === 'mismatch') {
        return sum + lot.quantity;
      }
      if (this.config.includeUnmatched && lot.matchStatus === 'unmatched') {
        return sum + lot.quantity;
      }
      return sum;
    }, 0);
  }

  private calculateFuturesHedge(positions: FuturesPosition[]): number {
    return positions.reduce((sum, pos) => {
      if (pos.direction === 'short' && pos.status !== 'closed') {
        return sum + pos.quantity;
      }
      return sum;
    }, 0);
  }

  private calculateBasisRisk(positions: FuturesPosition[]): number {
    const lockedBasis = this.basisRecords.filter(
      (b) => b.isLocked && positions.some((p) => p.id === b.positionId)
    );
    return lockedBasis.reduce((sum, b) => sum + b.basisValue * b.futuresPrice, 0);
  }

  private groupByDeliveryMonth(
    lots: InventoryLot[],
    positions: FuturesPosition[]
  ): Record<string, { spot: number; futures: number; net: number }> {
    const result: Record<string, { spot: number; futures: number; net: number }> = {};

    this.config.deliveryMonths.forEach((month) => {
      const monthPositions = positions.filter((p) => p.deliveryMonth === month);
      const monthLots = lots.filter((lot) => {
        const matchedPos = positions.find((p) => p.id === lot.matchedPositionId);
        return matchedPos?.deliveryMonth === month;
      });

      const spot = monthLots.reduce((sum, l) => sum + l.quantity, 0);
      const futures = monthPositions
        .filter((p) => p.direction === 'short' && p.status !== 'closed')
        .reduce((sum, p) => sum + p.quantity, 0);

      result[month] = {
        spot,
        futures,
        net: spot - futures * this.config.hedgingRatio,
      };
    });

    return result;
  }

  private getUnmatchedLots(lots: InventoryLot[]): string[] {
    return lots.filter((l) => l.matchStatus === 'unmatched').map((l) => l.id);
  }

  private detectWarnings(
    lots: InventoryLot[],
    positions: FuturesPosition[]
  ): WarningItem[] {
    const warnings: WarningItem[] = [];

    const mismatched = lots.filter((l) => l.matchStatus === 'mismatch');
    if (mismatched.length > 0) {
      const details = mismatched
        .map((l) => `${l.lotNo}: ${l.mismatchReason || '数量/日期不匹配'}`)
        .join('；');

      warnings.push({
        id: `mismatch-${Date.now()}`,
        type: 'mismatch',
        severity: 'high',
        title: `发现 ${mismatched.length} 个现货批次匹配异常`,
        description: `这些批次与对应期货持仓不匹配：${details}`,
        suggestion: '请前往批次匹配页面核对：检查到货数量是否与合同一致，确认期货手数是否对应现货量，必要时调整匹配关系',
        isRead: false,
      });
    }

    const duplicateBasisPositions = this.detectDuplicateBasis(positions);
    if (duplicateBasisPositions.length > 0) {
      const posIds = duplicateBasisPositions.join(', ');
      warnings.push({
        id: `basis-${Date.now()}`,
        type: 'basis_duplicate',
        severity: 'medium',
        title: '检测到基差可能重复扣减',
        description: `以下期货持仓存在多笔基差记录：${posIds}`,
        suggestion: '请检查基差录入是否重复，避免重复计算影响套保效果。应只保留已锁定的基差记录，未锁定的可标记为待确认',
        isRead: false,
      });
    }

    const rolloverIssues = this.detectRolloverIssues(positions);
    if (rolloverIssues.length > 0) {
      warnings.push({
        id: `rollover-${Date.now()}`,
        type: 'rollover',
        severity: 'medium',
        title: `发现 ${rolloverIssues.length} 笔移仓操作可能存在遗留敞口`,
        description: '跨月移仓后原合约未完全平盘，可能产生额外敞口。涉及持仓：' + rolloverIssues.map(r => r.contractMonth).join('、'),
        suggestion: '请在移仓追踪页面确认移仓是否完整，原合约是否已全部平仓，新合约手数是否与原合约一致',
        isRead: false,
      });
    }

    const unmatchedLots = lots.filter((l) => l.matchStatus === 'unmatched');
    if (unmatchedLots.length > 0) {
      warnings.push({
        id: `unmatched-${Date.now()}`,
        type: 'other',
        severity: 'low',
        title: `有 ${unmatchedLots.length} 个现货批次尚未匹配`,
        description: '这些批次还没有对应的期货套保持仓',
        suggestion: '请确认是否需要补开期货头寸，或在批次匹配页面完成匹配',
        isRead: false,
      });
    }

    return warnings;
  }

  private detectDuplicateBasis(positions: FuturesPosition[]): string[] {
    const positionBasisCount: Record<string, number> = {};
    this.basisRecords.forEach((b) => {
      if (positions.some((p) => p.id === b.positionId)) {
        positionBasisCount[b.positionId] = (positionBasisCount[b.positionId] || 0) + 1;
      }
    });
    return Object.entries(positionBasisCount)
      .filter(([_, count]) => count > 1)
      .map(([id]) => id);
  }

  private detectRolloverIssues(positions: FuturesPosition[]): FuturesPosition[] {
    const rolloverPositions = positions.filter(
      (p) => p.isRollover && p.status === 'open'
    );

    return rolloverPositions.filter((pos) => {
      if (!pos.rolloverFromId) return false;

      const originalPosition = positions.find(
        (p) => p.id === pos.rolloverFromId && p.status === 'open'
      );
      if (originalPosition) return true;

      const rolloverRecord = this.rolloverRecords.find(
        (r) => r.toPositionId === pos.id && !r.isComplete
      );
      return !!rolloverRecord;
    });
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatQuantity(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
