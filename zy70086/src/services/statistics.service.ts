import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import dayjs from 'dayjs';
import { Bin, BinStatus, BinType, BinEvent, EventStatus, Dispatch, DispatchStatus, Receipt, ReceiptStatus, DailyStat, Route, RoutePointStatus } from '../entities';
import { AppDataSource } from '../database/data-source';
import { BizResponse, success, idempotent, businessError } from '../utils/biz-response';
import { IdempotentService } from './idempotent.service';

export class StatisticsService {
  private binRepo: Repository<Bin>;
  private eventRepo: Repository<BinEvent>;
  private dispatchRepo: Repository<Dispatch>;
  private receiptRepo: Repository<Receipt>;
  private dailyStatRepo: Repository<DailyStat>;
  private routeRepo: Repository<Route>;
  private idempotentService: IdempotentService;

  constructor() {
    this.binRepo = AppDataSource.getRepository(Bin);
    this.eventRepo = AppDataSource.getRepository(BinEvent);
    this.dispatchRepo = AppDataSource.getRepository(Dispatch);
    this.receiptRepo = AppDataSource.getRepository(Receipt);
    this.dailyStatRepo = AppDataSource.getRepository(DailyStat);
    this.routeRepo = AppDataSource.getRepository(Route);
    this.idempotentService = new IdempotentService();
  }

  async getTodayOverview(): Promise<BizResponse> {
    const today = dayjs().format('YYYY-MM-DD');
    const startOfDay = dayjs(today).startOf('day').toDate();
    const endOfDay = dayjs(today).endOf('day').toDate();

    const allBins = await this.binRepo.find();
    const totalBinCount = allBins.length;
    const binsByStatus = new Map<string, number>();
    const binsByType = new Map<string, number>();
    const urgentBins = allBins.filter((b) => b.isUrgent);
    const fullBins = allBins.filter((b) => b.status === BinStatus.FULL);
    const overflowBins = allBins.filter((b) => b.status === BinStatus.OVERFLOW);

    for (const bin of allBins) {
      binsByStatus.set(bin.status, (binsByStatus.get(bin.status) || 0) + 1);
      binsByType.set(bin.binType, (binsByType.get(bin.binType) || 0) + 1);
    }

    const todayEvents = await this.eventRepo.find({
      where: { createdAt: Between(startOfDay, endOfDay) },
    });
    const todayFullEvents = todayEvents.filter((e) =>
      e.eventType.includes('满溢') || e.eventType.includes('溢漏')
    ).length;
    const todayResolvedEvents = todayEvents.filter((e) => e.status === EventStatus.RESOLVED).length;
    const pendingEvents = await this.eventRepo.count({ where: { status: EventStatus.PENDING } });
    const urgentEvents = await this.eventRepo.count({
      where: [
        { status: EventStatus.PENDING, level: '紧急' as any },
        { status: EventStatus.PENDING, level: '重大' as any },
      ],
    });

    const todayDispatches = await this.dispatchRepo.find({
      where: { dispatchDate: today },
    });
    const todayCompletedDispatches = todayDispatches.filter((d) => d.status === DispatchStatus.COMPLETED);

    const todayRouteIds = todayCompletedDispatches.map((d) => d.id);
    const todayCollectedWeight = todayCompletedDispatches.reduce(
      (sum, d) => sum + d.actualWeight,
      0,
    );
    const todayCollectedBins = todayCompletedDispatches.reduce(
      (sum, d) => sum + d.actualBinCount,
      0,
    );

    const todayReceipts = await this.receiptRepo.find({
      where: { createdAt: Between(startOfDay, endOfDay) },
    });
    const todaySettledReceipts = todayReceipts.filter((r) => r.status === ReceiptStatus.SETTLED);
    const todayTotalFee = todaySettledReceipts.reduce(
      (sum, r) => sum + Number(r.totalFee),
      0,
    );

    const urgentDispatchNeeded = urgentBins.length >= 3 || overflowBins.length >= 1;

    return success(
      {
        date: today,
        overview: {
          totalBinCount,
          urgentBins: urgentBins.length,
          fullBins: fullBins.length,
          overflowBins: overflowBins.length,
          pendingEvents,
          urgentEvents,
          urgentDispatchNeeded,
        },
        bins: {
          total: totalBinCount,
          byStatus: Object.fromEntries(binsByStatus),
          byType: Object.fromEntries(binsByType),
        },
        events: {
          todayTotal: todayEvents.length,
          todayFullAlerts: todayFullEvents,
          todayResolved: todayResolvedEvents,
          pending: pendingEvents,
          urgent: urgentEvents,
        },
        dispatches: {
          todayTotal: todayDispatches.length,
          todayCompleted: todayCompletedDispatches.length,
          todayCollectedWeight,
          todayCollectedBins,
        },
        receipts: {
          todayTotal: todayReceipts.length,
          todaySettled: todaySettledReceipts.length,
          todayTotalFee: Number(todayTotalFee.toFixed(2)),
        },
        alerts: [
          ...(urgentBins.length > 0 ? [`有 ${urgentBins.length} 个紧急桶点需要尽快清运`] : []),
          ...(overflowBins.length > 0 ? [`有 ${overflowBins.length} 个桶点已溢漏！`] : []),
          ...(pendingEvents > 5 ? [`待处理事件较多（${pendingEvents} 个）`] : []),
        ],
        recommendations: urgentDispatchNeeded
          ? ['建议立即创建调度单处理紧急桶点']
          : ['当前桶点状态正常，可按计划清运'],
      },
      `今日概览：${today} —— 桶点 ${totalBinCount} 个，紧急 ${urgentBins.length} 个，今日清运 ${todayCollectedBins} 个，重量 ${todayCollectedWeight}kg，结算费用 ${todayTotalFee.toFixed(2)} 元`,
    );
  }

