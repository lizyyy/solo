import { parseCacheRules } from "./ruleParser.js";
import { generateCacheKey } from "./cacheKeyGenerator.js";
export function compareSamples(samples, rulesConfig) {
  const rules = parseCacheRules(rulesConfig);
  const results = { total: samples.length, valid: 0, invalid: 0, groups: {}, details: [], errors: [] };
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const lineNumber = sample.lineNumber || i + 1;
    try {
      const processed = processSample(sample, rules, lineNumber);
      results.details.push(processed);
      results.valid++;
      const keyHash = processed.cacheKey.hash;
      if (!results.groups[keyHash]) results.groups[keyHash] = { count: 0, samples: [], cacheKey: processed.cacheKey };
      results.groups[keyHash].count++;
      results.groups[keyHash].samples.push({ lineNumber, url: sample.url, description: sample.description || "" });
    } catch (error) {
      results.invalid++;
      results.errors.push({ lineNumber, raw: sample.raw || JSON.stringify(sample), error: error.message });
    }
  }
  results.uniqueKeys = Object.keys(results.groups).length;
  return results;
}
function processSample(sample, rules, lineNumber) {
  if (!sample.url) throw new Error("缺少URL字段");
  const u = new URL(sample.url);
  const query = parseQuery(u);
  const headers = sample.headers || {};
  const cookies = parseCookieString(sample.cookies || "");
  const cacheKey = generateCacheKey(sample.url, headers, cookies, query, rules);
  return { lineNumber, url: sample.url, description: sample.description, cacheKey, input: { headers, cookies, query } };
}
function parseQuery(u) { const r = {}; for (const [k, v] of u.searchParams) r[k] = v; return r; }
function parseCookieString(s) { const r = {}; if (!s) return r; s.split(";").forEach(p => { const [k, v] = p.trim().split("="); if (k && v) r[k.trim()] = v.trim(); }); return r; }