import { 
  BudgetSummary, 
  CampaignSummary, 
  ChannelSummary,
  MaterialSummary,
  ReportQuery,
  Transaction
} from '../types';
import { 
  getBudgetPoolRepository,
  getCampaignRepository,
  getMaterialRepository,
  getChannelRepository,
  getBindingRepository,
  getTransactionRepository
} from '../repositories/RepositoryFactory';
import { 
  addAmount, 
  subtractAmount,
  formatAmount 
} from '../utils/amount';
import moment from 'moment';
import { createObjectCsvStringifier } from 'csv-writer';

export class ReportService {
  private static instance: ReportService;

  private constructor() {}

  static getInstance(): ReportService {
    if (!ReportService.instance) {
      ReportService.instance = new ReportService();
    }
    return ReportService.instance;
  }

  async getBudgetSummary(budgetPoolId: string): Promise<BudgetSummary> {
    const budgetPool = await getBudgetPoolRepository().findById(budgetPoolId);
    if (!budgetPool) {
      throw new Error('Budget pool not found');
    }

    const campaigns = await getCampaignRepository().findByQuery({ budgetPoolId });
    const transactions = await getTransactionRepository().findByBudgetPoolId(budgetPoolId);

    const dailyConsumed = this.calculateDailyConsumption(transactions, new Date());
    const dailyRemaining = budgetPool.dailyLimit
      ? subtractAmount(budgetPool.dailyLimit, dailyConsumed)
      : undefined;

    const campaignSummaries: CampaignSummary[] = [];
    for (const campaign of campaigns) {
      campaignSummaries.push(await this.buildCampaignSummary(campaign));
    }

    const netConsumed = subtractAmount(
      subtractAmount(budgetPool.consumedAmount, budgetPool.refundedAmount),
      budgetPool.compensatedAmount
    );
    const available = subtractAmount(budgetPool.totalAmount, netConsumed);

    return {
      budgetPoolId: budgetPool.id,
      budgetPoolName: budgetPool.name,
      totalAmount: budgetPool.totalAmount,
      consumedAmount: netConsumed,
      availableAmount: available,
      dailyConsumedAmount: dailyConsumed,
      dailyRemainingAmount: dailyRemaining || 0,
      campaignSummaries,
    };
  }

