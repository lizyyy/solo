"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportGenerator = void 0;
const json2csv_1 = require("json2csv");
const XLSX = __importStar(require("xlsx"));
const types_1 = require("../types");
class ReportGenerator {
    generateJsonReport(reportData) {
        return JSON.stringify(reportData, null, 2);
    }
    generateCsvReport(reportData) {
        const summaryRow = {
            '报告类型': '公交失物招领对账报告',
            '批次ID': reportData.batchId,
            '生成时间': reportData.generatedAt,
            '乘客报失总数': reportData.summary.totalPassengerReports,
            '司机上交总数': reportData.summary.totalDriverTurnIns,
            '仓库入库总数': reportData.summary.totalWarehouseReceipts,
            '已匹配': reportData.summary.matched,
            '未匹配': reportData.summary.unmatched,
            '复核中': reportData.summary.reviewing,
            '已审批': reportData.summary.approved,
            '已驳回': reportData.summary.rejected,
            '逾期未领': reportData.summary.overdue,
            '匹配率': `${(reportData.summary.matchRate * 100).toFixed(2)}%`
        };
        const summaryFields = Object.keys(summaryRow);
        const summaryParser = new json2csv_1.Parser({ fields: summaryFields });
        const summaryCsv = summaryParser.parse([summaryRow]);
        const detailsData = reportData.details.map(match => ({
            '匹配ID': match.matchId,
            '状态': this.getStatusText(match.status),
            '匹配分数': (match.matchScore * 100).toFixed(0) + '%',
            '乘客报失ID': match.passengerItemId || '',
            '司机上交ID': match.driverItemId || '',
            '仓库入库ID': match.warehouseItemId || '',
            '匹配字段': match.matchedFields.join('; '),
            '差异类型': match.differences.map(d => this.getDifferenceText(d)).join('; '),
            '差异说明': match.differenceExplanations.join(' | '),
            '同名物品': match.isSameName ? '是' : '否',
            '逾期未领': match.isOverdue ? '是' : '否',
            '敏感信息': match.hasSensitiveInfo ? '是' : '否',
            '创建时间': match.createdAt,
            '更新时间': match.updatedAt
        }));
        if (detailsData.length > 0) {
            const detailFields = Object.keys(detailsData[0]);
            const detailParser = new json2csv_1.Parser({ fields: detailFields });
            const detailsCsv = detailParser.parse(detailsData);
            return summaryCsv + '\n\n=== 明细 ===\n' + detailsCsv;
        }
        return summaryCsv;
    }
    generateExcelReport(reportData) {
        const wb = XLSX.utils.book_new();
        const summaryData = [
            ['公交失物招领对账报告'],
            ['批次ID', reportData.batchId],
            ['生成时间', reportData.generatedAt],
            [],
            ['汇总统计'],
            ['乘客报失总数', reportData.summary.totalPassengerReports],
            ['司机上交总数', reportData.summary.totalDriverTurnIns],
            ['仓库入库总数', reportData.summary.totalWarehouseReceipts],
            ['已匹配', reportData.summary.matched],
            ['未匹配', reportData.summary.unmatched],
            ['复核中', reportData.summary.reviewing],
            ['已审批', reportData.summary.approved],
            ['已驳回', reportData.summary.rejected],
            ['逾期未领', reportData.summary.overdue],
            ['匹配率', `${(reportData.summary.matchRate * 100).toFixed(2)}%`],
            [],
            ['差异分类统计']
        ];
        for (const diff of reportData.differenceBreakdown) {
            summaryData.push([this.getDifferenceText(diff.type), diff.count, diff.description]);
        }
        const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summaryWs, '汇总');
        const detailsData = reportData.details.map(match => ({
            '匹配ID': match.matchId,
            '状态': this.getStatusText(match.status),
            '匹配分数': (match.matchScore * 100).toFixed(0) + '%',
            '乘客报失ID': match.passengerItemId || '',
            '司机上交ID': match.driverItemId || '',
            '仓库入库ID': match.warehouseItemId || '',
            '匹配字段': match.matchedFields.join('; '),
            '差异类型': match.differences.map(d => this.getDifferenceText(d)).join('; '),
            '差异说明': match.differenceExplanations.join(' | '),
            '同名物品': match.isSameName ? '是' : '否',
            '逾期未领': match.isOverdue ? '是' : '否',
            '敏感信息': match.hasSensitiveInfo ? '是' : '否',
            '创建时间': match.createdAt,
            '更新时间': match.updatedAt
        }));
        const detailsWs = XLSX.utils.json_to_sheet(detailsData);
        XLSX.utils.book_append_sheet(wb, detailsWs, '明细');
        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }
    generateTextReport(reportData) {
        let report = '='.repeat(60) + '\n';
        report += '           公交失物招领对账报告\n';
        report += '='.repeat(60) + '\n\n';
        report += `批次ID: ${reportData.batchId}\n`;
        report += `生成时间: ${reportData.generatedAt}\n\n`;
        report += '-'.repeat(40) + '\n';
        report += '【汇总统计】\n';
        report += '-'.repeat(40) + '\n';
        report += `乘客报失总数: ${reportData.summary.totalPassengerReports}\n`;
        report += `司机上交总数: ${reportData.summary.totalDriverTurnIns}\n`;
        report += `仓库入库总数: ${reportData.summary.totalWarehouseReceipts}\n`;
        report += `已匹配: ${reportData.summary.matched}\n`;
        report += `未匹配: ${reportData.summary.unmatched}\n`;
        report += `复核中: ${reportData.summary.reviewing}\n`;
        report += `已审批: ${reportData.summary.approved}\n`;
        report += `已驳回: ${reportData.summary.rejected}\n`;
        report += `逾期未领: ${reportData.summary.overdue}\n`;
        report += `匹配率: ${(reportData.summary.matchRate * 100).toFixed(2)}%\n\n`;
        report += '-'.repeat(40) + '\n';
        report += '【差异分类统计】\n';
        report += '-'.repeat(40) + '\n';
        for (const diff of reportData.differenceBreakdown) {
            report += `${this.getDifferenceText(diff.type)}: ${diff.count}条 - ${diff.description}\n`;
        }
        report += '\n' + '-'.repeat(40) + '\n';
        report += '【明细记录】\n';
        report += '-'.repeat(40) + '\n\n';
        for (const match of reportData.details) {
            report += `匹配ID: ${match.matchId}\n`;
            report += `状态: ${this.getStatusText(match.status)}\n`;
            report += `匹配分数: ${(match.matchScore * 100).toFixed(0)}%\n`;
            if (match.passengerItemId) {
                report += `乘客报失ID: ${match.passengerItemId}\n`;
            }
            if (match.driverItemId) {
                report += `司机上交ID: ${match.driverItemId}\n`;
            }
            if (match.warehouseItemId) {
                report += `仓库入库ID: ${match.warehouseItemId}\n`;
            }
            if (match.differences.length > 0) {
                report += `差异类型: ${match.differences.map(d => this.getDifferenceText(d)).join(', ')}\n`;
            }
            if (match.differenceExplanations.length > 0) {
                report += `差异说明:\n`;
                for (const exp of match.differenceExplanations) {
                    report += `  - ${exp}\n`;
                }
            }
            report += '\n';
        }
        report += '='.repeat(60) + '\n';
        report += '报告结束\n';
        return report;
    }
    generateAuditTrailReport(match, passengerItem, driverItem, warehouseItem, reviewHistory = []) {
        let report = '='.repeat(60) + '\n';
        report += '           匹配记录审计报告\n';
        report += '='.repeat(60) + '\n\n';
        report += `匹配ID: ${match.matchId}\n`;
        report += `状态: ${this.getStatusText(match.status)}\n`;
        report += `匹配分数: ${(match.matchScore * 100).toFixed(0)}%\n`;
        report += `创建时间: ${match.createdAt}\n`;
        report += `更新时间: ${match.updatedAt}\n\n`;
        if (passengerItem) {
            report += '-'.repeat(40) + '\n';
            report += '【乘客报失信息】\n';
            report += '-'.repeat(40) + '\n';
            report += `记录ID: ${passengerItem.id}\n`;
            report += `报失日期: ${passengerItem.reportDate}\n`;
            report += `乘客姓名: ${passengerItem.passengerName}\n`;
            report += `联系电话: ${this.maskPhone(passengerItem.passengerPhone)}\n`;
            report += `物品名称: ${passengerItem.itemName}\n`;
            report += `物品描述: ${passengerItem.itemDescription}\n`;
            report += `物品类别: ${passengerItem.itemCategory}\n`;
            report += `线路: ${passengerItem.routeNumber}\n`;
            report += `丢失日期: ${passengerItem.lostDate}\n`;
            report += `丢失地点: ${passengerItem.lostLocation}\n`;
            if (passengerItem.remarks) {
                report += `备注: ${passengerItem.remarks}\n`;
            }
            report += '\n';
        }
        if (driverItem) {
            report += '-'.repeat(40) + '\n';
            report += '【司机上交信息】\n';
            report += '-'.repeat(40) + '\n';
            report += `记录ID: ${driverItem.id}\n`;
            report += `上交日期: ${driverItem.turnInDate}\n`;
            report += `司机姓名: ${driverItem.driverName}\n`;
            report += `司机ID: ${driverItem.driverId}\n`;
            report += `线路: ${driverItem.routeNumber}\n`;
            report += `车牌号: ${driverItem.busNumber}\n`;
            report += `物品名称: ${driverItem.itemName}\n`;
            report += `物品描述: ${driverItem.itemDescription}\n`;
            report += `物品类别: ${driverItem.itemCategory}\n`;
            report += `拾获日期: ${driverItem.foundDate}\n`;
            report += `拾获地点: ${driverItem.foundLocation}\n`;
            if (driverItem.bagNumber) {
                report += `编号: ${driverItem.bagNumber}\n`;
            }
            if (driverItem.remarks) {
                report += `备注: ${driverItem.remarks}\n`;
            }
            report += '\n';
        }
        if (warehouseItem) {
            report += '-'.repeat(40) + '\n';
            report += '【仓库入库信息】\n';
            report += '-'.repeat(40) + '\n';
            report += `记录ID: ${warehouseItem.id}\n`;
            report += `入库日期: ${warehouseItem.receiptDate}\n`;
            report += `入库人员: ${warehouseItem.warehouseStaff}\n`;
            report += `物品名称: ${warehouseItem.itemName}\n`;
            report += `物品描述: ${warehouseItem.itemDescription}\n`;
            report += `物品类别: ${warehouseItem.itemCategory}\n`;
            report += `存放位置: ${warehouseItem.storageLocation}\n`;
            if (warehouseItem.shelfNumber) {
                report += `货架编号: ${warehouseItem.shelfNumber}\n`;
            }
            if (warehouseItem.bagNumber) {
                report += `编号: ${warehouseItem.bagNumber}\n`;
            }
            if (warehouseItem.remarks) {
                report += `备注: ${warehouseItem.remarks}\n`;
            }
            report += '\n';
        }
        if (match.differences.length > 0) {
            report += '-'.repeat(40) + '\n';
            report += '【差异说明】\n';
            report += '-'.repeat(40) + '\n';
            for (const exp of match.differenceExplanations) {
                report += `- ${exp}\n`;
            }
            report += '\n';
        }
        if (reviewHistory.length > 0) {
            report += '-'.repeat(40) + '\n';
            report += '【复核历史】\n';
            report += '-'.repeat(40) + '\n';
            for (const review of reviewHistory) {
                report += `[${review.reviewDate} ${review.reviewTime}] ${review.reviewer}\n`;
                report += `  操作: ${this.getActionText(review.action)}\n`;
                report += `  状态变更: ${this.getStatusText(review.previousStatus)} -> ${this.getStatusText(review.newStatus)}\n`;
                report += `  原因: ${review.reason}\n`;
                if (review.changes && review.changes.length > 0) {
                    report += `  变更:\n`;
                    for (const change of review.changes) {
                        report += `    ${change.field}: ${change.oldValue} -> ${change.newValue}\n`;
                    }
                }
                report += '\n';
            }
        }
        report += '='.repeat(60) + '\n';
        return report;
    }
    getStatusText(status) {
        const statusMap = {
            [types_1.ItemStatus.PENDING]: '待处理',
            [types_1.ItemStatus.MATCHED]: '已匹配',
            [types_1.ItemStatus.UNMATCHED]: '未匹配',
            [types_1.ItemStatus.REVIEWING]: '复核中',
            [types_1.ItemStatus.APPROVED]: '已审批',
            [types_1.ItemStatus.REJECTED]: '已驳回',
            [types_1.ItemStatus.RETURNED]: '已归还',
            [types_1.ItemStatus.CLAIMED]: '已认领',
            [types_1.ItemStatus.OVERDUE]: '已逾期'
        };
        return statusMap[status] || status;
    }
    getDifferenceText(type) {
        const typeMap = {
            [types_1.DifferenceType.SAME_NAME]: '同名物品',
            [types_1.DifferenceType.OVERDUE]: '逾期未领',
            [types_1.DifferenceType.SENSITIVE_INFO]: '敏感信息',
            [types_1.DifferenceType.DESCRIPTION_MISMATCH]: '描述不匹配',
            [types_1.DifferenceType.TIME_MISMATCH]: '时间不匹配',
            [types_1.DifferenceType.LOCATION_MISMATCH]: '地点不匹配',
            [types_1.DifferenceType.DUPLICATE]: '重复记录'
        };
        return typeMap[type] || type;
    }
    getActionText(action) {
        const actionMap = {
            [types_1.ReviewAction.APPROVE]: '审批通过',
            [types_1.ReviewAction.REJECT]: '驳回',
            [types_1.ReviewAction.REQUEST_MORE_INFO]: '要求补充信息',
            [types_1.ReviewAction.MANUAL_MATCH]: '人工匹配',
            [types_1.ReviewAction.UNMATCH]: '解除匹配'
        };
        return actionMap[action] || action;
    }
    maskPhone(phone) {
        if (!phone || phone.length < 7)
            return phone;
        return phone.slice(0, 3) + '****' + phone.slice(-4);
    }
}
exports.ReportGenerator = ReportGenerator;
