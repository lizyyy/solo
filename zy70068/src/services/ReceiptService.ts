import { DriverReceipt, ReceiptStatus } from '../models/types';
import { repository } from '../repositories/MemoryRepository';
import { ReceiptTimeoutError } from '../models/errors';

export class ReceiptService {
  private readonly DEFAULT_TIMEOUT_MINUTES = 30;

  createReceipt(driverId: string, detourEventId: string, timeoutMinutes?: number): DriverReceipt {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (timeoutMinutes ?? this.DEFAULT_TIMEOUT_MINUTES) * 60 * 1000);

    const existingReceipts = repository.findReceiptsByDetour(detourEventId);
    const activeReceipt = existingReceipts.find(
      (r) => r.driverId === driverId && r.status === 'PENDING' && r.expiresAt > now
    );

    if (activeReceipt) {
      return activeReceipt;
    }

    const receipt: DriverReceipt = {
      id: repository.generateId(),
      driverId,
      detourEventId,
      status: 'PENDING',
      createdAt: now,
      expiresAt,
    };

    return repository.saveDriverReceipt(receipt);
  }

  acknowledgeReceipt(receiptId: string): DriverReceipt {
    const receipt = repository.findDriverReceiptById(receiptId);
    if (!receipt) {
      throw new Error(`回执 ${receiptId} 不存在`);
    }

    if (receipt.status !== 'PENDING') {
      return receipt;
    }

    const now = new Date();
    if (now > receipt.expiresAt) {
      receipt.status = 'TIMED_OUT';
      repository.saveDriverReceipt(receipt);
      throw new ReceiptTimeoutError(receiptId);
    }

    receipt.status = 'ACKNOWLEDGED';
    receipt.acknowledgedAt = now;
    return repository.saveDriverReceipt(receipt);
  }

  rejectReceipt(receiptId: string, reason: string): DriverReceipt {
    const receipt = repository.findDriverReceiptById(receiptId);
    if (!receipt) {
      throw new Error(`回执 ${receiptId} 不存在`);
    }

    if (receipt.status !== 'PENDING') {
      return receipt;
    }

    receipt.status = 'REJECTED';
    receipt.rejectedReason = reason;
    return repository.saveDriverReceipt(receipt);
  }

  processExpiredReceipts(): DriverReceipt[] {
    const expired = repository.findExpiredReceipts();
    expired.forEach((receipt) => {
      receipt.status = 'TIMED_OUT';
      repository.saveDriverReceipt(receipt);
    });
    return expired;
  }

  getReceipt(receiptId: string): DriverReceipt | undefined {
    return repository.findDriverReceiptById(receiptId);
  }

  getReceiptsByDetour(detourEventId: string): DriverReceipt[] {
    return repository.findReceiptsByDetour(detourEventId);
  }

  isAllAcknowledged(detourEventId: string, requiredDrivers?: string[]): boolean {
    const receipts = repository.findReceiptsByDetour(detourEventId);
    
    if (requiredDrivers && requiredDrivers.length > 0) {
      const acknowledgedDrivers = receipts
        .filter((r) => r.status === 'ACKNOWLEDGED')
        .map((r) => r.driverId);
      
      return requiredDrivers.every((driverId) => acknowledgedDrivers.includes(driverId));
    }

    const activeReceipts = receipts.filter((r) => r.status !== 'TIMED_OUT');
    if (activeReceipts.length === 0) {
      return false;
    }

    return activeReceipts.every((r) => r.status === 'ACKNOWLEDGED');
  }

  getStatistics(detourEventId: string): {
    total: number;
    acknowledged: number;
    rejected: number;
    timedOut: number;
    pending: number;
  } {
    const receipts = repository.findReceiptsByDetour(detourEventId);
    return {
      total: receipts.length,
      acknowledged: receipts.filter((r) => r.status === 'ACKNOWLEDGED').length,
      rejected: receipts.filter((r) => r.status === 'REJECTED').length,
      timedOut: receipts.filter((r) => r.status === 'TIMED_OUT').length,
      pending: receipts.filter((r) => r.status === 'PENDING').length,
    };
  }
}

export const receiptService = new ReceiptService();
