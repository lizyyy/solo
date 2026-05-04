function generateMarkdownHandover(db) {
    const items = db.getAllItems();
    const claims = db.getAllClaims();
    const reviews = db.getAllReviews();
    const matches = db.getAllMatchResults();
    
    const today = new Date().toISOString().split('T')[0];
    const pendingItems = items.filter(i => i.status === 'pending');
    const matchedItems = items.filter(i => i.status === 'matched');
    const pendingClaims = claims.filter(c => c.status === 'pending');
    const matchedClaims = claims.filter(c => c.status === 'matched');
    const highRiskMatches = matches.filter(m => m.riskLevel === 'high');
    
    let md = `# 机场失物招领交接单\n\n`;
    md += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    
    md += `## 一、当日汇总统计\n\n`;
    md += `| 类别 | 数量 |\n`;
    md += `|------|------|\n`;
    md += `| 待处理失物 | ${pendingItems.length} 件 |\n`;
    md += `| 已匹配失物 | ${matchedItems.length} 件 |\n`;
    md += `| 待处理认领 | ${pendingClaims.length} 条 |\n`;
    md += `| 已匹配认领 | ${matchedClaims.length} 条 |\n`;
    md += `| 高风险匹配 | ${highRiskMatches.length} 条 |\n\n`;
    
    md += `## 二、待处理失物清单\n\n`;
    if (pendingItems.length === 0) {
        md += `暂无待处理失物。\n\n`;
    } else {
        for (const item of pendingItems) {
            md += `### 失物 ID: ${item.id.slice(0, 12)}\n\n`;
            if (item.photoUrl) {
                md += `![失物照片](${item.photoUrl})\n\n`;
            }
            md += `- 原始文件名: ${item.originalName || '-'}\n`;
            md += `- 描述: ${item.description || '-'}\n`;
            md += `- 标签: ${(item.tags || []).join('、') || '-'}\n`;
            md += `- 发现日期: ${item.foundDate || '-'}\n`;
            md += `- 发现地点: ${item.location || '-'}\n`;
            md += `- 状态: ${getStatusText(item.status)}\n\n`;
            
            const itemMatches = matches.filter(m => m.itemId === item.id);
            if (itemMatches.length > 0) {
                md += `#### 相关匹配记录\n\n`;
                for (const match of itemMatches) {
                    const claim = claims.find(c => c.claimId === match.claimId);
                    const riskEmoji = match.riskLevel === 'high' ? '⚠️' : match.riskLevel === 'medium' ? '⚡' : '✅';
                    md += `${riskEmoji} **匹配度 ${Math.round(match.overallScore * 100)}%** | 风险等级: ${getRiskText(match.riskLevel)}\n`;
                    if (claim) {
                        md += `   - 认领人: ${claim.passengerName || '未提供'}\n`;
                        md += `   - 航班号: ${claim.flightNumber || '未提供'}\n`;
                    }
                    if (match.matchingPoints && match.matchingPoints.length > 0) {
                        md += `   - 匹配点: ${match.matchingPoints.join('；')}\n`;
                    }
                    if (match.conflicts && match.conflicts.length > 0) {
                        md += `   - 冲突点: ${match.conflicts.join('；')}\n`;
                    }
                    md += '\n';
                }
            }
        }
    }
    
    md += `## 三、待处理认领清单\n\n`;
    if (pendingClaims.length === 0) {
        md += `暂无待处理认领。\n\n`;
    } else {
        for (const claim of pendingClaims) {
            md += `### 认领 ID: ${claim.claimId.slice(0, 12)}\n\n`;
            md += `- 乘客姓名: ${claim.passengerName || '-'}\n`;
            md += `- 联系电话: ${claim.phone || '-'}\n`;
            md += `- 航班号: ${claim.flightNumber || '-'}\n`;
            md += `- 丢失日期: ${claim.lostDate || '-'}\n`;
            md += `- 丢失地点: ${claim.lostLocation || '-'}\n`;
            md += `- 描述: ${claim.description || '-'}\n`;
            md += `- 标签: ${(claim.tags || []).join('、') || '-'}\n`;
            md += `- 状态: ${getStatusText(claim.status)}\n\n`;
            
            const claimMatches = matches.filter(m => m.claimId === claim.claimId);
            if (claimMatches.length > 0) {
                md += `#### 相关匹配记录\n\n`;
                for (const match of claimMatches) {
                    const item = items.find(i => i.id === match.itemId);
                    const riskEmoji = match.riskLevel === 'high' ? '⚠️' : match.riskLevel === 'medium' ? '⚡' : '✅';
                    md += `${riskEmoji} **匹配度 ${Math.round(match.overallScore * 100)}%** | 风险等级: ${getRiskText(match.riskLevel)}\n`;
                    if (item) {
                        md += `   - 失物: ${item.originalName || item.description || '未命名'}\n`;
                    }
                    md += '\n';
                }
            }
        }
    }
    
    md += `## 四、高风险匹配清单\n\n`;
    if (highRiskMatches.length === 0) {
        md += `暂无高风险匹配。\n\n`;
    } else {
        for (const match of highRiskMatches) {
            const item = items.find(i => i.id === match.itemId);
            const claim = claims.find(c => c.claimId === match.claimId);
            
            md += `### ⚠️ 高风险匹配\n\n`;
            md += `- 匹配度: ${Math.round(match.overallScore * 100)}%\n`;
            md += `- 风险原因: ${(match.riskReasons || []).join('；')}\n\n`;
            
            if (item) {
                md += `**失物信息:**\n`;
                md += `- ID: ${item.id.slice(0, 12)}\n`;
                md += `- 描述: ${item.description || '-'}\n`;
                md += `- 标签: ${(item.tags || []).join('、') || '-'}\n\n`;
            }
            
            if (claim) {
                md += `**认领信息:**\n`;
                md += `- ID: ${claim.claimId.slice(0, 12)}\n`;
                md += `- 乘客: ${claim.passengerName || '-'}\n`;
                md += `- 电话: ${claim.phone || '-'}\n`;
                md += `- 描述: ${claim.description || '-'}\n\n`;
            }
            
            if (match.conflicts && match.conflicts.length > 0) {
                md += `**冲突点:**\n`;
                for (const conflict of match.conflicts) {
                    md += `- ${conflict}\n`;
                }
                md += '\n';
            }
        }
    }
    
    md += `## 五、复核记录\n\n`;
    if (reviews.length === 0) {
        md += `暂无复核记录。\n\n`;
    } else {
        for (const review of reviews.slice(-20)) {
            md += `- [${formatDateTime(review.reviewDate || review.createdAt)}] ${review.reviewer || '系统'}: `;
            md += `${getDecisionText(review.decision)} `;
            md += `(失物: ${review.itemId?.slice(0, 8) || '-'} | 认领: ${review.claimId?.slice(0, 8) || '-'})\n`;
            if (review.notes) {
                md += `  备注: ${review.notes}\n`;
            }
        }
        md += '\n';
    }
    
    md += `---\n\n`;
    md += `*此交接单由系统自动生成，打印后请交接双方签字确认。*\n`;
    md += `\n**交接人签字:** _______________\n`;
    md += `\n**接交人签字:** _______________\n`;
    md += `\n**日期:** ${today}\n`;
    
    return md;
}

