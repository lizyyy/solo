const G = 9.80665;

const BELAY_DEFAULTS = {
  ATC: { friction: 0.50, label: 'ATC' },
  GriGri: { friction: 0.72, label: 'GriGri' },
  Figure8: { friction: 0.30, label: '8字环' },
  Munter: { friction: 0.60, label: '意大利半扣' }
};

const RISK_THRESHOLDS = [
  { max: 6, level: 'Low', color: '#4caf50' },
  { max: 8, level: 'Medium', color: '#ff9800' },
  { max: 12, level: 'High', color: '#f44336' },
  { max: Infinity, level: 'Critical', color: '#9c27b0' }
];

const STATE_TRANSITIONS = {
  draft:     { submit: 'submitted', delete: null },
  submitted: { approve: 'approved', reject: 'rejected', withdraw: 'draft', supplement: 'submitted' },
  approved:  { withdraw: 'submitted', supplement: 'approved' },
  rejected:  { supplement: 'rejected', submit: 'submitted' }
};

const STATUS_LABELS = {
  draft: '草稿', submitted: '已提交', approved: '已审核', rejected: '已驳回'
};

const UIAA_MAX_IMPACT = 12;
const MAX_FALL_FACTOR = 2.0;
const ENERGY_DEVIATION_WARN = 0.10;
const ENERGY_DEVIATION_CRITICAL = 0.25;

const PhysicsEngine = {
  calculate(params) {
    const { ropeLength, fallDistance, mass, frictionCoeff, frictionDir, elongationRate, ropeModulus } = params;
    const errors = [];
    const warnings = [];

    if (ropeLength <= 0) {
      errors.push({ field: 'ropeLength', msg: '绳长必须大于零，否则无法计算坠落系数' });
    }
    if (fallDistance < 0) {
      errors.push({ field: 'fallDistance', msg: '坠落距离不能为负' });
    }
    if (mass <= 0) {
      errors.push({ field: 'mass', msg: '攀爬者质量必须大于零' });
    }
    if (frictionCoeff < 0 || frictionCoeff > 1) {
      errors.push({ field: 'frictionCoeff', msg: '摩擦系数应在 0~1 之间' });
    }
    if (frictionDir === 'opposing') {
      warnings.push({ field: 'frictionDir', msg: '摩擦方向为"反向"，这与正常保护操作相反，冲击力将放大', severity: 'error' });
    }
    if (ropeLength > 0) {
      const ff = fallDistance / ropeLength;
      if (ff > MAX_FALL_FACTOR) {
        errors.push({ field: 'fallFactor', msg: `坠落系数 ${ff.toFixed(2)} > 2.0，物理上不可能（坠落距离超过绳长的两倍）` });
      }
    }
    if (elongationRate !== undefined && (elongationRate < 0 || elongationRate > 50)) {
      errors.push({ field: 'elongationRate', msg: '绳伸长率应在 0~50% 之间' });
    }

    if (errors.some(e => e.field === 'ropeLength' || e.field === 'fallFactor')) {
      return {
        valid: false,
        errors,
        warnings,
        fallFactor: ropeLength > 0 ? fallDistance / ropeLength : Infinity,
        baseImpactForce: null,
        effectiveImpactForce: null,
        ropeElongationAbs: null,
        potentialEnergy: mass * G * Math.max(fallDistance, 0),
        absorbedEnergy: null,
        energyDeviation: null,
        riskLevel: null,
        riskColor: null,
        exceedsUIAA: false
      };
    }

    const fallFactor = fallDistance / ropeLength;
    const weight = mass * G;
    const K = ropeModulus || 25.0;
    const K_N = K * 1000;

    const discriminant = 1 + (2 * K_N * fallFactor) / (weight * 1);
    const baseImpactForce = weight * (1 + Math.sqrt(Math.max(discriminant, 0)));

    let frictionFactor;
    if (frictionDir === 'opposing') {
      frictionFactor = 1 + (1 - frictionCoeff) * 0.5;
    } else {
      frictionFactor = (1 + Math.exp(-frictionCoeff * Math.PI)) / 2;
    }

    const effectiveImpactForce = baseImpactForce * frictionFactor;

    const k_total = K_N / Math.max(ropeLength, 0.01);
    const x_base = baseImpactForce / Math.max(k_total, 1);
    const ropeElongationAbs = effectiveImpactForce / Math.max(k_total, 1);

    const potentialEnergyBase = weight * (fallDistance + Math.max(x_base, 0));
    const potentialEnergy = weight * (fallDistance + Math.max(ropeElongationAbs, 0));
    const absorbedEnergyBase = 0.5 * k_total * Math.max(x_base, 0) * Math.max(x_base, 0);
    const absorbedEnergy = 0.5 * k_total * Math.max(ropeElongationAbs, 0) * Math.max(ropeElongationAbs, 0);
    const frictionDissipated = potentialEnergy - absorbedEnergy;

    let energyDeviation = null;
    if (potentialEnergyBase > 0 && absorbedEnergyBase !== null) {
      energyDeviation = Math.abs(absorbedEnergyBase - potentialEnergyBase) / potentialEnergyBase;
    }

    const riskLevel = this.classifyRisk(effectiveImpactForce / 1000);
    const exceedsUIAA = (effectiveImpactForce / 1000) > UIAA_MAX_IMPACT;

    if (exceedsUIAA) {
      warnings.push({ field: 'impactForce', msg: `有效冲击力 ${(effectiveImpactForce/1000).toFixed(2)} kN 超过 UIAA 标准 12 kN`, severity: 'error' });
    }
    if (energyDeviation !== null && energyDeviation > ENERGY_DEVIATION_CRITICAL) {
      warnings.push({ field: 'energy', msg: `能量守恒偏差 ${(energyDeviation*100).toFixed(1)}% > 25%，计算结果不可信`, severity: 'error' });
    } else if (energyDeviation !== null && energyDeviation > ENERGY_DEVIATION_WARN) {
      warnings.push({ field: 'energy', msg: `能量守恒偏差 ${(energyDeviation*100).toFixed(1)}% > 10%，需复核参数`, severity: 'warn' });
    }
    if (fallFactor >= 1.0) {
      warnings.push({ field: 'fallFactor', msg: `坠落系数 ${fallFactor.toFixed(2)} ≥ 1.0，属于严重坠落`, severity: 'warn' });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fallFactor,
      baseImpactForce: baseImpactForce / 1000,
      effectiveImpactForce: effectiveImpactForce / 1000,
      ropeElongationAbs,
      potentialEnergy,
      absorbedEnergy,
      energyDeviation,
      riskLevel: riskLevel.level,
      riskColor: riskLevel.color,
      exceedsUIAA
    };
  },

  classifyRisk(forceKN) {
    for (const t of RISK_THRESHOLDS) {
      if (forceKN < t.max) return t;
    }
    return RISK_THRESHOLDS[RISK_THRESHOLDS.length - 1];
  }
};

