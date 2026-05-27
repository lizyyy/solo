"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
const json2csv_1 = require("json2csv");
const types_1 = require("../types");
class ReportService {
    translateActivityType(type) {
        const map = {
            [types_1.ActivityType.PARENT_CHILD]: '亲子课',
            [types_1.ActivityType.ELDERLY]: '老人课',
        };
        return map[type] || type;
    }
    translateReviewStatus(status) {
        const map = {
            [types_1.ReviewStatus.PENDING_REVIEW]: '待复核',
            [types_1.ReviewStatus.APPROVED]: '已通过',
            [types_1.ReviewStatus.REJECTED]: '已拒绝',
            [types_1.ReviewStatus.NEEDS_MORE_INFO]: '需补材料',
        };
        return map[status] || status;
    }
    translateFinalStatus(status) {
        const map = {
            allowed: '放行',
            rejected: '退回',
            pending: '待处理',
        };
        return map[status] || status;
    }
    translateCheckInStatus(status) {
        const map = {
            [types_1.CheckInStatus.CHECKED_IN]: '已签到',
            [types_1.CheckInStatus.NOT_CHECKED_IN]: '未签到',
            [types_1.CheckInStatus.ABSENT]: '缺勤',
        };
        return map[status] || status;
    }
    translateRegistrationStatus(status) {
        if (!status)
            return '-';
        const map = {
            [types_1.RegistrationStatus.PENDING]: '待确认',
            [types_1.RegistrationStatus.CONFIRMED]: '已确认',
            [types_1.RegistrationStatus.CANCELLED]: '已取消',
            [types_1.RegistrationStatus.WAITLIST]: '候补',
            [types_1.RegistrationStatus.PROMOTED]: '已递补',
        };
        return map[status] || status;
    }
    translateDiscrepancyType(type) {
        const map = {
            [types_1.DiscrepancyType.DUPLICATE_REGISTRATION]: '重复报名',
            [types_1.DiscrepancyType.BLACKLISTED]: '黑名单人员',
            [types_1.DiscrepancyType.WAITLIST_PROMOTED]: '候补递补',
            [types_1.DiscrepancyType.CANCELLED_BUT_CHECKED_IN]: '取消后签到',
            [types_1.DiscrepancyType.NOT_REGISTERED_BUT_CHECKED_IN]: '无报名但签到',
            [types_1.DiscrepancyType.REGISTERED_BUT_NOT_CHECKED_IN]: '报名未签到',
            [types_1.DiscrepancyType.INFO_MISMATCH]: '信息不一致',
            [types_1.DiscrepancyType.MANUAL_CHANGE]: '人工修改',
        };
        return map[type] || type;
    }
    generateDetailedReport(batch, records) {
        const lines = [];
        lines.push('='.repeat(80));
        lines.push(`街道活动对账报告`);
        lines.push('='.repeat(80));
        lines.push(`批次名称: ${batch.name}`);
        lines.push(`批次ID: ${batch.id}`);
        lines.push(`活动类型: ${this.translateActivityType(batch.activityType)}`);
        lines.push(`活动名称: ${batch.activityName}`);
        lines.push(`创建时间: ${batch.createdAt.toLocaleString()}`);
        lines.push(`创建人: ${batch.createdBy}`);
        lines.push(`批次状态: ${batch.status}`);
        lines.push('');
        lines.push('【统计汇总】');
        lines.push('-'.repeat(60));
        lines.push(`报名总人数: ${batch.statistics.totalRegistrations}`);
        lines.push(`候补总人数: ${batch.statistics.totalWaitlist}`);
        lines.push(`签到总人数: ${batch.statistics.totalCheckIns}`);
        lines.push(`匹配记录数: ${batch.statistics.matchedRecords}`);
        lines.push(`存在差异: ${batch.statistics.discrepancies}`);
        lines.push(`待复核: ${batch.statistics.pendingReview}`);
        lines.push(`已通过: ${batch.statistics.approved}`);
        lines.push(`已拒绝: ${batch.statistics.rejected}`);
        lines.push('');
        lines.push('【详细记录】');
        lines.push('-'.repeat(60));
        lines.push('');
        records.forEach((record, index) => {
            lines.push(`[记录 ${index + 1}] ${record.name} (${record.phone})`);
            lines.push(`  对账记录ID: ${record.id}`);
            lines.push(`  活动名称: ${record.activityName}`);
            lines.push(`  报名状态: ${this.translateRegistrationStatus(record.registrationStatus)}`);
            lines.push(`  签到状态: ${this.translateCheckInStatus(record.checkInStatus)}`);
            lines.push(`  复核状态: ${this.translateReviewStatus(record.reviewStatus)}`);
            lines.push(`  最终状态: ${this.translateFinalStatus(record.finalStatus)}`);
            if (record.finalReason) {
                lines.push(`  最终原因: ${record.finalReason}`);
            }
            if (record.discrepancies.length > 0) {
                lines.push(`  差异情况 (${record.discrepancies.length}项):`);
                record.discrepancies.forEach((d, i) => {
                    lines.push(`    [${i + 1}] ${this.translateDiscrepancyType(d.type)} (${d.severity === 'high' ? '高' : d.severity === 'medium' ? '中' : '低'})`);
                    lines.push(`        说明: ${d.description}`);
                    d.sourceEvidence.forEach((e) => {
                        const sourceMap = {
                            registration_csv: '报名表',
                            waitlist_json: '候补表',
                            checkin_csv: '签到表',
                            blacklist_json: '黑名单',
                            manual: '人工操作',
                        };
                        const source = sourceMap[e.source] || e.source;
                        if (e.expectedValue !== undefined && e.actualValue !== undefined) {
                            lines.push(`        证据[${source}]: ${e.field} 期望值="${e.expectedValue}", 实际值="${e.actualValue}"`);
                        }
                        else {
                            lines.push(`        证据[${source}]: ${e.field} = "${e.actualValue}"`);
                        }
                    });
                });
            }
            lines.push(`  审计追踪 (${record.auditTrail.length}条):`);
            record.auditTrail
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .forEach((log) => {
                const actionMap = {
                    auto_reconciliation: '系统自动比对',
                    review_approve: '审核通过',
                    review_reject: '审核拒绝',
                    review_request_info: '要求补材料',
                    field_update: '字段更新',
                };
                const action = actionMap[log.action] || log.action;
                lines.push(`    [${log.timestamp.toLocaleString()}] ${action} - ${log.operator}`);
                if (log.reason) {
                    lines.push(`      原因: ${log.reason}`);
                }
                if (log.previousValue !== undefined && log.newValue !== undefined) {
                    lines.push(`      变更: "${log.previousValue}" → "${log.newValue}"`);
                }
            });
            lines.push('');
        });
        lines.push('='.repeat(80));
        lines.push('报告生成时间: ' + new Date().toLocaleString());
        lines.push('='.repeat(80));
        return lines.join('\n');
    }
    generateSummaryCSV(batch, records) {
        const data = records.map((record) => ({
            对账记录ID: record.id,
            姓名: record.name,
            电话: record.phone,
            活动名称: record.activityName,
            报名状态: this.translateRegistrationStatus(record.registrationStatus),
            签到状态: this.translateCheckInStatus(record.checkInStatus),
            复核状态: this.translateReviewStatus(record.reviewStatus),
            最终状态: this.translateFinalStatus(record.finalStatus),
            最终原因: record.finalReason || '',
            差异数量: record.discrepancies.length,
            差异类型: record.discrepancies.map((d) => this.translateDiscrepancyType(d.type)).join('; '),
            创建时间: record.createdAt.toLocaleString(),
            更新时间: record.updatedAt.toLocaleString(),
        }));
        const parser = new json2csv_1.Parser();
        return parser.parse(data);
    }
    generateDiscrepancyReport(batch, records) {
        const recordsWithDiscrepancies = records.filter((r) => r.discrepancies.length > 0);
        const lines = [];
        lines.push('街道活动差异分析报告');
        lines.push('='.repeat(60));
        lines.push(`批次: ${batch.name}`);
        lines.push(`生成时间: ${new Date().toLocaleString()}`);
        lines.push(`总差异记录数: ${recordsWithDiscrepancies.length}`);
        lines.push('');
        const typeCounts = new Map();
        recordsWithDiscrepancies.forEach((r) => {
            r.discrepancies.forEach((d) => {
                const key = this.translateDiscrepancyType(d.type);
                typeCounts.set(key, (typeCounts.get(key) || 0) + 1);
            });
        });
        lines.push('【差异类型统计】');
        typeCounts.forEach((count, type) => {
            lines.push(`  ${type}: ${count} 条`);
        });
        lines.push('');
        lines.push('【差异详情】');
        recordsWithDiscrepancies.forEach((record) => {
            lines.push(`\n${record.name} (${record.phone}):`);
            record.discrepancies.forEach((d) => {
                lines.push(`  - [${d.severity === 'high' ? '高' : d.severity === 'medium' ? '中' : '低'}] ${this.translateDiscrepancyType(d.type)}: ${d.description}`);
            });
        });
        return lines.join('\n');
    }
    generateAuditTrailCSV(records) {
        const auditData = [];
        records.forEach((record) => {
            record.auditTrail.forEach((log) => {
                auditData.push({
                    对账记录ID: log.reconciliationId,
                    姓名: record.name,
                    电话: record.phone,
                    操作类型: log.action,
                    操作人: log.operator,
                    操作时间: log.timestamp.toLocaleString(),
                    原值: log.previousValue !== undefined ? String(log.previousValue) : '',
                    新值: log.newValue !== undefined ? String(log.newValue) : '',
                    原因: log.reason || '',
                });
            });
        });
        const parser = new json2csv_1.Parser();
        return parser.parse(auditData);
    }
    generateJSONReport(batch, records) {
        return JSON.stringify({
            batch: {
                ...batch,
                createdAt: batch.createdAt.toISOString(),
            },
            records: records.map((r) => ({
                ...r,
                createdAt: r.createdAt.toISOString(),
                updatedAt: r.updatedAt.toISOString(),
                auditTrail: r.auditTrail.map((log) => ({
                    ...log,
                    timestamp: log.timestamp.toISOString(),
                })),
            })),
            generatedAt: new Date().toISOString(),
        }, null, 2);
    }
}
exports.ReportService = ReportService;
