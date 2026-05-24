import fs from 'fs/promises';
import crypto from 'crypto';
import { LicenseEntry, FontFile, Risk, RiskLevel } from '../types.js';
import { readJsonFile, fileExists } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';

interface LicenseFileFormat {
  licenses: Array<{
    familyName: string;
    alternativeNames?: string[];
    licenseType: string;
    version?: string;
    validFrom?: string;
    validUntil?: string;
    permittedUses?: string[];
    restrictions?: string[];
    sourceUrl?: string;
    attribution?: string;
  }>;
}

export class LicenseManager {
  private entries: LicenseEntry[] = [];

  async loadFromFile(filePath: string): Promise<LicenseEntry[]> {
    logger.info(`加载授权清单: ${filePath}`);

    if (!(await fileExists(filePath))) {
      logger.warn(`授权清单文件不存在: ${filePath}`);
      return [];
    }

    try {
      const data = await readJsonFile<LicenseFileFormat>(filePath);

      if (!data.licenses || !Array.isArray(data.licenses)) {
        throw new Error('授权清单格式错误：缺少 licenses 数组');
      }

      this.entries = data.licenses.map((item) => ({
        id: crypto.createHash('md5').update(item.familyName).digest('hex'),
        familyName: item.familyName,
        alternativeNames: item.alternativeNames || [],
        licenseType: item.licenseType,
        version: item.version,
        validFrom: item.validFrom ? new Date(item.validFrom) : undefined,
        validUntil: item.validUntil ? new Date(item.validUntil) : undefined,
        permittedUses: item.permittedUses || [],
        restrictions: item.restrictions || [],
        sourceUrl: item.sourceUrl,
        attribution: item.attribution,
      }));

      logger.success(`加载完成，共 ${this.entries.length} 条授权记录`);
      return this.entries;
    } catch (error) {
      logger.error(`加载授权清单失败: ${(error as Error).message}`);
      throw error;
    }
  }

  getEntries(): LicenseEntry[] {
    return this.entries;
  }

  matchFont(font: FontFile): LicenseEntry | null {
    const fontName = font.familyName.toLowerCase();
    const fontVersion = font.version;

    for (const entry of this.entries) {
      const namesToCheck = [entry.familyName.toLowerCase(), ...entry.alternativeNames.map((n) => n.toLowerCase())];

      for (const name of namesToCheck) {
        if (fontName === name || fontName.includes(name) || name.includes(fontName)) {
          if (entry.version && fontVersion && entry.version !== fontVersion) {
            continue;
          }
          return entry;
        }
      }
    }

    return null;
  }

  matchFontFamily(familyName: string): LicenseEntry | null {
    const searchName = familyName.toLowerCase();

    for (const entry of this.entries) {
      const namesToCheck = [entry.familyName.toLowerCase(), ...entry.alternativeNames.map((n) => n.toLowerCase())];

      for (const name of namesToCheck) {
        if (searchName === name || searchName.includes(name) || name.includes(searchName)) {
          return entry;
        }
      }
    }

    return null;
  }

  checkLicenseValidity(entry: LicenseEntry, checkDate: Date = new Date()): {
    isValid: boolean;
    expiresIn?: number;
    expiredFor?: number;
  } {
    if (!entry.validUntil) {
      return { isValid: true };
    }

    const now = checkDate.getTime();
    const until = entry.validUntil.getTime();

    if (now > until) {
      const expiredFor = Math.floor((now - until) / (1000 * 60 * 60 * 24));
      return { isValid: false, expiredFor };
    }

    const expiresIn = Math.ceil((until - now) / (1000 * 60 * 60 * 24));
    return { isValid: true, expiresIn };
  }
}

export class RiskAssessor {
  private risks: Risk[] = [];

  assessAll(
    fontFiles: FontFile[],
    licenses: LicenseEntry[],
    licenseManager: LicenseManager,
    remoteFontsCount: number,
    unmatchedReferences: { familyName: string }[]
  ): Risk[] {
    this.risks = [];

    this.assessMissingLicenses(fontFiles, licenseManager);
    this.assessExpiredLicenses(licenses, licenseManager);
    this.assessRemoteFonts(remoteFontsCount);
    this.assessUnmatchedReferences(unmatchedReferences);
    this.assessVersionConflicts(fontFiles);

    return this.risks;
  }

