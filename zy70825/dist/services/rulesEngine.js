"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RulesEngineService = void 0;
const overdueRule = {
    id: 'overdue-check',
    name: '超期未还检查',
    check: (item, context) => {
        const issues = [];
        const suggestions = [];
        let status = 'normal';
        if (item.status !== 'returned') {
            const expectedDate = new Date(item.expectedReturnDate);
            const daysOverdue = Math.floor((context.currentDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysOverdue > 0) {
                issues.push(`样品超期 ${daysOverdue} 天未归还`);
                status = daysOverdue > 30 ? 'failed' : 'pending';
                const influencer = context.influencers.get(item.influencerId);
                if (influencer) {
                    suggestions.push(`联系达人 ${influencer.name} (${influencer.contact}) 催收样品`);
                    if (daysOverdue > 14 && influencer.depositAmount > 0) {
                        const deductAmount = Math.min(influencer.depositAmount, item.sampleValue * 0.5);
                        suggestions.push(`超期超过14天，可扣除押金 ${deductAmount} 元`);
                    }
                }
                else {
                    suggestions.push('达人档案缺失，请补充达人信息后再处理');
                }
                if (daysOverdue > 30) {
                    suggestions.push(`超期超过30天，建议标记为丢失，按样品价值 ${item.sampleValue} 元全额索赔`);
                }
            }
        }
        return {
            hasIssue: issues.length > 0,
            status,
            issues,
            suggestions
        };
    }
};
const damageRule = {
    id: 'damage-check',
    name: '破损扣款检查',
    check: (item, context) => {
        const issues = [];
        const suggestions = [];
        let status = 'normal';
        if (item.status === 'damaged') {
            status = 'failed';
            const damageDesc = item.damageDescription || '未描述';
            issues.push(`样品损坏: ${damageDesc}`);
            const influencer = context.influencers.get(item.influencerId);
            if (influencer) {
                const deductAmount = Math.min(influencer.depositAmount, item.sampleValue);
                suggestions.push(`达人 ${influencer.name} 造成样品损坏，扣除押金 ${deductAmount} 元`);
                suggestions.push(`联系达人 ${influencer.contact} 确认赔偿事宜`);
            }
            else {
                suggestions.push(`达人档案缺失，按样品价值 ${item.sampleValue} 元索赔`);
            }
            if (!item.returnPhotos || item.returnPhotos.length === 0) {
                issues.push('缺少损坏照片凭证');
                suggestions.push('请上传回收照片作为损坏凭证');
                status = 'pending';
            }
        }
        return {
            hasIssue: issues.length > 0,
            status,
            issues,
            suggestions
        };
    }
};
const duplicateShipmentRule = {
    id: 'duplicate-check',
    name: '同样品重复寄送检查',
    check: (item, context) => {
        const issues = [];
        const suggestions = [];
        let status = 'normal';
        const historicalDuplicates = context.existingShipments.filter(s => s.sampleId === item.sampleId &&
            s.id !== item.id &&
            s.status !== 'returned');
        const batchDuplicates = context.currentBatchShipments.filter(s => s.sampleId === item.sampleId &&
            s.id !== item.id &&
            s.status !== 'returned');
        const allDuplicates = [...historicalDuplicates, ...batchDuplicates];
        if (allDuplicates.length > 0) {
            status = 'failed';
            const historicalCount = historicalDuplicates.length;
            const batchCount = batchDuplicates.length;
            if (historicalCount > 0 && batchCount > 0) {
                issues.push(`样品 ${item.sampleName} (${item.sampleId}) 存在重复寄送：历史 ${historicalCount} 笔未归还，本批次 ${batchCount} 笔重复`);
            }
            else if (historicalCount > 0) {
                issues.push(`样品 ${item.sampleName} (${item.sampleId}) 已被寄送但未归还，共 ${historicalCount} 笔`);
            }
            else {
                issues.push(`样品 ${item.sampleName} (${item.sampleId}) 在本批次中重复寄送 ${batchCount} 次`);
            }
            suggestions.push('该样品当前处于借出状态，不能重复寄送');
            suggestions.push('请先确认之前的寄送记录是否已归还');
        }
        return {
            hasIssue: issues.length > 0,
            status,
            issues,
            suggestions
        };
    }
};
const missingInfluencerRule = {
    id: 'missing-influencer',
    name: '达人档案缺失检查',
    check: (item, context) => {
        const issues = [];
        const suggestions = [];
        let status = 'normal';
        if (!context.influencers.has(item.influencerId)) {
            status = 'pending';
            issues.push(`达人 ${item.influencerName} (${item.influencerId}) 档案缺失`);
            suggestions.push('请在达人档案中补充该达人信息，包括联系方式和押金金额');
        }
        return {
            hasIssue: issues.length > 0,
            status,
            issues,
            suggestions
        };
    }
};
const returnWithoutPhotoRule = {
    id: 'return-without-photo',
    name: '归还无照片检查',
    check: (item, context) => {
        const issues = [];
        const suggestions = [];
        let status = 'normal';
        if (item.status === 'returned' && (!item.returnPhotos || item.returnPhotos.length === 0)) {
            status = 'pending';
            issues.push('已归还但缺少回收照片');
            suggestions.push('请补充回收照片以确认归还状态');
        }
        return {
            hasIssue: issues.length > 0,
            status,
            issues,
            suggestions
        };
    }
};
class RulesEngineService {
    constructor() {
        this.rules = [
            missingInfluencerRule,
            duplicateShipmentRule,
            damageRule,
            overdueRule,
            returnWithoutPhotoRule
        ];
    }
    processItems(items, influencers, existingShipments, batchId) {
        const context = {
            influencers,
            existingShipments,
            currentBatchShipments: items,
            currentDate: new Date()
        };
        const normalItems = [];
        const pendingItems = [];
        const failedItems = [];
        items.forEach(item => {
            const allIssues = [];
            const allSuggestions = [];
            let finalStatus = 'normal';
            this.rules.forEach(rule => {
                const result = rule.check(item, context);
                if (result.hasIssue) {
                    allIssues.push(...result.issues);
                    allSuggestions.push(...result.suggestions);
                    if (result.status === 'failed') {
                        finalStatus = 'failed';
                    }
                    else if (result.status === 'pending' && finalStatus !== 'failed') {
                        finalStatus = 'pending';
                    }
                }
            });
            const processedItem = {
                original: item,
                status: finalStatus,
                issues: allIssues,
                suggestions: [...new Set(allSuggestions)]
            };
            switch (finalStatus) {
                case 'normal':
                    normalItems.push(processedItem);
                    break;
                case 'pending':
                    pendingItems.push(processedItem);
                    break;
                case 'failed':
                    failedItems.push(processedItem);
                    break;
            }
        });
        return {
            batchId,
            normalItems,
            pendingItems,
            failedItems,
            statistics: {
                total: items.length,
                normal: normalItems.length,
                pending: pendingItems.length,
                failed: failedItems.length
            }
        };
    }
}
exports.RulesEngineService = RulesEngineService;