const StateMachine = {
  canTransition(currentState, action) {
    const transitions = STATE_TRANSITIONS[currentState];
    if (!transitions) return false;
    return action in transitions;
  },

  transition(currentState, action) {
    if (!this.canTransition(currentState, action)) {
      return { success: false, error: `不允许从 "${STATUS_LABELS[currentState]}" 执行 "${action}" 操作` };
    }
    const newState = STATE_TRANSITIONS[currentState][action];
    if (newState === null) {
      return { success: false, error: `操作 "${action}" 在 "${STATUS_LABELS[currentState]}" 状态下不可用` };
    }
    return { success: true, newState };
  }
};

const DataManager = {
  _records: new Map(),
  _listeners: [],

  onChange(fn) { this._listeners.push(fn); },
  _notify() { this._listeners.forEach(fn => fn(this.getAll())); },

  getAll() {
    return Array.from(this._records.values()).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  },

  getById(id) { return this._records.get(id) || null; },

  idExists(id) { return this._records.has(id); },

  add(record) {
    if (this.idExists(record.id)) {
      return { success: false, error: `记录编号 "${record.id}" 已存在，不允许重复编号` };
    }
    const now = Date.now();
    const rec = {
      ...record,
      status: record.status || 'draft',
      createdAt: now,
      updatedAt: now,
      history: [{ action: 'create', from: null, to: 'draft', ts: now, note: '创建记录' }],
      calcResult: null
    };
    rec.calcResult = PhysicsEngine.calculate(rec);
    this._records.set(rec.id, rec);
    this._notify();
    return { success: true, record: rec };
  },

  update(id, updates) {
    const rec = this._records.get(id);
    if (!rec) return { success: false, error: `记录 "${id}" 不存在` };
    if (rec.status !== 'draft' && rec.status !== 'rejected') {
      return { success: false, error: `记录 "${id}" 状态为 "${STATUS_LABELS[rec.status]}"，不可直接编辑，请使用补录功能` };
    }
    const now = Date.now();
    Object.assign(rec, updates, { updatedAt: now });
    rec.calcResult = PhysicsEngine.calculate(rec);
    rec.history.push({ action: 'update', from: rec.status, to: rec.status, ts: now, note: '编辑记录' });
    this._records.set(id, rec);
    this._notify();
    return { success: true, record: rec };
  },

  supplement(id, supplementalData) {
    const rec = this._records.get(id);
    if (!rec) return { success: false, error: `记录 "${id}" 不存在` };
    if (!StateMachine.canTransition(rec.status, 'supplement')) {
      return { success: false, error: `记录 "${id}" 状态为 "${STATUS_LABELS[rec.status]}"，不可补录` };
    }
    const now = Date.now();
    const prevState = rec.status;
    Object.assign(rec, supplementalData, { updatedAt: now });
    rec.calcResult = PhysicsEngine.calculate(rec);
    const result = StateMachine.transition(rec.status, 'supplement');
    if (result.success) {
      rec.status = result.newState;
    }
    rec.history.push({ action: 'supplement', from: prevState, to: rec.status, ts: now, note: '补录数据' });
    this._records.set(id, rec);
    this._notify();
    return { success: true, record: rec };
  },

  changeState(id, action) {
    const rec = this._records.get(id);
    if (!rec) return { success: false, error: `记录 "${id}" 不存在` };
    const result = StateMachine.transition(rec.status, action);
    if (!result.success) return result;
    const now = Date.now();
    const prevState = rec.status;
    rec.status = result.newState;
    rec.updatedAt = now;
    rec.history.push({ action, from: prevState, to: result.newState, ts: now, note: this._actionLabel(action) });
    this._records.set(id, rec);
    this._notify();
    return { success: true, record: rec };
  },

  delete(id) {
    const rec = this._records.get(id);
    if (!rec) return { success: false, error: `记录 "${id}" 不存在` };
    if (rec.status !== 'draft') {
      return { success: false, error: `记录 "${id}" 状态为 "${STATUS_LABELS[rec.status]}"，仅草稿可删除` };
    }
    this._records.delete(id);
    this._notify();
    return { success: true };
  },

  _actionLabel(action) {
    const labels = { submit: '提交', approve: '审核通过', reject: '驳回', withdraw: '撤回', supplement: '补录' };
    return labels[action] || action;
  },

  filter(records, filters) {
    return records.filter(r => {
      if (filters.risk && r.calcResult && r.calcResult.riskLevel !== filters.risk) return false;
      if (filters.status && r.status !== filters.status) return false;
      if (filters.belayType && r.belayType !== filters.belayType) return false;
      if (filters.forceMin !== undefined && filters.forceMin !== '' && r.calcResult && r.calcResult.effectiveImpactForce !== null) {
        if (r.calcResult.effectiveImpactForce < Number(filters.forceMin)) return false;
      }
      if (filters.forceMax !== undefined && filters.forceMax !== '' && r.calcResult && r.calcResult.effectiveImpactForce !== null) {
        if (r.calcResult.effectiveImpactForce > Number(filters.forceMax)) return false;
      }
      return true;
    });
  },

  exportCSV(records) {
    const headers = ['编号','日期','绳长(m)','坠落距离(m)','质量(kg)','保护器','摩擦系数','摩擦方向','绳伸长率(%)','绳索模量(kN)','坠落系数','基础冲击力(kN)','有效冲击力(kN)','绳伸长量(m)','输入势能(J)','吸收能量(J)','能量偏差(%)','风险等级','超UIAA','状态','备注'];
    const rows = records.map(r => {
      const c = r.calcResult || {};
      return [
        r.id,
        r.date || '',
        r.ropeLength ?? '',
        r.fallDistance ?? '',
        r.mass ?? '',
        r.belayType || '',
        r.frictionCoeff ?? '',
        r.frictionDir === 'opposing' ? '反向' : '协助制动',
        r.elongationRate ?? '',
        r.ropeModulus ?? '',
        c.fallFactor !== undefined && c.fallFactor !== null ? c.fallFactor.toFixed(3) : '',
        c.baseImpactForce !== null && c.baseImpactForce !== undefined ? c.baseImpactForce.toFixed(2) : '',
        c.effectiveImpactForce !== null && c.effectiveImpactForce !== undefined ? c.effectiveImpactForce.toFixed(2) : '',
        c.ropeElongationAbs !== null && c.ropeElongationAbs !== undefined ? c.ropeElongationAbs.toFixed(4) : '',
        c.potentialEnergy !== null && c.potentialEnergy !== undefined ? c.potentialEnergy.toFixed(1) : '',
        c.absorbedEnergy !== null && c.absorbedEnergy !== undefined ? c.absorbedEnergy.toFixed(1) : '',
        c.energyDeviation !== null && c.energyDeviation !== undefined ? (c.energyDeviation * 100).toFixed(1) : '',
        c.riskLevel || '',
        c.exceedsUIAA ? '是' : '否',
        STATUS_LABELS[r.status] || r.status,
        (r.notes || '').replace(/"/g, '""')
      ].map(v => `"${v}"`).join(',');
    });
    return '\uFEFF' + [headers.join(','), ...rows].join('\n');
  },

  generateReport(records) {
    let html = `<html><head><meta charset="utf-8"><title>攀岩坠落缓冲安全报告</title>
    <style>
      body{font-family:sans-serif;padding:24px;color:#2c2825;}
      h1{color:#c75b39;font-size:22px;margin-bottom:4px;}
      h2{color:#4a7c6f;font-size:16px;margin-top:20px;margin-bottom:8px;}
      .meta{color:#6b6560;font-size:12px;margin-bottom:16px;}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px;}
      th,td{border:1px solid #d4cfc8;padding:5px 8px;text-align:left;}
      th{background:#f5f3f0;font-weight:600;}
      .risk-low{color:#4caf50;font-weight:bold;}
      .risk-medium{color:#ff9800;font-weight:bold;}
      .risk-high{color:#f44336;font-weight:bold;}
      .risk-critical{color:#9c27b0;font-weight:bold;}
      .warn{background:#fff8e1;padding:8px;border-left:3px solid #ff9800;margin-bottom:8px;font-size:12px;}
      .err{background:#fde8e8;padding:8px;border-left:3px solid #f44336;margin-bottom:8px;font-size:12px;}
      .summary{display:flex;gap:16px;margin-bottom:16px;}
      .summary-card{flex:1;background:#f5f3f0;border-radius:8px;padding:12px;text-align:center;}
      .summary-card .num{font-size:24px;font-weight:700;color:#c75b39;}
      .summary-card .lbl{font-size:11px;color:#6b6560;}
    </style></head><body>`;
    html += `<h1>攀岩坠落缓冲安全报告</h1>`;
    html += `<div class="meta">生成时间: ${new Date().toLocaleString('zh-CN')}</div>`;

    const validRecs = records.filter(r => r.calcResult && r.calcResult.valid);
    const invalidRecs = records.filter(r => r.calcResult && !r.calcResult.valid);
    const criticalRecs = validRecs.filter(r => r.calcResult.riskLevel === 'Critical');
    const highRecs = validRecs.filter(r => r.calcResult.riskLevel === 'High');
    const exceeds = validRecs.filter(r => r.calcResult.exceedsUIAA);

    html += `<div class="summary">`;
    html += `<div class="summary-card"><div class="num">${records.length}</div><div class="lbl">总记录</div></div>`;
    html += `<div class="summary-card"><div class="num">${validRecs.length}</div><div class="lbl">有效计算</div></div>`;
    html += `<div class="summary-card"><div class="num" style="color:#9c27b0">${criticalRecs.length}</div><div class="lbl">Critical</div></div>`;
    html += `<div class="summary-card"><div class="num" style="color:#f44336">${highRecs.length}</div><div class="lbl">High</div></div>`;
    html += `<div class="summary-card"><div class="num" style="color:#f44336">${exceeds.length}</div><div class="lbl">超UIAA标准</div></div>`;
    html += `</div>`;

    if (invalidRecs.length > 0) {
      html += `<h2>⚠️ 参数异常记录</h2>`;
      html += `<div class="err">以下 ${invalidRecs.length} 条记录存在参数边界问题，计算结果不可信：</div>`;
      html += `<table><tr><th>编号</th><th>问题</th></tr>`;
      invalidRecs.forEach(r => {
        const msgs = (r.calcResult.errors || []).map(e => e.msg).join('；');
        html += `<tr><td>${r.id}</td><td>${msgs}</td></tr>`;
      });
      html += `</table>`;
    }

    if (exceeds.length > 0) {
      html += `<h2>🚨 冲击力超限记录</h2>`;
      html += `<div class="err">以下记录有效冲击力超过 UIAA 12 kN 标准：</div>`;
      html += `<table><tr><th>编号</th><th>冲击力(kN)</th><th>坠落系数</th><th>风险</th></tr>`;
      exceeds.forEach(r => {
        html += `<tr><td>${r.id}</td><td class="risk-${r.calcResult.riskLevel.toLowerCase()}">${r.calcResult.effectiveImpactForce.toFixed(2)}</td><td>${r.calcResult.fallFactor.toFixed(2)}</td><td class="risk-${r.calcResult.riskLevel.toLowerCase()}">${r.calcResult.riskLevel}</td></tr>`;
      });
      html += `</table>`;
    }

    html += `<h2>完整数据</h2>`;
    html += `<table><tr><th>编号</th><th>绳长(m)</th><th>坠落(m)</th><th>质量(kg)</th><th>保护器</th><th>FF</th><th>冲击力(kN)</th><th>能量偏差</th><th>风险</th><th>状态</th></tr>`;
    records.forEach(r => {
      const c = r.calcResult || {};
      const riskClass = c.riskLevel ? `risk-${c.riskLevel.toLowerCase()}` : '';
      html += `<tr>
        <td>${r.id}</td>
        <td>${r.ropeLength ?? ''}</td>
        <td>${r.fallDistance ?? ''}</td>
        <td>${r.mass ?? ''}</td>
        <td>${r.belayType || ''}</td>
        <td>${c.fallFactor !== undefined ? c.fallFactor.toFixed(2) : '—'}</td>
        <td class="${riskClass}">${c.effectiveImpactForce !== null && c.effectiveImpactForce !== undefined ? c.effectiveImpactForce.toFixed(2) : '—'}</td>
        <td>${c.energyDeviation !== null && c.energyDeviation !== undefined ? (c.energyDeviation*100).toFixed(1)+'%' : '—'}</td>
        <td class="${riskClass}">${c.riskLevel || '—'}</td>
        <td>${STATUS_LABELS[r.status] || r.status}</td>
      </tr>`;
    });
    html += `</table>`;

    html += `</body></html>`;
    return html;
  },

  loadSampleData() {
    const samples = [
      {
        id: 'CL-2026-001', date: '2026-03-12', ropeLength: 25.0, fallDistance: 3.2,
        mass: 72.0, belayType: 'ATC', frictionCoeff: 0.50, frictionDir: 'assisting',
        elongationRate: 8.5, ropeModulus: 25.0,
        notes: '5.9 线路，第4个快挂处脱落，保护正常'
      },
      {
        id: 'CL-2026-002', date: '2026-03-14', ropeLength: 18.0, fallDistance: 5.0,
        mass: 85.0, belayType: 'GriGri', frictionCoeff: 0.72, frictionDir: 'assisting',
        elongationRate: 7.2, ropeModulus: 22.0,
        notes: '5.11 线路，冲坠，保护者稍微被提起'
      },
      {
        id: 'CL-2026-003', date: '2026-03-15', ropeLength: 0, fallDistance: 2.0,
        mass: 68.0, belayType: 'ATC', frictionCoeff: 0.50, frictionDir: 'assisting',
        elongationRate: 9.0, ropeModulus: 25.0,
        notes: '忘记记录绳长，保护点数据缺失'
      },
      {
        id: 'CL-2026-004', date: '2026-03-18', ropeLength: 30.0, fallDistance: 8.0,
        mass: 78.5, belayType: 'Figure8', frictionCoeff: 0.30, frictionDir: 'opposing',
        elongationRate: 10.0, ropeModulus: 20.0,
        notes: '8字环使用方式有误，摩擦方向反向！需重新培训'
      },
      {
        id: 'CL-2026-005', date: '2026-03-20', ropeLength: 12.0, fallDistance: 1.8,
        mass: 55.0, belayType: 'Munter', frictionCoeff: 0.60, frictionDir: 'assisting',
        elongationRate: 6.8, ropeModulus: 28.0,
        notes: '青少年课程，轻量攀爬者，轻微坠落'
      },
      {
        id: 'CL-2026-006', date: '2026-03-22', ropeLength: 40.0, fallDistance: 12.0,
        mass: 92.0, belayType: 'ATC', frictionCoeff: 0.50, frictionDir: 'assisting',
        elongationRate: 9.5, ropeModulus: 25.0,
        notes: '高墙区域，大坠落系数，保护者给出动态缓冲'
      },
      {
        id: 'CL-2026-007', date: '2026-03-25', ropeLength: 15.0, fallDistance: 4.5,
        mass: 76.0, belayType: 'GriGri', frictionCoeff: 0.72, frictionDir: 'assisting',
        elongationRate: 7.8, ropeModulus: 26.0,
        notes: ''
      },
      {
        id: 'CL-2026-008', date: '2026-03-28', ropeLength: 20.0, fallDistance: 0.5,
        mass: 65.0, belayType: 'ATC', frictionCoeff: 0.55, frictionDir: 'assisting',
        elongationRate: null, ropeModulus: null,
        notes: '绳伸长率和模量未测，使用默认值'
      },
      {
        id: 'CL-2026-009', date: '2026-04-01', ropeLength: 10.0, fallDistance: 15.0,
        mass: 80.0, belayType: 'ATC', frictionCoeff: 0.50, frictionDir: 'assisting',
        elongationRate: 8.0, ropeModulus: 25.0,
        notes: '数据异常：坠落距离远超绳长两倍，坠落系数 > 2'
      },
      {
        id: 'CL-2026-010', date: '2026-04-03', ropeLength: 22.0, fallDistance: 6.5,
        mass: 70.0, belayType: 'GriGri', frictionCoeff: 0.72, frictionDir: 'assisting',
        elongationRate: 7.5, ropeModulus: 24.0,
        notes: '抱石区上方顶绳，正常脱落'
      },
      {
        id: 'CL-2026-011', date: '2026-04-05', ropeLength: 35.0, fallDistance: 2.0,
        mass: 88.0, belayType: 'ATC', frictionCoeff: 0.48, frictionDir: 'assisting',
        elongationRate: 8.2, ropeModulus: 23.5,
        notes: '重量偏大攀爬者，低坠落系数，注意绳索磨损'
      },
      {
        id: 'CL-2026-012', date: '2026-04-08', ropeLength: 8.0, fallDistance: 6.0,
        mass: 75.0, belayType: 'Figure8', frictionCoeff: 0.35, frictionDir: 'assisting',
        elongationRate: 9.8, ropeModulus: 21.0,
        notes: '短绳长大坠落，FF=0.75，8字环摩擦偏低'
      }
    ];

    samples.forEach(s => {
      const rec = {
        ...s,
        status: 'draft',
        photoData: null
      };
      this.add(rec);
    });

    const r2 = this.getById('CL-2026-002');
    if (r2) this.changeState('CL-2026-002', 'submit');

    const r7 = this.getById('CL-2026-007');
    if (r7) this.changeState('CL-2026-007', 'submit');
    if (r7) this.changeState('CL-2026-007', 'approve');

    const r10 = this.getById('CL-2026-010');
    if (r10) this.changeState('CL-2026-010', 'submit');
    if (r10) this.changeState('CL-2026-010', 'approve');

    const r4 = this.getById('CL-2026-004');
    if (r4) this.changeState('CL-2026-004', 'submit');
    if (r4) this.changeState('CL-2026-004', 'reject');
  }
};

const UIController = {
  currentFilters: {},
  editingId: null,
  cameraStream: null,
  cameraFacing: 'user',
  capturedPhotos: [],

  init() {
    DataManager.onChange(() => this.renderTable());

    document.getElementById('btn-legend').addEventListener('click', () => this.toggleLegend());
    document.getElementById('btn-legend-close').addEventListener('click', () => this.toggleLegend(false));
    document.getElementById('btn-camera').addEventListener('click', () => this.toggleCamera());
    document.getElementById('btn-camera-close').addEventListener('click', () => this.toggleCamera(false));
    document.getElementById('btn-camera-capture').addEventListener('click', () => this.capturePhoto());
    document.getElementById('btn-camera-switch').addEventListener('click', () => this.switchCamera());
    document.getElementById('btn-export').addEventListener('click', () => this.showExportModal());
    document.getElementById('btn-filter-apply').addEventListener('click', () => this.applyFilters());
    document.getElementById('btn-filter-reset').addEventListener('click', () => this.resetFilters());

    document.getElementById('record-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveDraft();
    });
    document.getElementById('btn-submit-record').addEventListener('click', () => this.submitRecord());
    document.getElementById('btn-cancel-form').addEventListener('click', () => this.cancelForm());

    document.getElementById('form-belay-type').addEventListener('change', (e) => {
      const def = BELAY_DEFAULTS[e.target.value];
      if (def) document.getElementById('form-friction-coeff').value = def.friction;
    });

    DataManager.loadSampleData();
    this.renderTable();
  },

  toggleLegend(show) {
    const panel = document.getElementById('legend-panel');
    const visible = show !== undefined ? show : panel.style.display === 'none';
    panel.style.display = visible ? 'block' : 'none';
  },

  async toggleCamera(show) {
    const panel = document.getElementById('camera-panel');
    if (show === false || panel.style.display !== 'none') {
      panel.style.display = 'none';
      this.stopCamera();
      return;
    }
    panel.style.display = 'block';
    await this.startCamera();
  },

  async startCamera() {
    try {
      if (this.cameraStream) {
        this.cameraStream.getTracks().forEach(t => t.stop());
      }
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this.cameraFacing, width: { ideal: 640 }, height: { ideal: 480 } }
      });
      document.getElementById('camera-video').srcObject = this.cameraStream;
    } catch (err) {
      console.warn('Camera not available:', err);
      const capturesDiv = document.getElementById('camera-captures');
      capturesDiv.innerHTML = '<div style="color:#b71c1c;font-size:12px;padding:4px;">⚠️ 无法访问摄像头：' + err.message + '</div>';
    }
  },

  stopCamera() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(t => t.stop());
      this.cameraStream = null;
    }
  },

  async switchCamera() {
    this.cameraFacing = this.cameraFacing === 'user' ? 'environment' : 'user';
    await this.startCamera();
  },

  capturePhoto() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    if (!video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

    this.capturedPhotos.push(dataUrl);
    document.getElementById('form-photo-data').value = this.capturedPhotos.join('|||');

    const capturesDiv = document.getElementById('camera-captures');
    const img = document.createElement('img');
    img.src = dataUrl;
    img.title = '点击移除';
    img.addEventListener('click', () => {
      this.capturedPhotos = this.capturedPhotos.filter(p => p !== dataUrl);
      document.getElementById('form-photo-data').value = this.capturedPhotos.join('|||');
      img.remove();
    });
    capturesDiv.appendChild(img);
  },

  showExportModal() {
    const records = DataManager.filter(DataManager.getAll(), this.currentFilters);
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    content.innerHTML = `
      <h3>📤 导出报告</h3>
      <p style="font-size:13px;color:#6b6560;margin-bottom:12px;">当前筛选结果共 ${records.length} 条记录</p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="btn btn-primary" id="export-csv">导出 CSV 文件</button>
        <button class="btn btn-secondary" id="export-html">导出 HTML 安全报告</button>
        <button class="btn btn-outline" id="export-print">打印报告</button>
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" id="export-close">关闭</button>
      </div>
    `;

    overlay.style.display = 'flex';

    document.getElementById('export-csv').addEventListener('click', () => {
      const csv = DataManager.exportCSV(records);
      this._downloadFile(csv, '攀岩坠落缓冲数据.csv', 'text/csv;charset=utf-8');
    });

    document.getElementById('export-html').addEventListener('click', () => {
      const html = DataManager.generateReport(records);
      this._downloadFile(html, '攀岩坠落缓冲安全报告.html', 'text/html;charset=utf-8');
    });

    document.getElementById('export-print').addEventListener('click', () => {
      const html = DataManager.generateReport(records);
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
      win.print();
    });

    document.getElementById('export-close').addEventListener('click', () => {
      overlay.style.display = 'none';
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  },

  _downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  applyFilters() {
    this.currentFilters = {
      risk: document.getElementById('filter-risk').value || undefined,
      status: document.getElementById('filter-status').value || undefined,
      belayType: document.getElementById('filter-belay').value || undefined,
      forceMin: document.getElementById('filter-force-min').value,
      forceMax: document.getElementById('filter-force-max').value
    };
    this.renderTable();
  },

  resetFilters() {
    this.currentFilters = {};
    document.getElementById('filter-risk').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-belay').value = '';
    document.getElementById('filter-force-min').value = '';
    document.getElementById('filter-force-max').value = '';
    this.renderTable();
  },

  getFormData() {
    return {
      id: document.getElementById('form-id').value.trim(),
      date: document.getElementById('form-date').value,
      ropeLength: parseFloat(document.getElementById('form-rope-len').value),
      fallDistance: parseFloat(document.getElementById('form-fall-dist').value),
      mass: parseFloat(document.getElementById('form-mass').value),
      belayType: document.getElementById('form-belay-type').value,
      frictionCoeff: parseFloat(document.getElementById('form-friction-coeff').value),
      frictionDir: document.getElementById('form-friction-dir').value,
      elongationRate: document.getElementById('form-elongation').value !== '' ? parseFloat(document.getElementById('form-elongation').value) : undefined,
      ropeModulus: document.getElementById('form-rope-modulus').value !== '' ? parseFloat(document.getElementById('form-rope-modulus').value) : undefined,
      notes: document.getElementById('form-notes').value.trim(),
      photoData: document.getElementById('form-photo-data').value || null
    };
  },

  clearFormErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.field-invalid').forEach(el => el.classList.remove('field-invalid'));
  },

  validateForm(data) {
    this.clearFormErrors();
    let valid = true;

    if (!data.id) {
      document.getElementById('err-id').textContent = '记录编号不能为空';
      document.getElementById('form-id').classList.add('field-invalid');
      valid = false;
    } else if (!this.editingId && DataManager.idExists(data.id)) {
      document.getElementById('err-id').textContent = `编号 "${data.id}" 已存在，不允许重复`;
      document.getElementById('form-id').classList.add('field-invalid');
      valid = false;
    }

    if (isNaN(data.ropeLength) || data.ropeLength === undefined) {
      document.getElementById('err-rope-len').textContent = '绳长不能为空';
      document.getElementById('form-rope-len').classList.add('field-invalid');
      valid = false;
    } else if (data.ropeLength <= 0) {
      document.getElementById('err-rope-len').textContent = '绳长为零或负数将导致计算异常';
      document.getElementById('form-rope-len').classList.add('field-invalid');
    }

    if (isNaN(data.fallDistance) || data.fallDistance === undefined) {
      document.getElementById('err-fall-dist').textContent = '坠落距离不能为空';
      document.getElementById('form-fall-dist').classList.add('field-invalid');
      valid = false;
    }

    if (isNaN(data.mass) || data.mass === undefined) {
      document.getElementById('err-mass').textContent = '质量不能为空';
      document.getElementById('form-mass').classList.add('field-invalid');
      valid = false;
    } else if (data.mass <= 0) {
      document.getElementById('err-mass').textContent = '质量必须大于零';
      document.getElementById('form-mass').classList.add('field-invalid');
      valid = false;
    }

    if (!isNaN(data.frictionCoeff) && data.frictionCoeff !== undefined) {
      if (data.frictionCoeff < 0 || data.frictionCoeff > 1) {
        document.getElementById('err-friction').textContent = '摩擦系数应在 0~1 之间';
        document.getElementById('form-friction-coeff').classList.add('field-invalid');
        valid = false;
      }
    }

    if (data.frictionDir === 'opposing') {
      document.getElementById('err-friction-dir').textContent = '⚠️ 摩擦方向为反向，冲击力将被放大';
    }

    if (!isNaN(data.ropeLength) && data.ropeLength > 0 && !isNaN(data.fallDistance)) {
      const ff = data.fallDistance / data.ropeLength;
      if (ff > MAX_FALL_FACTOR) {
        document.getElementById('err-fall-dist').textContent = `坠落系数 ${ff.toFixed(2)} > 2.0，不可能`;
        document.getElementById('form-fall-dist').classList.add('field-invalid');
      }
    }

    return valid;
  },

  saveDraft() {
    const data = this.getFormData();
    if (!this.validateForm(data)) return;

    if (this.editingId) {
      const rec = DataManager.getById(this.editingId);
      if (rec && rec.status === 'draft') {
        DataManager.update(this.editingId, data);
      } else if (rec) {
        DataManager.supplement(this.editingId, data);
      }
    } else {
      const result = DataManager.add({ ...data, status: 'draft' });
      if (!result.success) {
        document.getElementById('err-id').textContent = result.error;
        document.getElementById('form-id').classList.add('field-invalid');
        return;
      }
    }
    this.resetForm();
    this.renderTable();
  },

  submitRecord() {
    const data = this.getFormData();
    if (!this.validateForm(data)) return;

    let recordId;
    if (this.editingId) {
      const rec = DataManager.getById(this.editingId);
      if (rec && rec.status === 'draft') {
        DataManager.update(this.editingId, data);
      } else if (rec) {
        DataManager.supplement(this.editingId, data);
      }
      recordId = this.editingId;
    } else {
      const result = DataManager.add({ ...data, status: 'draft' });
      if (!result.success) {
        document.getElementById('err-id').textContent = result.error;
        document.getElementById('form-id').classList.add('field-invalid');
        return;
      }
      recordId = result.record.id;
    }

    const submitResult = DataManager.changeState(recordId, 'submit');
    if (!submitResult.success) {
      alert(submitResult.error);
      return;
    }
    this.resetForm();
    this.renderTable();
  },

  cancelForm() {
    this.resetForm();
  },

  resetForm() {
    this.editingId = null;
    document.getElementById('record-form').reset();
    document.getElementById('form-edit-id').value = '';
    document.getElementById('form-photo-data').value = '';
    this.capturedPhotos = [];
    document.getElementById('photo-preview-area').innerHTML = '';
    document.getElementById('camera-captures').innerHTML = '';
    this.clearFormErrors();
    this.hideCalcResults();
  },

  editRecord(id) {
    const rec = DataManager.getById(id);
    if (!rec) return;

    if (rec.status !== 'draft' && rec.status !== 'rejected') {
      this.showSupplementModal(id);
      return;
    }

    this.editingId = id;
    document.getElementById('form-edit-id').value = id;
    document.getElementById('form-id').value = rec.id;
    document.getElementById('form-id').readOnly = true;
    document.getElementById('form-date').value = rec.date || '';
    document.getElementById('form-rope-len').value = rec.ropeLength ?? '';
    document.getElementById('form-fall-dist').value = rec.fallDistance ?? '';
    document.getElementById('form-mass').value = rec.mass ?? '';
    document.getElementById('form-belay-type').value = rec.belayType || 'ATC';
    document.getElementById('form-friction-coeff').value = rec.frictionCoeff ?? '';
    document.getElementById('form-friction-dir').value = rec.frictionDir || 'assisting';
    document.getElementById('form-elongation').value = rec.elongationRate ?? '';
    document.getElementById('form-rope-modulus').value = rec.ropeModulus ?? '';
    document.getElementById('form-notes').value = rec.notes || '';

    if (rec.calcResult) this.showCalcResults(rec.calcResult);
    this.clearFormErrors();
  },

  showSupplementModal(id) {
    const rec = DataManager.getById(id);
    if (!rec) return;

    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    content.innerHTML = `
      <h3>📝 补录数据 — ${rec.id}</h3>
      <p style="font-size:12px;color:#6b6560;margin-bottom:12px;">当前状态：${STATUS_LABELS[rec.status]}。补录不会改变状态，但会更新计算结果。</p>
      <div class="form-group">
        <label>补充备注</label>
        <textarea id="supplement-notes" rows="3" placeholder="补充说明...">${rec.notes || ''}</textarea>
      </div>
      <div class="form-group">
        <label>修正绳伸长率 (%)</label>
        <input type="number" id="supplement-elongation" step="0.1" value="${rec.elongationRate ?? ''}">
      </div>
      <div class="form-group">
        <label>修正绳索模量 (kN)</label>
        <input type="number" id="supplement-modulus" step="0.1" value="${rec.ropeModulus ?? ''}">
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="supplement-save">保存补录</button>
        <button class="btn btn-outline" id="supplement-cancel">取消</button>
      </div>
    `;

    overlay.style.display = 'flex';

    document.getElementById('supplement-save').addEventListener('click', () => {
      const updates = {};
      const notes = document.getElementById('supplement-notes').value.trim();
      const elong = document.getElementById('supplement-elongation').value;
      const modulus = document.getElementById('supplement-modulus').value;

      if (notes) updates.notes = notes;
      if (elong !== '') updates.elongationRate = parseFloat(elong);
      if (modulus !== '') updates.ropeModulus = parseFloat(modulus);

      const result = DataManager.supplement(id, updates);
      if (!result.success) {
        alert(result.error);
        return;
      }
      overlay.style.display = 'none';
      this.renderTable();
    });

    document.getElementById('supplement-cancel').addEventListener('click', () => {
      overlay.style.display = 'none';
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  },

  showHistoryModal(id) {
    const rec = DataManager.getById(id);
    if (!rec) return;

    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    let historyHTML = rec.history.map(h => {
      const ts = new Date(h.ts).toLocaleString('zh-CN');
      return `<div style="padding:6px 0;border-bottom:1px solid #d4cfc8;font-size:12px;">
        <span style="color:#6b6560;">${ts}</span>
        <strong>${h.note}</strong>
        ${h.from ? ` (${STATUS_LABELS[h.from] || h.from} → ${STATUS_LABELS[h.to] || h.to})` : ''}
      </div>`;
    }).join('');

    content.innerHTML = `
      <h3>📋 操作历史 — ${rec.id}</h3>
      <div style="max-height:300px;overflow-y:auto;">${historyHTML}</div>
      <div class="modal-actions">
        <button class="btn btn-outline" id="history-close">关闭</button>
      </div>
    `;

    overlay.style.display = 'flex';

    document.getElementById('history-close').addEventListener('click', () => {
      overlay.style.display = 'none';
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  },

  renderTable() {
    const allRecords = DataManager.getAll();
    const filtered = DataManager.filter(allRecords, this.currentFilters);
    const tbody = document.getElementById('records-tbody');
    document.getElementById('record-count').textContent = `(${filtered.length}/${allRecords.length})`;

    tbody.innerHTML = filtered.map(r => {
      const c = r.calcResult || {};
      const isValid = c.valid !== false;
      const rowClass = !isValid ? 'row-invalid' : (c.warnings && c.warnings.some(w => w.severity === 'error') ? 'row-warning' : '');

      const riskBadge = c.riskLevel
        ? `<span class="risk-dot" style="background:${c.riskColor || '#999'}"></span>${c.riskLevel}`
        : '—';
      const statusBadge = `<span class="status-badge status-${r.status}">${STATUS_LABELS[r.status]}</span>`;
      const ffDisplay = c.fallFactor !== undefined && c.fallFactor !== null && c.fallFactor !== Infinity
        ? c.fallFactor.toFixed(2)
        : (c.fallFactor === Infinity ? '∞' : '—');
      const forceDisplay = c.effectiveImpactForce !== null && c.effectiveImpactForce !== undefined
        ? c.effectiveImpactForce.toFixed(2)
        : '—';
      const deviationDisplay = c.energyDeviation !== null && c.energyDeviation !== undefined
        ? `${(c.energyDeviation * 100).toFixed(1)}%`
        : '—';

      let actionBtns = '';
      if (r.status === 'draft') {
        actionBtns = `
          <button class="btn btn-outline btn-sm" onclick="UIController.editRecord('${r.id}')">编辑</button>
          <button class="btn btn-secondary btn-sm" onclick="UIController.doAction('${r.id}','submit')">提交</button>
          <button class="btn btn-danger btn-sm" onclick="UIController.doDelete('${r.id}')">删除</button>
        `;
      } else if (r.status === 'submitted') {
        actionBtns = `
          <button class="btn btn-outline btn-sm" onclick="UIController.showSupplementModal('${r.id}')">补录</button>
          <button class="btn btn-secondary btn-sm" onclick="UIController.doAction('${r.id}','approve')">审核</button>
          <button class="btn btn-danger btn-sm" onclick="UIController.doAction('${r.id}','reject')">驳回</button>
          <button class="btn btn-outline btn-sm" onclick="UIController.doAction('${r.id}','withdraw')">撤回</button>
        `;
      } else if (r.status === 'approved') {
        actionBtns = `
          <button class="btn btn-outline btn-sm" onclick="UIController.showSupplementModal('${r.id}')">补录</button>
          <button class="btn btn-outline btn-sm" onclick="UIController.doAction('${r.id}','withdraw')">撤回</button>
        `;
      } else if (r.status === 'rejected') {
        actionBtns = `
          <button class="btn btn-outline btn-sm" onclick="UIController.editRecord('${r.id}')">编辑</button>
          <button class="btn btn-outline btn-sm" onclick="UIController.showSupplementModal('${r.id}')">补录</button>
          <button class="btn btn-secondary btn-sm" onclick="UIController.doAction('${r.id}','submit')">重新提交</button>
        `;
      }
      actionBtns += `<button class="btn btn-outline btn-sm" onclick="UIController.showHistoryModal('${r.id}')" title="操作历史">📋</button>`;

      return `<tr class="${rowClass}">
        <td>${r.id}</td>
        <td>${r.date || '—'}</td>
        <td>${r.ropeLength ?? '—'}</td>
        <td>${r.fallDistance ?? '—'}</td>
        <td>${r.mass ?? '—'}</td>
        <td>${r.belayType || '—'}</td>
        <td>${r.frictionCoeff ?? '—'}</td>
        <td>${ffDisplay}</td>
        <td>${forceDisplay}</td>
        <td>${deviationDisplay}</td>
        <td>${riskBadge}</td>
        <td>${statusBadge}</td>
        <td><div class="action-btns">${actionBtns}</div></td>
      </tr>`;
    }).join('');
  },

  doAction(id, action) {
    const result = DataManager.changeState(id, action);
    if (!result.success) {
      alert(result.error);
      return;
    }
    this.renderTable();
  },

  doDelete(id) {
    if (!confirm(`确定要删除记录 "${id}" 吗？`)) return;
    const result = DataManager.delete(id);
    if (!result.success) {
      alert(result.error);
    }
    this.renderTable();
  },

  showCalcResults(calc) {
    document.getElementById('calc-results').style.display = 'flex';
    document.getElementById('calc-empty').style.display = 'none';

    document.getElementById('res-ff').textContent = calc.fallFactor === Infinity ? '∞' : (calc.fallFactor !== null && calc.fallFactor !== undefined ? calc.fallFactor.toFixed(3) : '—');
    document.getElementById('res-base-force').textContent = calc.baseImpactForce !== null && calc.baseImpactForce !== undefined ? calc.baseImpactForce.toFixed(2) + ' kN' : '—';
    document.getElementById('res-eff-force').textContent = calc.effectiveImpactForce !== null && calc.effectiveImpactForce !== undefined ? calc.effectiveImpactForce.toFixed(2) + ' kN' : '—';
    document.getElementById('res-elongation').textContent = calc.ropeElongationAbs !== null && calc.ropeElongationAbs !== undefined ? calc.ropeElongationAbs.toFixed(3) + ' m' : '—';
    document.getElementById('res-potential-energy').textContent = calc.potentialEnergy !== null && calc.potentialEnergy !== undefined ? calc.potentialEnergy.toFixed(1) + ' J' : '—';
    document.getElementById('res-absorbed-energy').textContent = calc.absorbedEnergy !== null && calc.absorbedEnergy !== undefined ? calc.absorbedEnergy.toFixed(1) + ' J' : '—';
    document.getElementById('res-energy-deviation').textContent = calc.energyDeviation !== null && calc.energyDeviation !== undefined ? (calc.energyDeviation * 100).toFixed(1) + '%' : '—';

    const riskEl = document.getElementById('res-risk-level');
    riskEl.textContent = calc.riskLevel || '—';
    riskEl.className = 'result-value';
    if (calc.riskColor) riskEl.style.color = calc.riskColor;

    const warningsDiv = document.getElementById('validation-warnings');
    const allIssues = [...(calc.errors || []), ...(calc.warnings || [])];
    if (allIssues.length > 0) {
      warningsDiv.innerHTML = allIssues.map(w => {
        const cls = w.severity === 'error' || (w.msg && w.msg.includes('不可能')) || (w.msg && w.msg.includes('不可信')) || (w.msg && w.msg.includes('必须')) ? 'warning-error' : 'warning-warn';
        const icon = cls === 'warning-error' ? '❌' : '⚠️';
        return `<div class="warning-item ${cls}">${icon} ${w.msg}</div>`;
      }).join('');
    } else {
      warningsDiv.innerHTML = '<div class="warning-item" style="background:#e8f5e9;color:#2e7d32;border-left:3px solid #4caf50;">✅ 所有参数在正常范围内</div>';
    }
  },

  hideCalcResults() {
    document.getElementById('calc-results').style.display = 'none';
    document.getElementById('calc-empty').style.display = 'block';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  UIController.init();
});
