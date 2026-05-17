import { extractRepository, extractTag } from './yaml-parser.js';

export function detectDrift(expectedWorkloads, actualImages, options = {}) {
  const { strictTagMatch = false, groupBy = 'namespace' } = options;
  
  const driftResults = [];
  const matched = [];
  const unmatched = { expected: [], actual: [] };
  
  for (const expected of expectedWorkloads) {
    const matchingActuals = findMatchingActualImages(expected, actualImages);
    
    if (matchingActuals.length === 0) {
      unmatched.expected.push({
        ...expected,
        reason: 'NO_RUNNING_POD_FOUND',
        message: '未找到运行中的Pod实例'
      });
    } else {
      for (const actual of matchingActuals) {
        const result = compareImages(expected, actual, strictTagMatch);
        driftResults.push(result);
        
        if (result.status === 'MATCHED') {
          matched.push(result);
        }
      }
    }
  }
  
  for (const actual of actualImages) {
    const hasMatch = driftResults.some(r => 
      r.actual?.podName === actual.podName && 
      r.actual?.containerName === actual.containerName
    );
    
    if (!hasMatch) {
      unmatched.actual.push({
        ...actual,
        reason: 'NOT_IN_MANIFEST',
        message: '运行中但不在部署清单中'
      });
    }
  }
  
  const grouped = groupResults(driftResults, groupBy);
  
  return {
    summary: generateSummary(driftResults, matched, unmatched),
    driftResults,
    matched,
    unmatched,
    grouped,
    timestamp: new Date().toISOString()
  };
}

function findMatchingActualImages(expected, actualImages) {
  return actualImages.filter(actual => {
    const namespaceMatch = actual.namespace === expected.namespace;
    const workloadMatch = actual.workload === expected.name;
    const containerMatch = actual.containerName === expected.containerName;
    const kindMatch = actual.workloadKind === expected.kind || 
                     (actual.workloadKind === 'Deployment' && expected.kind === 'Deployment');
    
    return namespaceMatch && workloadMatch && containerMatch;
  });
}

function compareImages(expected, actual, strictTagMatch) {
  const expectedRepo = expected.expectedRepository;
  const expectedTag = expected.expectedTag;
  const actualRepo = extractRepository(actual.specImage);
  const actualTag = extractTag(actual.specImage);
  
  const result = {
    expected: {
      kind: expected.kind,
      name: expected.name,
      namespace: expected.namespace,
      containerName: expected.containerName,
      containerType: expected.containerType,
      image: expected.image,
      repository: expectedRepo,
      tag: expectedTag,
      location: {
        filePath: expected.filePath,
        line: expected.line,
        column: expected.column,
        rawLine: expected.rawLine
      }
    },
    actual: {
      kind: actual.workloadKind,
      name: actual.workload,
      namespace: actual.namespace,
      containerName: actual.containerName,
      containerType: actual.containerType,
      podName: actual.podName,
      specImage: actual.specImage,
      actualImage: actual.actualImage,
      actualDigest: actual.actualDigest,
      repository: actualRepo,
      tag: actualTag,
      ready: actual.ready,
      restartCount: actual.restartCount,
      nodeName: actual.nodeName
    },
    status: 'UNKNOWN',
    driftType: null,
    issues: []
  };
  
  const issues = [];
  
  if (expectedRepo !== actualRepo) {
    issues.push({
      type: 'REPOSITORY_MISMATCH',
      severity: 'high',
      message: `镜像仓库不一致`,
      expected: expectedRepo,
      actual: actualRepo
    });
  }
  
  if (strictTagMatch && expectedTag !== actualTag) {
    issues.push({
      type: 'TAG_MISMATCH',
      severity: 'medium',
      message: `镜像标签不一致`,
      expected: expectedTag,
      actual: actualTag
    });
  }
  
  if (!actual.actualDigest) {
    issues.push({
      type: 'NO_DIGEST',
      severity: 'low',
      message: `无法获取实际镜像digest`,
      expected: null,
      actual: null
    });
  }
  
  if (expected.image.includes('@sha256:')) {
    const expectedDigest = expected.image.match(/sha256:[a-f0-9]{64}/)?.[0];
    if (expectedDigest && actual.actualDigest && expectedDigest !== actual.actualDigest) {
      issues.push({
        type: 'DIGEST_MISMATCH',
        severity: 'high',
        message: `镜像Digest不一致（漂移）`,
        expected: expectedDigest,
        actual: actual.actualDigest
      });
    }
  }
  
  if (issues.length === 0) {
    result.status = 'MATCHED';
  } else {
    result.status = issues.some(i => i.severity === 'high') ? 'DRIFTED' : 'WARNING';
    result.driftType = determineDriftType(issues);
  }
  
  result.issues = issues;
  return result;
}

function determineDriftType(issues) {
  const types = issues.map(i => i.type);
  
  if (types.includes('DIGEST_MISMATCH')) return 'TAG_DRIFT';
  if (types.includes('REPOSITORY_MISMATCH')) return 'REPOSITORY_DRIFT';
  if (types.includes('TAG_MISMATCH')) return 'TAG_MISMATCH';
  if (types.includes('NO_DIGEST')) return 'INCOMPLETE_DATA';
  
  return 'OTHER';
}

function groupResults(results, groupBy) {
  const groups = {};
  
  for (const result of results) {
    let key;
    switch (groupBy) {
      case 'namespace':
        key = result.expected.namespace || result.actual.namespace;
        break;
      case 'kind':
        key = result.expected.kind || result.actual.kind;
        break;
      case 'status':
        key = result.status;
        break;
      case 'workload':
        key = `${result.expected.namespace}/${result.expected.kind}/${result.expected.name}`;
        break;
      default:
        key = 'all';
    }
    
    if (!groups[key]) {
      groups[key] = { items: [], stats: {} };
    }
    groups[key].items.push(result);
  }
  
  for (const key in groups) {
    const items = groups[key].items;
    groups[key].stats = {
      total: items.length,
      matched: items.filter(i => i.status === 'MATCHED').length,
      drifted: items.filter(i => i.status === 'DRIFTED').length,
      warning: items.filter(i => i.status === 'WARNING').length
    };
  }
  
  return groups;
}

function generateSummary(driftResults, matched, unmatched) {
  const drifted = driftResults.filter(r => r.status === 'DRIFTED');
  const warnings = driftResults.filter(r => r.status === 'WARNING');
  
  return {
    totalChecked: driftResults.length,
    matched: matched.length,
    drifted: drifted.length,
    warning: warnings.length,
    unmatchedExpected: unmatched.expected.length,
    unmatchedActual: unmatched.actual.length,
    driftRate: driftResults.length > 0 ? (drifted.length / driftResults.length * 100).toFixed(2) : 0,
    driftTypes: countDriftTypes(drifted),
    severities: countSeverities(driftResults)
  };
}

function countDriftTypes(results) {
  const counts = {};
  for (const result of results) {
    const type = result.driftType || 'UNKNOWN';
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}

function countSeverities(results) {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const result of results) {
    for (const issue of result.issues) {
      counts[issue.severity] = (counts[issue.severity] || 0) + 1;
    }
  }
  return counts;
}

export function filterDrifted(results) {
  return results.driftResults.filter(r => r.status === 'DRIFTED');
}

export function filterByNamespace(results, namespace) {
  return results.driftResults.filter(r => 
    r.expected.namespace === namespace || r.actual.namespace === namespace
  );
}

export function filterByWorkload(results, kind, name) {
  return results.driftResults.filter(r => 
    (r.expected.kind === kind && r.expected.name === name) ||
    (r.actual.kind === kind && r.actual.name === name)
  );
}