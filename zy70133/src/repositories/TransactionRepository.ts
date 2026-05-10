import { Transaction, UUID } from '../types';
import { InMemoryRepository } from './InMemoryRepository';
import moment from 'moment';

export class TransactionRepository extends InMemoryRepository<Transaction> {
  async findByBudgetPoolId(budgetPoolId: UUID): Promise<Transaction[]> {
    return (await this.findAll()).filter(t => t.budgetPoolId === budgetPoolId);
  }

  async findByCampaignId(campaignId: UUID): Promise<Transaction[]> {
    return (await this.findAll()).filter(t => t.campaignId === campaignId);
  }

  async findByMaterialId(materialId: UUID): Promise<Transaction[]> {
    return (await this.findAll()).filter(t => t.materialId === materialId);
  }

  async findByChannelId(channelId: UUID): Promise<Transaction[]> {
    return (await this.findAll()).filter(t => t.channelId === channelId);
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]> {
    return (await this.findAll()).filter(t => {
      return t.createdAt >= startDate && t.createdAt <= endDate;
    });
  }

  async getDailyConsumption(budgetPoolId: UUID, date: Date): Promise<number> {
    const startOfDay = moment(date).startOf('day').toDate();
    const endOfDay = moment(date).endOf('day').toDate();

    const transactions = (await this.findAll()).filter(t => {
      return t.budgetPoolId === budgetPoolId &&
        t.createdAt >= startOfDay &&
        t.createdAt <= endOfDay &&
        t.type === 'DEDUCT' &&
        t.status === 'SUCCESS';
    });

    return transactions.reduce((sum, t) => sum + t.amount, 0);
  }

  async findRelatedTransactions(transactionId: UUID): Promise<Transaction[]> {
    return (await this.findAll()).filter(t => t.relatedTransactionId === transactionId);
  }
}
