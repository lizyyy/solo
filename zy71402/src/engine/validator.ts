import type {
  ValidationIssue,
  ParsedTerms,
  CustomerPosition,
  UnderlyingPrice,
  CalculationResult,
  Material,
  ObservationInterval,
  ReturnTier,
  EvidenceRef,
} from '../types';
import { generateId } from '../utils/hash';
import { checkBoundaryRisk } from './calculator';
import { createEvidenceRef } from './evidence';

interface ValidationContext {
  batchId: string;
  terms?: ParsedTerms | null;
  positions?: CustomerPosition[];
  prices?: UnderlyingPrice[];
  calculations?: CalculationResult[];
  materials?: Material[];
}

function createIssue(
  batchId: string,
  severity: 'error' | 'warning' | 'info',
  type: 'boundary_error' | 'tier_mismatch' | 'early_termination_missing' | 'data_missing' | 'logic_conflict',
  description: string,
  triggeredBy: string,
  blockedAt: string,
  suggestion: string,
  evidence: EvidenceRef[] = []
): ValidationIssue {
  return {
    id: generateId('issue'),
    batchId,
    severity,
    type,
    description,
    triggeredBy,
    blockedAt,
    suggestion,
    evidence,
    resolved: false,
  };
}

function checkDataCompleteness(ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { batchId, terms, positions, prices, materials } = ctx;
  
  if (!terms) {
    const termMaterial = materials?.find(m => m.type === 'product_terms');
    issues.push(createIssue(
      batchId,
      'error',
      'data_missing',
      '缺少产品条款解析结果',
      termMaterial ? `材料: ${termMaterial.filename}` : '未导入产品条款材料',
      '条款解析阶段',
      '请先导入并解析产品条款材料',
      termMaterial ? [createEvidenceRef(termMaterial, '材料', termMaterial.filename)] : []
    ));
  } else {
    if (!terms.productCode) {
      issues.push(createIssue(
        batchId,
        'error',
        'data_missing',
        '产品代码缺失',
        '条款解析结果',
        '条款解析阶段',
        '请在条款解析中补充产品代码',
        terms.evidenceRef.productCode ? [terms.evidenceRef.productCode] : []
      ));
    }
    if (!terms.underlying) {
      issues.push(createIssue(
        batchId,
        'error',
        'data_missing',
        '挂钩标的缺失',
        '条款解析结果',
        '条款解析阶段',
        '请在条款解析中补充挂钩标的',
        terms.evidenceRef.underlying ? [terms.evidenceRef.underlying] : []
      ));
    }
    if (terms.returnTiers.length === 0) {
      issues.push(createIssue(
        batchId,
        'error',
        'data_missing',
        '收益档位缺失',
        '条款解析结果',
        '条款解析阶段',
        '请在条款解析中补充收益档位设置',
        Object.values(terms.evidenceRef).filter(ev => ev.location.includes('tier'))
      ));
    }
    if (terms.observationIntervals.length === 0) {
      issues.push(createIssue(
        batchId,
        'warning',
        'data_missing',
        '观察区间缺失',
        '条款解析结果',
        '条款解析阶段',
        '建议补充观察区间设置，否则将使用持仓到期日作为观察日',
        terms.evidenceRef['observation_interval'] ? [terms.evidenceRef['observation_interval']] : []
      ));
    }
  }
  
  if (!positions || positions.length === 0) {
    const posMaterial = materials?.find(m => m.type === 'customer_position');
    issues.push(createIssue(
      batchId,
      'error',
      'data_missing',
      '缺少客户持仓数据',
      posMaterial ? `材料: ${posMaterial.filename}` : '未导入客户持仓材料',
      '数据导入阶段',
      '请先导入客户持仓材料',
      posMaterial ? [createEvidenceRef(posMaterial, '材料', posMaterial.filename)] : []
    ));
  } else {
    positions.forEach((pos, index) => {
      if (!pos.customerName) {
        issues.push(createIssue(
          batchId,
          'error',
          'data_missing',
          `第${index + 1}条持仓: 客户名称缺失`,
          `持仓记录 ${pos.customerId || index}`,
          '持仓解析阶段',
          '请补充客户名称',
          pos.evidenceRef ? [pos.evidenceRef] : []
        ));
      }
      if (!pos.principal || pos.principal <= 0) {
        issues.push(createIssue(
          batchId,
          'error',
          'data_missing',
          `第${index + 1}条持仓: 持有金额无效`,
          `客户: ${pos.customerName}`,
          '持仓解析阶段',
          '请确认持有金额是否正确',
          pos.evidenceRef ? [pos.evidenceRef] : []
        ));
      }
      if (!pos.startDate) {
        issues.push(createIssue(
          batchId,
          'warning',
          'data_missing',
          `第${index + 1}条持仓: 起息日缺失`,
          `客户: ${pos.customerName}`,
          '持仓解析阶段',
          '建议补充起息日，用于计算实际持有天数',
          pos.evidenceRef ? [pos.evidenceRef] : []
        ));
      }
      if (!pos.endDate) {
        issues.push(createIssue(
          batchId,
          'warning',
          'data_missing',
          `第${index + 1}条持仓: 到期日缺失`,
          `客户: ${pos.customerName}`,
          '持仓解析阶段',
          '建议补充到期日，用于观察日匹配',
          pos.evidenceRef ? [pos.evidenceRef] : []
        ));
      }
    });
  }
  
  if (!prices || prices.length === 0) {
    const priceMaterial = materials?.find(m => m.type === 'underlying_price');
    issues.push(createIssue(
      batchId,
      'error',
      'data_missing',
      '缺少标的价格数据',
      priceMaterial ? `材料: ${priceMaterial.filename}` : '未导入标的价格材料',
      '数据导入阶段',
      '请先导入标的价格材料',
      priceMaterial ? [createEvidenceRef(priceMaterial, '材料', priceMaterial.filename)] : []
    ));
  }
  
  return issues;
}

