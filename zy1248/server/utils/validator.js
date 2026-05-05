function validateRequest(request) {
  const errors = [];

  if (!request) {
    errors.push('Request object is required');
    return { valid: false, errors };
  }

  // 验证 method
  const validMethods = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'];
  if (request.method && !validMethods.includes(request.method.toUpperCase())) {
    errors.push(`Invalid method: ${request.method}. Valid methods: ${validMethods.join(', ')}`);
  }

  // 验证 url
  if (request.url === undefined || request.url === null) {
    errors.push('URL is required');
  } else if (typeof request.url !== 'string') {
    errors.push('URL must be a string');
  } else if (!request.url.startsWith('/') && !request.url.startsWith('http://') && !request.url.startsWith('https://')) {
    errors.push('URL should start with "/" or be a full URL');
  }

  // 验证 headers
  if (request.headers !== undefined && request.headers !== null) {
    if (typeof request.headers !== 'object' || Array.isArray(request.headers)) {
      errors.push('Headers must be an object');
    } else {
      // 验证常见头的格式
      for (const [key, value] of Object.entries(request.headers)) {
        if (typeof value !== 'string' && typeof value !== 'number') {
          errors.push(`Header "${key}" value must be a string or number`);
        }
        
        // 特定头的验证
        const lowerKey = key.toLowerCase();
        
        if (lowerKey === 'cache-control') {
          const validation = validateCacheControl(value.toString());
          if (!validation.valid) {
            errors.push(`Cache-Control: ${validation.errors.join('; ')}`);
          }
        }
        
        if (lowerKey === 'etag') {
          const validation = validateETag(value.toString());
          if (!validation.valid) {
            errors.push(`ETag: ${validation.errors.join('; ')}`);
          }
        }
        
        if (lowerKey === 'range') {
          const validation = validateRange(value.toString());
          if (!validation.valid) {
            errors.push(`Range: ${validation.errors.join('; ')}`);
          }
        }
        
        if (lowerKey === 'if-match' || lowerKey === 'if-none-match') {
          const validation = validateETagList(value.toString());
          if (!validation.valid) {
            errors.push(`${key}: ${validation.errors.join('; ')}`);
          }
        }
        
        if (lowerKey === 'if-modified-since' || lowerKey === 'if-unmodified-since' || lowerKey === 'date' || lowerKey === 'expires') {
          const validation = validateHttpDate(value.toString());
          if (!validation.valid) {
            errors.push(`${key}: ${validation.errors.join('; ')}`);
          }
        }
      }
    }
  }

  // 验证 corsConfig
  if (request.corsConfig !== undefined && request.corsConfig !== null) {
    if (typeof request.corsConfig !== 'object' || Array.isArray(request.corsConfig)) {
      errors.push('corsConfig must be an object');
    } else {
      const config = request.corsConfig;
      if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
        errors.push('corsConfig.enabled must be a boolean');
      }
      if (config.allowOrigin !== undefined && typeof config.allowOrigin !== 'string') {
        errors.push('corsConfig.allowOrigin must be a string');
      }
      if (config.allowMethods !== undefined && typeof config.allowMethods !== 'string') {
        errors.push('corsConfig.allowMethods must be a string');
      }
      if (config.allowHeaders !== undefined && typeof config.allowHeaders !== 'string') {
        errors.push('corsConfig.allowHeaders must be a string');
      }
      if (config.allowCredentials !== undefined && typeof config.allowCredentials !== 'boolean') {
        errors.push('corsConfig.allowCredentials must be a boolean');
      }
      if (config.maxAge !== undefined && (typeof config.maxAge !== 'number' || config.maxAge < 0)) {
        errors.push('corsConfig.maxAge must be a non-negative number');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: generateRequestWarnings(request)
  };
}

function validateResource(resource) {
  const errors = [];

  if (!resource) {
    errors.push('Resource object is required');
    return { valid: false, errors };
  }

  // 验证 path
  if (resource.path === undefined || resource.path === null) {
    errors.push('Resource path is required');
  } else if (typeof resource.path !== 'string') {
    errors.push('Resource path must be a string');
  } else if (!resource.path.startsWith('/')) {
    errors.push('Resource path should start with "/"');
  }

  // 验证 body
  if (resource.body !== undefined && resource.body !== null && typeof resource.body !== 'string') {
    errors.push('Resource body must be a string');
  }

  // 验证 contentType
  if (resource.contentType !== undefined && resource.contentType !== null) {
    if (typeof resource.contentType !== 'string') {
      errors.push('contentType must be a string');
    } else if (!resource.contentType.includes('/')) {
      errors.push('contentType should include "/" (e.g., "text/html", "application/json")');
    }
  }

  // 验证 etag
  if (resource.etag !== undefined && resource.etag !== null) {
    const validation = validateETag(resource.etag);
    if (!validation.valid) {
      errors.push(`ETag: ${validation.errors.join('; ')}`);
    }
  }

  // 验证 lastModified
  if (resource.lastModified !== undefined && resource.lastModified !== null) {
    const validation = validateHttpDate(resource.lastModified);
    if (!validation.valid) {
      errors.push(`lastModified: ${validation.errors.join('; ')}`);
    }
  }

  // 验证 cacheControl
  if (resource.cacheControl !== undefined && resource.cacheControl !== null) {
    const validation = validateCacheControl(resource.cacheControl);
    if (!validation.valid) {
      errors.push(`Cache-Control: ${validation.errors.join('; ')}`);
    }
  }

  // 验证 vary
  if (resource.vary !== undefined && resource.vary !== null && typeof resource.vary !== 'string') {
    errors.push('Vary must be a string');
  }

  // 验证 redirect
  if (resource.redirect !== undefined && resource.redirect !== null) {
    if (typeof resource.redirect !== 'object' || Array.isArray(resource.redirect)) {
      errors.push('Redirect must be an object');
    } else {
      const validRedirectCodes = [301, 302, 303, 307, 308];
      if (!validRedirectCodes.includes(resource.redirect.statusCode)) {
        errors.push(`Invalid redirect status code. Valid codes: ${validRedirectCodes.join(', ')}`);
      }
      if (!resource.redirect.location || typeof resource.redirect.location !== 'string') {
        errors.push('Redirect location is required and must be a string');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: generateResourceWarnings(resource)
  };
}

function validateETag(etag) {
  const errors = [];
  
  if (!etag) {
    return { valid: true, errors };
  }

  // ETag 格式: "etag-value" 或 W/"etag-value"
  const etagRegex = /^(W\/)?"[^"]*"$/;
  
  if (!etagRegex.test(etag)) {
    errors.push('ETag should be enclosed in double quotes. Example: "abc123" or W/"abc123"');
  }

  if (etag.includes('"') && (etag.startsWith('"') || etag.startsWith('W/'))) {
    // 检查是否有未转义的双引号
    const content = etag.replace(/^W\//, '').slice(1, -1);
    if (content.includes('"')) {
      errors.push('ETag content should not contain unescaped double quotes');
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateETagList(etagList) {
  const errors = [];
  
  if (!etagList) {
    return { valid: true, errors };
  }

  if (etagList === '*') {
    return { valid: true, errors };
  }

  const etags = etagList.split(',').map(e => e.trim());
  
  for (const etag of etags) {
    const validation = validateETag(etag);
    if (!validation.valid) {
      errors.push(`Invalid ETag "${etag}": ${validation.errors.join('; ')}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateCacheControl(cacheControl) {
  const errors = [];
  
  if (!cacheControl) {
    return { valid: true, errors };
  }

  const directives = cacheControl.split(',').map(d => d.trim().toLowerCase());
  
  const knownDirectives = [
    'public', 'private', 'no-cache', 'no-store', 'no-transform',
    'must-revalidate', 'proxy-revalidate', 'immutable',
    'max-age', 's-maxage', 'max-stale', 'min-fresh', 'stale-while-revalidate', 'stale-if-error'
  ];

  const directivesWithValue = [
    'max-age', 's-maxage', 'max-stale', 'min-fresh', 'stale-while-revalidate', 'stale-if-error'
  ];

  for (const directive of directives) {
    const [name, value] = directive.split('=');
    
    // 检查是否是已知指令
    if (!knownDirectives.includes(name)) {
      errors.push(`Unknown directive: ${name}`);
      continue;
    }

    // 检查需要值的指令
    if (directivesWithValue.includes(name)) {
      if (value === undefined) {
        if (name === 'max-stale') {
          // max-stale 可以没有值
          continue;
        }
        errors.push(`Directive "${name}" requires a value. Example: ${name}=3600`);
      } else {
        const numValue = parseInt(value);
        if (isNaN(numValue) || numValue < 0) {
          errors.push(`Directive "${name}" value must be a non-negative number`);
        }
      }
    } else if (value !== undefined) {
      errors.push(`Directive "${name}" should not have a value`);
    }

    // 检查互斥的指令
    if (directives.includes('no-store') && directives.includes('no-cache')) {
      errors.push('no-store and no-cache are mutually exclusive');
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateRange(range) {
  const errors = [];
  
  if (!range) {
    return { valid: true, errors };
  }

  // 支持的格式:
  // bytes=0-499
  // bytes=-500
  // bytes=9500-
  // bytes=0-99, 200-299 (多范围，暂不支持详细验证)

  const rangeRegex = /^bytes=((\d*-\d*|\d*-|-\d+)(,\s*\d*-\d*|\d*-|-\d+)*)$/;
  
  if (!rangeRegex.test(range)) {
    errors.push('Invalid Range format. Valid formats: bytes=0-99, bytes=-500, bytes=9500-');
    return { valid: false, errors };
  }

  const ranges = range.replace('bytes=', '').split(',').map(r => r.trim());
  
  for (const r of ranges) {
    const [startStr, endStr] = r.split('-');
    
    if (startStr === '' && endStr === '') {
      errors.push(`Invalid range: "${r}". At least one of start or end must be specified`);
      continue;
    }

    if (startStr !== '') {
      const start = parseInt(startStr);
      if (isNaN(start) || start < 0) {
        errors.push(`Range start must be a non-negative number: "${r}"`);
      }
    }

    if (endStr !== '') {
      const end = parseInt(endStr);
      if (isNaN(end) || end < 0) {
        errors.push(`Range end must be a non-negative number: "${r}"`);
      }
      
      if (startStr !== '') {
        const start = parseInt(startStr);
        if (start > end) {
          errors.push(`Range start (${start}) must be less than or equal to end (${end})`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateHttpDate(date) {
  const errors = [];
  
  if (!date) {
    return { valid: true, errors };
  }

  // 尝试解析日期
  const timestamp = Date.parse(date);
  
  if (isNaN(timestamp)) {
    errors.push('Invalid date format. Use HTTP-date format (e.g., "Wed, 21 Oct 2015 07:28:00 GMT")');
  }

  return { valid: errors.length === 0, errors };
}

function generateRequestWarnings(request) {
  const warnings = [];
  
  if (!request) return warnings;

  // 检查可能的问题
  if (request.method && request.method.toUpperCase() === 'POST' && !request.headers['content-type']) {
    warnings.push('POST request without Content-Type header. This may cause issues with some servers.');
  }

  if (request.headers && request.headers['cache-control']) {
    const cc = request.headers['cache-control'].toLowerCase();
    if (cc.includes('no-cache') && cc.includes('max-age')) {
      warnings.push('Cache-Control includes both no-cache and max-age. no-cache will take precedence for revalidation.');
    }
  }

  return warnings;
}

function generateResourceWarnings(resource) {
  const warnings = [];
  
  if (!resource) return warnings;

  // 检查可能的问题
  if (resource.cacheControl) {
    const cc = resource.cacheControl.toLowerCase();
    
    if (cc.includes('no-store') && (cc.includes('max-age') || cc.includes('s-maxage'))) {
      warnings.push('Cache-Control includes no-store with max-age/s-maxage. no-store will prevent caching entirely.');
    }
    
    if (cc.includes('private') && cc.includes('public')) {
      warnings.push('Cache-Control includes both private and public. They are mutually exclusive.');
    }
    
    if (!cc.includes('no-cache') && !cc.includes('no-store') && !cc.includes('max-age') && !cc.includes('s-maxage') && !resource.cacheControl.toLowerCase().includes('expires')) {
      warnings.push('Resource does not specify caching strategy. It may be cached heuristically by browsers.');
    }
  }

  if (resource.redirect && resource.body && resource.body.length > 0) {
    warnings.push('Redirect resource has body content. Browsers typically ignore the body of redirect responses.');
  }

  if (resource.vary && resource.vary.toLowerCase() === '*') {
    warnings.push('Vary: * means the response varies on all request headers. This effectively makes the response uncacheable.');
  }

  return warnings;
}

module.exports = {
  validateRequest,
  validateResource,
  validateETag,
  validateETagList,
  validateCacheControl,
  validateRange,
  validateHttpDate
};