function generateHighRiskCSV(db) {
    const matches = db.getAllMatchResults();
    const items = db.getAllItems();
    const claims = db.getAllClaims();
    
    const highRiskMatches = matches.filter(m => m.riskLevel === 'high');
    
    let csv = '匹配时间,失物ID,失物描述,失物标签,认领ID,乘客姓名,联系电话,认领描述,认领标签,匹配度,风险等级,风险原因,匹配点,冲突点\n';
    
    if (highRiskMatches.length === 0) {
        return csv;
    }
    
    for (const match of highRiskMatches) {
        const item = items.find(i => i.id === match.itemId);
        const claim = claims.find(c => c.claimId === match.claimId);
        
        const row = [
            formatDateTime(match.matchedAt),
            match.itemId?.slice(0, 12) || '',
            escapeCSV(item?.description || ''),
            escapeCSV((item?.tags || []).join('、')),
            match.claimId?.slice(0, 12) || '',
            escapeCSV(claim?.passengerName || ''),
            escapeCSV(claim?.phone || ''),
            escapeCSV(claim?.description || ''),
            escapeCSV((claim?.tags || []).join('、')),
            Math.round(match.overallScore * 100) + '%',
            getRiskText(match.riskLevel),
            escapeCSV((match.riskReasons || []).join('；')),
            escapeCSV((match.matchingPoints || []).join('；')),
            escapeCSV((match.conflicts || []).join('；'))
        ];
        
        csv += row.join(',') + '\n';
    }
    
    return csv;
}

