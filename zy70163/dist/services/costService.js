"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateRetrievalCost = estimateRetrievalCost;
exports.estimateTransitionCost = estimateTransitionCost;
exports.estimateDeletionCost = estimateDeletionCost;
const types_1 = require("../models/types");
const PRICING = {
    [types_1.StorageClass.STANDARD]: {
        storagePerGB: 0.023,
        retrievalPerGB: 0.0004,
        transitionPerObject: 0.0001,
        deletionPerObject: 0
    },
    [types_1.StorageClass.INFREQUENT_ACCESS]: {
        storagePerGB: 0.0125,
        retrievalPerGB: 0.01,
        transitionPerObject: 0.0001,
        deletionPerObject: 0
    },
    [types_1.StorageClass.ARCHIVE]: {
        storagePerGB: 0.004,
        retrievalPerGB: 0.03,
        transitionPerObject: 0.0001,
        deletionPerObject: 0
    },
    [types_1.StorageClass.DEEP_ARCHIVE]: {
        storagePerGB: 0.00099,
        retrievalPerGB: 0.15,
        transitionPerObject: 0.0001,
        deletionPerObject: 0
    }
};
const RETRIEVAL_TIER_MULTIPLIER = {
    'expedited': 10,
    'standard': 1,
    'bulk': 0.25
};
function estimateRetrievalCost(objectId, objectKey, size, currentClass, retrievalTier = 'standard') {
    const sizeInGB = size / (1024 * 1024 * 1024);
    const pricing = PRICING[currentClass];
    const tierMultiplier = RETRIEVAL_TIER_MULTIPLIER[retrievalTier];
    const retrievalCost = sizeInGB * pricing.retrievalPerGB * tierMultiplier;
    return {
        objectId,
        objectKey,
        operation: 'RETRIEVE',
        estimatedCost: Math.round(retrievalCost * 10000) / 10000,
        breakdown: [
            {
                item: `数据检索费 (${currentClass})`,
                cost: Math.round(sizeInGB * pricing.retrievalPerGB * 10000) / 10000
            },
            {
                item: `存储层级溢价 (${retrievalTier})`,
                cost: Math.round(retrievalCost - sizeInGB * pricing.retrievalPerGB * 10000) / 10000
            }
        ]
    };
}
function estimateTransitionCost(objectId, objectKey, size, fromClass, toClass) {
    const sizeInGB = size / (1024 * 1024 * 1024);
    const fromPricing = PRICING[fromClass];
    const toPricing = PRICING[toClass];
    const transitionCost = 0.0001;
    const storageSavings = (fromPricing.storagePerGB - toPricing.storagePerGB) * sizeInGB;
    return {
        objectId,
        objectKey,
        operation: `TRANSITION_${fromClass}_TO_${toClass}`,
        estimatedCost: Math.round(transitionCost * 10000) / 10000,
        breakdown: [
            {
                item: '对象转换请求费',
                cost: Math.round(transitionCost * 10000) / 10000
            },
            {
                item: '预估月度存储成本节约',
                cost: -Math.round(storageSavings * 10000) / 10000
            }
        ]
    };
}
function estimateDeletionCost(objectId, objectKey, size, currentClass) {
    const sizeInGB = size / (1024 * 1024 * 1024);
    const pricing = PRICING[currentClass];
    let earlyDeletionFee = 0;
    if (currentClass === types_1.StorageClass.ARCHIVE) {
        earlyDeletionFee = sizeInGB * pricing.storagePerGB * 90;
    }
    else if (currentClass === types_1.StorageClass.DEEP_ARCHIVE) {
        earlyDeletionFee = sizeInGB * pricing.storagePerGB * 180;
    }
    return {
        objectId,
        objectKey,
        operation: 'DELETE',
        estimatedCost: Math.round(earlyDeletionFee * 10000) / 10000,
        breakdown: [
            {
                item: '提前删除违约金',
                cost: Math.round(earlyDeletionFee * 10000) / 10000
            }
        ]
    };
}
