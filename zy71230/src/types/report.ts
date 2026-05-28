import type { AlternativePath, GameStats } from './game';
import type { RiskEvent, DecisionLog, StopResult, Stop } from './tour';

export interface ReviewReport {
  executionSummary: ExecutionSummary;
  financialOverview: FinancialOverview;
  stopAnalysis: StopAnalysis[];
  riskAnalysis: RiskAnalysis;
  decisionAnalysis: DecisionAnalysis;
  recommendations: Recommendation[];
  alternativePaths: AlternativePath[];
  gameStats: GameStats;
  generatedAt: string;
}

export interface ExecutionSummary {
  tourName: string;
  bandName?: string;
  tourDuration: string;
  totalStops: number;
  completedStops: number;
  initialBudget: number;
  finalCashFlow: number;
  netProfit: number;
  isSuccess: boolean;
  successMessage: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface FinancialOverview {
  totalRevenue: number;
  totalExpense: number;
  netProfit: number;
  profitMargin: number;
  revenueBreakdown: {
    category: string;
    amount: number;
    percentage: number;
  }[];
  expenseBreakdown: {
    category: string;
    amount: number;
    percentage: number;
  }[];
  cashFlowTimeline: {
    stop: string;
    date: string;
    cashFlow: number;
    revenue: number;
    expense: number;
  }[];
  perStopFinancials: {
    stopId: string;
    city: string;
    revenue: number;
    expense: number;
    profit: number;
  }[];
}

export interface StopAnalysis {
  stop: Stop;
  result: StopResult;
  attendanceRate: number;
  profitPerAttendee: number;
  merchConversionRate: number;
  risks: RiskEvent[];
  decisions: DecisionLog[];
  performanceRating: 'excellent' | 'good' | 'average' | 'poor';
  keyInsights: string[];
}

export interface RiskAnalysis {
  totalRisks: number;
  risksByType: Record<string, number>;
  risksBySeverity: Record<string, number>;
  highRiskEvents: RiskEvent[];
  riskTimeline: {
    stop: string;
    date: string;
    riskCount: number;
    riskIndex: number;
  }[];
  unresolvedRisks: RiskEvent[];
}

export interface DecisionAnalysis {
  totalDecisions: number;
  decisionsByType: Record<string, number>;
  decisionsByRiskLevel: Record<string, number>;
  averageImpact: number;
  bestDecisions: DecisionLog[];
  worstDecisions: DecisionLog[];
  decisionImpactChart: {
    decisionId: string;
    description: string;
    impact: number;
    riskLevel: string;
  }[];
}

export interface Recommendation {
  id: string;
  category: 'financial' | 'route' | 'inventory' | 'marketing' | 'risk_management';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionableSteps: string[];
  expectedImpact: string;
  relatedRiskEventId?: string;
  relatedDecisionId?: string;
}

export interface ExportOptions {
  format: 'pdf' | 'xlsx';
  includeRawData: boolean;
  includeCharts: boolean;
  includeAlternativePaths: boolean;
  language: 'zh' | 'en';
}
