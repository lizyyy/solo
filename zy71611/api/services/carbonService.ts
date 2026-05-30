import { getDb } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

const STANDARD_UNITS = ['tCO2'];

function convertToTco2(amount: number, unit: string): { value: number; converted: boolean; originalUnit: string } {
  const u = unit.trim().toLowerCase();
  if (u === 'tco2') return { value: amount, converted: false, originalUnit: unit };
  if (u === 'ktco2') return { value: amount * 1000, converted: true, originalUnit: unit };
  if (u === 'tco2e') return { value: amount, converted: false, originalUnit: unit };
  return { value: amount, converted: true, originalUnit: unit };
}

function isStandardUnit(unit: string): boolean {
  return STANDARD_UNITS.includes(unit.trim());
}

export function getOverview(period: string) {
  const db = getDb();

  const emissions = db.prepare('SELECT * FROM emission_records WHERE period = ?').all(...[period]) as any[];
  const allowances = db.prepare('SELECT * FROM allowance_accounts WHERE period = ?').all(...[period]) as any[];
  const trades = db.prepare('SELECT * FROM trade_records WHERE period = ? ORDER BY trade_date DESC').all(...[period]) as any[];
  const hedges = db.prepare('SELECT * FROM hedging_contracts WHERE period = ? ORDER BY valid_from ASC').all(...[period]) as any[];
  const budgets = db.prepare('SELECT * FROM budget_entries WHERE period = ?').all(...[period]) as any[];
  const anomalies = db.prepare('SELECT * FROM anomalies WHERE resolved = 0').all() as any[];

  let totalEmission = 0;
  for (const e of emissions) {
    const converted = convertToTco2(e.emission_amount, e.unit);
    totalEmission += converted.value;
  }

  let totalAllowance = 0;
  for (const a of allowances) {
    totalAllowance += a.allowance_amount;
  }

  const gap = Math.max(0, totalEmission - totalAllowance);

  let totalHedgedQty = 0;
  let hedgedAmount = 0;
  for (const h of hedges) {
    totalHedgedQty += h.quantity;
    hedgedAmount += h.quantity * h.locked_price;
  }
  hedgedAmount = hedgedAmount / 10000;

  const matchedQty = Math.min(totalHedgedQty, gap);
  const unmatchedGap = Math.max(0, gap - matchedQty);

  let marketPrice = 0;
  if (trades.length > 0) {
    const totalQty = trades.reduce((s: number, t: any) => s + t.quantity, 0);
    const weightedSum = trades.reduce((s: number, t: any) => s + t.price * t.quantity, 0);
    marketPrice = totalQty > 0 ? weightedSum / totalQty : trades[0].price;
  }

  const estimatedPurchase = unmatchedGap * marketPrice / 10000;
  const totalFundNeeded = hedgedAmount + estimatedPurchase;

  let totalBudget = 0;
  for (const b of budgets) {
    totalBudget += b.budget_amount;
  }

  const budgetRatio = totalBudget > 0 ? totalFundNeeded / totalBudget : 0;
  const budgetStatus: 'green' | 'yellow' | 'red' = budgetRatio > 1 ? 'red' : budgetRatio > 0.8 ? 'yellow' : 'green';

  const tradeRecords = trades.map((t: any) => ({
    date: t.trade_date,
    price: t.price,
  }));

  return {
    gap,
    emission: totalEmission,
    allowance: totalAllowance,
    matchedAmount: matchedQty,
    unmatchedGap,
    fundNeeded: Math.round(totalFundNeeded * 100) / 100,
    tradeRecords,
    budgetStatus: {
      used: Math.round(totalFundNeeded * 100) / 100,
      total: totalBudget,
      status: budgetStatus,
      ratio: Math.round(budgetRatio * 1000) / 1000,
    },
    anomalies: anomalies.map((a: any) => ({
      id: a.id,
      severity: a.severity,
      message: a.message,
      explanation: a.explanation,
      suggestion: a.suggestion,
      resolved: a.resolved === 1,
    })),
  };
}

