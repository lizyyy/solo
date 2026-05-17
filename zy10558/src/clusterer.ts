import { TestFailure, NormalizedFailure, Cluster, ClusterResult, Baseline, ParseResult } from './types';
import { normalizeFailure, calculateSimilarity } from './normalizer';
import { createHash } from 'crypto';

function generateClusterId(): string {
  return 'cluster_' + createHash('md5').update(Date.now().toString() + Math.random()).digest('hex').slice(0, 8);
}

export function clusterFailures(
  failures: TestFailure[],
  threshold: number = 0.7,
  baseline?: Baseline
): Cluster[] {
  const normalized = failures.map(f => normalizeFailure(f));
  const clusters: Cluster[] = [];
  
  for (const failure of normalized) {
    let bestCluster: Cluster | null = null;
    let bestSimilarity = 0;
    
    for (const cluster of clusters) {
      const similarity = calculateSimilarity(failure, cluster.representative);
      if (similarity > threshold && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestCluster = cluster;
      }
    }
    
    if (bestCluster) {
      bestCluster.failures.push(failure);
      bestCluster.frequency = bestCluster.failures.length;
    } else {
      const cluster: Cluster = {
        id: generateClusterId(),
        label: generateClusterLabel(failure),
        failures: [failure],
        representative: failure,
        frequency: 1,
        isNew: baseline ? !baseline.fingerprints.includes(failure.fingerprint) : undefined
      };
      clusters.push(cluster);
    }
  }
  
  clusters.sort((a, b) => b.frequency - a.frequency);
  
  return clusters;
}

function generateClusterLabel(failure: NormalizedFailure): string {
  const errorType = failure.features.find(f => f.startsWith('type:'));
  const suite = failure.features.find(f => f.startsWith('suite:'));
  const keyword = failure.features.find(f => f.startsWith('kw:'));
  
  const parts: string[] = [];
  
  if (errorType) {
    parts.push(errorType.replace('type:', ''));
  }
  
  if (suite) {
    parts.push(`in ${suite.replace('suite:', '')}`);
  }
  
  if (keyword) {
    parts.push(`[${keyword.replace('kw:', '')}]`);
  }
  
  if (parts.length === 0) {
    const shortError = failure.normalizedError.slice(0, 50);
    parts.push(shortError);
  }
  
  return parts.join(' ');
}

export function buildClusterResult(
  parseResult: ParseResult,
  clusters: Cluster[],
  baseline?: Baseline
): ClusterResult {
  const totalFailures = parseResult.successes.length;
  let newFailures = 0;
  let existingFailures = 0;
  
  for (const cluster of clusters) {
    for (const failure of cluster.failures) {
      if (baseline) {
        if (baseline.fingerprints.includes(failure.fingerprint)) {
          existingFailures++;
        } else {
          newFailures++;
        }
      }
    }
  }
  
  return {
    totalFailures,
    totalClusters: clusters.length,
    newFailures,
    existingFailures,
    clusters,
    parseErrors: parseResult.errors,
    baseline,
    generatedAt: new Date().toISOString()
  };
}

export function createBaselineFromResult(result: ClusterResult): Baseline {
  const fingerprints: string[] = [];
  const clusters: Baseline['clusters'] = [];
  
  for (const cluster of result.clusters) {
    for (const failure of cluster.failures) {
      if (!fingerprints.includes(failure.fingerprint)) {
        fingerprints.push(failure.fingerprint);
      }
    }
    
    clusters.push({
      fingerprint: cluster.representative.fingerprint,
      label: cluster.label,
      count: cluster.frequency
    });
  }
  
  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    fingerprints,
    clusters
  };
}
