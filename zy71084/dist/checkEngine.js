"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckEngine = void 0;
const types_1 = require("./types");
const certificateValidator_1 = require("./certificateValidator");
const bundleMatcher_1 = require("./bundleMatcher");
class CheckEngine {
    static checkProfile(profile, options) {
        const checks = [];
        checks.push(this.checkProfileExpiration(profile, options.warnDaysBeforeExpiration));
        checks.push(this.checkProfileBundleId(profile));
        checks.push(this.checkProfileTeamInfo(profile));
        checks.push(this.checkProfileCertificates(profile));
        const overallStatus = this.getOverallStatus(checks);
        return {
            profile,
            checks,
            overallStatus
        };
    }
    static checkProfileExpiration(profile, warnDays) {
        const now = new Date();
        const daysUntilExpiration = Math.ceil((profile.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (now > profile.expirationDate) {
            return {
                checkName: 'Profile 过期检查',
                status: types_1.CheckStatus.ERROR,
                message: `Profile 已过期`,
                details: `过期时间: ${profile.expirationDate.toLocaleString()}`,
                location: { file: profile.filePath },
                severity: 'critical'
            };
        }
        if (daysUntilExpiration <= warnDays) {
            return {
                checkName: 'Profile 过期检查',
                status: types_1.CheckStatus.WARN,
                message: `Profile 即将过期 (${daysUntilExpiration} 天后)`,
                details: `过期时间: ${profile.expirationDate.toLocaleString()}`,
                location: { file: profile.filePath },
                severity: 'high'
            };
        }
        return {
            checkName: 'Profile 过期检查',
            status: types_1.CheckStatus.PASS,
            message: `Profile 有效，还有 ${daysUntilExpiration} 天过期`,
            details: `过期时间: ${profile.expirationDate.toLocaleString()}`,
            location: { file: profile.filePath },
            severity: 'low'
        };
    }
    static checkProfileBundleId(profile) {
        if (!profile.bundleId) {
            return {
                checkName: 'Profile Bundle ID 检查',
                status: types_1.CheckStatus.ERROR,
                message: 'Profile 缺少 Bundle ID',
                location: { file: profile.filePath },
                severity: 'critical'
            };
        }
        if (profile.bundleId.includes('*')) {
            return {
                checkName: 'Profile Bundle ID 检查',
                status: types_1.CheckStatus.WARN,
                message: 'Profile 使用通配符 Bundle ID',
                details: `Bundle ID: ${profile.bundleId}`,
                location: { file: profile.filePath },
                severity: 'medium'
            };
        }
        return {
            checkName: 'Profile Bundle ID 检查',
            status: types_1.CheckStatus.PASS,
            message: 'Profile Bundle ID 有效',
            details: `Bundle ID: ${profile.bundleId}`,
            location: { file: profile.filePath },
            severity: 'low'
        };
    }
    static checkProfileTeamInfo(profile) {
        if (!profile.teamId) {
            return {
                checkName: 'Profile Team 信息检查',
                status: types_1.CheckStatus.ERROR,
                message: 'Profile 缺少 Team ID',
                location: { file: profile.filePath },
                severity: 'high'
            };
        }
        return {
            checkName: 'Profile Team 信息检查',
            status: types_1.CheckStatus.PASS,
            message: 'Profile Team 信息完整',
            details: `Team ID: ${profile.teamId}, Team Name: ${profile.teamName || 'N/A'}`,
            location: { file: profile.filePath },
            severity: 'low'
        };
    }
    static checkProfileCertificates(profile) {
        if (!profile.developerCertificates || profile.developerCertificates.length === 0) {
            return {
                checkName: 'Profile 证书检查',
                status: types_1.CheckStatus.WARN,
                message: 'Profile 未包含开发者证书',
                location: { file: profile.filePath },
                severity: 'medium'
            };
        }
        return {
            checkName: 'Profile 证书检查',
            status: types_1.CheckStatus.PASS,
            message: `Profile 包含 ${profile.developerCertificates.length} 个证书`,
            location: { file: profile.filePath },
            severity: 'low'
        };
    }
    static checkCertificate(certificate, options) {
        const checks = [];
        checks.push(this.checkCertificateExpiration(certificate, options.warnDaysBeforeExpiration));
        checks.push(this.checkCertificateValidity(certificate));
        checks.push(this.checkCertificateType(certificate));
        checks.push(this.checkCertificateTeamInfo(certificate));
        const overallStatus = this.getOverallStatus(checks);
        return {
            certificate,
            checks,
            overallStatus
        };
    }
    static checkCertificateExpiration(cert, warnDays) {
        const daysLeft = certificateValidator_1.CertificateValidator.getDaysUntilExpiration(cert);
        if (cert.isExpired) {
            return {
                checkName: '证书过期检查',
                status: types_1.CheckStatus.ERROR,
                message: '证书已过期',
                details: `过期时间: ${cert.notAfter.toLocaleString()}`,
                location: { file: cert.filePath },
                severity: 'critical'
            };
        }
        if (daysLeft <= warnDays) {
            return {
                checkName: '证书过期检查',
                status: types_1.CheckStatus.WARN,
                message: `证书即将过期 (${daysLeft} 天后)`,
                details: `过期时间: ${cert.notAfter.toLocaleString()}`,
                location: { file: cert.filePath },
                severity: 'high'
            };
        }
        return {
            checkName: '证书过期检查',
            status: types_1.CheckStatus.PASS,
            message: `证书有效，还有 ${daysLeft} 天过期`,
            details: `过期时间: ${cert.notAfter.toLocaleString()}`,
            location: { file: cert.filePath },
            severity: 'low'
        };
    }
    static checkCertificateValidity(cert) {
        if (!cert.isValid) {
            return {
                checkName: '证书有效性检查',
                status: types_1.CheckStatus.ERROR,
                message: '证书无效',
                details: `有效期: ${cert.notBefore.toLocaleString()} - ${cert.notAfter.toLocaleString()}`,
                location: { file: cert.filePath },
                severity: 'critical'
            };
        }
        return {
            checkName: '证书有效性检查',
            status: types_1.CheckStatus.PASS,
            message: '证书在有效期内',
            location: { file: cert.filePath },
            severity: 'low'
        };
    }
    static checkCertificateType(cert) {
        if (cert.type === 'unknown') {
            return {
                checkName: '证书类型检查',
                status: types_1.CheckStatus.WARN,
                message: '无法识别证书类型',
                details: `Common Name: ${cert.commonName}`,
                location: { file: cert.filePath },
                severity: 'low'
            };
        }
        return {
            checkName: '证书类型检查',
            status: types_1.CheckStatus.PASS,
            message: `证书类型: ${cert.type}`,
            location: { file: cert.filePath },
            severity: 'low'
        };
    }
    static checkCertificateTeamInfo(cert) {
        if (!cert.teamId) {
            return {
                checkName: '证书 Team 信息检查',
                status: types_1.CheckStatus.WARN,
                message: '证书缺少 Team ID',
                details: `Team Name: ${cert.teamName || 'N/A'}`,
                location: { file: cert.filePath },
                severity: 'medium'
            };
        }
        return {
            checkName: '证书 Team 信息检查',
            status: types_1.CheckStatus.PASS,
            message: '证书 Team 信息完整',
            details: `Team ID: ${cert.teamId}, Team Name: ${cert.teamName || 'N/A'}`,
            location: { file: cert.filePath },
            severity: 'low'
        };
    }
    static checkTarget(target, profiles, certificates, options) {
        const checks = [];
        let matchedProfile;
        let matchedCertificate;
        checks.push(this.checkTargetBundleId(target));
        const profileMatch = bundleMatcher_1.BundleMatcher.findMatchingProfile(profiles, target);
        if (profileMatch) {
            matchedProfile = profileMatch.profile;
            checks.push({
                checkName: 'Target Profile 匹配',
                status: profileMatch.confidence === 'exact' ? types_1.CheckStatus.PASS : types_1.CheckStatus.WARN,
                message: profileMatch.reason || `找到匹配的 Profile: ${profileMatch.profile.name}`,
                details: `匹配方式: ${profileMatch.confidence}`,
                location: { file: target.source, line: target.lineNumber },
                severity: profileMatch.confidence === 'exact' ? 'low' : 'medium'
            });
            const certMatch = bundleMatcher_1.BundleMatcher.findMatchingCertificate(certificates, profileMatch.profile);
            if (certMatch) {
                matchedCertificate = certMatch.certificate;
                checks.push({
                    checkName: 'Target Certificate 匹配',
                    status: certMatch.confidence === 'exact' ? types_1.CheckStatus.PASS : types_1.CheckStatus.WARN,
                    message: certMatch.reason || `找到匹配的证书: ${certMatch.certificate.name}`,
                    details: `匹配方式: ${certMatch.confidence}`,
                    location: { file: target.source, line: target.lineNumber },
                    severity: certMatch.confidence === 'exact' ? 'low' : 'medium'
                });
                const teamCheck = bundleMatcher_1.BundleMatcher.checkTeamConsistency(profileMatch.profile, certMatch.certificate);
                checks.push({
                    checkName: 'Target Team 一致性',
                    status: teamCheck.isMatch ? types_1.CheckStatus.PASS : types_1.CheckStatus.ERROR,
                    message: teamCheck.reason || 'Team 一致性检查',
                    location: { file: target.source, line: target.lineNumber },
                    severity: teamCheck.isMatch ? 'low' : 'high'
                });
            }
            else {
                checks.push({
                    checkName: 'Target Certificate 匹配',
                    status: types_1.CheckStatus.ERROR,
                    message: `未找到与 Profile "${profileMatch.profile.name}" 匹配的证书`,
                    details: `Profile Team ID: ${profileMatch.profile.teamId}`,
                    location: { file: target.source, line: target.lineNumber },
                    severity: 'critical'
                });
            }
        }
        else {
            checks.push({
                checkName: 'Target Profile 匹配',
                status: types_1.CheckStatus.ERROR,
                message: `未找到匹配的 Profile`,
                details: `Target Bundle ID: ${target.bundleId}`,
                location: { file: target.source, line: target.lineNumber },
                severity: 'critical'
            });
        }
        if (target.profileName && matchedProfile) {
            if (target.profileName !== matchedProfile.name) {
                checks.push({
                    checkName: 'Target 指定 Profile 校验',
                    status: types_1.CheckStatus.ERROR,
                    message: `指定的 Profile 与实际匹配的不一致`,
                    details: `指定: ${target.profileName}, 实际匹配: ${matchedProfile.name}`,
                    location: { file: target.source, line: target.lineNumber },
                    severity: 'high'
                });
            }
            else {
                checks.push({
                    checkName: 'Target 指定 Profile 校验',
                    status: types_1.CheckStatus.PASS,
                    message: `指定 Profile 匹配正确`,
                    location: { file: target.source, line: target.lineNumber },
                    severity: 'low'
                });
            }
        }
        const overallStatus = this.getOverallStatus(checks);
        return {
            target,
            matchedProfile,
            matchedCertificate,
            checks,
            overallStatus
        };
    }
    static checkTargetBundleId(target) {
        if (!target.bundleId) {
            return {
                checkName: 'Target Bundle ID 检查',
                status: types_1.CheckStatus.ERROR,
                message: 'Target 缺少 Bundle ID',
                location: { file: target.source, line: target.lineNumber },
                severity: 'critical'
            };
        }
        const bundleIdPattern = /^[a-zA-Z0-9.*-]+$/;
        if (!bundleIdPattern.test(target.bundleId)) {
            return {
                checkName: 'Target Bundle ID 检查',
                status: types_1.CheckStatus.ERROR,
                message: 'Target Bundle ID 格式无效',
                details: `Bundle ID: ${target.bundleId}`,
                location: { file: target.source, line: target.lineNumber },
                severity: 'high'
            };
        }
        return {
            checkName: 'Target Bundle ID 检查',
            status: types_1.CheckStatus.PASS,
            message: 'Target Bundle ID 有效',
            details: `Bundle ID: ${target.bundleId}`,
            location: { file: target.source, line: target.lineNumber },
            severity: 'low'
        };
    }
    static runFullCheck(profiles, certificates, targets, options) {
        const profileResults = profiles.map(p => this.checkProfile(p, options));
        const certificateResults = certificates.map(c => this.checkCertificate(c, options));
        const targetResults = targets.map(t => this.checkTarget(t, profiles, certificates, options));
        const allChecks = [
            ...profileResults.flatMap(r => r.checks),
            ...certificateResults.flatMap(r => r.checks),
            ...targetResults.flatMap(r => r.checks)
        ];
        const summary = {
            total: allChecks.length,
            passed: allChecks.filter(c => c.status === types_1.CheckStatus.PASS).length,
            warnings: allChecks.filter(c => c.status === types_1.CheckStatus.WARN).length,
            errors: allChecks.filter(c => c.status === types_1.CheckStatus.ERROR).length,
            skipped: allChecks.filter(c => c.status === types_1.CheckStatus.SKIP).length
        };
        const hasErrors = summary.errors > 0;
        const hasWarnings = summary.warnings > 0;
        const exitCode = hasErrors ? 2 : (hasWarnings && options.strictMode ? 1 : 0);
        return {
            generatedAt: new Date(),
            options,
            profiles: profileResults,
            certificates: certificateResults,
            targets: targetResults,
            summary,
            exitCode
        };
    }
    static getOverallStatus(checks) {
        if (checks.some(c => c.status === types_1.CheckStatus.ERROR)) {
            return types_1.CheckStatus.ERROR;
        }
        if (checks.some(c => c.status === types_1.CheckStatus.WARN)) {
            return types_1.CheckStatus.WARN;
        }
        return types_1.CheckStatus.PASS;
    }
}
exports.CheckEngine = CheckEngine;
//# sourceMappingURL=checkEngine.js.map