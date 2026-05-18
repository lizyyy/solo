import { DEDUCTION_CHANGE_TYPES } from './types.js';

export function validateScoreSync(record) {
  const issues = [];
  const details = [];

  const originalScore = record.原始得分;
  const reviewScore = record.复议得分;
  const finalScore = record.最终得分;

  if (reviewScore !== null) {
    if (finalScore !== reviewScore) {
      issues.push('复议后最终得分与复议得分不一致');
      details.push({
        type: 'score_mismatch',
        field: '最终得分',
        expected: reviewScore,
        actual: finalScore,
        expectedSource: '复议得分',
        actualSource: '最终得分'
      });
    }
  } else {
    if (finalScore !== originalScore) {
      issues.push('无复议时最终得分与原始得分不一致');
      details.push({
        type: 'score_mismatch',
        field: '最终得分',
        expected: originalScore,
        actual: finalScore,
        expectedSource: '原始得分',
        actualSource: '最终得分'
      });
    }
  }

  return { passed: issues.length === 0, issues, details };
}

export function validateDeductionsSync(record) {
  const issues = [];
  const details = [];

  const originalDeductions = new Set(record.原始扣分项.map(String));
  const reviewDeductions = new Set(record.复议扣分项.map(String));
  const finalDeductions = new Set(record.最终扣分项.map(String));

  const allKeys = new Set([...originalDeductions, ...reviewDeductions, ...finalDeductions]);

  for (const key of allKeys) {
    const inOriginal = originalDeductions.has(key);
    const inReview = reviewDeductions.has(key);
    const inFinal = finalDeductions.has(key);

    let changeType = DEDUCTION_CHANGE_TYPES.NO_CHANGE;

    if (!inOriginal && inReview) {
      changeType = DEDUCTION_CHANGE_TYPES.ADD;
      if (!inFinal) {
        issues.push(`复议新增扣分项"${key}"未同步到最终扣分项`);
        details.push({ type: 'deduction_not_synced', changeType, item: key, expected: true, actual: false });
      }
    } else if (inOriginal && !inReview) {
      changeType = DEDUCTION_CHANGE_TYPES.REMOVE;
      if (inFinal) {
        issues.push(`复议删除扣分项"${key}"未同步到最终扣分项`);
        details.push({ type: 'deduction_not_synced', changeType, item: key, expected: false, actual: true });
      }
    } else if (inOriginal && inReview) {
      if (!inFinal) {
        issues.push(`扣分项"${key}"在最终扣分项中缺失`);
        details.push({ type: 'deduction_missing', changeType, item: key, expected: true, actual: false });
      }
    } else if (!inOriginal && !inReview && inFinal) {
      issues.push(`最终扣分项"${key}"无来源（原始和复议中均无此项）`);
      details.push({ type: 'deduction_orphan', changeType, item: key });
    }
  }

  return { passed: issues.length === 0, issues, details };
}

export function validateReviewRound(records) {
  const issues = [];
  const details = [];
  const grouped = {};

  for (const record of records) {
    const id = record.质检编号;
    if (!grouped[id]) grouped[id] = [];
    grouped[id].push(record);
  }

  for (const [id, rounds] of Object.entries(grouped)) {
    if (rounds.length > 1) {
      rounds.sort((a, b) => a.复议轮次 - b.复议轮次);
      for (let i = 1; i < rounds.length; i++) {
        const prev = rounds[i - 1];
        const curr = rounds[i];
        if (prev.最终得分 !== curr.原始得分) {
          issues.push(`质检编号${id}第${curr.复议轮次}轮复议原始得分未继承上轮最终得分`);
          details.push({
            type: 'round_inherit_error',
            质检编号: id,
            当前轮次: curr.复议轮次,
            期望原始得分: prev.最终得分,
            实际原始得分: curr.原始得分
          });
        }
      }
    }
  }

  return { passed: issues.length === 0, issues, details };
}

export function validateRecord(record) {
  const scoreResult = validateScoreSync(record);
  const deductionResult = validateDeductionsSync(record);

  return {
    质检编号: record.质检编号,
    客服工号: record.客服工号,
    复议轮次: record.复议轮次,
    复议状态: record.复议状态,
    得分核对: scoreResult.passed,
    扣分项核对: deductionResult.passed,
    得分问题: scoreResult.issues,
    扣分项问题: deductionResult.issues,
    得分详情: scoreResult.details,
    扣分项详情: deductionResult.details,
    通过: scoreResult.passed && deductionResult.passed,
    原始记录: record
  };
}
