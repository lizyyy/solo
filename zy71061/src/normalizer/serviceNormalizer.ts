import { ServiceRetention, NormalizedService, DataSourceType } from '../types';
import { normalizeServiceName } from '../utils/unitConverter';
import { readFile, parseJsonOrYaml } from '../readers/fileReader';

interface AliasMap {
  [canonicalName: string]: string[];
}

export function readAliasMap(filePath?: string): AliasMap {
  if (!filePath) return {};

  const content = readFile(filePath);
  const data = parseJsonOrYaml(content, filePath);

  const aliasMap: AliasMap = {};
  for (const [canonicalName, aliases] of Object.entries(data)) {
    if (Array.isArray(aliases)) {
      aliasMap[canonicalName] = aliases.map(a => normalizeServiceName(String(a)));
    }
  }

  return aliasMap;
}

export function normalizeServices(
  allServices: ServiceRetention[],
  aliasMap: AliasMap = {}
): NormalizedService[] {
  const serviceMap = new Map<string, NormalizedService>();
  const nameToCanonical = new Map<string, string>();

  for (const [canonicalName, aliases] of Object.entries(aliasMap)) {
    const canonicalKey = normalizeServiceName(canonicalName);
    nameToCanonical.set(canonicalKey, canonicalName);
    for (const alias of aliases) {
      nameToCanonical.set(alias, canonicalName);
    }
  }

  for (const service of allServices) {
    const normalizedName = normalizeServiceName(service.serviceName);
    let canonicalName = nameToCanonical.get(normalizedName) || service.serviceName;

    if (service.aliases && service.aliases.length > 0) {
      for (const alias of service.aliases) {
        const normalizedAlias = normalizeServiceName(alias);
        if (!nameToCanonical.has(normalizedAlias)) {
          nameToCanonical.set(normalizedAlias, canonicalName);
        }
      }
    }

    let normalized = serviceMap.get(canonicalName);
    if (!normalized) {
      normalized = {
        canonicalName,
        aliases: service.aliases || [],
        sources: {},
      };
      serviceMap.set(canonicalName, normalized);
    }

    normalized.sources[service.source] = {
      retentionDays: service.retentionDays,
      rawValue: service.rawValue,
    };

    if (service.aliases) {
      for (const alias of service.aliases) {
        if (!normalized.aliases.includes(alias)) {
          normalized.aliases.push(alias);
        }
      }
    }
  }

  return Array.from(serviceMap.values());
}

export function filterServices(
  services: NormalizedService[],
  serviceFilter?: string
): NormalizedService[] {
  if (!serviceFilter) return services;

  const normalizedFilter = normalizeServiceName(serviceFilter);
  return services.filter(s => {
    if (normalizeServiceName(s.canonicalName) === normalizedFilter) return true;
    return s.aliases.some(a => normalizeServiceName(a) === normalizedFilter);
  });
}

export function getSourceTypes(services: NormalizedService[]): DataSourceType[] {
  const types = new Set<DataSourceType>();
  for (const service of services) {
    for (const source of Object.keys(service.sources) as DataSourceType[]) {
      types.add(source);
    }
  }
  return Array.from(types).sort();
}
