"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeLocationName = normalizeLocationName;
exports.calculateDistance = calculateDistance;
exports.generateReportNo = generateReportNo;
exports.generateVersion = generateVersion;
exports.generatePruningSuggestion = generatePruningSuggestion;
exports.detectConflicts = detectConflicts;
function normalizeLocationName(name) {
    return name
        .trim()
        .toLowerCase()
        .replace(/[（\(][^）\)]*[）\)]/g, '')
        .replace(/[，,\s\.。、；;：:]/g, '')
        .replace(/[一二三四五六七八九十百千万零〇]/g, '')
        .replace(/路|街|道|巷|弄|号|栋|单元|旁|边|口|处|交叉口|路口|转角/g, '')
        .replace(/的|和|与|及|或|等|及其|周边|附近|旁边|对面/g, '')
        .replace(/\s+/g, '');
}
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function generateReportNo() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `TP${year}${month}${day}${random}`;
}
function generateVersion(existingVersions = []) {
    const majorVersions = existingVersions
        .map(v => parseInt(v.split('.')[0] || '0', 10))
        .filter(v => !isNaN(v));
    const nextMajor = Math.max(0, ...majorVersions) + 1;
    return `${nextMajor}.0`;
}
function generatePruningSuggestion(feedbackContent, locationName) {
    const suggestions = [];
    if (feedbackContent.includes('遮挡') || feedbackContent.includes('挡') || feedbackContent.includes('遮')) {
        suggestions.push('检查树枝遮挡情况，确认遮挡信号灯/标志/视线的具体树枝');
        suggestions.push('优先修剪影响通行安全的下垂枝、横伸枝');
    }
    if (feedbackContent.includes('信号') || feedbackContent.includes('灯')) {
        suggestions.push('修剪后确保信号灯视距不小于50米');
        suggestions.push('保留树枝与灯杆距离至少1.5米安全间距');
    }
    if (feedbackContent.includes('标志') || feedbackContent.includes('牌')) {
        suggestions.push('确保交通标志完整露出，无树枝遮挡');
        suggestions.push('修剪后标志牌边缘与树枝间距不少于30厘米');
    }
    if (feedbackContent.includes('枯') || feedbackContent.includes('死')) {
        suggestions.push('彻底清除枯枝死枝，防止坠落伤人');
        suggestions.push('检查整株树木健康状况，必要时安排病虫害检测');
    }
    if (feedbackContent.includes('长') || feedbackContent.includes('过长')) {
        suggestions.push('回缩过长枝条，保持树形美观与安全平衡');
    }
    if (suggestions.length === 0) {
        suggestions.push('现场勘查后确定具体修剪方案');
        suggestions.push('注意避让电力线路及地下管线');
    }
    suggestions.push('作业前设置安全警示区域');
    suggestions.push('作业后及时清理现场树枝树叶');
    suggestions.push('修剪后3日内安排巡检复核');
    return suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');
}
function detectConflicts(newFeedback, existingFeedbacks) {
    const conflicts = [];
    for (const existing of existingFeedbacks) {
        const contentSimilar = similarText(newFeedback.content || '', existing.content || '');
        const rawContentSimilar = similarText(newFeedback.rawContent || '', existing.rawContent || '');
        if (!contentSimilar && !rawContentSimilar &&
            (newFeedback.content?.length > 10 || existing.content?.length > 10)) {
            conflicts.push({
                locationId: newFeedback.locationId,
                feedbackId: newFeedback.id,
                relatedFeedbackId: existing.id,
                conflictType: 'content_discrepancy',
                description: `同一点位存在不同描述的反馈内容`,
                feedbackValue: (newFeedback.content || newFeedback.rawContent || '').substring(0, 100),
                existingValue: (existing.content || existing.rawContent || '').substring(0, 100),
                suggestedAction: '建议核实两个反馈是否描述同一问题，如为同一问题可合并处理，如为不同问题需分别安排'
            });
        }
        if (newFeedback.priority !== existing.priority) {
            const priorityMap = { urgent: 3, high: 2, medium: 1, low: 0 };
            const diff = Math.abs((priorityMap[newFeedback.priority] ?? 1) - (priorityMap[existing.priority] ?? 1));
            if (diff >= 2) {
                conflicts.push({
                    locationId: newFeedback.locationId,
                    feedbackId: newFeedback.id,
                    relatedFeedbackId: existing.id,
                    conflictType: 'priority',
                    description: `同一点位反馈的优先级差异较大`,
                    feedbackValue: newFeedback.priority,
                    existingValue: existing.priority,
                    suggestedAction: '建议重新评估该点位的紧急程度，确定统一的处理优先级'
                });
            }
        }
    }
    return conflicts;
}
function similarText(a, b) {
    const setA = new Set(a.split(''));
    const setB = new Set(b.split(''));
    const intersection = [...setA].filter(x => setB.has(x));
    return intersection.length / Math.max(setA.size, setB.size) > 0.7;
}
