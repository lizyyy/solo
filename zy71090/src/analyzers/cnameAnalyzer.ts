import { ZoneData, DNSRecord, CNAMEChain } from '../types';

export function analyzeCNAMEChains(zoneData: ZoneData, maxDepth: number = 10): CNAMEChain[] {
  const cnameRecords = zoneData.records.filter(r => r.type === 'CNAME');
  const allRecordsMap = buildRecordMap(zoneData);
  
  const chains: CNAMEChain[] = [];
  const processedDomains = new Set<string>();
  
  for (const cname of cnameRecords) {
    if (processedDomains.has(cname.name)) continue;
    
    const chain = buildCNAMEChain(cname.name, allRecordsMap, maxDepth, processedDomains);
    if (chain.chain.length > 0) {
      chains.push(chain);
    }
  }
  
  return chains;
}

function buildRecordMap(zoneData: ZoneData): Map<string, DNSRecord[]> {
  const map = new Map<string, DNSRecord[]>();
  
  for (const record of zoneData.records) {
    const key = record.name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(record);
    
    if (record.name.startsWith('*')) {
      const wildcardKey = record.name.replace('*', '');
      const wildcardMapKey = `*:${wildcardKey}`.toLowerCase();
      if (!map.has(wildcardMapKey)) {
        map.set(wildcardMapKey, []);
      }
      map.get(wildcardMapKey)!.push(record);
    }
  }
  
  return map;
}

function buildCNAMEChain(
  startDomain: string,
  recordMap: Map<string, DNSRecord[]>,
  maxDepth: number,
  processedDomains: Set<string>
): CNAMEChain {
  const chain: DNSRecord[] = [];
  const visited = new Set<string>();
  const unresolved: string[] = [];
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

function findWildcardMatch(
  domain: string,
  recordMap: Map<string, DNSRecord[]>
): DNSRecord[] | undefined {
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

export function getLongestChains(chains: CNAMEChain[], limit: number = 10): CNAMEChain[] {
  return [...chains]
    .sort((a, b) => b.depth - a.depth)
    .slice(0, limit);
}

export function getCircularChains(chains: CNAMEChain[]): CNAMEChain[] {
  return chains.filter(c => c.isCircular);
}

export function getChainsWithHighTTL(chains: CNAMEChain[], threshold: number = 3600): CNAMEChain[] {
  return chains.filter(c => c.maxTTL > threshold);
}

export function getUnresolvedChains(chains: CNAMEChain[]): CNAMEChain[] {
  return chains.filter(c => c.unresolved.length > 0);
}

export function formatChainAsTree(chain: CNAMEChain): string {
  if (chain.chain.length === 0) {
    return chain.domain;
  }
  
  const lines: string[] = [];
  
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