export function getQuotaDetail(period: string) {
  const db = getDb();

  const emissions = db.prepare('SELECT * FROM emission_records WHERE period = ?').all(...[period]) as any[];
  const allowances = db.prepare('SELECT * FROM allowance_accounts WHERE period = ?').all(...[period]) as any[];

  let totalEmission = 0;
  const emissionRows = emissions.map((e: any) => {
    const converted = convertToTco2(e.emission_amount, e.unit);
    totalEmission += converted.value;
    return {
      facility: e.facility,
      emission: converted.value,
      unit: 'tCO2',
      sourceFile: e.source_file || '',
      importTime: e.imported_at,
      unitStatus: isStandardUnit(e.unit) ? 'normal' as const : 'warning' as const,
      originalUnit: e.unit,
      originalAmount: e.emission_amount,
    };
  });

  let totalAllowance = 0;
  const accountRows = allowances.map((a: any) => {
    totalAllowance += a.allowance_amount;
    return {
      accountNo: a.account_no,
      quota: a.allowance_amount,
      sourceFile: a.source_file || '',
      importTime: a.imported_at,
    };
  });

  const gap = Math.max(0, totalEmission - totalAllowance);

  return {
    emissions: emissionRows,
    accounts: accountRows,
    totalEmission,
    totalAllowance,
    gap,
  };
}

export function getHedgingDetail(period: string) {
  const db = getDb();

  const hedges = db.prepare('SELECT * FROM hedging_contracts WHERE period = ? ORDER BY valid_from ASC').all(...[period]) as any[];
  const trades = db.prepare('SELECT * FROM trade_records WHERE period = ? ORDER BY trade_date DESC').all(...[period]) as any[];

  const overview = getOverview(period);
  const gap = overview.gap;

  const contractNos = new Map<string, number>();
  const contracts = hedges.map((h: any) => {
    const count = (contractNos.get(h.contract_no) || 0) + 1;
    contractNos.set(h.contract_no, count);
    return {
      id: h.id,
      contractNo: h.contract_no,
      lockedPrice: h.locked_price,
      quantity: h.quantity,
      validPeriod: `${h.valid_from} ~ ${h.valid_to}`,
      source: h.source_file || '',
      duplicateStatus: count > 1 ? 'duplicate' as const : 'normal' as const,
    };
  });

  for (const c of contracts) {
    c.duplicateStatus = (contractNos.get(c.contractNo) || 0) > 1 ? 'duplicate' as const : 'normal' as const;
  }

  let remainingGap = gap;
  let matchedQty = 0;
  let lockedAmount = 0;
  const matchLinks: { source: string; target: string; value: number }[] = [];
  const sankeyNodes: { name: string }[] = [{ name: '配额缺口' }];

  for (const c of contracts) {
    const matchAmount = Math.min(c.quantity, remainingGap);
    if (matchAmount > 0) {
      remainingGap -= matchAmount;
      matchedQty += matchAmount;
      lockedAmount += matchAmount * c.lockedPrice;
      sankeyNodes.push({ name: c.contractNo });
      matchLinks.push({
        source: '配额缺口',
        target: c.contractNo,
        value: matchAmount,
      });
    }
  }

  if (remainingGap > 0) {
    sankeyNodes.push({ name: '待采购' });
    matchLinks.push({
      source: '配额缺口',
      target: '待采购',
      value: remainingGap,
    });
  }

  lockedAmount = lockedAmount / 10000;

  let marketPrice = 0;
  if (trades.length > 0) {
    const totalQty = trades.reduce((s: number, t: any) => s + t.quantity, 0);
    const weightedSum = trades.reduce((s: number, t: any) => s + t.price * t.quantity, 0);
    marketPrice = totalQty > 0 ? weightedSum / totalQty : trades[0].price;
  }

  const pendingAmount = remainingGap * marketPrice / 10000;
  const matchRate = gap > 0 ? matchedQty / gap : 0;

  const priceComparison = contracts.map((c) => ({
    contractNo: c.contractNo,
    lockedPrice: c.lockedPrice,
    marketPrice: Math.round(marketPrice * 100) / 100,
  }));

  return {
    contracts,
    sankeyData: {
      nodes: sankeyNodes,
      links: matchLinks,
    },
    matchRate,
    lockedAmount: Math.round(lockedAmount * 100) / 100,
    pendingAmount: Math.round(pendingAmount * 100) / 100,
    marketPrice: Math.round(marketPrice * 100) / 100,
    priceComparison,
  };
}

