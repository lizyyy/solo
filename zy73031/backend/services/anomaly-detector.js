const { getDatabase } = require('../config/database');

const ALGORITHM_VERSION = 'v1.2';
const CALIBER_VERSION = '2026-06-v1.1';
const CALIBER_DESC = '体重异常四分类：(1)体重字段与手写备注存在单位混写（含 kg/g/lb/斤等价换算但单位不同）；(2)体重字段内部多单位混写；(3)等价换算偏差超阈值的备注标注；(4)量级明显冲突（数值比>10x或绝对差>20%）。回访结论空值或歧义；病历单号与训练课关联断裂。复核口径：已确认=异常属实已处理；待补件=需补充材料佐证；退回=判定为误报。体重单位混写/量级冲突类记录在详情页与导出文件中均明确标注"非普通记录-体重单位异常"。';

function normalizeWeightUnit(unitRaw) {
  const unit = String(unitRaw || '').toLowerCase();
  if (unit === 'g' || unit === '克' || unit.startsWith('gram')) return 'g';
  if (unit === 'lb' || unit === 'lbs' || unit.startsWith('pound') || unit === '磅') return 'lb';
  if (unit === '斤' || unit === '市斤') return '斤';
  return 'kg';
}

function toKg(value, unit) {
  if (unit === 'g') return value / 1000;
  if (unit === 'lb') return value * 0.453592;
  if (unit === '斤') return value * 0.5;
  return value;
}

function extractWeightObservations(text, { requireContext = false, source = 'unknown' } = {}) {
  if (!text) return [];
  const str = String(text);
  const lower = str.toLowerCase();
  const hasGeneralContext = /体重|重登记|登记处|另注|单位|误写|量级|手写|标注|处方粮|喂食|剂量|药物|用药|狗粮|猫粮|康复|复查|营养|肥胖|偏瘦|增重|减重|瘦身|超重|称重|体况|身体状况/.test(lower);
  const pattern = /(\d+(?:\.\d+)?)\s*(kg|kilograms?|公斤|千克|grams?|克|g|lbs?|pounds?|磅|市斤|斤)/gi;
  const observations = [];
  let match;

  while ((match = pattern.exec(str)) !== null) {
    const raw = match[0];
    const start = match.index;
    const end = start + raw.length;
    const windowText = str.slice(Math.max(0, start - 20), Math.min(str.length, end + 20)).toLowerCase();
    const contextual = hasGeneralContext || /体重|重登记|另注|单位|误写|量级|手写|标注|处方粮|喂食|剂量|药物|用药|狗粮|猫粮|康复|复查|营养|肥胖|偏瘦|增重|减重|瘦身|超重|称重|体况|身体状况|处方|粮/.test(windowText);
    if (requireContext && !contextual) continue;

    const value = parseFloat(match[1]);
    const unit = normalizeWeightUnit(match[2]);
    observations.push({
      raw,
      value,
      unit,
      normalizedKg: toKg(value, unit),
      source,
      start,
      end,
      sourceText: str
    });
  }

  return observations;
}

function parseWeight(weightStr) {
  if (!weightStr) return null;
  const str = String(weightStr).trim().toLowerCase();
  const observations = extractWeightObservations(str);
  if (observations.length) {
    const first = observations[0];
    return {
      raw: weightStr,
      value: first.value,
      unit: first.unit,
      normalizedKg: first.normalizedKg
    };
  }

  const patterns = [
    /^([\d.]+)\s*(kg|kilograms?|公斤|千克)$/i,
    /^([\d.]+)\s*(g|grams?|克)$/i,
    /^([\d.]+)\s*(lb|lbs|pounds?|磅)$/i,
    /^([\d.]+)\s*(斤|市斤)$/i
  ];

  for (const p of patterns) {
    const m = str.match(p);
    if (m) {
      const val = parseFloat(m[1]);
      const unitRaw = m[2].toLowerCase();
      let unit = 'kg';
      let converted = val;
      if (unitRaw === 'g' || unitRaw === '克' || unitRaw.startsWith('gram')) {
        unit = 'g';
        converted = val / 1000;
      } else if (unitRaw === 'lb' || unitRaw === 'lbs' || unitRaw.startsWith('pound') || unitRaw === '磅') {
        unit = 'lb';
        converted = val * 0.453592;
      } else if (unitRaw === '斤' || unitRaw === '市斤') {
        unit = '斤';
        converted = val * 0.5;
      }
      return { raw: weightStr, value: val, unit, normalizedKg: converted };
    }
  }

  const justNum = str.match(/^([\d.]+)$/);
  if (justNum) {
    const val = parseFloat(justNum[1]);
    return { raw: weightStr, value: val, unit: 'unknown', normalizedKg: val };
  }

  return { raw: weightStr, value: null, unit: 'unknown', normalizedKg: null };
}

