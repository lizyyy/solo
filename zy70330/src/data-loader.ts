import * as fs from 'fs';
import * as path from 'path';
import { Order, Refund, Party, Config, Anomaly } from './types';

export class DataLoader {
  private orders: Map<string, Order> = new Map();
  private refunds: Map<string, Refund[]> = new Map();
  private parties: Map<string, Party> = new Map();
  private config!: Config;
  private anomalies: Anomaly[] = [];
  private duplicateOrders: string[] = [];

  loadConfig(configPath: string): Config {
    const content = fs.readFileSync(configPath, 'utf-8');
    this.config = JSON.parse(content) as Config;
    this.validateConfig();
    return this.config;
  }

  loadOrders(ordersPath: string): Order[] {
    const content = fs.readFileSync(ordersPath, 'utf-8');
    const ordersArray = JSON.parse(content) as Order[];
    
    ordersArray.forEach(order => {
      if (this.orders.has(order.id)) {
        this.duplicateOrders.push(order.id);
        this.anomalies.push({
          type: 'duplicate_order',
          severity: 'warning',
          message: `订单 ${order.id} 重复导入，仅保留首次导入的数据`,
          affectedParties: [order.merchantId]
        });
      } else {
        this.orders.set(order.id, order);
      }
    });
    
    return Array.from(this.orders.values());
  }

  loadRefunds(refundsPath: string): Refund[] {
    const content = fs.readFileSync(refundsPath, 'utf-8');
    const refundsArray = JSON.parse(content) as Refund[];
    
    refundsArray.forEach(refund => {
      const existing = this.refunds.get(refund.orderId) || [];
      existing.push(refund);
      this.refunds.set(refund.orderId, existing);
    });
    
    return refundsArray;
  }

  loadParties(partiesPath: string): Party[] {
    const content = fs.readFileSync(partiesPath, 'utf-8');
    const partiesArray = JSON.parse(content) as Party[];
    
    partiesArray.forEach(party => {
      this.parties.set(party.id, party);
    });
    
    return partiesArray;
  }

  private validateConfig(): void {
    const { oldRules, newRules } = this.config;
    
    this.checkRuleOverlap(oldRules, '旧规则');
    this.checkRuleOverlap(newRules, '新规则');
  }

  private checkRuleOverlap(rules: Config['oldRules'], label: string): void {
    const sortedRules = [...rules].sort((a, b) => 
      new Date(a.effectiveStartDate).getTime() - new Date(b.effectiveStartDate).getTime()
    );

    for (let i = 0; i < sortedRules.length - 1; i++) {
      const current = sortedRules[i];
      const next = sortedRules[i + 1];
      
      const currentEnd = current.effectiveEndDate 
        ? new Date(current.effectiveEndDate).getTime() 
        : Infinity;
      const nextStart = new Date(next.effectiveStartDate).getTime();

      if (currentEnd >= nextStart) {
        this.anomalies.push({
          type: 'rule_overlap',
          severity: 'error',
          message: `${label}版本重叠: ${current.version} 与 ${next.version} 生效时间有重叠`,
          affectedParties: ['platform', 'merchant', 'talent', 'serviceProvider']
        });
      }
    }
  }

  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  getRefundsForOrder(orderId: string): Refund[] {
    return this.refunds.get(orderId) || [];
  }

  getParty(partyId: string): Party | undefined {
    return this.parties.get(partyId);
  }

  getAnomalies(): Anomaly[] {
    return this.anomalies;
  }

  getDuplicateOrders(): string[] {
    return this.duplicateOrders;
  }

  getConfig(): Config {
    return this.config;
  }

  getAllOrders(): Order[] {
    return Array.from(this.orders.values());
  }

  validateAll(): Anomaly[] {
    const anomalies: Anomaly[] = [...this.anomalies];

    this.orders.forEach(order => {
      if (order.talentId && !this.parties.has(order.talentId)) {
        anomalies.push({
          type: 'missing_talent',
          severity: 'warning',
          message: `订单 ${order.id} 的达人 ${order.talentId} 不存在`,
          affectedParties: [order.merchantId, order.talentId]
        });
      }

      if (order.serviceProviderId && !this.parties.has(order.serviceProviderId)) {
        anomalies.push({
          type: 'missing_service_provider',
          severity: 'warning',
          message: `订单 ${order.id} 的服务商 ${order.serviceProviderId} 不存在`,
          affectedParties: [order.merchantId, order.serviceProviderId]
        });
      }
    });

    return anomalies;
  }
}
