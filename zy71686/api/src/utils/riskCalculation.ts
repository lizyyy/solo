import type {
  Customer,
  GuaranteeContract,
  CreditLine,
  CounterGuarantee,
  RiskAnalysisResult,
  RiskFactor,
  RiskLevel,
  GraphNode,
  GraphEdge
} from '../../../shared/types.js';
import { getRiskLevelFromScore } from './anomalyDetection.js';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300 });

export interface RiskCalculationContext {
  customerId: string;
  customers: Map<string, Customer>;
  guarantees: GuaranteeContract[];
  credits: CreditLine[];
  counterGuarantees: CounterGuarantee[];
  version: string;
  calculationVersion: string;
  maxDepth?: number;
}

export class RiskCalculator {
  private context: RiskCalculationContext;
  private visitedGuarantors = new Set<string>();

  constructor(context: RiskCalculationContext) {
    this.context = context;
  }

  calculate(): RiskAnalysisResult {
    const cacheKey = `risk_${this.context.customerId}_${this.context.version}`;
    const cached = cache.get<RiskAnalysisResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const customer = this.context.customers.get(this.context.customerId);
    const riskFactors: RiskFactor[] = [];

    this.visitedGuarantors.clear();
    const { totalExposure, chainLength, maxChainLength, guaranteeCount } = this.calculateTotalExposure(
      this.context.customerId,
      0,
      1
    );

    const { crossGuaranteeCount, mutualGuaranteePairs } = this.detectCrossGuarantees();

    const counterGuaranteeCoverage = this.calculateCounterGuaranteeCoverage();

    const creditConcentration = this.calculateCreditConcentration();

    const complexityScore = this.calculateComplexityScore(maxChainLength, guaranteeCount);
    const concentrationScore = creditConcentration * 100;
    const coverageScore = (1 - counterGuaranteeCoverage) * 100;
    const crossGuaranteeScore = Math.min(crossGuaranteeCount * 20, 100);

    const riskScore = Math.round(
      0.3 * complexityScore +
      0.25 * concentrationScore +
      0.25 * coverageScore +
      0.2 * crossGuaranteeScore
    );

    const overallRiskLevel = getRiskLevelFromScore(riskScore);

    if (complexityScore >= 50) {
      riskFactors.push({
        code: 'complex_guarantee_chain',
        name: '担保链复杂',
        severity: getRiskLevelFromScore(complexityScore),
        description: `担保链最长 ${maxChainLength} 层，涉及 ${guaranteeCount} 笔担保`,
        relatedObjects: []
      });
    }

    if (crossGuaranteeCount > 0) {
      riskFactors.push({
        code: 'cross_guarantee',
        name: '互保/交叉担保',
        severity: crossGuaranteeCount >= 3 ? 'high' : 'medium',
        description: `发现 ${crossGuaranteeCount} 组互保关系`,
        relatedObjects: mutualGuaranteePairs.map(p => `${p[0]}-${p[1]}`)
      });
    }

    if (counterGuaranteeCoverage < 0.5) {
      riskFactors.push({
        code: 'insufficient_counter_guarantee',
        name: '反担保不足',
        severity: counterGuaranteeCoverage < 0.3 ? 'critical' : 'high',
        description: `反担保覆盖率仅 ${(counterGuaranteeCoverage * 100).toFixed(1)}%`,
        relatedObjects: []
      });
    }

    if (creditConcentration > 0.5) {
      riskFactors.push({
        code: 'high_credit_concentration',
        name: '授信集中度高',
        severity: creditConcentration > 0.7 ? 'high' : 'medium',
        description: `前三大担保方占比 ${(creditConcentration * 100).toFixed(1)}%`,
        relatedObjects: []
      });
    }

    const result: RiskAnalysisResult = {
      customerId: this.context.customerId,
      customerName: customer?.name,
      totalExposure,
      guaranteeChainRisk: getRiskLevelFromScore(complexityScore),
      crossGuaranteeRisk: crossGuaranteeCount === 0 ? 'low' : crossGuaranteeCount >= 3 ? 'high' : 'medium',
      counterGuaranteeCoverage,
      creditConcentration,
      overallRiskLevel,
      riskFactors,
      riskScore,
      calculationVersion: this.context.calculationVersion,
      calculationTime: new Date().toISOString(),
      version: this.context.version
    };

    cache.set(cacheKey, result);
    return result;
  }