  async getRangeStatistics(startDate?: string, endDate?: string): Promise<BizResponse> {
    const today = dayjs().format('YYYY-MM-DD');
    const effectiveStart = startDate || dayjs().subtract(7, 'day').format('YYYY-MM-DD');
    const effectiveEnd = endDate || today;

    const start = dayjs(effectiveStart).startOf('day').toDate();
    const end = dayjs(effectiveEnd).endOf('day').toDate();

    const dispatches = await this.dispatchRepo.find({
      where: {
        dispatchDate: Between(effectiveStart, effectiveEnd),
      },
    });
    const completedDispatches = dispatches.filter((d) => d.status === DispatchStatus.COMPLETED);

    const totalDispatches = dispatches.length;
    const completedDispatchCount = completedDispatches.length;
    const totalCollectedWeight = completedDispatches.reduce((sum, d) => sum + d.actualWeight, 0);
    const totalCollectedBins = completedDispatches.reduce((sum, d) => sum + d.actualBinCount, 0);

    const receipts = await this.receiptRepo.find({
      where: { createdAt: Between(start, end) },
    });
    const settledReceipts = receipts.filter((r) => r.status === ReceiptStatus.SETTLED);
    const totalFee = settledReceipts.reduce((sum, r) => sum + Number(r.totalFee), 0);

    const events = await this.eventRepo.find({
      where: { createdAt: Between(start, end) },
    });
    const fullEvents = events.filter((e) =>
      e.eventType.includes('满溢') || e.eventType.includes('溢漏')
    );
    const resolvedEvents = events.filter((e) => e.status === EventStatus.RESOLVED);

    const dailyStats = await this.dailyStatRepo.find({
      where: {
        statDate: Between(effectiveStart, effectiveEnd),
      },
      order: { statDate: 'ASC' },
    });

    const dispatchRate = totalDispatches > 0
      ? Math.floor((completedDispatchCount / totalDispatches) * 100)
      : 0;
    const resolutionRate = events.length > 0
      ? Math.floor((resolvedEvents.length / events.length) * 100)
      : 0;
    const avgWeightPerDispatch = completedDispatchCount > 0
      ? Math.floor(totalCollectedWeight / completedDispatchCount)
      : 0;

    return success(
      {
        range: {
          startDate: effectiveStart,
          endDate: effectiveEnd,
          days: dayjs(effectiveEnd).diff(dayjs(effectiveStart), 'day') + 1,
        },
        summary: {
          totalDispatches,
          completedDispatchCount,
          dispatchRate: `${dispatchRate}%`,
          totalCollectedWeight,
          totalCollectedBins,
          avgWeightPerDispatch,
          totalReceipts: receipts.length,
          settledReceipts: settledReceipts.length,
          totalFee: Number(totalFee.toFixed(2)),
          totalEvents: events.length,
          fullAlerts: fullEvents.length,
          resolvedEvents: resolvedEvents.length,
          resolutionRate: `${resolutionRate}%`,
        },
        dailyBreakdown: dailyStats.map((s) => ({
          date: s.statDate,
          fullBinCount: s.fullBinCount,
          overflowBinCount: s.overflowBinCount,
          dispatchCount: s.todayDispatchCount,
          completedDispatchCount: s.todayCompletedDispatchCount,
          collectedWeight: s.todayCollectedWeight,
          collectedBins: s.todayCollectedBinCount,
          totalFee: s.todayTotalFee,
        })),
        insights: [
          totalCollectedWeight > 0
            ? `期间共清运 ${totalCollectedWeight}kg 垃圾，平均每车 ${avgWeightPerDispatch}kg`
            : '期间无清运数据',
          dispatchRate >= 80
            ? `调度完成率良好（${dispatchRate}%）`
            : `调度完成率待提高（${dispatchRate}%）`,
          resolutionRate >= 80
            ? `事件处理及时（${resolutionRate}%）`
            : `事件处理存在积压（${resolutionRate}%）`,
        ],
      },
      `统计周期：${effectiveStart} 至 ${effectiveEnd} —— 调度 ${completedDispatchCount}/${totalDispatches}，清运 ${totalCollectedWeight}kg，费用 ${totalFee.toFixed(2)} 元`,
    );
  }