function checkBoundaryErrors(ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { batchId, terms, prices, calculations, materials } = ctx;
  
  if (!terms || !prices) return issues;
  
  const priceMaterial = materials?.find(m => m.type === 'underlying_price');
  
  prices.forEach((priceData, index) => {
    const boundaryRisk = checkBoundaryRisk(
      priceData.price,
      terms.observationIntervals,
      terms.returnTiers
    );
    
    if (boundaryRisk.hasRisk) {
      const calculation = calculations?.find(c => 
        Math.abs(c.observationPrice - priceData.price) < 0.001 && 
        c.observationDate === priceData.date
      );
      
      boundaryRisk.details.forEach(detail => {
        let severity: 'error' | 'warning' = 'warning';
        let blockedAt = '边界检查阶段';
        let suggestion = '请确认区间边界设置是否正确，特别是≥/>、≤/<的使用';
        
        if (calculation) {
          const tier = terms.returnTiers.find(t => t.id === calculation.matchedTierId);
          if (tier) {
            const exactLower = Math.abs(priceData.price - tier.lowerBound) < 0.001;
            const exactUpper = Math.abs(priceData.price - tier.upperBound) < 0.001;
            
            if ((exactLower && !tier.lowerInclusive) || (exactUpper && !tier.upperInclusive)) {
              severity = 'error';
              blockedAt = `档位匹配阶段 - ${calculation.customerName}`;
              suggestion = `⚠️ 严重问题：价格 ${priceData.price} 正好在边界上，但当前设置为不包含边界(${exactLower ? '>' : '<'} ${priceData.price})，导致档位匹配可能错误。请检查边界设置应该是≥还是>，≤还是<。`;
            }
          }
        }
        
        const evidence: EvidenceRef[] = [];
        if (priceMaterial) {
          evidence.push(createEvidenceRef(
            priceMaterial,
            `第${index + 1}行`,
            `${priceData.date}: ${priceData.price}`
          ));
        }
        
        terms.observationIntervals.forEach((interval, i) => {
          if (Math.abs(priceData.price - interval.lowerBound) < 0.001 ||
              Math.abs(priceData.price - interval.upperBound) < 0.001) {
            const ev = terms.evidenceRef[`observation_interval`] || terms.evidenceRef[`interval_startDate`];
            if (ev) evidence.push(ev);
          }
        });
        
        terms.returnTiers.forEach((tier, i) => {
          if (Math.abs(priceData.price - tier.lowerBound) < 0.001 ||
              Math.abs(priceData.price - tier.upperBound) < 0.001) {
            const ev = terms.evidenceRef[`tier_${i}`];
            if (ev) evidence.push(ev);
          }
        });
        
        issues.push(createIssue(
          batchId,
          severity,
          'boundary_error',
          detail,
          `价格 ${priceData.date}: ${priceData.price}`,
          blockedAt,
          suggestion,
          evidence
        ));
      });
    }
  });
  
  return issues;
}

