const { normalizeUrl, compareUrls, checkUrlParams, extractRedirectUriFromAuthUrl } = require('./urlNormalizer');

function getUriValue(uri) {
  if (typeof uri === 'string') return uri;
  if (typeof uri === 'object' && uri !== null && uri.value) return uri.value;
  return String(uri);
}

function validateConfig(config, targetEnv = null) {
  const results = {
    applications: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    }
  };

  if (!config.applications || !Array.isArray(config.applications)) {
    return results;
  }

  config.applications.forEach((app, appIndex) => {
    const appSource = app._source || {};
    const appResult = {
      appId: app.appId || app.name,
      appName: app.name,
      source: {
        file: appSource.file || config._file || 'unknown',
        fileName: appSource.fileName || config._fileName || 'unknown',
        line: appSource.line || 'unknown',
        index: appSource.index !== undefined ? appSource.index : appIndex
      },
      environments: [],
      errors: [],
      warnings: []
    };

    if (!app.environments || !Array.isArray(app.environments)) {
      appResult.errors.push({
        type: 'CONFIG_ERROR',
        message: '应用缺少环境配置'
      });
      results.applications.push(appResult);
      return;
    }

    app.environments.forEach((env, envIndex) => {
      if (targetEnv && env.name !== targetEnv) {
        return;
      }

      const envSource = env._source || {};
      const envResult = {
        name: env.name,
        source: {
          file: envSource.file || config._file || 'unknown',
          fileName: envSource.fileName || config._fileName || 'unknown',
          line: envSource.line || 'unknown',
          index: envSource.index !== undefined ? envSource.index : envIndex
        },
        authorizedUris: [],
        authUrlCheck: null,
        errors: [],
        warnings: []
      };

      if (!env.authorizedRedirectUris || !Array.isArray(env.authorizedRedirectUris)) {
        envResult.errors.push({
          type: 'CONFIG_ERROR',
          message: '环境缺少授权回调地址配置'
        });
      } else {
        env.authorizedRedirectUris.forEach((uri, uriIndex) => {
          const uriValue = typeof uri === 'object' && uri.value ? uri.value : uri;
          const uriSource = typeof uri === 'object' && uri._source ? uri._source : {};
          const normalized = normalizeUrl(uriValue);
          const uriResult = {
            original: uriValue,
            normalized: normalized.normalized,
            isValid: !!normalized.normalized,
            source: {
              file: uriSource.file || config._file || 'unknown',
              fileName: uriSource.fileName || config._fileName || 'unknown',
              line: uriSource.line || 'unknown',
              index: uriSource.index !== undefined ? uriSource.index : uriIndex,
              rawContent: uriSource.rawContent || uriValue
            },
            errors: [],
            warnings: []
          };

          if (!normalized.normalized) {
            uriResult.errors.push({
              type: 'INVALID_URL',
              message: `URL格式无效: ${normalized.error}`
            });
          } else {
            if (normalized.protocol !== 'https' && env.name === 'production') {
              uriResult.warnings.push({
                type: 'INSECURE_PROTOCOL',
                message: '生产环境应使用HTTPS协议'
              });
            }
            
            if (normalized.hash) {
              uriResult.warnings.push({
                type: 'HASH_PRESENT',
                message: 'URL包含hash片段，OAuth回调通常不包含hash'
              });
            }
          }

          envResult.authorizedUris.push(uriResult);
          
          if (!uriResult.isValid) {
            envResult.errors.push(...uriResult.errors);
          }
          envResult.warnings.push(...uriResult.warnings);
        });
      }

      if (env.authUrl) {
        const authUrlCheck = checkUrlParams(env.authUrl, ['client_id', 'redirect_uri', 'response_type']);
        envResult.authUrlCheck = authUrlCheck;
        
        if (!authUrlCheck.isValid) {
          envResult.errors.push({
            type: 'AUTH_URL_MISSING_PARAMS',
            message: `授权链接缺少必要参数: ${authUrlCheck.missingParams.join(', ')}`
          });
        }
        
        if (authUrlCheck.redirectUri) {
          const decodedRedirectUri = decodeURIComponent(authUrlCheck.redirectUri);
          const redirectMatch = env.authorizedRedirectUris.some(uri => {
            const uriValue = getUriValue(uri);
            const comparison = compareUrls(decodedRedirectUri, uriValue);
            return comparison.exactMatch;
          });
          
          if (!redirectMatch) {
            envResult.errors.push({
              type: 'REDIRECT_URI_MISMATCH',
              message: `授权链接中的redirect_uri不在授权列表中: ${decodedRedirectUri}`,
              redirectUri: decodedRedirectUri
            });
          }
        }
      }

      appResult.environments.push(envResult);
      appResult.errors.push(...envResult.errors);
      appResult.warnings.push(...envResult.warnings);
    });

    results.applications.push(appResult);
    
    results.summary.total++;
    if (appResult.errors.length > 0) {
      results.summary.failed++;
    } else {
      results.summary.passed++;
    }
    results.summary.warnings += appResult.warnings.length;
  });

  return results;
}

