"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assessSiteRisk = assessSiteRisk;
exports.getActionRequired = getActionRequired;
exports.isSiteReassignable = isSiteReassignable;
exports.findAvailableReplacementSites = findAvailableReplacementSites;
const storage_1 = require("../storage");
const RISK_ASSESSMENT_RULES = [
    {
        id: 'rule-elevation-critical',
        name: '极低海拔 critical',
        condition: (site, weather) => {
            if (site.elevation < 10 && site.type === 'LOW_LYING' && weather.severity === 'EXTREME') {
                return 'CRITICAL';
            }
            return 'NO_RISK';
        },
        priority: 1
    },
    {
        id: 'rule-water-distance-high',
        name: '近水源高风险',
        condition: (site, weather) => {
            if (site.distanceToWater < 20 && weather.severity === 'EXTREME') {
                return 'HIGH';
            }
            return 'NO_RISK';
        },
        priority: 2
    },
    {
        id: 'rule-low-lying-severe',
        name: '低洼营位中风险',
        condition: (site, weather) => {
            if (site.type === 'LOW_LYING' && ['SEVERE', 'EXTREME'].includes(weather.severity)) {
                return 'MEDIUM';
            }
            return 'NO_RISK';
        },
        priority: 3
    },
    {
        id: 'rule-standard-moderate',
        name: '标准营位低风险',
        condition: (site, weather) => {
            if (site.type === 'STANDARD' && weather.severity === 'EXTREME') {
                return 'LOW';
            }
            return 'NO_RISK';
        },
        priority: 4
    },
    {
        id: 'rule-elevated-safe',
        name: '高地营位安全',
        condition: (site, weather) => {
            if (site.type === 'ELEVATED' || site.type === 'PREMIUM') {
                return 'NO_RISK';
            }
            return 'NO_RISK';
        },
        priority: 5
    }
];
const RISK_LEVEL_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NO_RISK'];
function assessSiteRisk(site, weatherAlert) {
    const results = RISK_ASSESSMENT_RULES
        .sort((a, b) => a.priority - b.priority)
        .map(rule => rule.condition(site, weatherAlert))
        .filter(level => level !== 'NO_RISK');
    if (results.length === 0) {
        return 'NO_RISK';
    }
    return results.reduce((highest, current) => {
        const highestIndex = RISK_LEVEL_ORDER.indexOf(highest);
        const currentIndex = RISK_LEVEL_ORDER.indexOf(current);
        return currentIndex < highestIndex ? current : highest;
    }, 'NO_RISK');
}
function getActionRequired(riskLevel) {
    switch (riskLevel) {
        case 'CRITICAL':
            return 'EVACUATE';
        case 'HIGH':
            return 'REASSIGN';
        case 'MEDIUM':
            return 'MONITOR';
        case 'LOW':
            return 'MONITOR';
        case 'NO_RISK':
        default:
            return 'NONE';
    }
}
function isSiteReassignable(siteId) {
    const site = storage_1.storage.getSite(siteId);
    if (!site)
        return false;
    if (site.isLocked)
        return false;
    if (site.isOccupied)
        return false;
    const activeLocks = storage_1.storage.getActiveLocksBySite(siteId);
    return activeLocks.length === 0;
}
function findAvailableReplacementSites(originalSiteId) {
    const originalSite = storage_1.storage.getSite(originalSiteId);
    if (!originalSite)
        return [];
    const allSites = storage_1.storage.getAllSites();
    return allSites.filter(site => {
        if (site.siteId === originalSiteId)
            return false;
        if (!isSiteReassignable(site.siteId))
            return false;
        const elevatedRisk = assessSiteRisk(site, {
            alertId: 'temp-check',
            alertType: 'RAIN',
            severity: 'EXTREME',
            validFrom: new Date().toISOString(),
            validTo: new Date().toISOString(),
            description: 'Temporary check'
        });
        return ['NO_RISK', 'LOW'].includes(elevatedRisk);
    }).sort((a, b) => {
        if (a.type === 'ELEVATED' && b.type !== 'ELEVATED')
            return -1;
        if (b.type === 'ELEVATED' && a.type !== 'ELEVATED')
            return 1;
        return a.elevation - b.elevation;
    });
}
//# sourceMappingURL=riskService.js.map