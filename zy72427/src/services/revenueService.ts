import { v4 as uuidv4 } from 'uuid';
import { insertMany, findMany, updateOne } from '../database';
import { ImportService } from './importService';
import { CardService } from './cardService';
import { ConflictService } from './conflictService';
import {
  RevenueShareDetail,
  ClassAttendanceRecord,
  TicketExportRecord,
} from '../types';

export class RevenueService {
  private importService = new ImportService();
  private cardService = new CardService();
  private conflictService = new ConflictService();

  private readonly FORMULA_VERSION = 'v2.1.0';
  private readonly BASE_RATE = 100;
  private readonly SUBSTITUTE_ADJUSTMENT = -20;
  private readonly MAKEUP_MULTIPLIER = 1.2;

  calculateRevenue(
    cardId: string,
    calculatedBy: string,
    recalculationNote?: string
  ): { 
    version: number; 
    details: RevenueShareDetail[];
    previousVersion: number | null;
    recalculationNote: string;
  } {
    const card = this.cardService.getCard(cardId);
    if (!card) throw new Error('Card not found');

    const attendanceRecords = this.importService.getAttendanceByCardId(cardId);
    const ticketRecords = this.importService.getTicketsByCardId(cardId);
    const unresolvedConflicts = this.conflictService.getUnresolvedConflicts(cardId);

    if (unresolvedConflicts.length > 0) {
      throw new Error('存在未解决的冲突，请先处理冲突后再计算分账');
    }

    const previousVersion = card.revenueVersion || null;
    const newVersion = (card.revenueVersion || 0) + 1;
    const now = new Date().toISOString();

    if (previousVersion && previousVersion > 0) {
      const oldRevenues = findMany(
        'revenue', 
        (r: any) => r.cardId === cardId && r.version === previousVersion && !r.isWithdrawn
      );
      oldRevenues.forEach((r: any) => {
        updateOne('revenue', (x: any) => x.id === r.id, { isWithdrawn: true });
      });
    }

    const ticketMap = new Map<string, TicketExportRecord>();
    for (const ticket of ticketRecords) {
      const key = `${ticket.classDate}_${ticket.className}_${ticket.studentName}`;
      ticketMap.set(key, ticket);
    }

    const details: RevenueShareDetail[] = [];
    let note = recalculationNote || '';
    if (!note && previousVersion) {
      note = `第${newVersion}次重算，基于最新票务补录数据`;
    } else if (!note) {
      note = '首次计算分账';
    }

    for (const attendance of attendanceRecords) {
      const key = `${attendance.classDate}_${attendance.className}_${attendance.studentName}`;
      const ticket = ticketMap.get(key);

      const calculation = this.calculateSingleRecord(attendance, ticket);

      const detail: RevenueShareDetail = {
        id: uuidv4(),
        cardId,
        version: newVersion,
        classDate: attendance.classDate,
        className: attendance.className,
        studentName: attendance.studentName,
        baseAmount: calculation.baseAmount,
        adjustmentAmount: calculation.adjustmentAmount,
        finalAmount: calculation.finalAmount,
        calculationParams: {
          formulaVersion: this.FORMULA_VERSION,
          assumptions: [
            ...calculation.assumptions,
            `分账版本: v${newVersion}${previousVersion ? ` (取代v${previousVersion})` : ''}`,
            `重算说明: ${note}`,
          ],
          tradeoffs: calculation.tradeoffs,
        },
        calculatedAt: now,
        calculatedBy,
        isWithdrawn: false,
      };

      details.push(detail);
    }

    insertMany('revenue', details);
    this.cardService.updateCardFields(cardId, {
      revenueVersion: newVersion,
      status: 'REVENUE_CALCULATED',
      notes: note,
    }, {
      incrementVersion: true,
      createSnapshot: true,
      updatedBy: calculatedBy,
    });

    return { 
      version: newVersion, 
      details, 
      previousVersion,
      recalculationNote: note,
    };
  }