function compareEnvironments(config) {
  const comparison = {
    applications: []
  };

  if (!config.applications) return comparison;

  config.applications.forEach(app => {
    if (!app.environments || app.environments.length < 2) return;

    const appComparison = {
      appId: app.appId || app.name,
      appName: app.name,
      environmentPairs: []
    };

    for (let i = 0; i < app.environments.length; i++) {
      for (let j = i + 1; j < app.environments.length; j++) {
        const env1 = app.environments[i];
        const env2 = app.environments[j];
        
        const pairComparison = {
          env1: env1.name,
          env2: env2.name,
          differences: []
        };

        const uris1 = env1.authorizedRedirectUris || [];
        const uris2 = env2.authorizedRedirectUris || [];

        uris1.forEach(uri => {
          const uriValue = getUriValue(uri);
          const found = uris2.some(u => compareUrls(uriValue, getUriValue(u)).exactMatch);
          if (!found) {
            pairComparison.differences.push({
              type: 'URI_ONLY_IN_ENV1',
              message: `仅在 ${env1.name} 存在: ${uriValue}`,
              uri: uriValue,
              environment: env1.name
            });
          }
        });

        uris2.forEach(uri => {
          const uriValue = getUriValue(uri);
          const found = uris1.some(u => compareUrls(uriValue, getUriValue(u)).exactMatch);
          if (!found) {
            pairComparison.differences.push({
              type: 'URI_ONLY_IN_ENV2',
              message: `仅在 ${env2.name} 存在: ${uriValue}`,
              uri: uriValue,
              environment: env2.name
            });
          }
        });

        if (pairComparison.differences.length > 0) {
          appComparison.environmentPairs.push(pairComparison);
        }
      }
    }

    if (appComparison.environmentPairs.length > 0) {
      comparison.applications.push(appComparison);
    }
  });

  return comparison;
}

function attributeErrors(validationResult, errorSamples = [], envComparison = null) {
  const attributed = {
    timestamp: new Date().toISOString(),
    summary: {
      hasErrors: false,
      hasWarnings: false,
      totalApplications: validationResult.summary.total,
      passedApplications: validationResult.summary.passed,
      failedApplications: validationResult.summary.failed,
      totalErrors: 0,
      totalWarnings: validationResult.summary.warnings,
      errorCategories: {}
    },
    applications: [],
    environmentComparison: envComparison,
    matchedErrorSamples: []
  };

  validationResult.applications.forEach(app => {
    const appAttributed = {
      appId: app.appId,
      appName: app.appName,
      source: app.source,
      status: app.errors.length > 0 ? 'FAILED' : 'PASSED',
      environments: []
    };

    app.environments.forEach(env => {
      const envAttributed = {
        name: env.name,
        source: env.source,
        status: env.errors.length > 0 ? 'FAILED' : 'PASSED',
        authorizedUris: env.authorizedUris,
        issues: []
      };

      env.errors.forEach(error => {
        const category = categorizeError(error);
        envAttributed.issues.push({
          severity: 'ERROR',
          category: category,
          type: error.type,
          message: error.message,
          suggestion: getSuggestion(error.type, error),
          redirectUri: error.redirectUri,
          source: env.source
        });
        
        attributed.summary.errorCategories[category] = (attributed.summary.errorCategories[category] || 0) + 1;
        attributed.summary.totalErrors++;
        attributed.summary.hasErrors = true;
      });

      env.warnings.forEach(warning => {
        const category = categorizeError(warning);
        envAttributed.issues.push({
          severity: 'WARNING',
          category: category,
          type: warning.type,
          message: warning.message,
          suggestion: getSuggestion(warning.type, warning),
          source: env.source
        });
        attributed.summary.hasWarnings = true;
      });

      if (env.authUrlCheck && env.authUrlCheck.redirectUri) {
        envAttributed.redirectUriFromAuthUrl = env.authUrlCheck.redirectUri;
      }

      appAttributed.environments.push(envAttributed);
    });

    attributed.applications.push(appAttributed);
  });

  errorSamples.forEach(sample => {
    const match = matchErrorSample(sample, validationResult);
    if (match) {
      attributed.matchedErrorSamples.push({
        sample: sample,
        matched: match
      });
    }
  });

  return attributed;
}