function generateAuditJSON(db) {
    const items = db.getAllItems();
    const claims = db.getAllClaims();
    const reviews = db.getAllReviews();
    const matches = db.getAllMatchResults();
    
    const audit = {
        auditInfo: {
            generatedAt: new Date().toISOString(),
            version: '1.0.0',
            system: '机场失物招领预审系统'
        },
        statistics: {
            totalItems: items.length,
            totalClaims: claims.length,
            totalReviews: reviews.length,
            totalMatches: matches.length,
            byStatus: {
                items: {
                    pending: items.filter(i => i.status === 'pending').length,
                    matched: items.filter(i => i.status === 'matched').length
                },
                claims: {
                    pending: claims.filter(c => c.status === 'pending').length,
                    matched: claims.filter(c => c.status === 'matched').length,
                    rejected: claims.filter(c => c.status === 'rejected').length,
                    merged: claims.filter(c => c.status === 'merged').length
                }
            },
            byRisk: {
                high: matches.filter(m => m.riskLevel === 'high').length,
                medium: matches.filter(m => m.riskLevel === 'medium').length,
                low: matches.filter(m => m.riskLevel === 'low').length
            }
        },
        items: items.map(item => ({
            id: item.id,
            originalName: item.originalName,
            photoUrl: item.photoUrl,
            description: item.description,
            tags: item.tags,
            foundDate: item.foundDate,
            location: item.location,
            status: item.status,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
        })),
        claims: claims.map(claim => ({
            claimId: claim.claimId,
            passengerName: claim.passengerName,
            phone: claim.phone,
            flightNumber: claim.flightNumber,
            lostDate: claim.lostDate,
            lostLocation: claim.lostLocation,
            description: claim.description,
            tags: claim.tags,
            status: claim.status,
            notes: claim.notes,
            mergedFrom: claim.mergedFrom,
            mergedInto: claim.mergedInto,
            createdAt: claim.createdAt,
            updatedAt: claim.updatedAt
        })),
        reviews: reviews.map(review => ({
            reviewId: review.reviewId,
            itemId: review.itemId,
            claimId: review.claimId,
            decision: review.decision,
            notes: review.notes,
            reviewer: review.reviewer,
            reviewDate: review.reviewDate,
            createdAt: review.createdAt
        })),
        matches: matches.map(match => ({
            itemId: match.itemId,
            claimId: match.claimId,
            overallScore: match.overallScore,
            categoryScore: match.categoryScore,
            colorScore: match.colorScore,
            brandScore: match.brandScore,
            keywordScore: match.keywordScore,
            textSimilarity: match.textSimilarity,
            matchingPoints: match.matchingPoints,
            conflicts: match.conflicts,
            riskLevel: match.riskLevel,
            riskReasons: match.riskReasons,
            matchedAt: match.matchedAt
        }))
    };
    
    return JSON.stringify(audit, null, 2);
}

function escapeCSV(value) {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
}

function getStatusText(status) {
    const map = {
        'pending': '待处理',
        'matched': '已匹配',
        'rejected': '已拒绝',
        'merged': '已合并'
    };
    return map[status] || status;
}

function getRiskText(level) {
    const map = {
        'low': '低风险',
        'medium': '中风险',
        'high': '高风险'
    };
    return map[level] || level;
}

function getDecisionText(decision) {
    const map = {
        'matched': '确认匹配',
        'rejected': '拒绝认领',
        'pending': '待复核'
    };
    return map[decision] || decision;
}

function formatDateTime(isoString) {
    if (!isoString) return '-';
    try {
        const date = new Date(isoString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return isoString;
    }
}

module.exports = {
    generateMarkdownHandover,
    generateHighRiskCSV,
    generateAuditJSON
};
