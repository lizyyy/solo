import crypto from 'crypto';
import { makeRequest } from './http-client.js';

function generateIssueId(testCase, accessType) {
  const key = `${testCase.id}:${testCase.method}:${testCase.path}:${accessType}`;
  return crypto.createHash('md5').update(key).digest('hex').slice(0, 12);
}

function isReadMethod(method) {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

function isWriteMethod(method) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

function substitutePathParams(path, params) {
  let result = path;
  for (const [key, value] of Object.entries(params || {})) {
    result = result.replace(new RegExp(`:${key}`, 'g'), value);
  }
  return result;
}

function shouldDenyAccess(response, testCase, crossTenant = true) {
  if (!response.success) return false;
  
  const status = response.status;
  
  if (testCase.requiresAdmin) {
    return status === 403 || status === 401 || status === 404;
  }
  
  if (crossTenant) {
    return status === 403 || status === 401 || status === 404;
  }
  
  return status >= 200 && status < 300;
}

function getAccessType(method, path) {
  if (path.includes('/export')) return 'export';
  if (method === 'DELETE') return 'delete';
  if (isWriteMethod(method)) return 'modify';
  return 'read';
}

function getAccessTypeLabel(type) {
  const labels = {
    read: '读取',
    modify: '修改',
    export: '导出',
    delete: '删除',
  };
  return labels[type] || type;
}

function buildNormalRequest(testCase, tenant, token, resourceId) {
  const path = substitutePathParams(testCase.path, {
    id: resourceId || testCase.resourceId,
    ...testCase.pathParams,
  });
  
  return {
    method: testCase.method,
    path,
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenant.id,
      ...testCase.headers,
    },
    body: testCase.body,
    queryParams: testCase.queryParams,
  };
}

function buildCrossTenantRequest(testCase, attackerTenant, attackerToken, targetResourceId) {
  const path = substitutePathParams(testCase.path, {
    id: targetResourceId,
    ...testCase.pathParams,
  });
  
  return {
    method: testCase.method,
    path,
    headers: {
      'Authorization': `Bearer ${attackerToken}`,
      'X-Tenant-Id': attackerTenant.id,
      ...testCase.headers,
    },
    body: testCase.body,
    queryParams: testCase.queryParams,
  };
}

export async function runTests(config, mockServer = null) {
  const { baseUrl, tenants, testCases, tokens } = config;
  const startTime = Date.now();
  
  const testResults = [];
  const issues = [];
  const issueMap = new Map();
  
  for (const testCase of testCases) {
    const accessType = getAccessType(testCase.method, testCase.path);
    
    if (testCase.skip) {
      testResults.push({
        testCaseId: testCase.id,
        skipped: true,
        reason: testCase.skipReason || '标记跳过',
      });
      continue;
    }
    
    for (const targetTenant of tenants) {
      const targetToken = tokens[targetTenant.tokenKey];
      const targetResourceId = testCase.targetResourceId || targetTenant.resourceIds?.[0];
      
      if (!targetToken) {
        testResults.push({
          testCaseId: testCase.id,
          error: `租户 ${targetTenant.id} 缺少令牌`,
        });
        continue;
      }
      
      const normalRequest = buildNormalRequest(
        testCase, 
        targetTenant, 
        targetToken, 
        targetResourceId
      );
      
      const normalResponse = await makeRequest(
        baseUrl,
        normalRequest.method,
        normalRequest.path,
        {
          headers: normalRequest.headers,
          body: normalRequest.body,
          queryParams: normalRequest.queryParams,
        }
      );
      
      const normalAccessAllowed = shouldDenyAccess(normalResponse, testCase, false);
      
      for (const attackerTenant of tenants) {
        if (attackerTenant.id === targetTenant.id) continue;
        
        const attackerToken = tokens[attackerTenant.tokenKey];
        if (!attackerToken) continue;
        
        const crossRequest = buildCrossTenantRequest(
          testCase,
          attackerTenant,
          attackerToken,
          targetResourceId
        );
        
        const crossResponse = await makeRequest(
          baseUrl,
          crossRequest.method,
          crossRequest.path,
          {
            headers: crossRequest.headers,
            body: crossRequest.body,
            queryParams: crossRequest.queryParams,
          }
        );
        
        const shouldBeDenied = shouldDenyAccess(crossResponse, testCase, true);
        const wasAllowed = crossResponse.success && 
          crossResponse.status >= 200 && 
          crossResponse.status < 300;
        
        const isVulnerable = wasAllowed && !testCase.allowCrossTenant;
        
        const testResult = {
          testCaseId: testCase.id,
          targetTenant: targetTenant.id,
          attackerTenant: attackerTenant.id,
          accessType,
          accessTypeLabel: getAccessTypeLabel(accessType),
          method: testCase.method,
          path: crossRequest.path,
          normalAccess: {
            request: {
              method: normalRequest.method,
              path: normalRequest.path,
              headers: { ...normalRequest.headers, Authorization: '[REDACTED]' },
              body: normalRequest.body,
              queryParams: normalRequest.queryParams,
            },
            response: normalResponse,
            allowed: normalAccessAllowed,
          },
          crossTenantAccess: {
            request: {
              method: crossRequest.method,
              path: crossRequest.path,
              headers: { ...crossRequest.headers, Authorization: '[REDACTED]' },
              body: crossRequest.body,
              queryParams: crossRequest.queryParams,
            },
            response: crossResponse,
            shouldBeDenied,
            wasAllowed,
          },
          vulnerable: isVulnerable,
          requiresAdmin: testCase.requiresAdmin || false,
          isReadOperation: isReadMethod(testCase.method),
          isWriteOperation: isWriteMethod(testCase.method),
          description: testCase.description,
          notes: testCase.notes,
        };
        
        testResults.push(testResult);
        
        if (isVulnerable) {
          const issueId = generateIssueId(testCase, accessType);
          
          if (!issueMap.has(issueId)) {
            const issue = {
              id: issueId,
              testCaseId: testCase.id,
              accessType,
              accessTypeLabel: getAccessTypeLabel(accessType),
              method: testCase.method,
              path: testCase.path,
              description: testCase.description,
              occurrences: [],
              isReadOperation: isReadMethod(testCase.method),
              isWriteOperation: isWriteMethod(testCase.method),
              requiresAdmin: testCase.requiresAdmin || false,
            };
            issueMap.set(issueId, issue);
            issues.push(issue);
          }
          
          const issue = issueMap.get(issueId);
          issue.occurrences.push({
            targetTenant: targetTenant.id,
            attackerTenant: attackerTenant.id,
            targetResourceId,
            request: testResult.crossTenantAccess.request,
            responseStatus: crossResponse.status,
            responseData: crossResponse.data,
          });
        }
      }
    }
  }
  
  const endTime = Date.now();
  
  return {
    runAt: new Date().toISOString(),
    duration: endTime - startTime,
    config: {
      baseUrl,
      tenantCount: tenants.length,
      testCaseCount: testCases.length,
    },
    summary: {
      totalTests: testResults.length,
      vulnerableTests: testResults.filter(r => r.vulnerable).length,
      safeTests: testResults.filter(r => !r.vulnerable && !r.skipped && !r.error).length,
      skippedTests: testResults.filter(r => r.skipped).length,
      errors: testResults.filter(r => r.error).length,
      uniqueIssues: issues.length,
      readIssues: issues.filter(i => i.isReadOperation).length,
      writeIssues: issues.filter(i => i.isWriteOperation).length,
    },
    testResults,
    issues,
  };
}

export { generateIssueId, getAccessType, getAccessTypeLabel };
