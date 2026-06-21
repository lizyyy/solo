const crypto = require('crypto');

function normalizeName(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[（(].*?[)）]/g, '')
    .replace(/[，,。\.、；;：:！!？?"'「」【】\[\]《》<>]/g, '')
    .replace(/[~～\-—_]/g, '')
    .trim();
}

function namesSimilar(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) {
    const longer = na.length >= nb.length ? na : nb;
    const shorter = na.length >= nb.length ? nb : na;
    return shorter.length / longer.length >= 0.6;
  }
  let common = 0;
  const setA = new Set(na);
  for (const ch of nb) {
    if (setA.has(ch)) common++;
  }
  const total = new Set([...na, ...nb]).size;
  return total > 0 && common / total >= 0.5;
}

function hashRequest(payload) {
  const key = JSON.stringify(payload);
  return crypto.createHash('sha256').update(key).digest('hex');
}

function parseScoreNoteContent(content) {
  const result = {
    raw: content,
    mentionsVersions: [],
    mentionsCoverage: false,
    mentionsConfidence: null,
    mentionsNeedConfirm: false,
    tags: [],
  };

  const versionMatch = content.match(/v(\d+(\.\d+)*)/gi);
  if (versionMatch) {
    result.mentionsVersions = [...new Set(versionMatch.map(v => v.toLowerCase()))];
  }
  const verMatch = content.match(/版本\s*[：:]?\s*([^\s，,。；]+)/g);
  if (verMatch) {
    verMatch.forEach(m => {
      const v = m.replace(/版本\s*[：:]?\s*/, '').trim();
      if (v && !result.mentionsVersions.includes(v)) {
        result.mentionsVersions.push(v);
      }
    });
  }

  if (/覆盖|重复|重叠|交叉|多版本/.test(content)) {
    result.mentionsCoverage = true;
    result.tags.push('coverage');
  }

  const confMatch = content.match(/置信度?[：:]\s*([\d.]+)\s*%?/);
  if (confMatch) {
    result.mentionsConfidence = parseFloat(confMatch[1]) / 100;
    if (result.mentionsConfidence > 1) result.mentionsConfidence = result.mentionsConfidence / 100;
  }

  if (/人工确认|需确认|待确认|复查|核对/.test(content)) {
    result.mentionsNeedConfirm = true;
    result.tags.push('need_confirm');
  }

  if (/外推|越界|超出范围|边界|极值/.test(content)) {
    result.tags.push('extrapolation');
  }

  if (/单位|量纲|量级/.test(content)) {
    result.tags.push('unit');
  }

  if (/阈值|门限|threshold/i.test(content)) {
    result.tags.push('threshold');
  }

  return result;
}

function now() {
  return Date.now();
}

module.exports = {
  normalizeName,
  namesSimilar,
  hashRequest,
  parseScoreNoteContent,
  now,
};
