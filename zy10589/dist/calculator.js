const DEFAULT_COST_PER_TB_MONTH = 100;
export function calculateEstimation(validInputs, invalidInputs, inputFile, costPerTBMonth) {
    const actualCostPerTB = costPerTBMonth ?? DEFAULT_COST_PER_TB_MONTH;
    const validTopics = validInputs.map((input) => {
        const compressedDailySizeGB = input.dailySizeGB * input.compressionRatio;
        const totalSizeGB = compressedDailySizeGB * input.retentionDays;
        const totalSizeTB = totalSizeGB / 1024;
        const estimatedCost = totalSizeTB * actualCostPerTB;
        return {
            ...input,
            compressedDailySizeGB,
            totalSizeGB,
            totalSizeTB,
            estimatedCost,
        };
    });
    const totalDailySizeGB = validTopics.reduce((sum, t) => sum + t.dailySizeGB, 0);
    const totalCompressedDailySizeGB = validTopics.reduce((sum, t) => sum + t.compressedDailySizeGB, 0);
    const totalRetentionGB = validTopics.reduce((sum, t) => sum + t.totalSizeGB, 0);
    const totalRetentionTB = totalRetentionGB / 1024;
    const totalEstimatedCost = validTopics.reduce((sum, t) => sum + t.estimatedCost, 0);
    const groupedByCostTag = {};
    validTopics.forEach((topic) => {
        const tag = topic.costTag || '未分类';
        if (!groupedByCostTag[tag]) {
            groupedByCostTag[tag] = {
                topics: [],
                totalRetentionTB: 0,
                totalEstimatedCost: 0,
            };
        }
        groupedByCostTag[tag].topics.push(topic);
        groupedByCostTag[tag].totalRetentionTB += topic.totalSizeTB;
        groupedByCostTag[tag].totalEstimatedCost += topic.estimatedCost;
    });
    Object.keys(groupedByCostTag).forEach((tag) => {
        groupedByCostTag[tag].topics.sort((a, b) => b.totalSizeTB - a.totalSizeTB);
    });
    const topLargestTopics = [...validTopics]
        .sort((a, b) => b.totalSizeTB - a.totalSizeTB)
        .slice(0, 10);
    return {
        summary: {
            totalTopics: validInputs.length + invalidInputs.length,
            validTopics: validTopics.length,
            invalidTopics: invalidInputs.length,
            totalDailySizeGB,
            totalCompressedDailySizeGB,
            totalRetentionGB,
            totalRetentionTB,
            totalEstimatedCost,
        },
        validTopics,
        invalidTopics: invalidInputs,
        groupedByCostTag,
        topLargestTopics,
        generatedAt: new Date().toISOString(),
        parameters: {
            inputFile,
            costPerTBMonth: actualCostPerTB,
        },
    };
}
export function formatSizeGB(sizeGB) {
    if (sizeGB >= 1024) {
        return `${(sizeGB / 1024).toFixed(2)} TB`;
    }
    if (sizeGB >= 1) {
        return `${sizeGB.toFixed(2)} GB`;
    }
    if (sizeGB >= 0.001) {
        return `${(sizeGB * 1024).toFixed(2)} MB`;
    }
    return `${(sizeGB * 1024 * 1024).toFixed(2)} KB`;
}
export function formatSizeTB(sizeTB) {
    if (sizeTB >= 1) {
        return `${sizeTB.toFixed(2)} TB`;
    }
    return `${(sizeTB * 1024).toFixed(2)} GB`;
}
export function formatCost(cost) {
    if (cost >= 10000) {
        return `¥${(cost / 10000).toFixed(2)} 万`;
    }
    if (cost >= 1000) {
        return `¥${(cost / 1000).toFixed(2)}k`;
    }
    return `¥${cost.toFixed(2)}`;
}
