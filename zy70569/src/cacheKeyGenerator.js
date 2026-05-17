import crypto from "crypto";
function getEffectiveQueryParams(query, rules) {
  const result = {};
  if (rules.all) return Object.assign({}, query);
  if (rules.include.length) {
    for (const key of rules.include) if (query[key]) result[key] = query[key];
  } else if (rules.exclude.length) {
    for (const [key, value] of Object.entries(query)) {
      if (rules.exclude.indexOf(key) === -1) result[key] = value;
    }
  }
  return result;
}
function getEffectiveCookies(cookies, rules) {
  const result = {};
  if (rules.all) return Object.assign({}, cookies);
  if (rules.include.length) {
    for (const key of rules.include) if (cookies[key]) result[key] = cookies[key];
  } else if (rules.exclude.length) {
    for (const [key, value] of Object.entries(cookies)) {
      if (rules.exclude.indexOf(key) === -1) result[key] = value;
    }
  }
  return result;
}
function getEffectiveHeaders(headers, rules) {
  const result = {};
  const lowerHeaders = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  if (rules.all) return lowerHeaders;
  if (rules.include.length) {
    for (const key of rules.include) if (lowerHeaders[key]) result[key] = lowerHeaders[key];
  } else if (rules.exclude.length) {
    for (const [key, value] of Object.entries(lowerHeaders)) {
      if (rules.exclude.indexOf(key) === -1) result[key] = value;
    }
  }
  return result;
}
export function generateCacheKey(url, headers, cookies, query, rules) {
  const u = new URL(url);
  const parts = [];
  if (rules.scheme) parts.push("scheme:" + u.protocol);
  if (rules.host) parts.push("host:" + u.hostname);
  if (rules.path) parts.push("path:" + u.pathname);
  const qp = getEffectiveQueryParams(query, rules.query);
  if (Object.keys(qp).length) parts.push("query:" + JSON.stringify(qp));
  const cp = getEffectiveCookies(cookies, rules.cookies);
  if (Object.keys(cp).length) parts.push("cookies:" + JSON.stringify(cp));
  const hp = getEffectiveHeaders(headers, rules.headers);
  if (Object.keys(hp).length) parts.push("headers:" + JSON.stringify(hp));
  const rawKey = parts.join("||");
  return { rawKey, hash: crypto.createHash("md5").update(rawKey).digest("hex"), components: { scheme: rules.scheme ? u.protocol : null, host: rules.host ? u.hostname : null, path: rules.path ? u.pathname : null, query: qp, cookies: cp, headers: hp } };
}