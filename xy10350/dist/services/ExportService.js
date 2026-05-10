"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportService = void 0;
const fs_1 = require("fs");
class ExportService {
    constructor(config = { includeConflicts: true, includeExplanations: true, format: 'csv' }) {
        this.config = config;
    }
    exportReplayResults(results, outputPath) {
        if (this.config.format === 'json') {
            return this.exportAsJSON(results, outputPath);
        }
        return this.exportAsCSV(results, outputPath);
    }
    exportDiffReports(diffs, outputPath) {
        if (this.config.format === 'json') {
            return this.exportDiffsAsJSON(diffs, outputPath);
        }
        return this.exportDiffsAsCSV(diffs, outputPath);
    }
    exportAsJSON(results, outputPath) {
        const content = JSON.stringify({
            exportTime: new Date().toISOString(),
            keyMetrics: this.buildKeyMetrics(),
            results,
        }, null, 2);
        (0, fs_1.writeFileSync)(outputPath, content, 'utf-8');
        return outputPath;
    }
    exportDiffsAsJSON(diffs, outputPath) {
        const content = JSON.stringify({
            exportTime: new Date().toISOString(),
            keyMetrics: this.buildDiffMetrics(diffs),
            diffs,
        }, null, 2);
        (0, fs_1.writeFileSync)(outputPath, content, 'utf-8');
        return outputPath;
    }
    exportAsCSV(results, outputPath) {
        const lines = [];
        lines.push('========== 赠品规则回放报告 ==========');
        lines.push(`导出时间: ${new Date().toISOString()}`);
        lines.push('');
        lines.push('========== 关键口径说明 ==========');
        lines.push('');
        lines.push(this.buildKeyMetricsText());
        lines.push('');
        lines.push('========== 订单回放结果 ==========');
        lines.push('');
        const headers = [
            '订单ID',
            '订单时间',
            '匹配规则数',
            '规则名称',
            '赠品SKU',
            '赠品名称',
            '建议数量',
            '状态',
            '原因',
        ];
        if (this.config.includeConflicts) {
            headers.push('冲突类型', '冲突信息');
        }
        if (this.config.includeExplanations) {
            headers.push('完整说明');
        }
        lines.push(headers.join(','));
        for (const result of results) {
            for (const gift of result.recommendedGifts) {
                const rule = result.matchedRules.find((r) => r.ruleId === gift.sourceRuleId);
                const row = [
                    result.orderId,
                    result.orderCreateTime,
                    result.matchedRules.length,
                    rule ? rule.ruleName : '',
                    gift.giftSku,
                    gift.giftName,
                    gift.quantity,
                    gift.status,
                    this.escapeCSV(gift.reason),
                ];
                if (this.config.includeConflicts) {
                    const conflict = result.conflicts[0];
                    row.push(conflict ? conflict.type : '');
                    row.push(conflict ? this.escapeCSV(conflict.message) : '');
                }
                if (this.config.includeExplanations) {
                    row.push(this.escapeCSV(result.explanation));
                }
                lines.push(row.join(','));
            }
        }
        (0, fs_1.writeFileSync)(outputPath, lines.join('\n'), 'utf-8');
        return outputPath;
    }
    exportDiffsAsCSV(diffs, outputPath) {
        const lines = [];
        lines.push('========== 赠品差异报告 ==========');
        lines.push(`导出时间: ${new Date().toISOString()}`);
        lines.push('');
        lines.push('========== 差异统计 ==========');
        const stats = this.buildDiffMetrics(diffs);
        for (const [key, value] of Object.entries(stats)) {
            lines.push(`${key}: ${value}`);
        }
        lines.push('');
        lines.push('========== 订单差异详情 ==========');
        lines.push('');
        const headers = [
            '订单ID',
            '订单时间',
            '差异类型',
            '差异详情',
            '期望赠品',
            '实际赠品',
        ];
        lines.push(headers.join(','));
        for (const diff of diffs) {
            const expectedGifts = diff.expectedGifts
                .map((g) => `${g.giftName}(${g.giftSku})x${g.quantity}`)
                .join('; ');
            const actualGifts = diff.actualGifts
                .map((g) => `${g.giftName}(${g.giftSku})x${g.quantity}`)
                .join('; ');
            const row = [
                diff.orderId,
                diff.orderCreateTime,
                diff.diffType,
                this.escapeCSV(diff.diffDetails),
                this.escapeCSV(expectedGifts),
                this.escapeCSV(actualGifts),
            ];
            lines.push(row.join(','));
        }
        (0, fs_1.writeFileSync)(outputPath, lines.join('\n'), 'utf-8');
        return outputPath;
    }
    buildKeyMetrics() {
        return {
            '规则匹配口径': '按订单创建时间查找当时生效的规则，按优先级排序',
            '优先级规则': 'priority值越大优先级越高，相同时创建时间早的规则优先',
            '库存判断口径': '按历史顺序回放，先到先得，已发放的不再重复发放',
            '重复回放防护': '同一订单在同一回放ID下只发放一次，不同回放ID需要确认',
            '赠品状态说明': 'granted=已确认发放 pending=待确认 denied=拒绝发放',
            '冲突类型': 'rule_overlap=规则重叠 insufficient_inventory=库存不足 amount_changed=金额修改 already_granted=已领取',
        };
    }
    buildKeyMetricsText() {
        const metrics = this.buildKeyMetrics();
        return Object.entries(metrics)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
    }
    buildDiffMetrics(diffs) {
        const total = diffs.length;
        const match = diffs.filter((d) => d.diffType === 'match').length;
        const missing = diffs.filter((d) => d.diffType === 'missing').length;
        const extra = diffs.filter((d) => d.diffType === 'extra').length;
        const quantityMismatch = diffs.filter((d) => d.diffType === 'quantity_mismatch').length;
        return {
            '订单总数': total,
            '完全匹配': match,
            '缺少赠品': missing,
            '多余赠品': extra,
            '数量不符': quantityMismatch,
            '匹配率': total > 0 ? Math.round((match / total) * 100) : 0,
        };
    }
    escapeCSV(value) {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }
}
exports.ExportService = ExportService;
//# sourceMappingURL=ExportService.js.map