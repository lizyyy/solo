// @ts-ignore
import spdxParse from 'spdx-expression-parse';
import { LicenseInfo } from './types';

const SPDX_LICENSES = new Set([
  'MIT', 'Apache-2.0', 'ISC', 'BSD-3-Clause', 'BSD-2-Clause',
  'GPL-3.0', 'GPL-2.0', 'LGPL-3.0', 'LGPL-2.1', 'MPL-2.0',
  'CDDL-1.0', 'EPL-2.0', 'Unlicense', 'WTFPL', 'CC0-1.0',
  'CC-BY-4.0', 'CC-BY-3.0', 'Artistic-2.0',
]);

export function parseLicense(licenseStr: string | null | undefined): LicenseInfo {
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
    const parsed = spdxParse(cleaned);
    return parseSpdxAst(parsed, cleaned);
  } catch {
    return parseLegacyLicense(cleaned);
  }
}

function parseSpdxAst(ast: any, original: string): LicenseInfo {
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

function collectLicenses(ast: any): string[] {
  if (ast.license) return [ast.license];
  if (ast.left && ast.right) {
    return [...collectLicenses(ast.left), ...collectLicenses(ast.right)];
  }
  return [];
}

function parseLegacyLicense(licenseStr: string): LicenseInfo {
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

function normalizeLicenseName(name: string): string {
  const mappings: Record<string, string> = {
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

export function isLicenseAllowed(licenseInfo: LicenseInfo, allowedLicenses: string[]): boolean {
  if (!licenseInfo.spdxId) return false;

  if (licenseInfo.isDual) {
    return licenseInfo.alternatives.some(alt =>
      allowedLicenses.some(allowed => matchLicensePattern(alt, allowed))
    );
  }

  return allowedLicenses.some(allowed => matchLicensePattern(licenseInfo.spdxId!, allowed));
}

function matchLicensePattern(license: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return license.startsWith(prefix);
  }
  return license.toLowerCase() === pattern.toLowerCase();
}
