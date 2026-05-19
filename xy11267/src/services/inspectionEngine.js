const { allQuery } = require('../database/db');
const { maskText } = require('../utils/masking');

let rulesCache = null;
let rulesVersion = 0;

async function loadRules() {
  const rules = await allQuery('SELECT * FROM inspection_rules WHERE is_enabled = 1 ORDER BY severity DESC');
  rulesCache = rules.map(rule => ({
    id: rule.id,
    type: rule.rule_type,
    name: rule.rule_name,
    keywords: rule.keywords.split(','),
    severity: rule.severity,
    version: rule.version
  }));
  const maxVersion = Math.max(...rules.map(r => r.version), 1);
  rulesVersion = maxVersion;
  return { rules: rulesCache, version: rulesVersion };
}

async function getRules() {
  if (!rulesCache) {
    await loadRules();
  }
  return { rules: rulesCache, version: rulesVersion };
}

function detectSpeakerMissing(speakers) {
  const missing = speakers.filter(s => !s.speaker_id || s.speaker_id.trim() === '');
  return {
    hasIssue: missing.length > 0,
    missingCount: missing.length,
    totalCount: speakers.length,
    details: missing.map((m, i) => `第${i + 1}条对话缺少说话人标识`)
  };
}

function detectTimestampOverlap(speakers) {
  const overlaps = [];
  for (let i = 0; i < speakers.length; i++) {
    for (let j = i + 1; j < speakers.length; j++) {
      const a = speakers[i];
      const b = speakers[j];
      if (a.start_time < b.end_time && b.start_time < a.end_time) {
        overlaps.push({
          index1: i,
          index2: j,
          time1: `${a.start_time}-${a.end_time}`,
          time2: `${b.start_time}-${b.end_time}`
        });
      }
    }
  }
  return {
    hasIssue: overlaps.length > 0,
    overlapCount: overlaps.length,
    details: overlaps.map(o => `对话${o.index1 + 1}(${o.time1})与对话${o.index2 + 1}(${o.time2})时间重叠`)
  };
}

async function inspectText(text, speakers = []) {
  const { rules, version } = await getRules();
  const violations = [];
  const passed = [];
  let riskLevel = 'normal';

  rules.forEach(rule => {
    const matchedKeywords = [];
    rule.keywords.forEach(keyword => {
      if (text.includes(keyword.trim())) {
        matchedKeywords.push(keyword.trim());
      }
    });

    if (matchedKeywords.length > 0) {
      violations.push({
        ruleId: rule.id,
        ruleType: rule.type,
        ruleName: rule.name,
        severity: rule.severity,
        matchedKeywords,
        reason: `检测到${rule.name}：${matchedKeywords.join(', ')}`
      });

      if (rule.severity === 'high' && riskLevel !== 'critical') {
        riskLevel = 'high';
      } else if (rule.severity === 'medium' && riskLevel === 'normal') {
        riskLevel = 'medium';
      }
    } else {
      passed.push({
        ruleType: rule.type,
        ruleName: rule.name,
        reason: `${rule.name}未检测到违规`
      });
    }
  });

  const speakerCheck = detectSpeakerMissing(speakers);
  if (speakerCheck.hasIssue) {
    violations.push({
      ruleType: 'speaker_missing',
      ruleName: '说话人缺失检测',
      severity: 'medium',
      details: speakerCheck.details,
      reason: `检测到${speakerCheck.missingCount}条对话缺少说话人标识`
    });
    if (riskLevel === 'normal') riskLevel = 'medium';
  }

  const timestampCheck = detectTimestampOverlap(speakers);
  if (timestampCheck.hasIssue) {
    violations.push({
      ruleType: 'timestamp_overlap',
      ruleName: '时间戳重叠检测',
      severity: 'low',
      details: timestampCheck.details,
      reason: `检测到${timestampCheck.overlapCount}处时间重叠`
    });
  }

  const hasViolations = violations.length > 0;

  return {
    passed: !hasViolations,
    riskLevel,
    violations,
    passedRules: passed,
    ruleVersion: version,
    summary: hasViolations 
      ? `检测到${violations.length}项问题，风险等级：${riskLevel}`
      : '质检通过，未检测到违规内容'
  };
}

async function inspectRecord(record) {
  const { speakers = [], transcript_text, session_id, operator, role } = record;
  return await inspectText(transcript_text, speakers);
}

async function reloadRules() {
  return await loadRules();
}

async function getCurrentRuleVersion() {
  if (!rulesCache) {
    await loadRules();
  }
  return rulesVersion;
}

module.exports = {
  inspectText,
  inspectRecord,
  loadRules,
  reloadRules,
  getRules,
  getCurrentRuleVersion,
  detectSpeakerMissing,
  detectTimestampOverlap
};