function categorizeError(error) {
  const type = error.type || '';
  if (type.includes('REDIRECT_URI') || type.includes('MISMATCH')) {
    return 'REDIRECT_URI_MISMATCH';
  } else if (type.includes('URL') || type.includes('INVALID')) {
    return 'INVALID_URL_FORMAT';
  } else if (type.includes('PARAM')) {
    return 'PARAMETER_ISSUE';
  } else if (type.includes('CONFIG')) {
    return 'CONFIGURATION_ERROR';
  } else if (type.includes('PROTOCOL') || type.includes('INSECURE')) {
    return 'SECURITY_WARNING';
  } else {
    return 'OTHER';
  }
}

function getSuggestion(errorType, error) {
  const suggestions = {
    'REDIRECT_URI_MISMATCH': [
      '检查OAuth应用后台配置的回调地址',
      '确认代码中使用的redirect_uri参数与配置一致',
      '注意URL编码问题，特别是特殊字符',
      '检查是否遗漏了端口号或路径后缀'
    ],
    'INVALID_URL_FORMAT': [
      '验证URL格式是否正确',
      '检查是否缺少协议(http/https)',
      '确认域名拼写无误'
    ],
    'AUTH_URL_MISSING_PARAMS': [
      '检查授权链接是否包含所有必要参数',
      '确保client_id、redirect_uri、response_type都已提供',
      '验证参数名称拼写是否正确'
    ],
    'INSECURE_PROTOCOL': [
      '生产环境强烈建议使用HTTPS协议',
      '更新配置使用https://开头的回调地址'
    ],
    'HASH_PRESENT': [
      'OAuth回调通常不应包含hash片段(#)',
      '考虑移除URL中的hash部分'
    ]
  };

  return suggestions[errorType] || ['检查配置是否正确'];
}

function matchErrorSample(sample, validationResult) {
  const sampleUrl = sample.redirectUri || sample.url || '';
  const sampleError = sample.error || sample.message || '';
  const sampleSource = sample._source || {};
  
  let bestMatch = null;
  let matchScore = 0;

  validationResult.applications.forEach(app => {
    app.environments.forEach(env => {
      env.authorizedUris.forEach(uri => {
        if (uri.original && uri.isValid) {
          const comparison = compareUrls(sampleUrl, uri.original);
          if (comparison.differences && comparison.differences.length > 0 && comparison.differences.length < 5) {
            const score = 5 - comparison.differences.length;
            if (score > matchScore) {
              matchScore = score;
              bestMatch = {
                app: app.appName,
                appSource: app.source,
                environment: env.name,
                environmentSource: env.source,
                configuredUri: uri.original,
                configuredUriSource: uri.source,
                normalizedConfiguredUri: uri.normalized,
                sampleUri: sampleUrl,
                sampleSource: {
                  file: sampleSource.file || 'unknown',
                  fileName: sampleSource.fileName || 'unknown',
                  line: sampleSource.line || 'unknown',
                  index: sampleSource.index,
                  rawContent: sampleSource.rawContent || JSON.stringify(sample).substring(0, 100)
                },
                differences: comparison.differences,
                matchConfidence: score / 5
              };
            }
          }
        }
      });
    });
  });

  return bestMatch;
}

module.exports = {
  validateConfig,
  compareEnvironments,
  attributeErrors,
  categorizeError,
  getSuggestion,
  matchErrorSample,
  getUriValue
};
