'use strict';

const crypto = require('crypto');
const { parse: csvParse } = require('csv-parse/sync');

const uuid = () => crypto.randomBytes(12).toString('hex');
const now  = () => new Date().toISOString();

const parseArtifactsCsv = (buffer) => {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const rows = csvParse(text, { columns: true, skip_empty_lines: true, trim: true });
  return rows.map((r, i) => ({
    kind: 'artifact',
    lineNo: i + 2,
    raw: r,
    key: `artifact:${r.accession_no || r.id || r.编号 || r.藏品号 || `row${i + 2}`}`,
  }));
};

const parseShippingJson = (buffer) => {
  const data = JSON.parse(buffer.toString('utf8'));
  const list = Array.isArray(data) ? data : (data.shipments || data.nodes || [data]);
  return list.map((s, i) => ({
    kind: 'shipping',
    lineNo: i + 1,
    raw: s,
    key: `shipping:${s.shipment_id || s.tracking_no || s.id || `ship${i + 1}`}`,
  }));
};

const parseInsuranceJson = (buffer) => {
  const data = JSON.parse(buffer.toString('utf8'));
  const list = Array.isArray(data) ? data : (data.policies || data.items || [data]);
  return list.map((p, i) => ({
    kind: 'insurance',
    lineNo: i + 1,
    raw: p,
    key: `insurance:${p.policy_no || p.accession_no || p.id || `pol${i + 1}`}`,
  }));
};

const parseInsuranceText = (buffer) => {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
  const lines = text.split(/\r?\n/);
  return lines.filter(Boolean).map((ln, i) => ({
    kind: 'insurance',
    lineNo: i + 1,
    raw: { text: ln },
    key: `insurance:text:${i + 1}`,
  }));
};

const inferParser = (filename, buffer) => {
  const name = (filename || '').toLowerCase();
  if (name.endsWith('.csv')) return parseArtifactsCsv(buffer);
  if (name.endsWith('.json')) {
    if (name.includes('ship') || name.includes('trans') || name.includes('运')) return parseShippingJson(buffer);
    if (name.includes('insur') || name.includes('保') || name.includes('policy')) return parseInsuranceJson(buffer);
    try { return parseShippingJson(buffer); } catch { return parseInsuranceJson(buffer); }
  }
  if (name.endsWith('.txt')) return parseInsuranceText(buffer);
  throw new Error(`不支持的文件类型: ${filename}`);
};

module.exports = {
  uuid, now,
  parseArtifactsCsv,
  parseShippingJson,
  parseInsuranceJson,
  parseInsuranceText,
  inferParser,
};