function checkTierMismatch(ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { batchId, terms, calculations } = ctx;
  
  if (!terms || !calculations) return issues;
  
  calculations.forEach(calc => {
    if (!calc.matchedTierId && !calc.earlyTerminated) {
      const evidence: EvidenceRef[] = [];
      const priceEv = calc.calculationSteps.find(s => s.step === '2')?.evidence;
      if (priceEv) evidence.push(priceEv);
      
      terms.returnTiers.forEach((tier, i) => {
        const ev = terms.evidenceRef[`tier_${i}`];
        if (ev) evidence.push(ev);
      });
      
      issues.push(createIssue(
        batchId,
        'error',
        'tier_mismatch',
        `客户 ${calc.customerName} 的价格 ${calc.observationPrice} 未匹配到任何收益档位`,
        `客户: ${calc.customerName}, 价格: ${calc.observationPrice}`,
        '档位匹配阶段',
        `请检查价格 ${calc.observationPrice} 是否在档位区间内，或补充相应的档位设置。当前档位范围: ${terms.returnTiers.map(t => `[${t.lowerBound}~${t.upperBound}]`).join(', ')}`,
        evidence
      ));
    }
    
    if (calc.matchedTierId) {
      const matchedTier = terms.returnTiers.find(t => t.id === calc.matchedTierId);
      if (matchedTier) {
        const priceInTier = checkInInterval(
          calc.observationPrice,
          matchedTier.lowerBound,
          matchedTier.upperBound,
          matchedTier.lowerInclusive,
          matchedTier.upperInclusive
        );
        
        if (!priceInTier) {
          const evidence: EvidenceRef[] = [];
          const priceEv = calc.calculationSteps.find(s => s.step === '2')?.evidence;
          if (priceEv) evidence.push(priceEv);
          
          const tierIndex = terms.returnTiers.indexOf(matchedTier);
          const tierEv = terms.evidenceRef[`tier_${tierIndex}`];
          if (tierEv) evidence.push(tierEv);
          
          issues.push(createIssue(
            batchId,
            'error',
            'tier_mismatch',
            `客户 ${calc.customerName} 的档位匹配可能有误：价格 ${calc.observationPrice} 不在档位区间 [${matchedTier.lowerBound}${matchedTier.lowerInclusive ? '≤' : '<'} 价格 ${matchedTier.upperInclusive ? '≤' : '<'} ${matchedTier.upperBound}] 内`,
            `客户: ${calc.customerName}`,
            '档位匹配阶段',
            `请检查边界设置。价格 ${calc.observationPrice} 与区间边界的关系设置是否正确？应该是≥还是>，≤还是<？`,
            evidence
          ));
        }
      }
    }
  });
  
  return issues;
}

function checkInInterval(
  value: number,
  lowerBound: number,
  upperBound: number,
  lowerInclusive: boolean,
  upperInclusive: boolean
): boolean {
  const lowerOk = lowerInclusive ? value >= lowerBound : value > lowerBound;
  const upperOk = upperInclusive ? value <= upperBound : value < upperBound;
  return lowerOk && upperOk;
}

