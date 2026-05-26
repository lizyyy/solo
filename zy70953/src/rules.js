'use strict';

const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[,¥\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const rules = {
  VALUATION_CHANGE: {
    code: 'VALUATION_CHANGE',
    applies: (x) => x.kind === 'artifact',
    check: (x) => {
      const r = x.raw || {};
      const declared = toNum(r.declared_value ?? r.估值 ?? r.申报价值);
      const insured  = toNum(r.insured_value  ?? r.保险金额 ?? r.保额);
      if (declared === null || insured === null) {
        return { status: 'pending', message: '估值或保险金额缺失，需人工补齐', suggestion: '补填「估值/申报价值」与「保险金额」后重新提交' };
      }
      const diff = Math.abs(declared - insured);
      const ratio = declared === 0 ? 0 : diff / declared;
      if (ratio > 0.1) {
        return { status: 'failed', message: `估值与保险金额偏差 ${(ratio * 100).toFixed(1)}%，超过 10% 阈值`, suggestion: '联系借展方与承保方确认估值口径，必要时走补充估值流程' };
      }
      return null;
    },
  },
  SHIPPING_DELAY: {
    code: 'SHIPPING_DELAY',
    applies: (x) => x.kind === 'shipping',
    check: (x) => {
      const r = x.raw || {};
      const planned = r.planned_arrival ?? r.计划到达 ?? r.planned_at;
      const actual  = r.actual_arrival  ?? r.实际到达 ?? r.arrived_at;
      if (!planned) return null;
      if (!actual) {
        return { status: 'pending', message: '运输节点已发出但实际到达缺失', suggestion: '确认运输状态，预计到达后补录实际到达时间' };
      }
      const p = new Date(planned).getTime();
      const a = new Date(actual).getTime();
      if (!Number.isFinite(p) || !Number.isFinite(a)) return null;
      const hours = (a - p) / 36e5;
      if (hours > 24) {
        return { status: 'failed', message: `运输延误 ${hours.toFixed(1)} 小时，超过 24 小时阈值`, suggestion: '登记延误原因，通知展陈部调整布展节奏并更新保险出险通知阈值' };
      }
      return null;
    },
  },
  ENV_ABNORMAL: {
    code: 'ENV_ABNORMAL',
    applies: (x) => x.kind === 'shipping' || x.kind === 'insurance',
    check: (x) => {
      const r = x.raw || {};
      const t = toNum(r.temperature ?? r.温度 ?? r.temp);
      const h = toNum(r.humidity    ?? r.湿度 ?? r.hum);
      const issues = [];
      if (t !== null && (t < 16 || t > 24)) issues.push(`温度 ${t}℃ 超出 [16,24]`);
      if (h !== null && (h < 45 || h > 55)) issues.push(`湿度 ${h}% 超出 [45,55]`);
      if (issues.length) {
        return { status: 'pending', message: `温湿度异常：${issues.join('；')}`, suggestion: '核查运输/存储环境记录，必要时联系文保专员评估受损风险' };
      }
      return null;
    },
  },
  MISSING_REQUIRED: {
    code: 'MISSING_REQUIRED',
    applies: () => true,
    check: (x) => {
      const r = x.raw || {};
      const required = x.kind === 'artifact'
        ? ['accession_no', 'title', 'declared_value']
        : x.kind === 'shipping'
          ? ['shipment_id', 'planned_arrival']
          : ['policy_no', 'insured_value'];
      const missing = required.filter((k) => r[k] === undefined || r[k] === null || r[k] === '');
      if (missing.length) {
        return { status: 'pending', message: `缺失必填字段: ${missing.join(', ')}`, suggestion: '补齐缺失字段后再提交；若字段名不同请在 CSV/JSON 中映射为英文键' };
      }
      return null;
    },
  },
};

const evaluate = (item) => {
  for (const rule of Object.values(rules)) {
    if (!rule.applies(item)) continue;
    const res = rule.check(item);
    if (res) return { rule_code: rule.code, ...res };
  }
  return { status: 'normal', rule_code: null, message: null, suggestion: null };
};

module.exports = { rules, evaluate };