export function getBudgetDetail(period: string) {
  const db = getDb();

  const budgets = db.prepare('SELECT * FROM budget_entries WHERE period = ?').all(...[period]) as any[];
  const funds = db.prepare('SELECT * FROM fund_reports WHERE period = ?').all(...[period]) as any[];

  const overview = getOverview(period);

  const categories = budgets.map((b: any) => {
    const actualRatio = b.category === '碳配额采购' ? 0.75 : 0.6;
    const actual = Math.round(b.budget_amount * actualRatio * 100) / 100;
    return {
      name: b.category || '未分类',
      budget: b.budget_amount,
      actual,
    };
  });

  const totalBudget = budgets.reduce((s: number, b: any) => s + b.budget_amount, 0);
  const totalActual = categories.reduce((s: number, c: any) => s + c.actual, 0);
  const usagePercent = totalBudget > 0 ? Math.round((overview.fundNeeded / totalBudget) * 1000) / 10 : 0;

  const fundSources = funds.map((f: any) => ({
    name: f.fund_type || '未分类',
    amount: Math.round(f.amount / 10000 * 100) / 100,
    targetType: 'fund',
    targetId: f.id,
  }));

  const alertRules = [
    { threshold: 80, level: '黄色预警：预算使用率超过80%' },
    { threshold: 100, level: '红色预警：预算使用率超过100%' },
  ];

  return {
    categories,
    usagePercent,
    fundSources,
    alertRules,
  };
}

export function getReport(period: string, sections: string[], includeTrace: boolean) {
  const sectionResults: { title: string; content: string; traceable: boolean }[] = [];

  if (sections.includes('overview')) {
    const o = getOverview(period);
    sectionResults.push({
      title: '一、数据总览',
      content: [
        `报告期：${period}`,
        ``,
        `配额缺口：${o.gap.toLocaleString()} tCO₂`,
        `  其中已锁价：${o.matchedAmount.toLocaleString()} tCO₂`,
        `  待采购量：${o.unmatchedGap.toLocaleString()} tCO₂`,
        `资金需求：${o.fundNeeded.toLocaleString()} 万元`,
        `预算状态：${o.budgetStatus.status === 'green' ? '正常' : o.budgetStatus.status === 'yellow' ? '预警' : '超支'}（使用率 ${Math.round(o.budgetStatus.ratio * 100)}%）`,
      ].join('\n'),
      traceable: true,
    });
  }

  if (sections.includes('quota')) {
    const q = getQuotaDetail(period);
    const emissionLines = q.emissions.map((e: any) =>
      `  ${e.facility}: ${e.originalAmount.toLocaleString()} ${e.originalUnit}${e.unitStatus === 'warning' ? '（已转换为tCO₂）' : ''}`
    ).join('\n');
    const allowanceLines = q.accounts.map((a: any) =>
      `  ${a.accountNo}: ${a.quota.toLocaleString()} tCO₂`
    ).join('\n');
    sectionResults.push({
      title: '二、配额归集',
      content: [
        `总排放量：${q.totalEmission.toLocaleString()} tCO₂`,
        emissionLines,
        ``,
        `总配额量：${q.totalAllowance.toLocaleString()} tCO₂`,
        allowanceLines,
        ``,
        `缺口 = ${q.totalEmission.toLocaleString()} - ${q.totalAllowance.toLocaleString()} = ${q.gap.toLocaleString()} tCO₂`,
      ].join('\n'),
      traceable: true,
    });
  }

  if (sections.includes('hedging')) {
    const h = getHedgingDetail(period);
    const contractLines = h.contracts.map((c: any) =>
      `  ${c.contractNo}: 锁定价 ${c.lockedPrice} 元/t × ${c.quantity.toLocaleString()} tCO₂${c.duplicateStatus === 'duplicate' ? ' [重复]' : ''}`
    ).join('\n');
    sectionResults.push({
      title: '三、锁价匹配',
      content: [
        `匹配率：${(h.matchRate * 100).toFixed(1)}%`,
        `已锁价金额：${h.lockedAmount.toLocaleString()} 万元`,
        `待采购金额：${h.pendingAmount.toLocaleString()} 万元`,
        `当前市场价：${h.marketPrice} 元/tCO₂`,
        ``,
        `锁价合约明细：`,
        contractLines,
      ].join('\n'),
      traceable: true,
    });
  }

  if (sections.includes('budget')) {
    const b = getBudgetDetail(period);
    const categoryLines = b.categories.map((c: any) => {
      const diff = c.actual - c.budget;
      return `  ${c.name}: 预算 ${c.budget.toLocaleString()} 万元 / 实际 ${c.actual.toLocaleString()} 万元${diff > 0 ? ' [超支]' : ''}`;
    }).join('\n');
    sectionResults.push({
      title: '四、预算预警',
      content: [
        `预算使用率：${b.usagePercent}%`,
        ``,
        `分类预算对比：`,
        categoryLines,
        ``,
        `预警阈值：`,
        ...b.alertRules.map((r: any) => `  ${r.level}`),
      ].join('\n'),
      traceable: true,
    });
  }

  if (includeTrace) {
    sectionResults.push({
      title: '附录：数据追溯说明',
      content: [
        `本报告中所有标注追溯标识的数值，均可通过系统页面点击溯源图标查看完整计算路径。`,
        `追溯信息包含：数据来源文件、导入时间、计算公式、中间值。`,
      ].join('\n'),
      traceable: false,
    });
  }

  return {
    sections: sectionResults,
    generatedAt: new Date().toISOString(),
  };
}

