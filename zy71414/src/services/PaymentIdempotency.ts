import type { PaymentRecord } from '../types';

export class PaymentIdempotency {
  private static paymentKeys: Map<string, string> = new Map();

  static generateKey(applicationId: string, amount: number, date: string): string {
    return `${applicationId}_${amount}_${date}`;
  }

  static checkDuplicate(
    key: string,
    existingPayments: PaymentRecord[]
  ): PaymentRecord | null {
    const [applicationId, amountStr] = key.split('_');
    const amount = parseFloat(amountStr);

    return (
      existingPayments.find(
        (p) =>
          p.applicationId === applicationId &&
          Math.abs(p.amount - amount) < 0.01 &&
          p.status === 'SUCCESS'
      ) || null
    );
  }

  static createPaymentRecord(
    applicationId: string,
    amount: number,
    operator: string,
    existingPayments: PaymentRecord[]
  ): PaymentRecord {
    const today = new Date().toISOString().split('T')[0];
    const key = this.generateKey(applicationId, amount, today);
    const duplicate = this.checkDuplicate(key, existingPayments);

    const version =
      existingPayments.filter((p) => p.applicationId === applicationId).length + 1;

    return {
      id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      applicationId,
      paymentNo: `PAY${new Date().getFullYear()}${String(Date.now()).slice(-8)}`,
      amount,
      paymentDate: today,
      isDuplicate: !!duplicate,
      duplicateOf: duplicate?.id || null,
      version,
      operator,
      status: 'SUCCESS',
    };
  }

  static getPaymentHistory(
    applicationId: string,
    allPayments: PaymentRecord[]
  ): PaymentRecord[] {
    return allPayments
      .filter((p) => p.applicationId === applicationId)
      .sort((a, b) => b.version - a.version);
  }
}
