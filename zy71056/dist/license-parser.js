"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLicense = parseLicense;
exports.isLicenseAllowed = isLicenseAllowed;
// @ts-ignore
const spdx_expression_parse_1 = __importDefault(require("spdx-expression-parse"));
const SPDX_LICENSES = new Set([
    'MIT', 'Apache-2.0', 'ISC', 'BSD-3-Clause', 'BSD-2-Clause',
    'GPL-3.0', 'GPL-2.0', 'LGPL-3.0', 'LGPL-2.1', 'MPL-2.0',
    'CDDL-1.0', 'EPL-2.0', 'Unlicense', 'WTFPL', 'CC0-1.0',
    'CC-BY-4.0', 'CC-BY-3.0', 'Artistic-2.0',
]);
function parseLicense(licenseStr) {
    if (!licenseStr) {
        return {
            name: 'UNKNOWN',
            spdxId: null,
            isValid: false,
            isDual: false,
            alternatives: [],
        };
    }
    const cleaned = licenseStr.trim();
    try {
        const parsed = (0, spdx_expression_parse_1.default)(cleaned);
        return parseSpdxAst(parsed, cleaned);
    }
    catch {
        return parseLegacyLicense(cleaned);
    }
}
function parseSpdxAst(ast, original) {
    if (ast.license) {
        return {
            name: ast.license,
            spdxId: ast.license,
            isValid: SPDX_LICENSES.has(ast.license),
            isDual: false,
            alternatives: [ast.license],
        };
    }
    if (ast.conjunction === 'or' || ast.conjunction === 'and') {
        const alternatives = collectLicenses(ast);
        return {
            name: original,
            spdxId: original,
            isValid: alternatives.every(l => SPDX_LICENSES.has(l)),
            isDual: ast.conjunction === 'or',
            alternatives,
        };
    }
    return {
        name: original,
        spdxId: original,
        isValid: false,
        isDual: false,
        alternatives: [original],
    };
}
function collectLicenses(ast) {
    if (ast.license)
        return [ast.license];
    if (ast.left && ast.right) {
        return [...collectLicenses(ast.left), ...collectLicenses(ast.right)];
    }
    return [];
}
function parseLegacyLicense(licenseStr) {
    const upper = licenseStr.toUpperCase();
    const dualPatterns = [
        /(.+?)\s*(?:\/|\|+|OR)\s*(.+)/i,
        /(.+?)\s+OR\s+(.+)/i,
    ];
    for (const pattern of dualPatterns) {
        const match = licenseStr.match(pattern);
        if (match) {
            const alternatives = [match[1].trim(), match[2].trim()].map(normalizeLicenseName);
            return {
                name: licenseStr,
                spdxId: alternatives.join(' OR '),
                isValid: alternatives.every(l => SPDX_LICENSES.has(l)),
                isDual: true,
                alternatives,
            };
        }
    }
    const normalized = normalizeLicenseName(licenseStr);
    return {
        name: licenseStr,
        spdxId: normalized,
        isValid: SPDX_LICENSES.has(normalized),
        isDual: false,
        alternatives: [normalized],
    };
}
function normalizeLicenseName(name) {
    const mappings = {
        'MIT': 'MIT',
        'APACHE': 'Apache-2.0',
        'APACHE 2.0': 'Apache-2.0',
        'APACHE-2.0': 'Apache-2.0',
        'APACHE2': 'Apache-2.0',
        'ISC': 'ISC',
        'BSD': 'BSD-3-Clause',
        'BSD-3-CLAUSE': 'BSD-3-Clause',
        'GPL': 'GPL-3.0',
        'GPL3': 'GPL-3.0',
        'UNLICENSED': 'UNLICENSED',
    };
    const upper = name.toUpperCase().trim();
    return mappings[upper] || name.trim();
}
function isLicenseAllowed(licenseInfo, allowedLicenses) {
    if (!licenseInfo.spdxId)
        return false;
    if (licenseInfo.isDual) {
        return licenseInfo.alternatives.some(alt => allowedLicenses.some(allowed => matchLicensePattern(alt, allowed)));
    }
    return allowedLicenses.some(allowed => matchLicensePattern(licenseInfo.spdxId, allowed));
}
function matchLicensePattern(license, pattern) {
    if (pattern === '*')
        return true;
    if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        return license.startsWith(prefix);
    }
    return license.toLowerCase() === pattern.toLowerCase();
}