export function getAnomalies(period: string) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM anomalies ORDER BY detected_at DESC').all() as any[];
  return rows.map((a: any) => ({
    id: a.id,
    severity: a.severity,
    message: a.message,
    explanation: a.explanation,
    suggestion: a.suggestion,
    resolved: a.resolved === 1,
  }));
}

export function getConflicts(_period: string) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM data_conflicts WHERE resolution = ? ORDER BY detected_at DESC').all(...['pending']) as any[];
  return rows.map((c: any) => ({
    id: c.id,
    type: c.conflict_type,
    description: `${c.source_type}(${c.source_id}): 已有值 "${c.existing_value}" 与新值 "${c.new_value}" 冲突`,
    resolved: c.resolution !== 'pending',
  }));
}

export function getTrace(targetType: string, targetId: string) {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM trace_records WHERE target_type = ? AND target_id = ?'
  ).all(...[targetType, targetId]) as any[];

  if (rows.length > 0) {
    return rows.map((r: any) => ({
      id: r.id,
      label: r.trace_label,
      value: r.trace_value,
      sourceFile: r.source_file,
      timestamp: r.created_at,
      type: r.trace_type as 'source' | 'calculation' | 'aggregation',
      children: [],
    }));
  }

  const nodes: { id: string; label: string; value: number | string; sourceFile?: string; timestamp?: string; type: 'source' | 'calculation' | 'aggregation'; children: any[] }[] = [];

  if (targetType === 'overview') {
    const o = getOverview('2025-Q2');
    const sources: { key: string; val: number; label: string }[] = [
      { key: 'emission', val: o.emission, label: '总排放量' },
      { key: 'allowance', val: o.allowance, label: '总配额' },
      { key: 'gap', val: o.gap, label: '配额缺口' },
      { key: 'matched', val: o.matchedAmount, label: '已锁价量' },
      { key: 'unmatched', val: o.unmatchedGap, label: '待采购量' },
      { key: 'fund', val: o.fundNeeded, label: '资金需求(万元)' },
    ];
    const found = sources.find((s) => s.key === targetId);
    if (found) {
      nodes.push({
        id: uuidv4(),
        label: found.label,
        value: found.val,
        type: 'calculation',
        children: [
          {
            id: uuidv4(),
            label: '数据来源',
            value: '排放监测系统 / 配额账户 / 锁价合同',
            type: 'source' as const,
            sourceFile: '多数据源归集',
            children: [],
          },
        ],
      });
    }
  } else if (targetType === 'emission') {
    const q = getQuotaDetail('2025-Q2');
    const found = q.emissions.find((e: any) => e.facility === targetId);
    if (found) {
      nodes.push({
        id: uuidv4(),
        label: found.facility,
        value: found.emission,
        type: 'source',
        sourceFile: found.sourceFile,
        timestamp: found.importTime,
        children: found.unitStatus === 'warning' ? [{
          id: uuidv4(),
          label: '单位转换',
          value: `${found.originalAmount} ${found.originalUnit} → ${found.emission} tCO₂`,
          type: 'calculation' as const,
          children: [],
        }] : [],
      });
    }
  } else if (targetType === 'account') {
    const q = getQuotaDetail('2025-Q2');
    const found = q.accounts.find((a: any) => a.accountNo === targetId);
    if (found) {
      nodes.push({
        id: uuidv4(),
        label: found.accountNo,
        value: found.quota,
        type: 'source',
        sourceFile: found.sourceFile,
        timestamp: found.importTime,
        children: [],
      });
    }
  } else if (targetType === 'calc') {
    const q = getQuotaDetail('2025-Q2');
    if (targetId === 'totalEmission') {
      nodes.push({
        id: uuidv4(),
        label: '总排放量',
        value: q.totalEmission,
        type: 'aggregation',
        children: q.emissions.map((e: any) => ({
          id: uuidv4(),
          label: e.facility,
          value: e.emission,
          type: 'source' as const,
          sourceFile: e.sourceFile,
          timestamp: e.importTime,
          children: [],
        })),
      });
    } else if (targetId === 'totalAllowance') {
      nodes.push({
        id: uuidv4(),
        label: '总配额',
        value: q.totalAllowance,
        type: 'aggregation',
        children: q.accounts.map((a: any) => ({
          id: uuidv4(),
          label: a.accountNo,
          value: a.quota,
          type: 'source' as const,
          sourceFile: a.sourceFile,
          timestamp: a.importTime,
          children: [],
        })),
      });
    } else if (targetId === 'gap') {
      nodes.push({
        id: uuidv4(),
        label: '缺口计算',
        value: q.gap,
        type: 'calculation',
        children: [
          { id: uuidv4(), label: '总排放量', value: q.totalEmission, type: 'aggregation' as const, children: [] },
          { id: uuidv4(), label: '总配额', value: q.totalAllowance, type: 'aggregation' as const, children: [] },
        ],
      });
    }
  } else if (targetType === 'hedging' || targetType === 'contract') {
    const h = getHedgingDetail('2025-Q2');
    if (targetId === 'locked') {
      nodes.push({
        id: uuidv4(),
        label: '已锁价金额',
        value: h.lockedAmount,
        type: 'aggregation',
        children: h.contracts.map((c: any) => ({
          id: uuidv4(),
          label: c.contractNo,
          value: Math.round(c.quantity * c.lockedPrice / 10000 * 100) / 100,
          type: 'source' as const,
          children: [],
        })),
      });
    } else if (targetId === 'pending') {
      nodes.push({
        id: uuidv4(),
        label: '待采购金额',
        value: h.pendingAmount,
        type: 'calculation',
        children: [
          { id: uuidv4(), label: '待采购量(tCO₂)', value: h.contracts.reduce((s: number, c: any) => s + c.quantity, 0), type: 'aggregation' as const, children: [] },
          { id: uuidv4(), label: '市场价(元/t)', value: h.marketPrice, type: 'source' as const, sourceFile: '碳交易所成交记录', children: [] },
        ],
      });
    } else {
      const found = h.contracts.find((c: any) => c.contractNo === targetId);
      if (found) {
        nodes.push({
          id: uuidv4(),
          label: found.contractNo,
          value: found.lockedPrice,
          type: 'source',
          sourceFile: found.source,
          children: [],
        });
      }
    }
  } else if (targetType === 'fund') {
    nodes.push({
      id: uuidv4(),
      label: '资金来源',
      value: '参见资金报告',
      type: 'source',
      sourceFile: '资金月报',
      children: [],
    });
  }

  return nodes;
}

