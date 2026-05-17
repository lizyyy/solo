"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clusterFailures = clusterFailures;
exports.buildClusterResult = buildClusterResult;
exports.createBaselineFromResult = createBaselineFromResult;
const normalizer_1 = require("./normalizer");
const crypto_1 = require("crypto");
function generateClusterId() {
    return 'cluster_' + (0, crypto_1.createHash)('md5').update(Date.now().toString() + Math.random()).digest('hex').slice(0, 8);
}
function clusterFailures(failures, threshold = 0.7, baseline) {
    const normalized = failures.map(f => (0, normalizer_1.normalizeFailure)(f));
    const clusters = [];
    for (const failure of normalized) {
        let bestCluster = null;
        let bestSimilarity = 0;
        for (const cluster of clusters) {
            const similarity = (0, normalizer_1.calculateSimilarity)(failure, cluster.representative);
            if (similarity > threshold && similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestCluster = cluster;
            }
        }
        if (bestCluster) {
            bestCluster.failures.push(failure);
            bestCluster.frequency = bestCluster.failures.length;
        }
        else {
            const cluster = {
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
function generateClusterLabel(failure) {
    const errorType = failure.features.find(f => f.startsWith('type:'));
    const suite = failure.features.find(f => f.startsWith('suite:'));
    const keyword = failure.features.find(f => f.startsWith('kw:'));
    const parts = [];
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
function buildClusterResult(parseResult, clusters, baseline) {
    const totalFailures = parseResult.successes.length;
    let newFailures = 0;
    let existingFailures = 0;
    for (const cluster of clusters) {
        for (const failure of cluster.failures) {
            if (baseline) {
                if (baseline.fingerprints.includes(failure.fingerprint)) {
                    existingFailures++;
                }
                else {
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
function createBaselineFromResult(result) {
    const fingerprints = [];
    const clusters = [];
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
