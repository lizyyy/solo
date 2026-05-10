const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const RULE_VERSIONS = {
    COMPATIBILITY_CALCULATION: '1.0',
    ROLLBACK_WINDOW: '1.0',
    IMPACT_ASSESSMENT: '1.0',
    SUBSCRIPTION_AUTO_CREATE: '1.0',
    DEADLINE_CALCULATION: '1.0'
};

const logDecision = async (ruleName, ruleVersion, inputContext, decisionResult, metadata = {}) => {
    const decisionId = uuidv4();
    const query = `
        INSERT INTO rule_decision_logs 
        (decision_id, rule_name, rule_version, input_context, decision_result, 
         trigger_source, related_notice_id, related_confirmation_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    await db.query(query, [
        decisionId,
        ruleName,
        ruleVersion,
        JSON.stringify(inputContext),
        JSON.stringify(decisionResult),
        metadata.triggerSource || null,
        metadata.noticeId || null,
        metadata.confirmationId || null
    ]);
    
    return {
        decisionId,
        ruleName,
        ruleVersion,
        inputContext,
        decisionResult,
        timestamp: new Date().toISOString()
    };
};

const calculateCompatibilityPeriod = (input) => {
    const {
        changeType,
        isBreakingChange,
        dependencyStrength,
        changeDate,
        customStartDate,
        customEndDate
    } = input;

    const decisionContext = {
        ruleName: 'COMPATIBILITY_CALCULATION',
        inputs: { changeType, isBreakingChange, dependencyStrength, changeDate, customStartDate, customEndDate }
    };

    if (customStartDate && customEndDate) {
        return {
            ...decisionContext,
            decision: {
                method: 'CUSTOM_SPECIFIED',
                compatibilityStartDate: customStartDate,
                compatibilityEndDate: customEndDate,
                compatibilityDays: Math.ceil((new Date(customEndDate) - new Date(customStartDate)) / (1000 * 60 * 60 * 24)),
                ruleApplied: '用户自定义兼容期'
            }
        };
    }

    let baseDays = 30;
    
    if (isBreakingChange) {
        baseDays = changeType === 'MAJOR_UPGRADE' ? 90 : 60;
    } else {
        baseDays = changeType === 'PATCH' ? 7 : 30;
    }

    const strengthMultiplier = {
        'CRITICAL': 2,
        'HIGH': 1.5,
        'NORMAL': 1,
        'LOW': 0.5
    };

    const finalDays = Math.ceil(baseDays * (strengthMultiplier[dependencyStrength] || 1));
    const startDate = new Date(changeDate);
    const endDate = new Date(startDate.getTime() + finalDays * 24 * 60 * 60 * 1000);

    return {
        ...decisionContext,
        decision: {
            method: 'RULE_BASED_CALCULATION',
            compatibilityStartDate: startDate.toISOString(),
            compatibilityEndDate: endDate.toISOString(),
            compatibilityDays: finalDays,
            baseDays,
            strengthMultiplier: strengthMultiplier[dependencyStrength] || 1,
            ruleApplied: isBreakingChange 
                ? '破坏性变更兼容期规则' 
                : `普通变更兼容期规则 (${changeType})`
        }
    };
};

const calculateRollbackWindow = (input) => {
    const {
        changeType,
        isBreakingChange,
        compatibilityEndDate,
        customRollbackEndDate
    } = input;

    const decisionContext = {
        ruleName: 'ROLLBACK_WINDOW',
        inputs: { changeType, isBreakingChange, compatibilityEndDate, customRollbackEndDate }
    };

    if (customRollbackEndDate) {
        return {
            ...decisionContext,
            decision: {
                method: 'CUSTOM_SPECIFIED',
                rollbackWindowEndDate: customRollbackEndDate,
                ruleApplied: '用户自定义回滚窗口'
            }
        };
    }

    let rollbackDays = isBreakingChange ? 14 : 7;
    const baseDate = new Date(compatibilityEndDate);
    const rollbackEndDate = new Date(baseDate.getTime() + rollbackDays * 24 * 60 * 60 * 1000);

    return {
        ...decisionContext,
        decision: {
            method: 'RULE_BASED_CALCULATION',
            rollbackWindowEndDate: rollbackEndDate.toISOString(),
            rollbackWindowDays: rollbackDays,
            ruleApplied: isBreakingChange 
                ? '破坏性变更14天回滚窗口规则' 
                : '普通变更7天回滚窗口规则'
        }
    };
};

const assessImpact = (input) => {
    const {
        isBreakingChange,
        changeType,
        dependencyStrength,
        downstreamCount,
        affectedVersions
    } = input;

    const decisionContext = {
        ruleName: 'IMPACT_ASSESSMENT',
        inputs: { isBreakingChange, changeType, dependencyStrength, downstreamCount, affectedVersions }
    };

    let severityScore = 0;
    const factors = [];

    if (isBreakingChange) {
        severityScore += 40;
        factors.push({ factor: '破坏性变更', points: 40 });
    }

    const typeScores = {
        'MAJOR_UPGRADE': 30,
        'MINOR_UPGRADE': 15,
        'PATCH': 5,
        'CONFIG_CHANGE': 10,
        'DEPRECATION': 25
    };
    const typeScore = typeScores[changeType] || 10;
    severityScore += typeScore;
    factors.push({ factor: `变更类型: ${changeType}`, points: typeScore });

    const strengthScores = {
        'CRITICAL': 20,
        'HIGH': 10,
        'NORMAL': 5,
        'LOW': 2
    };
    const strengthScore = strengthScores[dependencyStrength] || 5;
    severityScore += strengthScore;
    factors.push({ factor: `依赖强度: ${dependencyStrength}`, points: strengthScore });

    const downstreamFactor = Math.min(downstreamCount * 2, 20);
    severityScore += downstreamFactor;
    factors.push({ factor: `下游服务数: ${downstreamCount}`, points: downstreamFactor });

    let impactLevel = 'LOW';
    if (severityScore >= 80) impactLevel = 'CRITICAL';
    else if (severityScore >= 60) impactLevel = 'HIGH';
    else if (severityScore >= 30) impactLevel = 'MEDIUM';

    return {
        ...decisionContext,
        decision: {
            impactLevel,
            severityScore,
            factors,
            downstreamCount,
            affectedVersions: affectedVersions || [],
            ruleApplied: '多维度影响评分模型'
        }
    };
};

const determineAutoSubscribeDownstreams = (input) => {
    const {
        upstreamServiceId,
        dependencies,
        notice
    } = input;

    const decisionContext = {
        ruleName: 'SUBSCRIPTION_AUTO_CREATE',
        inputs: { upstreamServiceId, notice }
    };

    const eligibleDownstreams = dependencies
        .filter(dep => dep.is_active)
        .filter(dep => {
            if (!dep.min_compatible_version && !dep.max_compatible_version) return true;
            
            const newVersion = notice.new_version;
            if (dep.min_compatible_version && versionCompare(newVersion, dep.min_compatible_version) < 0) {
                return false;
            }
            if (dep.max_compatible_version && versionCompare(newVersion, dep.max_compatible_version) > 0) {
                return false;
            }
            return true;
        });

    return {
        ...decisionContext,
        decision: {
            totalDownstreams: dependencies.length,
            eligibleDownstreams: eligibleDownstreams.length,
            autoSubscribeServices: eligibleDownstreams.map(d => ({
                serviceId: d.downstream_service_id,
                dependencyType: d.dependency_type,
                dependencyStrength: d.dependency_strength,
                versionConstraint: {
                    min: d.min_compatible_version,
                    max: d.max_compatible_version
                }
            })),
            excludedServices: dependencies
                .filter(d => !eligibleDownstreams.includes(d))
                .map(d => ({
                    serviceId: d.downstream_service_id,
                    reason: d.is_active ? '版本不兼容' : '依赖已停用'
                })),
            ruleApplied: '活跃依赖 + 版本兼容性检查'
        }
    };
};

const calculateDeadlines = (input) => {
    const {
        notice,
        subscription,
        confirmationDate
    } = input;

    const decisionContext = {
        ruleName: 'DEADLINE_CALCULATION',
        inputs: { notice, subscription }
    };

    const compatibilityStart = new Date(notice.compatibility_start_date || notice.change_date);
    const compatibilityEnd = new Date(notice.compatibility_end_date);
    const rollbackEnd = new Date(notice.rollback_window_end_date);
    
    const now = new Date();
    const daysUntilCompatibilityEnd = Math.ceil((compatibilityEnd - now) / (1000 * 60 * 60 * 24));
    const daysUntilRollbackEnd = Math.ceil((rollbackEnd - now) / (1000 * 60 * 60 * 24));
    const compatibilityDuration = Math.ceil((compatibilityEnd - compatibilityStart) / (1000 * 60 * 60 * 24));

    let status = 'ONGOING';
    if (now > rollbackEnd) status = 'EXPIRED';
    else if (now > compatibilityEnd) status = 'ROLLBACK_ONLY';
    else if (daysUntilCompatibilityEnd <= 7) status = 'URGENT';
    else if (daysUntilCompatibilityEnd <= 14) status = 'APPROACHING';

    return {
        ...decisionContext,
        decision: {
            compatibilityStartDate: compatibilityStart.toISOString(),
            compatibilityEndDate: compatibilityEnd.toISOString(),
            rollbackWindowEndDate: rollbackEnd.toISOString(),
            compatibilityDurationDays: compatibilityDuration,
            daysUntilCompatibilityEnd: Math.max(0, daysUntilCompatibilityEnd),
            daysUntilRollbackEnd: Math.max(0, daysUntilRollbackEnd),
            deadlineStatus: status,
            confirmedAt: confirmationDate || null,
            ruleApplied: '时间轴阶段判定规则'
        }
    };
};

const versionCompare = (v1, v2) => {
    const parts1 = v1.replace(/[^\d.]/g, '').split('.').map(Number);
    const parts2 = v2.replace(/[^\d.]/g, '').split('.').map(Number);
    
    const maxLen = Math.max(parts1.length, parts2.length);
    for (let i = 0; i < maxLen; i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 !== p2) return p1 - p2;
    }
    return 0;
};

module.exports = {
    RULE_VERSIONS,
    logDecision,
    calculateCompatibilityPeriod,
    calculateRollbackWindow,
    assessImpact,
    determineAutoSubscribeDownstreams,
    calculateDeadlines,
    versionCompare
};