  private calculateTotalExposure(
    customerId: string,
    depth: number,
    riskFactor: number
  ): {
    totalExposure: number;
    chainLength: number;
    maxChainLength: number;
    guaranteeCount: number;
  } {
    const maxDepth = this.context.maxDepth || 5;
    if (depth >= maxDepth || this.visitedGuarantors.has(customerId)) {
      return { totalExposure: 0, chainLength: 0, maxChainLength: depth, guaranteeCount: 0 };
    }

    this.visitedGuarantors.add(customerId);

    const customerCredits = this.context.credits.filter(c => c.customerId === customerId);
    const directUsed = customerCredits.reduce((sum, c) => sum + c.usedAmount, 0);

    const directGuarantees = this.context.guarantees.filter(
      g => g.guarantorId === customerId && !g.isCounterGuarantee
    );

    let totalExposure = directUsed;
    let maxChainLength = depth;
    let guaranteeCount = directGuarantees.length;

    for (const guarantee of directGuarantees) {
      const factor = guarantee.isCounterGuarantee ? 0.3 : 0.5;
      const nextRiskFactor = riskFactor * factor;
      
      const result = this.calculateTotalExposure(
        guarantee.guaranteedId,
        depth + 1,
        nextRiskFactor
      );
      
      totalExposure += guarantee.amount * nextRiskFactor;
      totalExposure += result.totalExposure;
      maxChainLength = Math.max(maxChainLength, result.maxChainLength);
      guaranteeCount += result.guaranteeCount;
    }

    return {
      totalExposure,
      chainLength: depth,
      maxChainLength,
      guaranteeCount
    };
  }

  private detectCrossGuarantees(): { crossGuaranteeCount: number; mutualGuaranteePairs: string[][] } {
    const pairs: string[][] = [];
    const guaranteeMap = new Map<string, Set<string>>();

    for (const g of this.context.guarantees) {
      if (g.isCounterGuarantee) continue;
      const existing = guaranteeMap.get(g.guarantorId) || new Set();
      existing.add(g.guaranteedId);
      guaranteeMap.set(g.guarantorId, existing);
    }

    const processed = new Set<string>();
    for (const [guarantor, guaranteedSet] of guaranteeMap) {
      for (const guaranteed of guaranteedSet) {
        const reverseSet = guaranteeMap.get(guaranteed);
        if (reverseSet && reverseSet.has(guarantor)) {
          const key = [guarantor, guaranteed].sort().join('-');
          if (!processed.has(key)) {
            processed.add(key);
            pairs.push([guarantor, guaranteed]);
          }
        }
      }
    }

    return {
      crossGuaranteeCount: pairs.length,
      mutualGuaranteePairs: pairs
    };
  }

  private calculateCounterGuaranteeCoverage(): number {
    const directGuarantees = this.context.guarantees.filter(
      g => g.guarantorId === this.context.customerId && !g.isCounterGuarantee
    );

    if (directGuarantees.length === 0) {
      return 1;
    }

    let totalGuaranteeAmount = 0;
    let totalCGAmount = 0;

    for (const g of directGuarantees) {
      totalGuaranteeAmount += g.amount;
      const cgs = this.context.counterGuarantees.filter(cg => cg.guaranteeId === g.id);
      totalCGAmount += cgs.reduce((sum, cg) => sum + cg.amount, 0);
    }

    return totalGuaranteeAmount > 0 ? totalCGAmount / totalGuaranteeAmount : 1;
  }

  private calculateCreditConcentration(): number {
    const customerGuarantees = this.context.guarantees.filter(
      g => g.guaranteedId === this.context.customerId && !g.isCounterGuarantee
    );

    if (customerGuarantees.length === 0) {
      return 0;
    }

    const guarantorAmounts = new Map<string, number>();
    let totalAmount = 0;

    for (const g of customerGuarantees) {
      const current = guarantorAmounts.get(g.guarantorId) || 0;
      guarantorAmounts.set(g.guarantorId, current + g.amount);
      totalAmount += g.amount;
    }

    if (totalAmount === 0) return 0;

    const amounts = Array.from(guarantorAmounts.values()).sort((a, b) => b - a);
    const top3 = amounts.slice(0, 3);
    const top3Sum = top3.reduce((sum, a) => sum + a, 0);

    return top3Sum / totalAmount;
  }