async function detectWeightUnitAnomalies(db) {
  const alerts = [];
  const rows = db.prepare(`
    SELECT id, record_no, pet_name, weight, handwritten_note, visit_date
    FROM medical_records
    WHERE (weight IS NOT NULL AND weight != '')
       OR (handwritten_note IS NOT NULL AND handwritten_note != '')
  `).all();

  for (const r of rows) {
    const parsed = parseWeight(r.weight);
    const fieldObservations = extractWeightObservations(r.weight, { source: 'field' });
    const noteObservations = extractWeightObservations(r.handwritten_note, { requireContext: true, source: 'note' });
    const observations = [...fieldObservations, ...noteObservations];
    if (!parsed && observations.length === 0) continue;

    if (parsed) {
      db.prepare(`UPDATE medical_records SET weight_value = ?, weight_unit = ? WHERE id = ?`).run(parsed.normalizedKg, parsed.unit, r.id);
    }

    const evidenceSummary = (arr) => arr.length
      ? arr.map(o => `${o.source === 'field' ? '体重字段' : '手写备注'}[${o.start}-${o.end}]${o.raw}=>${o.normalizedKg.toFixed(4)}kg(${o.unit})`).join('；')
      : '';

    const originalValueParts = [];
    if (r.weight) originalValueParts.push(`体重字段：${r.weight}`);
    if (r.handwritten_note) originalValueParts.push(`手写备注：${r.handwritten_note}`);
    if (observations.length) originalValueParts.push(`触发材料：${evidenceSummary(observations)}`);
    const originalValue = originalValueParts.join('；');

    if (parsed && parsed.unit === 'unknown') {
      alerts.push({
        source_type: 'medical_record',
        source_id: r.id,
        anomaly_type: 'weight_unit_missing',
        anomaly_level: 'warning',
        anomaly_field: 'weight',
        original_value: originalValue || r.weight,
        normalized_value: parsed.value !== null ? String(parsed.value) : null,
        description: `[非普通记录-体重单位缺失]病历${r.record_no}(${r.pet_name})体重字段${r.weight}缺少明确单位，无法判定量级，需人工复核手写单`,
        judgment_change: '体重基准不明将导致训练负荷评估与用药量计算存在偏差，该记录不视为普通训练课依据'
      });
      continue;
    }

    const distinctUnits = [...new Set(observations.map(item => item.unit))];
    const normalizedValues = observations
      .map(item => item.normalizedKg)
      .filter(value => typeof value === 'number' && Number.isFinite(value) && value > 0);
    const minKg = normalizedValues.length ? Math.min(...normalizedValues) : null;
    const maxKg = normalizedValues.length ? Math.max(...normalizedValues) : null;
    const medianKg = normalizedValues.length
      ? [...normalizedValues].sort((a, b) => a - b)[Math.floor(normalizedValues.length / 2)]
      : null;
    const absDiffKg = minKg !== null && maxKg !== null ? maxKg - minKg : null;
    const ratio = minKg !== null && maxKg !== null && minKg > 0 ? maxKg / minKg : null;

    const hasFieldObs = fieldObservations.length > 0;
    const hasNoteObs = noteObservations.length > 0;
    const mixedSource = hasFieldObs && hasNoteObs;
    const mixedUnitInField = fieldObservations.length >= 2 && (new Set(fieldObservations.map(o => o.unit))).size > 1;
    const mixedUnitInNote = noteObservations.length >= 2 && (new Set(noteObservations.map(o => o.unit))).size > 1;
    const mixedUnit = distinctUnits.length > 1;

    const hasScaleConflict = ratio !== null && ratio > 10;
    const hasEquivalentButMixed = mixedUnit && ratio !== null && ratio <= 1.05;
    const hasSignificantDiscrepancy = !mixedUnit && ratio !== null && ratio > 1.2;

    if (hasScaleConflict) {
      alerts.push({
        source_type: 'medical_record',
        source_id: r.id,
        anomaly_type: 'weight_unit_mismatch',
        anomaly_level: 'danger',
        anomaly_field: 'weight',
        original_value: originalValue,
        normalized_value: `量级差 ${ratio.toFixed(1)}x；min=${minKg.toFixed(3)}kg, max=${maxKg.toFixed(3)}kg；触发点=${observations.length}处`,
        description: `[非普通记录-体重量级冲突]病历${r.record_no}(${r.pet_name})体重字段与手写备注存在量级明显冲突（${ratio.toFixed(1)}倍），可能导致训练强度与用药量计算完全错误，必须核对原始手写单`,
        judgment_change: `同一病历出现无法调和的体重量级（差值 ${absDiffKg.toFixed(2)}kg，${ratio.toFixed(1)} 倍），训练课回访结论不能按普通记录处理，算法值班人需追溯原始手写单原件`
      });
      continue;
    }

    if (mixedUnitInField || (mixedUnit && !hasNoteObs) || (mixedUnit && hasEquivalentButMixed && hasFieldObs && fieldObservations.length >= 2)) {
      const subtype = hasEquivalentButMixed ? '等价换算但单位混写' : '字段内部多单位混写';
      alerts.push({
        source_type: 'medical_record',
        source_id: r.id,
        anomaly_type: 'weight_unit_mixed',
        anomaly_level: 'danger',
        anomaly_field: 'weight',
        original_value: originalValue,
        normalized_value: medianKg !== null ? `建议归一化基准≈${medianKg.toFixed(2)} kg（子类型：${subtype}）` : null,
        description: `[非普通记录-体重单位混写]病历${r.record_no}(${r.pet_name})体重字段内存在多单位${hasEquivalentButMixed ? '（' + observations.map(o => o.raw).join('/') + '等价换算但单位不同）' : '混用'}，需统一归一后再作为训练负荷依据`,
        judgment_change: '体重基础数据单位不统一将直接影响训练课负荷评估与后续回访结论，该记录不视为普通训练记录，需前台小温核对原手写单并做归一化补录'
      });
      continue;
    }

    if (mixedSource && mixedUnit) {
      const subtype = hasEquivalentButMixed ? '字段与备注等价换算但单位不同' : '字段与备注单位混用且数值存在差异';
      alerts.push({
        source_type: 'medical_record',
        source_id: r.id,
        anomaly_type: 'weight_unit_mixed',
        anomaly_level: 'danger',
        anomaly_field: 'weight',
        original_value: originalValue,
        normalized_value: medianKg !== null ? `字段${fieldObservations.length}处 vs 备注${noteObservations.length}处，建议基准≈${medianKg.toFixed(2)} kg（子类型：${subtype}）` : null,
        description: `[非普通记录-体重单位混写（字段+备注联合发现）]病历${r.record_no}(${r.pet_name})结构化体重与手写备注同时存在体重标注且单位/数值不一致（${hasEquivalentButMixed ? '等价换算但单位不同' : ratio !== null ? '相差' + ratio.toFixed(2) + '倍' : '存在多重口径'}），需人工复核原始病历`,
        judgment_change: '同一病历在结构化字段和手写备注中给出不统一的体重口径，训练课强度评估和回访判断不能按普通记录处理，必须前台小温核对原始手写单并补录统一口径'
      });
      continue;
    }

    if (mixedSource && hasSignificantDiscrepancy) {
      alerts.push({
        source_type: 'medical_record',
        source_id: r.id,
        anomaly_type: 'weight_unit_mismatch',
        anomaly_level: 'warning',
        anomaly_field: 'weight',
        original_value: originalValue,
        normalized_value: `同单位但数值差 ${ratio.toFixed(2)}x；min=${minKg.toFixed(3)}kg, max=${maxKg.toFixed(3)}kg`,
        description: `[非普通记录-体重数值冲突]病历${r.record_no}(${r.pet_name})体重字段与手写备注虽同单位但数值相差${ratio.toFixed(2)}倍，可能为医生复诊更新值也可能录入错误，需人工判定`,
        judgment_change: '体重数据在结构化与备注中存在显著偏差，训练课方案适用性存疑，回访结论需结合原始就诊时间线重新判定'
      });
      continue;
    }

    if (mixedUnit && hasNoteObs && !hasFieldObs) {
      alerts.push({
        source_type: 'medical_record',
        source_id: r.id,
        anomaly_type: 'weight_unit_mixed',
        anomaly_level: 'warning',
        anomaly_field: 'handwritten_note',
        original_value: originalValue,
        normalized_value: `仅在备注中发现${noteObservations.length}处不同单位标注`,
        description: `[非普通记录-体重单位混写（备注发现）]病历${r.record_no}(${r.pet_name})手写备注中存在多单位体重标注，但结构化体重字段未采集，需补充到结构化字段`,
        judgment_change: '备注中的体重信息未入结构化字段导致后续训练课无法引用，需前台补录并确认统一口径'
      });
      continue;
    }

    if (parsed && parsed.unit === 'g' && parsed.value > 100000) {
      alerts.push({
        source_type: 'medical_record',
        source_id: r.id,
        anomaly_type: 'weight_unit_mismatch',
        anomaly_level: 'danger',
        anomaly_field: 'weight',
        original_value: originalValue || r.weight,
        normalized_value: `${(parsed.value / 1000).toFixed(2)} kg（疑似单位误写）`,
        description: `[非普通记录-体重量级异常]病历${r.record_no}(${r.pet_name})体重${r.weight}数值与克量级严重不匹配(>100kg)，疑似单位误写`,
        judgment_change: '疑似单位误写会导致训练强度/用药量计算完全错误，需前台小温补正原始手写单'
      });
    }

    if (parsed && parsed.unit === 'kg' && parsed.value < 0.1 && r.visit_date > '2026-01-01') {
      alerts.push({
        source_type: 'medical_record',
        source_id: r.id,
        anomaly_type: 'weight_unit_mismatch',
        anomaly_level: 'warning',
        anomaly_field: 'weight',
        original_value: originalValue || r.weight,
        normalized_value: `${(parsed.value * 1000).toFixed(0)} g（疑似kg/g混淆）`,
        description: `[非普通记录-体重量级异常]病历${r.record_no}(${r.pet_name})体重${r.weight}对于成宠过轻，疑似kg/g单位混淆`,
        judgment_change: '单位量级偏差导致训练课方案适用性存疑，回访结论需结合原始材料重新判定'
      });
    }
  }

  return alerts;
}