  async refreshTodayStats(requestId: string): Promise<BizResponse> {
    const bizType = 'STATS_REFRESH';
    const { reserved, existing } = await this.idempotentService.checkOrReserve(
      bizType,
      requestId,
      JSON.stringify({ action: 'refresh-today' }),
    );

    if (!reserved && existing) {
      if (existing.status === 'SUCCESS' && existing.responseSnapshot) {
        const savedData = JSON.parse(existing.responseSnapshot);
        return idempotent(savedData, '今日统计已刷新（重复请求）');
      }
      return idempotent({ refreshed: false }, '正在刷新统计');
    }

    const today = dayjs().format('YYYY-MM-DD');
    const startOfDay = dayjs(today).startOf('day').toDate();
    const endOfDay = dayjs(today).endOf('day').toDate();

    try {
      const allBins = await this.binRepo.find();
      const totalBinCount = allBins.length;
      const normalBinCount = allBins.filter((b) => b.status === BinStatus.NORMAL || b.status === '接近满溢' as any).length;
      const fullBinCount = allBins.filter((b) => b.status === BinStatus.FULL).length;
      const overflowBinCount = allBins.filter((b) => b.status === BinStatus.OVERFLOW).length;

      const todayEvents = await this.eventRepo.find({
        where: { createdAt: Between(startOfDay, endOfDay) },
      });
      const todayFullEventCount = todayEvents.filter((e) =>
        e.eventType.includes('满溢') || e.eventType.includes('溢漏')
      ).length;
      const todayResolvedEventCount = todayEvents.filter((e) => e.status === EventStatus.RESOLVED).length;

      const todayDispatches = await this.dispatchRepo.find({
        where: { dispatchDate: today },
      });
      const todayCompletedDispatches = todayDispatches.filter((d) => d.status === DispatchStatus.COMPLETED);
      const todayCollectedWeight = todayCompletedDispatches.reduce(
        (sum, d) => sum + d.actualWeight,
        0,
      );
      const todayCollectedBins = todayCompletedDispatches.reduce(
        (sum, d) => sum + d.actualBinCount,
        0,
      );

      const todayReceipts = await this.receiptRepo.find({
        where: { createdAt: Between(startOfDay, endOfDay) },
      });
      const todayTotalFee = todayReceipts
        .filter((r) => r.status === ReceiptStatus.SETTLED)
        .reduce((sum, r) => sum + Number(r.totalFee), 0);

      let existingStat = await this.dailyStatRepo.findOne({
        where: { statDate: today },
      });

      if (!existingStat) {
        existingStat = this.dailyStatRepo.create({
          statDate: today,
          version: 1,
          detailsJson: '{}',
        });
      }

      existingStat.totalBinCount = totalBinCount;
      existingStat.normalBinCount = normalBinCount;
      existingStat.fullBinCount = fullBinCount;
      existingStat.overflowBinCount = overflowBinCount;
      existingStat.todayFullEventCount = todayFullEventCount;
      existingStat.todayResolvedEventCount = todayResolvedEventCount;
      existingStat.todayDispatchCount = todayDispatches.length;
      existingStat.todayCompletedDispatchCount = todayCompletedDispatches.length;
      existingStat.todayCollectedBinCount = todayCollectedBins;
      existingStat.todayCollectedWeight = todayCollectedWeight;
      existingStat.todayReceiptCount = todayReceipts.length;
      existingStat.todayTotalFee = Number(todayTotalFee.toFixed(2));
      existingStat.version = (existingStat.version || 0) + 1;
      existingStat.detailsJson = JSON.stringify({
        binTypes: {},
        lastUpdated: new Date().toISOString(),
      });

      await this.dailyStatRepo.save(existingStat);

      await this.idempotentService.markSuccess(
        bizType,
        requestId,
        existingStat.id,
        JSON.stringify({
          date: today,
          refreshed: true,
          version: existingStat.version,
        }),
      );

      return success(
        {
          date: today,
          version: existingStat.version,
          stats: {
            totalBinCount,
            fullBinCount,
            overflowBinCount,
            todayFullEventCount,
            todayResolvedEventCount,
            todayDispatchCount: todayDispatches.length,
            todayCompletedDispatchCount: todayCompletedDispatches.length,
            todayCollectedWeight,
            todayCollectedBins,
            todayReceiptCount: todayReceipts.length,
            todayTotalFee: Number(todayTotalFee.toFixed(2)),
          },
        },
        `今日统计已刷新（版本 ${existingStat.version}）：桶点总数 ${totalBinCount}，满溢 ${fullBinCount}，清运 ${todayCollectedWeight}kg，费用 ${todayTotalFee.toFixed(2)} 元`,
      );
    } catch (e: any) {
      await this.idempotentService.markFailed(bizType, requestId);
      throw e;
    }
  }
}
