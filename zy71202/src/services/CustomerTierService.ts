import type { CustomerPosition, CustomerTier, CustomerType, RiskLevel } from '@/types';

export const TIER_TEXT: Record<CustomerTier, string> = {
  PLATINUM: '铂金客户',
  GOLD: '黄金客户',
  SILVER: '白银客户',
  BRONZE: '普通客户',
};

export const TIER_COLOR: Record<CustomerTier, string> = {
  PLATINUM: 'bg-gradient-to-r from-slate-400 to-slate-300 text-slate-900',
  GOLD: 'bg-gradient-to-r from-yellow-500 to-amber-400 text-white',
  SILVER: 'bg-gradient-to-r from-slate-300 to-slate-200 text-slate-700',
  BRONZE: 'bg-gradient-to-r from-amber-700 to-amber-600 text-white',
};

export const CUSTOMER_TYPE_TEXT: Record<CustomerType, string> = {
  INSTITUTION: '机构客户',
  RETAIL: '零售客户',
};

export const RISK_LEVEL_TEXT: Record<RiskLevel, string> = {
  R1: '保守型',
  R2: '稳健型',
  R3: '平衡型',
  R4: '积极型',
  R5: '激进型',
};

export const RISK_LEVEL_COLOR: Record<RiskLevel, string> = {
  R1: 'badge-success',
  R2: 'badge-info',
  R3: 'badge-secondary',
  R4: 'badge-warning',
  R5: 'badge-danger',
};

export class CustomerTierService {
  private readonly tierRules = {
    PLATINUM: { minPosition: 1000000, customerTypes: ['INSTITUTION'] as CustomerType[] },
    GOLD: { minPosition: 500000, customerTypes: ['INSTITUTION', 'RETAIL'] as CustomerType[] },
    SILVER: { minPosition: 100000, customerTypes: ['RETAIL'] as CustomerType[] },
    BRONZE: { minPosition: 0, customerTypes: ['RETAIL'] as CustomerType[] },
  };
  
  tierCustomers(positions: CustomerPosition[]): Record<CustomerTier, CustomerPosition[]> {
    const tiers: Record<CustomerTier, CustomerPosition[]> = {
      PLATINUM: [],
      GOLD: [],
      SILVER: [],
      BRONZE: [],
    };
    
    for (const pos of positions) {
      tiers[pos.tier].push(pos);
    }
    
    return tiers;
  }
  
  groupByType(positions: CustomerPosition[]): Record<CustomerType, CustomerPosition[]> {
    return {
      INSTITUTION: positions.filter(p => p.customerType === 'INSTITUTION'),
      RETAIL: positions.filter(p => p.customerType === 'RETAIL'),
    };
  }
  
  filterByRiskLevel(
    positions: CustomerPosition[],
    minRiskLevel: RiskLevel
  ): CustomerPosition[] {
    const riskOrder: RiskLevel[] = ['R1', 'R2', 'R3', 'R4', 'R5'];
    const minIndex = riskOrder.indexOf(minRiskLevel);
    return positions.filter(p => riskOrder.indexOf(p.riskLevel) >= minIndex);
  }
  
  filterByTier(
    positions: CustomerPosition[],
    tiers: CustomerTier[]
  ): CustomerPosition[] {
    return positions.filter(p => tiers.includes(p.tier));
  }
  
  calculateTierStatistics(positions: CustomerPosition[]): Array<{
    tier: CustomerTier;
    tierText: string;
    count: number;
    totalPosition: number;
    percentage: number;
  }> {
    const tiered = this.tierCustomers(positions);
    const totalPosition = positions.reduce((sum, p) => sum + p.positionAmount, 0);
    
    return (Object.keys(tiered) as CustomerTier[]).map(tier => {
      const tierPositions = tiered[tier];
      const tierTotal = tierPositions.reduce((sum, p) => sum + p.positionAmount, 0);
      
      return {
        tier,
        tierText: TIER_TEXT[tier],
        count: tierPositions.length,
        totalPosition: tierTotal,
        percentage: totalPosition > 0 ? (tierTotal / totalPosition) * 100 : 0,
      };
    });
  }
  
  sortByPriority(positions: CustomerPosition[]): CustomerPosition[] {
    const tierPriority: Record<CustomerTier, number> = {
      PLATINUM: 4,
      GOLD: 3,
      SILVER: 2,
      BRONZE: 1,
    };
    
    const typePriority: Record<CustomerType, number> = {
      INSTITUTION: 2,
      RETAIL: 1,
    };
    
    return [...positions].sort((a, b) => {
      const tierDiff = tierPriority[b.tier] - tierPriority[a.tier];
      if (tierDiff !== 0) return tierDiff;
      
      const typeDiff = typePriority[b.customerType] - typePriority[a.customerType];
      if (typeDiff !== 0) return typeDiff;
      
      return b.positionAmount - a.positionAmount;
    });
  }
  
  getReminderStrategy(pos: CustomerPosition): {
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    reminderTypes: string[];
    description: string;
  } {
    if (pos.tier === 'PLATINUM' || (pos.customerType === 'INSTITUTION' && pos.positionAmount > 5000000)) {
      return {
        priority: 'HIGH',
        reminderTypes: ['PHONE', 'EMAIL', 'SMS'],
        description: '高优先级，需电话+邮件+短信三重提醒',
      };
    }
    
    if (pos.tier === 'GOLD' || pos.positionAmount > 1000000) {
      return {
        priority: 'MEDIUM',
        reminderTypes: ['EMAIL', 'SMS'],
        description: '中优先级，需邮件+短信提醒',
      };
    }
    
    return {
      priority: 'LOW',
      reminderTypes: ['SMS'],
      description: '低优先级，短信提醒即可',
    };
  }
}

export const customerTierService = new CustomerTierService();
