import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { GatewayTimeoutException } from '../../../common/exceptions/business.exception';

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);

  private shouldSimulateFailure(): boolean {
    return Math.random() < 0.1;
  }

  private shouldSimulateTimeout(): boolean {
    return Math.random() < 0.05;
  }

  async processRefund(refundId: string, amount: number, orderNo: string): Promise<{
    success: boolean;
    transactionId: string;
    response: Record<string, any>;
  }> {
    this.logger.log(`Processing refund: ${refundId}, amount: ${amount}, order: ${orderNo}`);

    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));

    if (this.shouldSimulateTimeout()) {
      this.logger.warn(`Simulating timeout for refund: ${refundId}`);
      throw new GatewayTimeoutException();
    }

    if (this.shouldSimulateFailure()) {
      this.logger.warn(`Simulating failure for refund: ${refundId}`);
      return {
        success: false,
        transactionId: uuidv4(),
        response: {
          code: 'PAYMENT_FAILED',
          message: 'Payment gateway declined the refund',
          details: { reason: 'INSUFFICIENT_BALANCE' },
        },
      };
    }

    const transactionId = `REF_${uuidv4()}`;
    this.logger.log(`Refund processed successfully: ${refundId}, transactionId: ${transactionId}`);

    return {
      success: true,
      transactionId,
      response: {
        code: 'SUCCESS',
        message: 'Refund processed successfully',
        transactionId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async queryTransaction(transactionId: string): Promise<{
    status: 'success' | 'failed' | 'pending' | 'unknown';
    response: Record<string, any>;
  }> {
    this.logger.log(`Querying transaction: ${transactionId}`);

    await new Promise((resolve) => setTimeout(resolve, 200));

    const statuses: Array<'success' | 'failed' | 'pending'> = ['success', 'failed', 'pending'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    return {
      status,
      response: {
        transactionId,
        status,
        queriedAt: new Date().toISOString(),
      },
    };
  }
}