  private calculateSingleRecord(
    attendance: ClassAttendanceRecord,
    ticket?: TicketExportRecord
  ): {
    baseAmount: number;
    adjustmentAmount: number;
    finalAmount: number;
    assumptions: string[];
    tradeoffs: string[];
  } {
    const assumptions: string[] = [];
    const tradeoffs: string[] = [];
    let baseAmount = this.BASE_RATE;
    let adjustmentAmount = 0;

    assumptions.push(`基础费率: ${this.BASE_RATE}元/课时 (公式版本 ${this.FORMULA_VERSION})`);

    if (attendance.status === 'MAKEUP') {
      baseAmount = this.BASE_RATE * this.MAKEUP_MULTIPLIER;
      assumptions.push(`补录课时按 ${this.MAKEUP_MULTIPLIER}x 倍率计算`);
      tradeoffs.push('补录课时多计20%以补偿额外协调成本');
    } else if (attendance.status === 'ABSENT') {
      baseAmount = 0;
      assumptions.push('缺席课时不计费');
    } else if (attendance.status === 'TEMP_SUBSTITUTE') {
      adjustmentAmount = this.SUBSTITUTE_ADJUSTMENT;
      assumptions.push(`临时替补扣减 ${Math.abs(this.SUBSTITUTE_ADJUSTMENT)}元`);
      tradeoffs.push('临时替补扣减以覆盖培训成本');
    }

    if (attendance.isGroupMessageOnly) {
      assumptions.push('此记录为群内提及的临时替补，未经票务系统确认');
      tradeoffs.push('保留异常标记，待票务同事复核后可调整');
    }

    if (ticket && ticket.ticketCount > 1) {
      assumptions.push(`票务系统显示 ${ticket.ticketCount} 张票，按1课时计算`);
      tradeoffs.push('多张票合并为单课时计算，避免重复计费');
    }

    if (!ticket && attendance.status !== 'ABSENT') {
      assumptions.push('无对应票务记录，按签到状态正常计费');
    }

    const finalAmount = Math.max(0, baseAmount + adjustmentAmount);

    return {
      baseAmount,
      adjustmentAmount,
      finalAmount,
      assumptions,
      tradeoffs,
    };
  }

  getRevenueByCardId(cardId: string, version?: number): RevenueShareDetail[] {
    const card = this.cardService.getCard(cardId);
    
    let targetVersion = version;
    if (targetVersion === undefined && card && card.revenueVersion) {
      targetVersion = card.revenueVersion;
    }

    let records = findMany('revenue', (r: any) => r.cardId === cardId && !r.isWithdrawn);
    
    if (targetVersion !== undefined) {
      records = records.filter((r: any) => r.version === targetVersion);
    } else {
      const maxVersion = records.reduce((max, r) => Math.max(max, r.version || 0), 0);
      if (maxVersion > 0) {
        records = records.filter((r: any) => r.version === maxVersion);
      }
    }

    return records
      .sort((a, b) => a.classDate.localeCompare(b.classDate)) as RevenueShareDetail[];
  }

  getLatestRevenue(cardId: string): RevenueShareDetail[] {
    const card = this.cardService.getCard(cardId);
    if (!card || !card.revenueVersion) return [];
    return this.getRevenueByCardId(cardId, card.revenueVersion);
  }

  getRevenueExportData(cardId: string): any[] {
    const details = this.getLatestRevenue(cardId);
    return details.map((d) => ({
      日期: d.classDate,
      课程: d.className,
      学员: d.studentName,
      基础金额: d.baseAmount,
      调整金额: d.adjustmentAmount,
      最终金额: d.finalAmount,
      公式版本: d.calculationParams.formulaVersion,
      假设条件: d.calculationParams.assumptions.join('; '),
      取舍理由: d.calculationParams.tradeoffs.join('; '),
    }));
  }
}
