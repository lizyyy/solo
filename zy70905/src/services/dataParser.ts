import csv from 'csv-parser';
import { Readable } from 'stream';
import { ReceiptItem, Member, ActivityRule } from '../types';

export class DataParser {
  async parseReceiptsCSV(csvContent: string | Buffer): Promise<ReceiptItem[]> {
    return new Promise((resolve, reject) => {
      const results: ReceiptItem[] = [];
      const stream = Readable.from(csvContent.toString());

      stream
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim().toLowerCase()
        }))
        .on('data', (data) => {
          const item = this.mapCSVToReceipt(data);
          if (item.receiptNo) {
            results.push(item);
          }
        })
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  private mapCSVToReceipt(data: any): ReceiptItem {
    return {
      receiptNo: this.sanitizeString(data['receiptno'] || data['小票号'] || data['receipt_no'] || ''),
      memberPhone: this.sanitizeString(data['memberphone'] || data['会员手机号'] || data['member_phone'] || data['phone'] || ''),
      transactionTime: this.sanitizeString(data['transactiontime'] || data['交易时间'] || data['transaction_time'] || data['time'] || ''),
      transactionType: this.parseTransactionType(data['transactiontype'] || data['交易类型'] || data['transaction_type'] || data['type'] || ''),
      amount: this.parseAmount(data['amount'] || data['金额'] || data['total'] || 0),
      storeId: this.sanitizeString(data['storeid'] || data['门店ID'] || data['store_id'] || data['store'] || ''),
      productId: this.sanitizeString(data['productid'] || data['商品ID'] || data['product_id'] || ''),
      productName: this.sanitizeString(data['productname'] || data['商品名称'] || data['product_name'] || ''),
      activityId: this.sanitizeString(data['activityid'] || data['活动ID'] || data['activity_id'] || ''),
      operator: this.sanitizeString(data['operator'] || data['操作员'] || '')
    };
  }

  parseMembersJSON(jsonContent: string | Buffer): Member[] {
    try {
      const data = JSON.parse(jsonContent.toString());
      const members = Array.isArray(data) ? data : (data.members || data.data || []);
      
      return members.map((m: any) => ({
        phone: this.sanitizeString(m.phone || m.mobile || m.memberPhone || ''),
        name: this.sanitizeString(m.name || m.memberName || ''),
        level: this.parseMemberLevel(m.level || m.memberLevel || 'normal'),
        totalPoints: parseInt(m.totalPoints || m.total_points || m.points || 0, 10),
        availablePoints: parseInt(m.availablePoints || m.available_points || m.totalPoints || 0, 10),
        joinDate: this.sanitizeString(m.joinDate || m.join_date || new Date().toISOString()),
        lastActiveTime: this.sanitizeString(m.lastActiveTime || m.last_active_time || '')
      }));
    } catch (error) {
      throw new Error('会员JSON格式解析失败');
    }
  }

  parseActivityRulesJSON(jsonContent: string | Buffer): ActivityRule[] {
    try {
      const data = JSON.parse(jsonContent.toString());
      const rules = Array.isArray(data) ? data : (data.rules || data.data || []);
      
      return rules.map((r: any) => ({
        id: this.sanitizeString(r.id || r.ruleId || `RULE_${Date.now()}_${Math.random()}`),
        name: this.sanitizeString(r.name || r.ruleName || '未命名活动'),
        type: this.sanitizeString(r.type || 'multiplier') as any,
        startTime: this.sanitizeString(r.startTime || r.start_time || r.start || ''),
        endTime: this.sanitizeString(r.endTime || r.end_time || r.end || ''),
        conditions: {
          minAmount: r.conditions?.minAmount || r.minAmount || undefined,
          maxAmount: r.conditions?.maxAmount || r.maxAmount || undefined,
          productCategories: r.conditions?.productCategories || r.productCategories || [],
          memberLevels: r.conditions?.memberLevels || r.memberLevels || [],
          storeIds: r.conditions?.storeIds || r.storeIds || []
        },
        multiplier: r.multiplier ? parseFloat(r.multiplier) : undefined,
        bonusPoints: r.bonusPoints ? parseInt(r.bonusPoints, 10) : undefined,
        maxPointsPerTransaction: r.maxPointsPerTransaction ? parseInt(r.maxPointsPerTransaction, 10) : undefined,
        priority: parseInt(r.priority || 0, 10),
        enabled: r.enabled !== false
      }));
    } catch (error) {
      throw new Error('活动规则JSON格式解析失败');
    }
  }

  private sanitizeString(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private parseAmount(value: any): number {
    if (typeof value === 'number') return value;
    const cleaned = String(value).replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.abs(num);
  }

  private parseTransactionType(value: any): 'purchase' | 'return' {
    const str = String(value).toLowerCase().trim();
    if (str.includes('退') || str === 'return' || str === 'refund' || str === 'r') {
      return 'return';
    }
    return 'purchase';
  }

  private parseMemberLevel(value: any): Member['level'] {
    const str = String(value).toLowerCase().trim();
    if (str.includes('钻石') || str === 'diamond') return 'diamond';
    if (str.includes('金') || str === 'gold') return 'gold';
    if (str.includes('银') || str === 'silver') return 'silver';
    return 'normal';
  }

  validateReceipts(receipts: ReceiptItem[]): {
    valid: ReceiptItem[];
    invalid: { item: ReceiptItem; error: string }[];
  } {
    const valid: ReceiptItem[] = [];
    const invalid: { item: ReceiptItem; error: string }[] = [];

    for (const receipt of receipts) {
      const errors = this.validateSingleReceipt(receipt);
      if (errors.length === 0) {
        valid.push(receipt);
      } else {
        invalid.push({ item: receipt, error: errors.join('; ') });
      }
    }

    return { valid, invalid };
  }

  private validateSingleReceipt(receipt: ReceiptItem): string[] {
    const errors: string[] = [];

    if (!receipt.receiptNo) {
      errors.push('小票号不能为空');
    }
    if (!receipt.memberPhone) {
      errors.push('会员手机号不能为空');
    }
    if (!receipt.transactionTime) {
      errors.push('交易时间不能为空');
    }
    if (!receipt.storeId) {
      errors.push('门店ID不能为空');
    }
    if (receipt.amount <= 0) {
      errors.push('交易金额必须大于0');
    }

    return errors;
  }
}
