"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cliOptionsSchema = exports.zoneFileSchema = void 0;
exports.validateTTL = validateTTL;
exports.validateDomainName = validateDomainName;
exports.validateRecordType = validateRecordType;
const zod_1 = require("zod");
const default_1 = require("../config/default");
exports.zoneFileSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Zone name cannot be empty'),
    records: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string().min(1, 'Record name cannot be empty'),
        type: zod_1.z.string().refine((val) => default_1.VALID_RECORD_TYPES.includes(val.toUpperCase()), (val) => ({ message: `Invalid record type: ${val}` })),
        ttl: zod_1.z.number().int().min(0, 'TTL must be a non-negative integer'),
        value: zod_1.z.string().min(1, 'Record value cannot be empty')
    }))
});
exports.cliOptionsSchema = zod_1.z.object({
    zoneFile: zod_1.z.string().min(1, 'Zone file path is required'),
    zoneDir: zod_1.z.string().optional(),
    outputDir: zod_1.z.string().min(1, 'Output directory is required'),
    environments: zod_1.z.array(zod_1.z.string()).default([]),
    migrationWindow: zod_1.z.string().optional(),
    ttlConfig: zod_1.z.string().optional(),
    envConfig: zod_1.z.string().optional(),
    format: zod_1.z.array(zod_1.z.enum(['json', 'markdown', 'terminal'])).default(['terminal']),
    verbose: zod_1.z.boolean().default(false),
    strict: zod_1.z.boolean().default(false),
    expandCNAME: zod_1.z.boolean().default(true),
    maxChainDepth: zod_1.z.number().int().min(1).max(default_1.MAX_CNAME_CHAIN_DEPTH).default(10),
    minTTLWarn: zod_1.z.number().int().min(0).default(300),
    maxTTLWarn: zod_1.z.number().int().min(0).default(3600)
});
function validateTTL(ttl) {
    if (ttl < 0) {
        return {
            field: 'ttl',
            message: `TTL ${ttl} is negative`,
            severity: 'error'
        };
    }
    if (ttl === 0) {
        return {
            field: 'ttl',
            message: 'TTL is 0, which may cause excessive DNS queries',
            severity: 'warning'
        };
    }
    if (ttl > 604800) {
        return {
            field: 'ttl',
            message: `TTL ${ttl} exceeds 7 days, which is unusually long`,
            severity: 'warning'
        };
    }
    return null;
}
function validateDomainName(name) {
    if (!name) {
        return {
            field: 'name',
            message: 'Domain name is empty',
            severity: 'error'
        };
    }
    if (name.length > 255) {
        return {
            field: 'name',
            message: `Domain name exceeds 255 characters: ${name.length}`,
            severity: 'error'
        };
    }
    const labels = name.endsWith('.') ? name.slice(0, -1).split('.') : name.split('.');
    for (const label of labels) {
        if (label.length > 63) {
            return {
                field: 'name',
                message: `Label exceeds 63 characters: ${label}`,
                severity: 'error'
            };
        }
        if (!/^[a-zA-Z0-9*-]+$/.test(label)) {
            return {
                field: 'name',
                message: `Label contains invalid characters: ${label}`,
                severity: 'warning'
            };
        }
    }
    return null;
}
function validateRecordType(type) {
    const upperType = type.toUpperCase();
    if (!default_1.VALID_RECORD_TYPES.includes(upperType)) {
        return {
            field: 'type',
            message: `Unknown record type: ${type}`,
            severity: 'warning'
        };
    }
    return null;
}
//# sourceMappingURL=validator.js.map