async function detectConclusionGap(db) {
  const alerts = [];
  const rows = db.prepare(`
    SELECT tc.id, tc.course_no, tc.course_name, tc.conclusion, tc.handwritten_note, tc.course_date, mr.pet_name, mr.record_no
    FROM training_courses tc
    LEFT JOIN medical_records mr ON tc.medical_record_id = mr.id
  `).all();

  for (const r of rows) {
    const conc = (r.conclusion || '').trim();
    const note = (r.handwritten_note || '').trim();

    if (!conc && !note) {
      alerts.push({
        source_type: 'training_course',
        source_id: r.id,
        anomaly_type: 'conclusion_empty',
        anomaly_level: 'danger',
        anomaly_field: 'conclusion',
        original_value: '(空)',
        normalized_value: null,
        description: `训练课${r.course_no}(${r.course_name}, ${r.pet_name || '未知宠物'})回访结论与手写备注均为空，后续无人能承接查询`,
        judgment_change: '无结论记录导致回访链路断裂，该课程状态无法确认，必须补件'
      });
    } else if (conc && /待查|待确认|待定|需随访|？|\?/.test(conc)) {
      alerts.push({
        source_type: 'training_course',
        source_id: r.id,
        anomaly_type: 'conclusion_ambiguous',
        anomaly_level: 'warning',
        anomaly_field: 'conclusion',
        original_value: conc,
        normalized_value: null,
        description: `训练课${r.course_no}(${r.course_name}, ${r.pet_name || '未知宠物'})回访结论"${conc}"存在歧义措辞`,
        judgment_change: '歧义结论使后续接手者无法判断真实处理状态，需前台补明确手写备注'
      });
    }
  }

  return alerts;
}