function checkEarlyTermination(ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { batchId, terms, calculations, materials } = ctx;
  
  if (!terms) return issues;
  
  const termMaterial = materials?.find(m => m.type === 'product_terms');
  
  if (terms.earlyTermination && terms.earlyTermination.enabled) {
    const et = terms.earlyTermination;
    
    if (et.observationDates.length === 0) {
      issues.push(createIssue(
        batchId,
        'warning',
        'early_termination_missing',
        '提前终止条款已启用，但未设置观察日期',
        '提前终止条款',
        '条款解析阶段',
        '请补充提前终止观察日期，否则无法进行提前终止检查',
        terms.evidenceRef['earlyTermination'] ? [terms.evidenceRef['earlyTermination']] :
        termMaterial ? [createEvidenceRef(termMaterial, '提前终止条款', '已启用但缺少观察日')] : []
      ));
    }
    
    if (!et.triggerCondition) {
      issues.push(createIssue(
        batchId,
        'warning',
        'early_termination_missing',
        '提前终止触发条件未设置',
        '提前终止条款',
        '条款解析阶段',
        '请补充提前终止触发条件（如: 价格≥触发水平）',
        terms.evidenceRef['earlyTermination'] ? [terms.evidenceRef['earlyTermination']] : []
      ));
    }
    
    if (calculations) {
      const etTriggered = calculations.filter(c => c.earlyTerminated);
      const etNotTriggered = calculations.filter(c => !c.earlyTerminated && terms.earlyTermination?.enabled);
      
      if (etTriggered.length > 0) {
        const evidence: EvidenceRef[] = [];
        if (terms.evidenceRef['earlyTermination']) {
          evidence.push(terms.evidenceRef['earlyTermination']);
        }
        
        issues.push(createIssue(
          batchId,
          'info',
          'early_termination_missing',
          `检测到 ${etTriggered.length} 位客户触发提前终止`,
          `提前终止触发: ${etTriggered.map(c => c.customerName).join(', ')}`,
          '提前终止检查阶段',
          `请确认提前终止收益率 ${(et.returnRate * 100).toFixed(2)}% 是否正确应用于这些客户`,
          evidence
        ));
      }
    }
  } else {
    const priceMaterial = materials?.find(m => m.type === 'underlying_price');
    if (priceMaterial && priceMaterial.filename.includes('提前') || priceMaterial?.content.rows?.some((r: any) => 
      Object.values(r).some((v: any) => String(v).includes('提前'))
    )) {
      issues.push(createIssue(
        batchId,
        'warning',
        'early_termination_missing',
        '检测到材料中可能包含提前终止相关信息，但条款中未启用提前终止',
        `材料: ${priceMaterial?.filename}`,
        '条款解析阶段',
        '请确认是否需要启用提前终止条款，避免遗漏提前终止情况的处理',
        priceMaterial ? [createEvidenceRef(priceMaterial, '材料内容', '疑似包含提前终止信息')] : []
      ));
    }
  }
  
  return issues;
}