  async buildCampaignSummary(campaign: any): Promise<CampaignSummary> {
    const bindings = await getBindingRepository().findByQuery({ campaignId: campaign.id });
    const channels = await getChannelRepository().findAll();
    const materials = await getMaterialRepository().findAll();
    const transactions = await getTransactionRepository().findByCampaignId(campaign.id);

    const channelMap = new Map(channels.map(c => [c.id, c]));
    const materialMap = new Map(materials.map(m => [m.id, m]));

    const consumedBudget = subtractAmount(
      subtractAmount(campaign.consumedBudget, campaign.refundedBudget),
      campaign.compensatedBudget
    );

    const channelSummaries: ChannelSummary[] = [];
    const channelGrouped = new Map<string, {
      consumed: number;
      refunded: number;
      compensated: number;
      materialStats: Map<string, { consumed: number; refunded: number; compensated: number }>;
    }>();

    for (const binding of bindings) {
      if (!channelGrouped.has(binding.channelId)) {
        channelGrouped.set(binding.channelId, {
          consumed: 0,
          refunded: 0,
          compensated: 0,
          materialStats: new Map(),
        });
      }

      const channelStats = channelGrouped.get(binding.channelId)!;
      const netConsumed = subtractAmount(
        subtractAmount(binding.consumedBudget, binding.refundedBudget),
        binding.compensatedBudget
      );

      channelStats.consumed = addAmount(channelStats.consumed, binding.consumedBudget);
      channelStats.refunded = addAmount(channelStats.refunded, binding.refundedBudget);
      channelStats.compensated = addAmount(channelStats.compensated, binding.compensatedBudget);

      if (!channelStats.materialStats.has(binding.materialId)) {
        channelStats.materialStats.set(binding.materialId, { consumed: 0, refunded: 0, compensated: 0 });
      }
      const materialStats = channelStats.materialStats.get(binding.materialId)!;
      materialStats.consumed = addAmount(materialStats.consumed, binding.consumedBudget);
      materialStats.refunded = addAmount(materialStats.refunded, binding.refundedBudget);
      materialStats.compensated = addAmount(materialStats.compensated, binding.compensatedBudget);
    }

    for (const [channelId, stats] of channelGrouped) {
      const channel = channelMap.get(channelId);
      if (!channel) continue;

      const netChannel = subtractAmount(
        subtractAmount(stats.consumed, stats.refunded),
        stats.compensated
      );

      const materialSummaries: MaterialSummary[] = [];
      for (const [materialId, mStats] of stats.materialStats) {
        const material = materialMap.get(materialId);
        if (!material) continue;

        const netMaterial = subtractAmount(
          subtractAmount(mStats.consumed, mStats.refunded),
          mStats.compensated
        );

        materialSummaries.push({
          materialId,
          materialName: material.name,
          consumedAmount: mStats.consumed,
          refundedAmount: mStats.refunded,
          compensatedAmount: mStats.compensated,
          netConsumed: netMaterial,
        });
      }

      channelSummaries.push({
        channelId,
        channelName: channel.name,
        consumedAmount: stats.consumed,
        refundedAmount: stats.refunded,
        compensatedAmount: stats.compensated,
        netConsumed: netChannel,
        materialSummaries,
      });
    }

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      totalBudget: campaign.totalBudget,
      consumedBudget,
      availableBudget: subtractAmount(campaign.totalBudget, consumedBudget),
      channelSummaries,
    };
  }

  private calculateDailyConsumption(transactions: Transaction[], date: Date): number {
    const startOfDay = moment(date).startOf('day');
    const endOfDay = moment(date).endOf('day');

    let total = 0;
    for (const t of transactions) {
      const transactionDate = moment(t.createdAt);
      if (
        transactionDate.isBetween(startOfDay, endOfDay, undefined, '[]') &&
        t.type === 'DEDUCT' &&
        t.status === 'SUCCESS'
      ) {
        total = addAmount(total, t.amount);
      }
    }
    return total;
  }

  async getTransactionsForReport(query: ReportQuery): Promise<Transaction[]> {
    let transactions: Transaction[] = [];

    if (query.budgetPoolId) {
      transactions = await getTransactionRepository().findByBudgetPoolId(query.budgetPoolId);
    } else if (query.campaignId) {
      transactions = await getTransactionRepository().findByCampaignId(query.campaignId);
    } else if (query.channelId) {
      transactions = await getTransactionRepository().findByChannelId(query.channelId);
    } else if (query.materialId) {
      transactions = await getTransactionRepository().findByMaterialId(query.materialId);
    } else {
      transactions = await getTransactionRepository().findAll();
    }

    if (query.startDate) {
      transactions = transactions.filter(t => t.createdAt >= query.startDate!);
    }
    if (query.endDate) {
      transactions = transactions.filter(t => t.createdAt <= query.endDate!);
    }

    return transactions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async exportTransactionsToCsv(query: ReportQuery): Promise<string> {
    const transactions = await this.getTransactionsForReport(query);

    const budgetPools = new Map((await getBudgetPoolRepository().findAll()).map(p => [p.id, p]));
    const campaigns = new Map((await getCampaignRepository().findAll()).map(c => [c.id, c]));
    const materials = new Map((await getMaterialRepository().findAll()).map(m => [m.id, m]));
    const channels = new Map((await getChannelRepository().findAll()).map(c => [c.id, c]));

    const records = transactions.map(t => ({
      transactionId: t.id,
      type: t.type,
      status: t.status,
      amount: t.amount,
      balanceBefore: t.balanceBefore,
      balanceAfter: t.balanceAfter,
      budgetPoolId: t.budgetPoolId,
      budgetPoolName: budgetPools.get(t.budgetPoolId)?.name || '',
      campaignId: t.campaignId || '',
      campaignName: t.campaignId ? (campaigns.get(t.campaignId)?.name || '') : '',
      materialId: t.materialId || '',
      materialName: t.materialId ? (materials.get(t.materialId)?.name || '') : '',
      channelId: t.channelId || '',
      channelName: t.channelId ? (channels.get(t.channelId)?.name || '') : '',
      reason: t.reason,
      operator: t.operator || '',
      relatedTransactionId: t.relatedTransactionId || '',
      createdAt: t.createdAt.toISOString(),
      rulePassed: t.ruleEvaluation?.passed ? 'Yes' : 'N/A',
      ruleDecision: t.ruleEvaluation?.finalDecision || 'N/A',
    }));

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'transactionId', title: 'Transaction ID' },
        { id: 'type', title: 'Type' },
        { id: 'status', title: 'Status' },
        { id: 'amount', title: 'Amount' },
        { id: 'balanceBefore', title: 'Balance Before' },
        { id: 'balanceAfter', title: 'Balance After' },
        { id: 'budgetPoolId', title: 'Budget Pool ID' },
        { id: 'budgetPoolName', title: 'Budget Pool Name' },
        { id: 'campaignId', title: 'Campaign ID' },
        { id: 'campaignName', title: 'Campaign Name' },
        { id: 'materialId', title: 'Material ID' },
        { id: 'materialName', title: 'Material Name' },
        { id: 'channelId', title: 'Channel ID' },
        { id: 'channelName', title: 'Channel Name' },
        { id: 'reason', title: 'Reason' },
        { id: 'operator', title: 'Operator' },
        { id: 'relatedTransactionId', title: 'Related Transaction ID' },
        { id: 'createdAt', title: 'Created At' },
        { id: 'rulePassed', title: 'Rule Passed' },
        { id: 'ruleDecision', title: 'Rule Decision' },
      ],
    });

    return csvStringifier.getHeaderString() + '\n' + csvStringifier.stringifyRecords(records);
  }

  async exportSummaryToCsv(budgetPoolId: string): Promise<string> {
    const summary = await this.getBudgetSummary(budgetPoolId);

    const records: any[] = [];

    records.push({
      level: 'BudgetPool',
      id: summary.budgetPoolId,
      name: summary.budgetPoolName,
      totalBudget: summary.totalAmount,
      consumed: summary.consumedAmount,
      refunded: '',
      compensated: '',
      netConsumed: summary.consumedAmount,
      available: summary.availableAmount,
    });

    for (const cs of summary.campaignSummaries) {
      records.push({
        level: 'Campaign',
        id: cs.campaignId,
        name: cs.campaignName,
        totalBudget: cs.totalBudget,
        consumed: cs.consumedBudget,
        refunded: '',
        compensated: '',
        netConsumed: cs.consumedBudget,
        available: cs.availableBudget,
      });

      for (const chs of cs.channelSummaries) {
        records.push({
          level: 'Channel',
          id: chs.channelId,
          name: chs.channelName,
          totalBudget: '',
          consumed: chs.consumedAmount,
          refunded: chs.refundedAmount,
          compensated: chs.compensatedAmount,
          netConsumed: chs.netConsumed,
          available: '',
        });

        for (const ms of chs.materialSummaries) {
          records.push({
            level: 'Material',
            id: ms.materialId,
            name: ms.materialName,
            totalBudget: '',
            consumed: ms.consumedAmount,
            refunded: ms.refundedAmount,
            compensated: ms.compensatedAmount,
            netConsumed: ms.netConsumed,
            available: '',
          });
        }
      }
    }

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'level', title: 'Level' },
        { id: 'id', title: 'ID' },
        { id: 'name', title: 'Name' },
        { id: 'totalBudget', title: 'Total Budget' },
        { id: 'consumed', title: 'Consumed' },
        { id: 'refunded', title: 'Refunded' },
        { id: 'compensated', title: 'Compensated' },
        { id: 'netConsumed', title: 'Net Consumed' },
        { id: 'available', title: 'Available' },
      ],
    });

    return csvStringifier.getHeaderString() + '\n' + csvStringifier.stringifyRecords(records);
  }
}