async function detectLinkBreak(db) {
  const alerts = [];
  const rows = db.prepare(`
    SELECT tc.id, tc.course_no, tc.course_name, tc.course_date, tc.medical_record_id, mr.record_no, mr.pet_name
    FROM training_courses tc
    LEFT JOIN medical_records mr ON tc.medical_record_id = mr.id
  `).all();

  for (const r of rows) {
    if (!r.medical_record_id || !r.record_no) {
      alerts.push({
        source_type: 'training_course',
        source_id: r.id,
        anomaly_type: 'link_orphan_course',
        anomaly_level: 'danger',
        anomaly_field: 'medical_record_id',
        original_value: r.medical_record_id ? String(r.medical_record_id) : '(未关联)',
        normalized_value: null,
        description: `训练课${r.course_no}(${r.course_name})未关联有效病历单，无法回溯原始就诊材料`,
        judgment_change: '训练课与病历断裂导致算法值班人追明细到训练课后无法回查病历，需补录关联或退回重登'
      });
    }
  }

  return alerts;
}

async function runDetection(clearExisting = true) {
  const db = await getDatabase();
  if (clearExisting) {
    const delReviews = db.prepare(`DELETE FROM review_records WHERE anomaly_alert_id IN (SELECT id FROM anomaly_alerts)`);
    delReviews.run();
    const delAlerts = db.prepare(`DELETE FROM anomaly_alerts`);
    delAlerts.run();
  }

  const allAlerts = [
    ...(await detectWeightUnitAnomalies(db)),
    ...(await detectConclusionGap(db)),
    ...(await detectLinkBreak(db))
  ];

  const insertAlert = db.prepare(`
    INSERT INTO anomaly_alerts
      (alert_no, source_type, source_id, anomaly_type, anomaly_level, anomaly_field,
       original_value, normalized_value, description, judgment_change,
       algorithm_version, 口径版本, 口径说明)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let seq = 1;
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const tx = db.transaction((alerts) => {
    for (const a of alerts) {
      const alertNo = `AA${today}${String(seq).padStart(5, '0')}`;
      insertAlert.run(
        alertNo, a.source_type, a.source_id, a.anomaly_type, a.anomaly_level,
        a.anomaly_field, a.original_value, a.normalized_value, a.description,
        a.judgment_change, ALGORITHM_VERSION, CALIBER_VERSION, CALIBER_DESC
      );
      seq++;
    }
  });

  tx(allAlerts);
  return {
    count: allAlerts.length,
    algorithm_version: ALGORITHM_VERSION,
    caliber_version: CALIBER_VERSION,
    caliber_description: CALIBER_DESC,
    alerts: allAlerts
  };
}

module.exports = {
  runDetection,
  parseWeight,
  ALGORITHM_VERSION,
  CALIBER_VERSION,
  CALIBER_DESC
};