function checkLogicConflicts(ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { batchId, terms, positions, materials } = ctx;
  
  if (!terms || !positions) return issues;
  
  const termMaterial = materials?.find(m => m.type === 'product_terms');
  const posMaterial = materials?.find(m => m.type === 'customer_position');
  
  if (termMaterial && posMaterial && terms.productCode) {
    const posProductCodes = new Set(positions.map(p => p.productCode).filter(Boolean));
    
    posProductCodes.forEach(code => {
      if (code && code !== terms.productCode) {
        const affectedCustomers = positions.filter(p => p.productCode === code);
        const evidence: EvidenceRef[] = [];
        
        if (terms.evidenceRef.productCode) {
          evidence.push(terms.evidenceRef.productCode);
        }
        
        const posWithCode = positions.find(p => p.productCode === code);
        if (posWithCode?.evidenceRef) {
          evidence.push(posWithCode.evidenceRef);
        }
        
        issues.push(createIssue(
          batchId,
          'warning',
          'logic_conflict',
          `持仓产品代码 ${code} 与条款产品代码 ${terms.productCode} 不一致`,
          `涉及客户: ${affectedCustomers.map(c => c.customerName).join(', ')}`,
          '数据一致性检查',
          `请确认是否为同一产品，或产品代码录入是否正确。涉及 ${affectedCustomers.length} 位客户`,
          evidence
        ));
      }
    });
  }
  
  positions.forEach((pos, index) => {
    if (pos.startDate && pos.endDate && pos.startDate > pos.endDate) {
      issues.push(createIssue(
        batchId,
        'error',
        'logic_conflict',
        `第${index + 1}条持仓: 起息日 ${pos.startDate} 晚于到期日 ${pos.endDate}`,
        `客户: ${pos.customerName}`,
        '数据一致性检查',
        '请检查起息日和到期日是否填写正确',
        pos.evidenceRef ? [pos.evidenceRef] : []
      ));
    }
    
    if (terms.observationIntervals.length > 0 && pos.endDate) {
      const interval = terms.observationIntervals[0];
      if (interval.endDate && pos.endDate < interval.startDate) {
        issues.push(createIssue(
          batchId,
          'warning',
          'logic_conflict',
          `客户 ${pos.customerName} 的到期日 ${pos.endDate} 早于观察期起始日 ${interval.startDate}`,
          `客户: ${pos.customerName}`,
          '数据一致性检查',
          '请确认持仓到期日和观察期设置是否正确，该持仓可能不参与本次收益计算',
          pos.evidenceRef ? [pos.evidenceRef] : []
        ));
      }
    }
  });
  
  if (terms.returnTiers.length > 1) {
    const sortedTiers = [...terms.returnTiers].sort((a, b) => a.lowerBound - b.lowerBound);
    
    for (let i = 0; i < sortedTiers.length - 1; i++) {
      const current = sortedTiers[i];
      const next = sortedTiers[i + 1];
      
      if (current.upperBound > next.lowerBound) {
        const evidence: EvidenceRef[] = [];
        const i1 = terms.returnTiers.indexOf(current);
        const i2 = terms.returnTiers.indexOf(next);
        if (terms.evidenceRef[`tier_${i1}`]) evidence.push(terms.evidenceRef[`tier_${i1}`]);
        if (terms.evidenceRef[`tier_${i2}`]) evidence.push(terms.evidenceRef[`tier_${i2}`]);
        
        issues.push(createIssue(
          batchId,
          'error',
          'logic_conflict',
          `档位区间存在重叠: 档位${i + 1}上限 ${current.upperBound} > 档位${i + 2}下限 ${next.lowerBound}`,
          `档位设置`,
          '档位校验阶段',
          '请检查档位区间设置，确保区间不重叠、无缝隙',
          evidence
        ));
      }
      
      if (current.upperBound < next.lowerBound) {
        const evidence: EvidenceRef[] = [];
        const i1 = terms.returnTiers.indexOf(current);
        const i2 = terms.returnTiers.indexOf(next);
        if (terms.evidenceRef[`tier_${i1}`]) evidence.push(terms.evidenceRef[`tier_${i1}`]);
        if (terms.evidenceRef[`tier_${i2}`]) evidence.push(terms.evidenceRef[`tier_${i2}`]);
        
        issues.push(createIssue(
          batchId,
          'warning',
          'logic_conflict',
          `档位区间存在缝隙: 档位${i + 1}上限 ${current.upperBound} < 档位${i + 2}下限 ${next.lowerBound}`,
          `档位设置`,
          '档位校验阶段',
          `区间 (${current.upperBound}, ${next.lowerBound}) 内的价格将无法匹配到任何档位，请补充档位设置或调整边界`,
          evidence
        ));
      }
      
      if (Math.abs(current.upperBound - next.lowerBound) < 0.001) {
        if (current.upperInclusive && next.lowerInclusive) {
          const evidence: EvidenceRef[] = [];
          const i1 = terms.returnTiers.indexOf(current);
          const i2 = terms.returnTiers.indexOf(next);
          if (terms.evidenceRef[`tier_${i1}`]) evidence.push(terms.evidenceRef[`tier_${i1}`]);
          if (terms.evidenceRef[`tier_${i2}`]) evidence.push(terms.evidenceRef[`tier_${i2}`]);
          
          issues.push(createIssue(
            batchId,
            'warning',
            'logic_conflict',
            `档位分界点 ${current.upperBound} 同时属于两个档位（都包含边界），可能导致匹配歧义`,
            `档位${i + 1}和档位${i + 2}`,
            '档位校验阶段',
            `请调整边界设置，确保分界点只属于一个档位。建议设置为档位${i + 1}包含上限、档位${i + 2}不包含下限，或反之`,
            evidence
          ));
        }
      }
    }
  }
  
  return issues;
}

export function validateBatch(ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  issues.push(...checkDataCompleteness(ctx));
  
  if (ctx.terms && ctx.prices && ctx.positions) {
    issues.push(...checkBoundaryErrors(ctx));
    issues.push(...checkTierMismatch(ctx));
    issues.push(...checkEarlyTermination(ctx));
    issues.push(...checkLogicConflicts(ctx));
  }
  
  return issues.sort((a, b) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

export function getIssueTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    boundary_error: '区间边界错误',
    tier_mismatch: '收益档位误套',
    early_termination_missing: '提前终止处理',
    data_missing: '数据缺失',
    logic_conflict: '逻辑矛盾',
  };
  return labels[type] || type;
}

export function getSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    error: '错误',
    warning: '警告',
    info: '提示',
  };
  return labels[severity] || severity;
}

export function getMaterialStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: '新增',
    duplicate: '重复提交',
    updated: '数据更新',
    supplementary: '补充材料',
  };
  return labels[status] || status;
}
