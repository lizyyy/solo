"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SummaryService = void 0;
const database_1 = require("../database");
class SummaryService {
    static async generateSummary(businessNos) {
        return new Promise((resolve, reject) => {
            let whereSQL = '';
            let params = [];
            if (businessNos && businessNos.length > 0) {
                const placeholders = businessNos.map(() => '?').join(',');
                whereSQL = `WHERE fr.business_no IN (${placeholders})`;
                params = businessNos;
            }
            (0, database_1.getDb)().all(`
        SELECT DISTINCT 
          fr.business_no,
          fr.gateway_error,
          fr.correction_suggestion,
          fr.conclusion,
          fr.failure_type as status,
          ls.patient_name,
          ls.sample_no,
          ls.department,
          vr.status as validation_status,
          CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END as has_anomaly
        FROM failure_records fr
        LEFT JOIN lab_samples ls ON fr.business_no = ls.business_no
        LEFT JOIN validation_records vr ON fr.business_no = vr.business_no
        LEFT JOIN anomaly_samples a ON fr.business_no = a.business_no
        ${whereSQL}
        UNION
        SELECT DISTINCT
          vr.business_no,
          NULL as gateway_error,
          NULL as correction_suggestion,
          '校验通过' as conclusion,
          vr.status,
          ls.patient_name,
          ls.sample_no,
          ls.department,
          vr.status as validation_status,
          0 as has_anomaly
        FROM validation_records vr
        LEFT JOIN lab_samples ls ON vr.business_no = ls.business_no
        WHERE vr.status = 'success'
        ${businessNos && businessNos.length > 0 ? `AND vr.business_no IN (${params.map(() => '?').join(',')})` : ''}
      `, [...params, ...params], (err, rows) => {
                if (err)
                    reject(err);
                const summaryMap = new Map();
                for (const row of rows || []) {
                    const businessNo = row.business_no;
                    if (!summaryMap.has(businessNo)) {
                        summaryMap.set(businessNo, {
                            businessNo,
                            gatewayError: row.gateway_error || undefined,
                            correction: row.correction_suggestion || undefined,
                            conclusion: row.conclusion || '校验通过',
                            status: row.status || row.validation_status || 'unknown',
                            patientName: row.patient_name,
                            sampleNo: row.sample_no,
                            department: row.department,
                            hasAnomaly: row.has_anomaly === 1
                        });
                    }
                    else {
                        const existing = summaryMap.get(businessNo);
                        if (row.gateway_error && !existing.gatewayError) {
                            existing.gatewayError = row.gateway_error;
                        }
                        if (row.correction_suggestion && !existing.correction) {
                            existing.correction = row.correction_suggestion;
                        }
                        if (row.has_anomaly === 1) {
                            existing.hasAnomaly = true;
                        }
                    }
                }
                const summary = Array.from(summaryMap.values());
                const statistics = {
                    total: summary.length,
                    successCount: summary.filter(s => s.status === 'success').length,
                    failedCount: summary.filter(s => s.status !== 'success').length,
                    hasGatewayError: summary.filter(s => !!s.gatewayError).length,
                    anomalyCount: summary.filter(s => s.hasAnomaly).length
                };
                resolve({
                    summary,
                    statistics
                });
            });
        });
    }
    static async generateSummaryReport(businessNos) {
        const { summary, statistics } = await this.generateSummary(businessNos);
        let report = '# 冻结窗口校验摘要报告\n\n';
        report += `生成时间: ${new Date().toLocaleString()}\n\n`;
        report += '## 统计概览\n\n';
        report += `- 总样本数: ${statistics.total}\n`;
        report += `- 成功数: ${statistics.successCount}\n`;
        report += `- 失败数: ${statistics.failedCount}\n`;
        report += `- 含网关错误数: ${statistics.hasGatewayError}\n`;
        report += `- 异常样本数: ${statistics.anomalyCount}\n\n`;
        report += '## 按业务单号明细\n\n';
        for (const item of summary) {
            report += `### 业务单号: ${item.businessNo}\n\n`;
            report += `- 状态: ${item.status}\n`;
            if (item.patientName)
                report += `- 患者姓名: ${item.patientName}\n`;
            if (item.sampleNo)
                report += `- 样本编号: ${item.sampleNo}\n`;
            if (item.department)
                report += `- 送检科室: ${item.department}\n`;
            if (item.gatewayError) {
                report += `\n#### 网关错误摘录\n\n\`\`\`json\n${item.gatewayError}\n\`\`\`\n\n`;
            }
            if (item.correction) {
                report += `#### 修正建议\n\n${item.correction}\n\n`;
            }
            report += `#### 结论\n\n${item.conclusion}\n\n`;
            report += '---\n\n';
        }
        return report;
    }
    static async getErrorStatistics() {
        return new Promise((resolve, reject) => {
            const byErrorType = {};
            const byDepartment = {};
            (0, database_1.getDb)().all(`
        SELECT fr.failure_type, COUNT(*) as count
        FROM failure_records fr
        GROUP BY fr.failure_type
      `, [], (err, rows) => {
                if (err)
                    reject(err);
                for (const row of rows) {
                    byErrorType[row.failure_type] = row.count;
                }
                (0, database_1.getDb)().all(`
          SELECT 
            ls.department,
            COUNT(DISTINCT ls.business_no) as total,
            COUNT(DISTINCT fr.business_no) as failed
          FROM lab_samples ls
          LEFT JOIN failure_records fr ON ls.business_no = fr.business_no
          GROUP BY ls.department
        `, [], (err, deptRows) => {
                    if (err)
                        reject(err);
                    for (const row of deptRows) {
                        byDepartment[row.department || '未知'] = {
                            total: row.total,
                            failed: row.failed
                        };
                    }
                    resolve({ byErrorType, byDepartment });
                });
            });
        });
    }
}
exports.SummaryService = SummaryService;
exports.default = SummaryService;