  private calculateComplexityScore(maxChainLength: number, guaranteeCount: number): number {
    const chainScore = Math.min(maxChainLength * 15, 60);
    const countScore = Math.min(guaranteeCount * 5, 40);
    return Math.min(chainScore + countScore, 100);
  }
}

export function buildGraph(
  customers: Customer[],
  guarantees: GuaranteeContract[],
  credits: CreditLine[],
  riskResults: Map<string, RiskAnalysisResult>,
  options: {
    centerCustomerId?: string;
    maxDepth?: number;
    minAmount?: number;
    riskLevels?: RiskLevel[];
  } = {}
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const { centerCustomerId, maxDepth = 3, minAmount = 0, riskLevels } = options;
  
  const customerMap = new Map(customers.map(c => [c.id, c]));
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const addedNodes = new Set<string>();

  const traverse = (customerId: string, depth: number) => {
    if (depth > maxDepth || addedNodes.has(customerId)) return;
    
    const customer = customerMap.get(customerId);
    if (!customer) return;

    const riskResult = riskResults.get(customerId);
    const riskLevel: RiskLevel = riskResult?.overallRiskLevel || 'low';
    
    if (riskLevels && !riskLevels.includes(riskLevel)) return;

    addedNodes.add(customerId);
    nodes.push({
      id: customerId,
      type: 'customer',
      name: customer.name,
      riskLevel,
      data: customer
    });

    const customerCredits = credits.filter(c => c.customerId === customerId);
    for (const credit of customerCredits) {
      if (credit.totalAmount >= minAmount) {
        const creditNodeId = `credit_${credit.id}`;
        if (!addedNodes.has(creditNodeId)) {
          addedNodes.add(creditNodeId);
          nodes.push({
            id: creditNodeId,
            type: 'credit',
            name: `授信 ${credit.totalAmount.toLocaleString()}`,
            riskLevel: credit.usedAmount / credit.totalAmount > 0.9 ? 'high' : 
                      credit.usedAmount / credit.totalAmount > 0.7 ? 'medium' : 'low',
            data: credit
          });
        }
        edges.push({
          id: `edge_credit_${credit.id}`,
          source: customerId,
          target: creditNodeId,
          relationType: 'creditLine',
          amount: credit.totalAmount,
          riskLevel: 'low'
        });
      }
    }

    const outgoingGuarantees = guarantees.filter(
      g => g.guarantorId === customerId && !g.isCounterGuarantee && g.amount >= minAmount
    );

    for (const guarantee of outgoingGuarantees) {
      const guaranteeNodeId = `guarantee_${guarantee.id}`;
      if (!addedNodes.has(guaranteeNodeId)) {
        addedNodes.add(guaranteeNodeId);
        nodes.push({
          id: guaranteeNodeId,
          type: 'guarantee',
          name: `担保 ${guarantee.amount.toLocaleString()}`,
          riskLevel: riskLevel,
          data: guarantee
        });
      }

      edges.push({
        id: `edge_g_out_${guarantee.id}`,
        source: customerId,
        target: guaranteeNodeId,
        relationType: 'directGuarantee',
        amount: guarantee.amount,
        riskLevel
      });

      edges.push({
        id: `edge_g_in_${guarantee.id}`,
        source: guaranteeNodeId,
        target: guarantee.guaranteedId,
        relationType: 'directGuarantee',
        amount: guarantee.amount,
        riskLevel
      });

      traverse(guarantee.guaranteedId, depth + 1);
    }

    const incomingGuarantees = guarantees.filter(
      g => g.guaranteedId === customerId && !g.isCounterGuarantee && g.amount >= minAmount
    );

    for (const guarantee of incomingGuarantees) {
      traverse(guarantee.guarantorId, depth + 1);
    }
  };

  if (centerCustomerId) {
    traverse(centerCustomerId, 0);
  } else {
    for (const customer of customers) {
      traverse(customer.id, 0);
    }
  }

  return { nodes, edges };
}
