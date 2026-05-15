import { getDb } from '../database';
import { SummaryItem } from '../types';

export class SummaryService {
  static async generateSummary(businessNos?: string[]): Promise<{
    summary: SummaryItem[];
    statistics: {
      total: number;
      successCount: number;
      failedCount: number;
      hasGatewayError: number;
      anomalyCount: number;
    };
  }> {
    return new Promise((resolve, reject) => {
      const summaryMap = new Map<string, SummaryItem & { 
        patientName?: string; 
        sampleNo?: string; 
        department?: string;
        hasAnomaly?: boolean;
        isFailure?: boolean;
      }>();

      const processFailures = () => {
        let whereSQL = '';
        let params: any[] = [];
        
        if (businessNos && businessNos.length > 0) {
          const placeholders = businessNos.map(() => '?').join(',');
          whereSQL = `WHERE fr.business_no IN (${placeholders})`;
          params = businessNos;
        }

        getDb().all(`
          SELECT DISTINCT 
            fr.business_no,
            fr.gateway_error,
            fr.correction_suggestion,
            fr.conclusion,
            fr.failure_type as status,
            ls.patient_name,
            ls.sample_no,
            ls.department,
            CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END as has_anomaly
          FROM failure_records fr
          LEFT JOIN lab_samples ls ON fr.business_no = ls.business_no
          LEFT JOIN anomaly_samples a ON fr.business_no = a.business_no
          ${whereSQL}
        `, params, (err, failureRows: any[] | undefined) => {
          if (err) {
            reject(err);
            return;
          }

          for (const row of failureRows || []) {
            const businessNo = row.business_no;
            summaryMap.set(businessNo, {
              businessNo,
              gatewayError: row.gateway_error || undefined,
              correction: row.correction_suggestion || undefined,
              conclusion: row.conclusion || '校验失败',
              status: row.status || 'unknown',
              patientName: row.patient_name,
              sampleNo: row.sample_no,
              department: row.department,
              hasAnomaly: row.has_anomaly === 1,
              isFailure: true
            });
          }

          processSuccesses();
        });
      };

      const processSuccesses = () => {
        let whereSQL = '';
        let params: any[] = [];
        
        if (businessNos && businessNos.length > 0) {
          const placeholders = businessNos.map(() => '?').join(',');
          whereSQL = `AND vr.business_no IN (${placeholders})`;
          params = businessNos;
        }

        getDb().all(`
          SELECT DISTINCT
            vr.business_no,
            ls.patient_name,
            ls.sample_no,
            ls.department
          FROM validation_records vr
          LEFT JOIN lab_samples ls ON vr.business_no = ls.business_no
          WHERE vr.status = 'success'
          ${whereSQL}
        `, params, (err, successRows: any[] | undefined) => {
          if (err) {
            reject(err);
            return;
          }

          for (const row of successRows || []) {
            const businessNo = row.business_no;
            
            if (!summaryMap.has(businessNo)) {
              summaryMap.set(businessNo, {
                businessNo,
                gatewayError: undefined,
                correction: undefined,
                conclusion: '校验通过',
                status: 'success',
                patientName: row.patient_name,
                sampleNo: row.sample_no,
                department: row.department,
                hasAnomaly: false,
                isFailure: false
              });
            } else {
              const existing = summaryMap.get(businessNo)!;
              if (!existing.patientName && row.patient_name) {
                existing.patientName = row.patient_name;
              }
              if (!existing.sampleNo && row.sample_no) {
                existing.sampleNo = row.sample_no;
              }
              if (!existing.department && row.department) {
                existing.department = row.department;
              }
            }
          }

          finishSummary();
        });
      };

      const finishSummary = () => {
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
      };

      processFailures();
    });
  }

  static async generateSummaryReport(businessNos?: string[]): Promise<string> {
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
      if ((item as any).patientName) report += `- 患者姓名: ${(item as any).patientName}\n`;
      if ((item as any).sampleNo) report += `- 样本编号: ${(item as any).sampleNo}\n`;
      if ((item as any).department) report += `- 送检科室: ${(item as any).department}\n`;

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

  static async getErrorStatistics(): Promise<{
    byErrorType: { [key: string]: number };
    byDepartment: { [key: string]: { total: number; failed: number } };
  }> {
    return new Promise((resolve, reject) => {
      const byErrorType: { [key: string]: number } = {};
      const byDepartment: { [key: string]: { total: number; failed: number } } = {};

      getDb().all(`
        SELECT fr.failure_type, COUNT(*) as count
        FROM failure_records fr
        GROUP BY fr.failure_type
      `, [], (err, rows: any[]) => {
        if (err) reject(err);
        for (const row of rows) {
          byErrorType[row.failure_type] = row.count;
        }

        getDb().all(`
          SELECT 
            ls.department,
            COUNT(DISTINCT ls.business_no) as total,
            COUNT(DISTINCT fr.business_no) as failed
          FROM lab_samples ls
          LEFT JOIN failure_records fr ON ls.business_no = fr.business_no
          GROUP BY ls.department
        `, [], (err, deptRows: any[]) => {
          if (err) reject(err);
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

export default SummaryService;