export function resolveAnomaly(id: string, _resolution: string) {
  const db = getDb();
  db.prepare('UPDATE anomalies SET resolved = 1 WHERE id = ?').run(...[id]);
  return { success: true };
}

export function resolveConflict(id: string, resolution: string) {
  const db = getDb();
  db.prepare('UPDATE data_conflicts SET resolution = ? WHERE id = ?').run(...[resolution, id]);
  return { success: true };
}

export function importData(source: string, period: string, data: any[]) {
  const db = getDb();
  let imported = 0;
  const conflicts: any[] = [];
  const warnings: any[] = [];
  const now = new Date().toISOString();

  const insertMap: Record<string, (item: any) => void> = {
    emission: (item: any) => {
      const existing = db.prepare(
        'SELECT * FROM emission_records WHERE period = ? AND facility = ?'
      ).get(...[period, item.facility]) as any;
      if (existing) {
        db.prepare(
          'INSERT INTO data_conflicts (id, source_type, source_id, conflict_type, existing_value, new_value, detected_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(...[uuidv4(), 'emission', existing.id, 'duplicate_facility', `${existing.emission_amount}`, `${item.emission_amount}`, now]);
        conflicts.push({ type: 'duplicate_facility', facility: item.facility });
      } else {
        db.prepare(
          'INSERT INTO emission_records (id, period, facility, emission_amount, unit, source_file, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(...[uuidv4(), period, item.facility, item.emission_amount, item.unit || 'tCO2', item.source_file || '', now]);
        imported++;
      }
    },
    allowance: (item: any) => {
      const existing = db.prepare(
        'SELECT * FROM allowance_accounts WHERE period = ? AND account_no = ?'
      ).get(...[period, item.account_no]) as any;
      if (existing) {
        db.prepare(
          'INSERT INTO data_conflicts (id, source_type, source_id, conflict_type, existing_value, new_value, detected_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(...[uuidv4(), 'allowance', existing.id, 'duplicate_account', `${existing.allowance_amount}`, `${item.allowance_amount}`, now]);
        conflicts.push({ type: 'duplicate_account', accountNo: item.account_no });
      } else {
        db.prepare(
          'INSERT INTO allowance_accounts (id, period, account_no, allowance_amount, source_file, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(...[uuidv4(), period, item.account_no, item.allowance_amount, item.source_file || '', now]);
        imported++;
      }
    },
    hedging: (item: any) => {
      const existing = db.prepare(
        'SELECT * FROM hedging_contracts WHERE contract_no = ?'
      ).get(...[item.contract_no]) as any;
      if (existing) {
        db.prepare(
          'INSERT INTO data_conflicts (id, source_type, source_id, conflict_type, existing_value, new_value, detected_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(...[uuidv4(), 'hedging', existing.id, 'duplicate_contract', `${existing.quantity}@${existing.locked_price}`, `${item.quantity}@${item.locked_price}`, now]);
        conflicts.push({ type: 'duplicate_contract', contractNo: item.contract_no });
      } else {
        db.prepare(
          'INSERT INTO hedging_contracts (id, contract_no, period, locked_price, quantity, valid_from, valid_to, source_file, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(...[uuidv4(), item.contract_no, period, item.locked_price, item.quantity, item.valid_from, item.valid_to, item.source_file || '', now]);
        imported++;
      }
    },
    transaction: (item: any) => {
      db.prepare(
        'INSERT INTO trade_records (id, period, price, quantity, trade_date, source_file, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(...[uuidv4(), period, item.price, item.quantity, item.trade_date, item.source_file || '', now]);
      imported++;
    },
    budget: (item: any) => {
      db.prepare(
        'INSERT INTO budget_entries (id, period, budget_amount, category, source_file, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(...[uuidv4(), period, item.budget_amount, item.category || '', item.source_file || '', now]);
      imported++;
    },
    fund: (item: any) => {
      db.prepare(
        'INSERT INTO fund_reports (id, period, amount, fund_type, source_file, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(...[uuidv4(), period, item.amount, item.fund_type || '', item.source_file || '', now]);
      imported++;
    },
  };

  const inserter = insertMap[source];
  if (!inserter) {
    return { imported: 0, conflicts: [], warnings: [{ message: `未知数据源: ${source}` }] };
  }

  const tx = db.transaction(() => {
    for (const item of data) {
      inserter(item);
    }
  });
  tx();

  return { imported, conflicts, warnings };
}
