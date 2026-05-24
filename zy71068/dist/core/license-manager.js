import crypto from 'crypto';
import { readJsonFile, fileExists } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';
export class LicenseManager {
    entries = [];
    async loadFromFile(filePath) {
        logger.info(`加载授权清单: ${filePath}`);
        if (!(await fileExists(filePath))) {
            logger.warn(`授权清单文件不存在: ${filePath}`);
            return [];
        }
        try {
            const data = await readJsonFile(filePath);
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
        }
        catch (error) {
            logger.error(`加载授权清单失败: ${error.message}`);
            throw error;
        }
    }
    getEntries() {
        return this.entries;
    }
    matchFont(font) {
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
    matchFontFamily(familyName) {
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
    checkLicenseValidity(entry, checkDate = new Date()) {
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
    risks = [];
    assessAll(fontFiles, licenses, licenseManager, remoteFontsCount, unmatchedReferences) {
        this.risks = [];
        this.assessMissingLicenses(fontFiles, licenseManager);
        this.assessExpiredLicenses(licenses, licenseManager);
        this.assessRemoteFonts(remoteFontsCount);
        this.assessUnmatchedReferences(unmatchedReferences);
        this.assessVersionConflicts(fontFiles);
        return this.risks;
    }
    addRisk(level, category, message, fontId, details = {}) {
        this.risks.push({
            id: crypto.createHash('md5').update(`${level}-${category}-${message}`).digest('hex'),
            level,
            category,
            message,
            fontId,
            details,
        });
    }
    assessMissingLicenses(fontFiles, licenseManager) {
        const unlicensed = [];
        for (const font of fontFiles) {
            const license = licenseManager.matchFont(font);
            if (!license) {
                unlicensed.push(font.familyName);
                this.addRisk('high', 'missing_license', `字体 "${font.familyName}" 未找到匹配的授权记录`, font.id, { fontFile: font.fileName, format: font.format });
            }
        }
        if (unlicensed.length === 0) {
            this.addRisk('info', 'compliance', '所有字体都有对应的授权记录');
        }
    }
    assessExpiredLicenses(licenses, licenseManager) {
        for (const entry of licenses) {
            const validity = licenseManager.checkLicenseValidity(entry);
            if (!validity.isValid) {
                this.addRisk('critical', 'expired_license', `字体 "${entry.familyName}" 的授权已过期 ${validity.expiredFor} 天`, undefined, { licenseType: entry.licenseType, expiredDays: validity.expiredFor });
            }
            else if (validity.expiresIn && validity.expiresIn <= 30) {
                this.addRisk('medium', 'expiring_license', `字体 "${entry.familyName}" 的授权将在 ${validity.expiresIn} 天后过期`, undefined, { licenseType: entry.licenseType, expiresInDays: validity.expiresIn });
            }
        }
    }
    assessRemoteFonts(count) {
        if (count > 0) {
            this.addRisk('medium', 'remote_font', `检测到 ${count} 个远程字体引用，需要确认是否符合授权条款`, undefined, { remoteFontCount: count });
        }
    }
    assessUnmatchedReferences(references) {
        for (const ref of references) {
            this.addRisk('low', 'unmatched_reference', `字体引用 "${ref.familyName}" 未找到对应的本地字体文件`, undefined, { familyName: ref.familyName });
        }
    }
    assessVersionConflicts(fontFiles) {
        const familyMap = new Map();
        for (const font of fontFiles) {
            const family = font.familyName.toLowerCase();
            if (!familyMap.has(family)) {
                familyMap.set(family, new Map());
            }
            const versionMap = familyMap.get(family);
            const version = font.version || 'unknown';
            if (!versionMap.has(version)) {
                versionMap.set(version, []);
            }
            versionMap.get(version).push(font);
        }
        for (const [family, versionMap] of familyMap) {
            if (versionMap.size > 1) {
                const versions = Array.from(versionMap.keys());
                this.addRisk('medium', 'version_conflict', `字体 "${family}" 存在多个版本: ${versions.join(', ')}`, undefined, { familyName: family, versions });
            }
        }
    }
    getRisksByLevel(risks) {
        const grouped = {
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
    countRisksByLevel(risks) {
        const grouped = this.getRisksByLevel(risks);
        return {
            critical: grouped.critical.length,
            high: grouped.high.length,
            medium: grouped.medium.length,
            low: grouped.low.length,
            info: grouped.info.length,
        };
    }
    shouldFail(risks, failLevel) {
        if (!failLevel)
            return false;
        const levels = ['critical', 'high', 'medium', 'low', 'info'];
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
//# sourceMappingURL=license-manager.js.map