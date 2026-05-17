const url = require('url');

function normalizeUrl(inputUrl) {
  try {
    const parsed = new URL(inputUrl);
    
    const protocol = parsed.protocol.toLowerCase();
    
    let hostname = parsed.hostname.toLowerCase();
    
    let port = '';
    if (parsed.port) {
      if ((protocol === 'http:' && parsed.port !== '80') ||
          (protocol === 'https:' && parsed.port !== '443')) {
        port = `:${parsed.port}`;
      }
    }
    
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    
    pathname = pathname.replace(/\/+/g, '/');
    
    const params = [];
    parsed.searchParams.forEach((value, key) => {
      params.push({ key, value });
    });
    params.sort((a, b) => a.key.localeCompare(b.key));
    
    const searchParams = new URLSearchParams();
    params.forEach(p => searchParams.append(p.key, p.value));
    const search = searchParams.toString() ? `?${searchParams.toString()}` : '';
    
    const normalized = `${protocol}//${hostname}${port}${pathname}${search}`;
    
    return {
      original: inputUrl,
      normalized,
      protocol: protocol.slice(0, -1),
      hostname,
      port: parsed.port || (protocol === 'https:' ? '443' : '80'),
      pathname,
      params: params.reduce((acc, p) => {
        acc[p.key] = p.value;
        return acc;
      }, {}),
      hash: parsed.hash
    };
  } catch (error) {
    return {
      original: inputUrl,
      normalized: null,
      error: error.message,
      isValid: false
    };
  }
}

function compareUrls(url1, url2) {
  const norm1 = normalizeUrl(url1);
  const norm2 = normalizeUrl(url2);
  
  if (!norm1.normalized || !norm2.normalized) {
    return {
      exactMatch: false,
      error: 'One or both URLs are invalid',
      url1Error: norm1.error,
      url2Error: norm2.error
    };
  }
  
  const protocolMatch = norm1.protocol === norm2.protocol;
  const hostMatch = norm1.hostname === norm2.hostname;
  const portMatch = norm1.port === norm2.port;
  const pathMatch = norm1.pathname === norm2.pathname;
  
  const params1Keys = Object.keys(norm1.params).sort();
  const params2Keys = Object.keys(norm2.params).sort();
  const paramsKeysMatch = JSON.stringify(params1Keys) === JSON.stringify(params2Keys);
  
  let paramsValuesMatch = true;
  const paramDifferences = [];
  
  params1Keys.forEach(key => {
    if (norm1.params[key] !== norm2.params[key]) {
      paramsValuesMatch = false;
      paramDifferences.push(`参数 ${key}: "${norm1.params[key]}" vs "${norm2.params[key]}"`);
    }
  });
  
  const paramsMatch = paramsKeysMatch && paramsValuesMatch;
  
  const differences = [];
  if (!protocolMatch) differences.push(`协议不匹配: ${norm1.protocol} vs ${norm2.protocol}`);
  if (!hostMatch) differences.push(`主机不匹配: ${norm1.hostname} vs ${norm2.hostname}`);
  if (!portMatch) differences.push(`端口不匹配: ${norm1.port} vs ${norm2.port}`);
  if (!pathMatch) differences.push(`路径不匹配: ${norm1.pathname} vs ${norm2.pathname}`);
  if (!paramsMatch) {
    if (!paramsKeysMatch) {
      differences.push(`参数键不匹配: ${params1Keys.join(',')} vs ${params2Keys.join(',')}`);
    }
    paramDifferences.forEach(d => differences.push(d));
  }
  
  return {
    exactMatch: norm1.normalized === norm2.normalized,
    protocolMatch,
    hostMatch,
    portMatch,
    pathMatch,
    paramsMatch,
    differences,
    url1: norm1,
    url2: norm2
  };
}

function checkUrlParams(authUrl, expectedParams = []) {
  try {
    const parsed = new URL(authUrl);
    const missingParams = [];
    const foundParams = {};
    
    expectedParams.forEach(param => {
      if (parsed.searchParams.has(param)) {
        foundParams[param] = parsed.searchParams.get(param);
      } else {
        missingParams.push(param);
      }
    });
    
    const redirectUri = parsed.searchParams.get('redirect_uri');
    
    return {
      isValid: missingParams.length === 0,
      missingParams,
      foundParams,
      redirectUri,
      hasRedirectUri: !!redirectUri,
      allParams: Object.fromEntries(parsed.searchParams.entries())
    };
  } catch (error) {
    return {
      isValid: false,
      error: error.message
    };
  }
}

function extractRedirectUriFromAuthUrl(authUrl) {
  try {
    const parsed = new URL(authUrl);
    const redirectUri = parsed.searchParams.get('redirect_uri');
    if (redirectUri) {
      return decodeURIComponent(redirectUri);
    }
    return null;
  } catch {
    return null;
  }
}

module.exports = {
  normalizeUrl,
  compareUrls,
  checkUrlParams,
  extractRedirectUriFromAuthUrl
};
