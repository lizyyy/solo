const { getDatabase } = require('../config/database');

const ALGORITHM_VERSION = 'v1.0';
const CALIBER_VERSION = '2026-06-v1';
const CALIBER_DESC = '体重单位混写判定：同一记录中kg/g/lb混用，或数值与单位量级明显不匹配；回访结论空值或歧义；病历单号与训练课关联断裂。复核口径：已确认=异常属实已处理；待补件=需补充材料佐证；退回=判定为误报。';

function parseWeight(weightStr) {
  if (!weightStr) return null;
  const str = String(weightStr).trim().toLowerCase();

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
  const rows = db.prepare(`SELECT id, record_no, pet_name, weight, visit_date FROM medical_records WHERE weight IS NOT NULL AND weight != ''`).all();

  for (const r of rows) {
    const parsed = parseWeight(r.weight);
    if (!parsed) continue;

    db.prepare(`UPDATE medical_records SET weight_value = ?, weight_unit = ? WHERE id = ?`).run(parsed.normalizedKg, parsed.unit, r.id);

    if (parsed.unit === 'unknown') {
      alerts.push({
        source_type: 'medical_record',
        source_id: r.id,
        anomaly_type: 'weight_unit_missing',
        anomaly_level: 'warning',
        anomaly_field: 'weight',
        original_value: r.weight,
        normalized_value: parsed.value !== null ? String(parsed.value) : null,
        description: `病历${r.record_no}(${r.pet_name})体重字段${r.weight}缺少明确单位，无法判定量级`,
        judgment_change: '原回访结论可能因体重基准不明导致用药/训练强度判断偏差，需人工复核'
      });
      continue;
    }

    const note = r.weight.toLowerCase();
    const hasKg = /kg|公斤|千克/.test(note);
    const hasG = /克|g[^s]/.test(note) || parsed.unit === 'g';
    const hasLb = /lb|磅|pound/.test(note);
    const mixed = [hasKg, hasG, hasLb].filter(Boolean).length > 1;

    if (mixed) {
      alerts.push({
        source_type: 'medical_record',
        source_id: r.id,
        anomaly_type: 'weight_unit_mixed',
        anomaly_level: 'danger',
        anomaly_field: 'weight',
        original_value: r.weight,
        normalized_value: parsed.normalizedKg ? `${parsed.normalizedKg.toFixed(2)} kg` : null,
        description: `病历${r.record_no}(${r.pet_name})体重${r.weight}存在多单位混写，已归一化为${parsed.normalizedKg ? parsed.normalizedKg.toFixed(2) + 'kg' : '无法归一'}`,
        judgment_change: '体重基础数据不一致将直接影响训练课负荷评估与后续回访结论，该记录不视为普通训练记录'
      });
      continue;
    }

    if (parsed.unit === 'g' && parsed.value > 100000) {
      alerts.push({
        source_type: 'medical_record',
        source_id: r.id,
        anomaly_type: 'weight_unit_mismatch',
        anomaly_level: 'danger',
        anomaly_field: 'weight',
        original_value: r.weight,
        normalized_value: `${(parsed.value / 1000).toFixed(2)} kg`,
        description: `病历${r.record_no}(${r.pet_name})体重${r.weight}数值与克量级严重不匹配(>100kg)，疑似单位误写`,
        judgment_change: '疑似单位误写会导致训练强度/用药量计算完全错误，需前台小温补正原始手写单'
      });
    }

    if (parsed.unit === 'kg' && parsed.value < 0.1 && r.visit_date > '2026-01-01') {
      alerts.push({
        source_type: 'medical_record',
        source_id: r.id,
        anomaly_type: 'weight_unit_mismatch',
        anomaly_level: 'warning',
        anomaly_field: 'weight',
        original_value: r.weight,
        normalized_value: `${(parsed.value * 1000).toFixed(0)} g`,
        description: `病历${r.record_no}(${r.pet_name})体重${r.weight}对于成宠过轻，疑似kg/g单位混淆`,
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
    const delReviews = db.prepare(`DELETE FROM review_records WHERE anomaly_alert_id IN (SELECT id FROM anomaly_alerts WHERE algorithm_version = ?)`);
    delReviews.run(ALGORITHM_VERSION);
    const delAlerts = db.prepare(`DELETE FROM anomaly_alerts WHERE algorithm_version = ?`);
    delAlerts.run(ALGORITHM_VERSION);
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
