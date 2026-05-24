"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeCNAMEChains = analyzeCNAMEChains;
exports.getLongestChains = getLongestChains;
exports.getCircularChains = getCircularChains;
exports.getChainsWithHighTTL = getChainsWithHighTTL;
exports.getUnresolvedChains = getUnresolvedChains;
exports.formatChainAsTree = formatChainAsTree;
function analyzeCNAMEChains(zoneData, maxDepth = 10) {
    const cnameRecords = zoneData.records.filter(r => r.type === 'CNAME');
    const allRecordsMap = buildRecordMap(zoneData);
    const chains = [];
    const processedDomains = new Set();
    for (const cname of cnameRecords) {
        if (processedDomains.has(cname.name))
            continue;
        const chain = buildCNAMEChain(cname.name, allRecordsMap, maxDepth, processedDomains);
        if (chain.chain.length > 0) {
            chains.push(chain);
        }
    }
    return chains;
}
function buildRecordMap(zoneData) {
    const map = new Map();
    for (const record of zoneData.records) {
        const key = record.name.toLowerCase();
        if (!map.has(key)) {
            map.set(key, []);
        }
        map.get(key).push(record);
        if (record.name.startsWith('*')) {
            const wildcardKey = record.name.replace('*', '');
            const wildcardMapKey = `*:${wildcardKey}`.toLowerCase();
            if (!map.has(wildcardMapKey)) {
                map.set(wildcardMapKey, []);
            }
            map.get(wildcardMapKey).push(record);
        }
    }
    return map;
}
function buildCNAMEChain(startDomain, recordMap, maxDepth, processedDomains) {
    const chain = [];
    const visited = new Set();
    const unresolved = [];
    let currentDomain = startDomain;
    let isCircular = false;
    let depth = 0;
    while (depth < maxDepth) {
        const domainKey = currentDomain.toLowerCase();
        if (visited.has(domainKey)) {
            isCircular = true;
            break;
        }
        visited.add(domainKey);
        processedDomains.add(domainKey);
        let records = recordMap.get(domainKey);
        if (!records) {
            records = findWildcardMatch(currentDomain, recordMap);
        }
        if (!records || records.length === 0) {
            unresolved.push(currentDomain);
            break;
        }
        const cnameRecord = records.find(r => r.type === 'CNAME');
        if (!cnameRecord) {
            break;
        }
        chain.push(cnameRecord);
        currentDomain = cnameRecord.value;
        depth++;
    }
    const ttls = chain.map(r => r.ttl);
    const totalTTL = ttls.reduce((a, b) => a + b, 0);
    return {
        domain: startDomain,
        chain,
        totalTTL,
        maxTTL: ttls.length > 0 ? Math.max(...ttls) : 0,
        minTTL: ttls.length > 0 ? Math.min(...ttls) : 0,
        averageTTL: ttls.length > 0 ? Math.round(totalTTL / ttls.length) : 0,
        depth: chain.length,
        isCircular,
        unresolved
    };
}
function findWildcardMatch(domain, recordMap) {
    const parts = domain.split('.');
    for (let i = 0; i < parts.length; i++) {
        const wildcardPattern = parts.slice(i).join('.');
        const wildcardKey = `*:.${wildcardPattern}`.toLowerCase();
        const records = recordMap.get(wildcardKey);
        if (records) {
            return records;
        }
    }
    return undefined;
}
function getLongestChains(chains, limit = 10) {
    return [...chains]
        .sort((a, b) => b.depth - a.depth)
        .slice(0, limit);
}
function getCircularChains(chains) {
    return chains.filter(c => c.isCircular);
}
function getChainsWithHighTTL(chains, threshold = 3600) {
    return chains.filter(c => c.maxTTL > threshold);
}
function getUnresolvedChains(chains) {
    return chains.filter(c => c.unresolved.length > 0);
}
function formatChainAsTree(chain) {
    if (chain.chain.length === 0) {
        return chain.domain;
    }
    const lines = [];
    lines.push(chain.chain[0].name);
    for (let i = 0; i < chain.chain.length; i++) {
        const record = chain.chain[i];
        const isLast = i === chain.chain.length - 1;
        const prefix = isLast ? '└── ' : '├── ';
        lines.push(`  ${prefix}${record.value} (TTL: ${record.ttl}s)`);
    }
    if (chain.unresolved.length > 0) {
        lines.push(`  └── ${chain.unresolved[0]} (UNRESOLVED)`);
    }
    if (chain.isCircular) {
        lines.push('  (警告: 检测到循环引用!)');
    }
    return lines.join('\n');
}
//# sourceMappingURL=cnameAnalyzer.js.map