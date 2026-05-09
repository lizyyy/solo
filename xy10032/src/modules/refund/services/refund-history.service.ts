import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefundHistory } from '../refund-history.entity';
import { Refund } from '../refund.entity';

@Injectable()
export class RefundHistoryService {
  constructor(
    @InjectRepository(RefundHistory)
    private refundHistoryRepository: Repository<RefundHistory>,
  ) {}

  async createHistory(
    refund: Refund,
    previousData: Partial<Refund>,
    changedBy: string,
    changedByUsername: string,
    changeDescription?: string,
  ): Promise<RefundHistory> {
    const newData: Partial<Refund> = {
      status: refund.status,
      amount: refund.amount,
      reason: refund.reason,
      remark: refund.remark,
      retryCount: refund.retryCount,
    };

    const history = this.refundHistoryRepository.create({
      refundId: refund.id,
      version: refund.version,
      status: refund.status,
      amount: refund.amount,
      reason: refund.reason,
      remark: refund.remark,
      changedBy,
      changedByUsername,
      previousData,
      newData,
      changeDescription,
    });

    return this.refundHistoryRepository.save(history);
  }

  async findByRefundId(refundId: string): Promise<RefundHistory[]> {
    return this.refundHistoryRepository.find({
      where: { refundId },
      order: { createdAt: 'DESC', version: 'DESC' },
    });
  }

  async findByVersion(refundId: string, version: number): Promise<RefundHistory> {
    return this.refundHistoryRepository.findOne({
      where: { refundId, version },
    });
  }

  async getLatestHistory(refundId: string): Promise<RefundHistory | null> {
    const histories = await this.refundHistoryRepository.find({
      where: { refundId },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    return histories[0] || null;
  }
}
