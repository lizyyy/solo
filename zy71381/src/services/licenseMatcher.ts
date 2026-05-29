import type { LicenseDefinition, LicenseMatchResult, RiskLevel } from '../types';
import { db } from '../db';

export class LicenseMatcher {
  private licenseCache: Map<string, LicenseDefinition> = new Map();
  private allLicenses: LicenseDefinition[] = [];

  async init(): Promise<void> {
    this.allLicenses = await db.licenses.toArray();
    this.allLicenses.forEach((lic) => {
      this.licenseCache.set(lic.spdxId.toLowerCase(), lic);
      this.licenseCache.set(lic.shortName.toLowerCase(), lic);
      this.licenseCache.set(lic.fullName.toLowerCase(), lic);
    });
  }

  match(licenseString: string): LicenseMatchResult {
    if (!licenseString || !licenseString.trim()) {
      return {
        license: null,
        confidence: 0,
        isDual: false,
      };
    }

    const trimmed = licenseString.trim();

    const dualMatch = this.parseDualLicense(trimmed);
    if (dualMatch.length > 1) {
      const primary = dualMatch[0];
      const alternatives = dualMatch.slice(1).filter(Boolean) as LicenseDefinition[];

      return {
        license: primary,
        confidence: 95,
        isDual: true,
        alternatives,
      };
    }

    const normalized = this.normalizeSpdx(trimmed);

    const exactMatch = this.licenseCache.get(normalized.toLowerCase());
    if (exactMatch) {
      return {
        license: exactMatch,
        confidence: 100,
        isDual: false,
      };
    }

    const fuzzyMatch = this.fuzzyMatch(normalized);
    if (fuzzyMatch) {
      return {
        license: fuzzyMatch.license,
        confidence: fuzzyMatch.confidence,
        isDual: false,
      };
    }

    const unknown = this.allLicenses.find((l) => l.spdxId === 'UNKNOWN');
    return {
      license: unknown || null,
      confidence: 10,
      isDual: false,
    };
  }

  parseDualLicense(licenseString: string): LicenseDefinition[] {
    const operators = [' OR ', ' or ', ' AND ', ' and ', '|', '&'];
    const results: LicenseDefinition[] = [];

    for (const op of operators) {
      if (licenseString.includes(op)) {
        const parts = licenseString.split(op).map((p) => p.trim());
        for (const part of parts) {
          const match = this.matchSingle(part);
          if (match) {
            results.push(match);
          }
        }
        break;
      }
    }

    if (licenseString.startsWith('(') && licenseString.endsWith(')')) {
      return this.parseDualLicense(licenseString.slice(1, -1));
    }

    return results;
  }

  private matchSingle(licenseStr: string): LicenseDefinition | null {
    const normalized = this.normalizeSpdx(licenseStr);
    const exactMatch = this.licenseCache.get(normalized.toLowerCase());
    if (exactMatch) return exactMatch;

    const fuzzy = this.fuzzyMatch(normalized);
    return fuzzy?.license || null;
  }

  normalizeSpdx(spdx: string): string {
    let normalized = spdx.trim();

    normalized = normalized.replace(/^['"(]|[)"']$/g, '');

    normalized = normalized.replace(/\s+/g, '-');

    const versionMap: Record<string, string> = {
      'v2': '-2.0',
      'v3': '-3.0',
      'v2.1': '-2.1',
      'v1.0': '-1.0',
      'version-2': '-2.0',
      'version-3': '-3.0',
    };

    for (const [from, to] of Object.entries(versionMap)) {
      if (normalized.toLowerCase().includes(from)) {
        normalized = normalized.replace(new RegExp(from, 'gi'), to);
      }
    }

    if (!normalized.includes('-') && /\d+$/.test(normalized)) {
      const match = normalized.match(/^(.*?)(\d+(\.\d+)?)$/);
      if (match) {
        normalized = `${match[1]}-${match[2]}`;
      }
    }

    return normalized;
  }

  private fuzzyMatch(licenseStr: string): { license: LicenseDefinition; confidence: number } | null {
    const lower = licenseStr.toLowerCase();
    let bestMatch: LicenseDefinition | null = null;
    let highestConfidence = 0;

    for (const lic of this.allLicenses) {
      let confidence = 0;

      if (lic.spdxId.toLowerCase() === lower) {
        confidence = 100;
      } else if (lic.shortName.toLowerCase() === lower) {
        confidence = 95;
      } else if (lic.fullName.toLowerCase().includes(lower) || lower.includes(lic.shortName.toLowerCase())) {
        confidence = 70;
      } else if (this.calculateSimilarity(lower, lic.shortName.toLowerCase()) > 0.7) {
        confidence = Math.round(this.calculateSimilarity(lower, lic.shortName.toLowerCase()) * 70);
      }

      if (confidence > highestConfidence && confidence >= 50) {
        highestConfidence = confidence;
        bestMatch = lic;
      }
    }

    if (bestMatch && highestConfidence >= 50) {
      return { license: bestMatch, confidence: highestConfidence };
    }

    return null;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1;

    let edits = 0;
    const matrix: number[][] = [];

    for (let i = 0; i <= shorter.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= longer.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= shorter.length; i++) {
      for (let j = 1; j <= longer.length; j++) {
        if (shorter[i - 1] === longer[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
      edits = matrix[i][longer.length];
    }

    return (longer.length - edits) / longer.length;
  }
}

export const licenseMatcher = new LicenseMatcher();

export function getRiskLevelFromLicense(license: LicenseDefinition | null): RiskLevel {
  return license?.riskLevel || 'unknown';
}
