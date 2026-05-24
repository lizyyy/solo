"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readAliasMap = readAliasMap;
exports.normalizeServices = normalizeServices;
exports.filterServices = filterServices;
exports.getSourceTypes = getSourceTypes;
const unitConverter_1 = require("../utils/unitConverter");
const fileReader_1 = require("../readers/fileReader");
function readAliasMap(filePath) {
    if (!filePath)
        return {};
    const content = (0, fileReader_1.readFile)(filePath);
    const data = (0, fileReader_1.parseJsonOrYaml)(content, filePath);
    const aliasMap = {};
    for (const [canonicalName, aliases] of Object.entries(data)) {
        if (Array.isArray(aliases)) {
            aliasMap[canonicalName] = aliases.map(a => (0, unitConverter_1.normalizeServiceName)(String(a)));
        }
    }
    return aliasMap;
}
function normalizeServices(allServices, aliasMap = {}) {
    const serviceMap = new Map();
    const nameToCanonical = new Map();
    for (const [canonicalName, aliases] of Object.entries(aliasMap)) {
        const canonicalKey = (0, unitConverter_1.normalizeServiceName)(canonicalName);
        nameToCanonical.set(canonicalKey, canonicalName);
        for (const alias of aliases) {
            nameToCanonical.set(alias, canonicalName);
        }
    }
    for (const service of allServices) {
        const normalizedName = (0, unitConverter_1.normalizeServiceName)(service.serviceName);
        let canonicalName = nameToCanonical.get(normalizedName) || service.serviceName;
        if (service.aliases && service.aliases.length > 0) {
            for (const alias of service.aliases) {
                const normalizedAlias = (0, unitConverter_1.normalizeServiceName)(alias);
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
function filterServices(services, serviceFilter) {
    if (!serviceFilter)
        return services;
    const normalizedFilter = (0, unitConverter_1.normalizeServiceName)(serviceFilter);
    return services.filter(s => {
        if ((0, unitConverter_1.normalizeServiceName)(s.canonicalName) === normalizedFilter)
            return true;
        return s.aliases.some(a => (0, unitConverter_1.normalizeServiceName)(a) === normalizedFilter);
    });
}
function getSourceTypes(services) {
    const types = new Set();
    for (const service of services) {
        for (const source of Object.keys(service.sources)) {
            types.add(source);
        }
    }
    return Array.from(types).sort();
}
