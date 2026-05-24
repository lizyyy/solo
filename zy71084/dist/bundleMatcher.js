"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BundleMatcher = void 0;
class BundleMatcher {
    static matchBundleId(profileBundleId, targetBundleId) {
        if (profileBundleId === targetBundleId) {
            return {
                isMatch: true,
                confidence: 'exact',
                reason: 'Bundle ID 完全匹配'
            };
        }
        if (profileBundleId.includes('*')) {
            return this.matchWildcard(profileBundleId, targetBundleId);
        }
        return {
            isMatch: false,
            confidence: 'none',
            reason: `Bundle ID 不匹配: Profile="${profileBundleId}", Target="${targetBundleId}"`
        };
    }
    static matchWildcard(pattern, value) {
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);
        if (regex.test(value)) {
            return {
                isMatch: true,
                confidence: 'wildcard',
                reason: `通配符匹配: Pattern="${pattern}", Value="${value}"`
            };
        }
        return {
            isMatch: false,
            confidence: 'none',
            reason: `通配符不匹配: Pattern="${pattern}", Value="${value}"`
        };
    }
    static findMatchingProfile(profiles, target) {
        let bestMatch = null;
        for (const profile of profiles) {
            const match = this.matchBundleId(profile.bundleId, target.bundleId);
            if (match.isMatch) {
                const result = {
                    ...match,
                    profile
                };
                if (match.confidence === 'exact') {
                    return result;
                }
                if (!bestMatch || this.isBetterMatch(match.confidence, bestMatch.confidence)) {
                    bestMatch = result;
                }
            }
        }
        return bestMatch;
    }
    static isBetterMatch(current, existing) {
        const priority = { exact: 3, wildcard: 2, none: 1 };
        return (priority[current] || 0) > (priority[existing] || 0);
    }
    static findMatchingCertificate(certificates, profile) {
        for (const cert of certificates) {
            if (profile.teamId && cert.teamId && profile.teamId === cert.teamId) {
                return {
                    isMatch: true,
                    confidence: 'exact',
                    certificate: cert,
                    reason: `Team ID 匹配: ${cert.teamId}`
                };
            }
        }
        for (const cert of certificates) {
            if (profile.teamName && cert.teamName && profile.teamName === cert.teamName) {
                return {
                    isMatch: true,
                    confidence: 'wildcard',
                    certificate: cert,
                    reason: `Team Name 匹配: ${cert.teamName}`
                };
            }
        }
        return null;
    }
    static checkTeamConsistency(profile, certificate) {
        if (profile.teamId && certificate.teamId) {
            if (profile.teamId === certificate.teamId) {
                return {
                    isMatch: true,
                    confidence: 'exact',
                    reason: `Team ID 一致: ${profile.teamId}`
                };
            }
            else {
                return {
                    isMatch: false,
                    confidence: 'none',
                    reason: `Team ID 不一致: Profile="${profile.teamId}", Certificate="${certificate.teamId}"`
                };
            }
        }
        if (profile.teamName && certificate.teamName) {
            if (profile.teamName === certificate.teamName) {
                return {
                    isMatch: true,
                    confidence: 'wildcard',
                    reason: `Team Name 一致: ${profile.teamName}`
                };
            }
        }
        return {
            isMatch: false,
            confidence: 'none',
            reason: '无法验证 Team 一致性'
        };
    }
    static detectWildcardIssues(profiles, targets) {
        const issues = [];
        for (const target of targets) {
            for (const profile of profiles) {
                const match = this.matchBundleId(profile.bundleId, target.bundleId);
                if (match.isMatch && match.confidence === 'wildcard') {
                    const hasExactMatch = profiles.some(p => this.matchBundleId(p.bundleId, target.bundleId).confidence === 'exact');
                    if (!hasExactMatch) {
                        issues.push({
                            target,
                            profile,
                            issue: `Target "${target.name}" 使用通配符 Profile "${profile.name}"`,
                            suggestion: '建议为该 Bundle ID 创建专用的 Profile，避免权限过度开放'
                        });
                    }
                }
            }
        }
        return issues;
    }
    static detectCrossTargetConflicts(targets, profiles) {
        const conflicts = [];
        for (const profile of profiles) {
            const matchingTargets = [];
            for (const target of targets) {
                const match = this.matchBundleId(profile.bundleId, target.bundleId);
                if (match.isMatch) {
                    matchingTargets.push(target);
                }
            }
            if (matchingTargets.length > 1) {
                conflicts.push({
                    targets: matchingTargets,
                    profile,
                    issue: `Profile "${profile.name}" 被 ${matchingTargets.length} 个 Target 共享使用`
                });
            }
        }
        return conflicts;
    }
}
exports.BundleMatcher = BundleMatcher;
//# sourceMappingURL=bundleMatcher.js.map