  private addRisk(
    level: RiskLevel,
    category: string,
    message: string,
    fontId?: string,
    details: Record<string, unknown> = {}
  ): void {
    this.risks.push({
      id: crypto.createHash('md5').update(`${level}-${category}-${message}`).digest('hex'),
      level,
      category,
      message,
      fontId,
      details,
    });
  }

  private assessMissingLicenses(fontFiles: FontFile[], licenseManager: LicenseManager): void {
    const unlicensed: string[] = [];

    for (const font of fontFiles) {
      const license = licenseManager.matchFont(font);
      if (!license) {
        unlicensed.push(font.familyName);
        this.addRisk(
          'high',
          'missing_license',
          `字体 "${font.familyName}" 未找到匹配的授权记录`,
          font.id,
          { fontFile: font.fileName, format: font.format }
        );
      }
    }

    if (unlicensed.length === 0) {
      this.addRisk('info', 'compliance', '所有字体都有对应的授权记录');
    }
  }

  private assessExpiredLicenses(licenses: LicenseEntry[], licenseManager: LicenseManager): void {
    for (const entry of licenses) {
      const validity = licenseManager.checkLicenseValidity(entry);

      if (!validity.isValid) {
        this.addRisk(
          'critical',
          'expired_license',
          `字体 "${entry.familyName}" 的授权已过期 ${validity.expiredFor} 天`,
          undefined,
          { licenseType: entry.licenseType, expiredDays: validity.expiredFor }
        );
      } else if (validity.expiresIn && validity.expiresIn <= 30) {
        this.addRisk(
          'medium',
          'expiring_license',
          `字体 "${entry.familyName}" 的授权将在 ${validity.expiresIn} 天后过期`,
          undefined,
          { licenseType: entry.licenseType, expiresInDays: validity.expiresIn }
        );
      }
    }
  }

  private assessRemoteFonts(count: number): void {
    if (count > 0) {
      this.addRisk(
        'medium',
        'remote_font',
        `检测到 ${count} 个远程字体引用，需要确认是否符合授权条款`,
        undefined,
        { remoteFontCount: count }
      );
    }
  }

  private assessUnmatchedReferences(references: { familyName: string }[]): void {
    for (const ref of references) {
      this.addRisk(
        'low',
        'unmatched_reference',
        `字体引用 "${ref.familyName}" 未找到对应的本地字体文件`,
        undefined,
        { familyName: ref.familyName }
      );
    }
  }

  private assessVersionConflicts(fontFiles: FontFile[]): void {
    const familyMap = new Map<string, Map<string, FontFile[]>>();

    for (const font of fontFiles) {
      const family = font.familyName.toLowerCase();
      if (!familyMap.has(family)) {
        familyMap.set(family, new Map());
      }
      const versionMap = familyMap.get(family)!;
      const version = font.version || 'unknown';
      if (!versionMap.has(version)) {
        versionMap.set(version, []);
      }
      versionMap.get(version)!.push(font);
    }

    for (const [family, versionMap] of familyMap) {
      if (versionMap.size > 1) {
        const versions = Array.from(versionMap.keys());
        this.addRisk(
          'medium',
          'version_conflict',
          `字体 "${family}" 存在多个版本: ${versions.join(', ')}`,
          undefined,
          { familyName: family, versions }
        );
      }
    }
  }

  getRisksByLevel(risks: Risk[]): Record<RiskLevel, Risk[]> {
    const grouped: Record<RiskLevel, Risk[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: [],
    };

    for (const risk of risks) {
      grouped[risk.level].push(risk);
    }

    return grouped;
  }

  countRisksByLevel(risks: Risk[]): Record<RiskLevel, number> {
    const grouped = this.getRisksByLevel(risks);
    return {
      critical: grouped.critical.length,
      high: grouped.high.length,
      medium: grouped.medium.length,
      low: grouped.low.length,
      info: grouped.info.length,
    };
  }

  shouldFail(risks: Risk[], failLevel: RiskLevel | null): boolean {
    if (!failLevel) return false;

    const levels: RiskLevel[] = ['critical', 'high', 'medium', 'low', 'info'];
    const failIndex = levels.indexOf(failLevel);

    for (let i = 0; i <= failIndex; i++) {
      const level = levels[i];
      if (risks.some((r) => r.level === level)) {
        return true;
      }
    }

    return false;
  }
}
