import { AuditRule, LaboratorySample, AuditContext } from './types';

export const auditRules: AuditRule[] = [
  {
    version: 'v1.0.0',
    effectiveDate: '2024-01-01',
    description: '实验室样本单基础审计规则 - 初始版本',
    checks: [
      {
        id: 'R001',
        name: '样本编号格式校验',
        description: '检查样本编号是否符合 LAB-YYYYMMDD-XXXX 格式',
        check: (sample: LaboratorySample) => {
          const pattern = /^LAB-\d{8}-\d{4}$/;
          if (pattern.test(sample.sampleNo)) {
            return { passed: true, message: '样本编号格式正确', severity: 'info' };
          }
          return { passed: false, message: `样本编号 ${sample.sampleNo} 不符合 LAB-YYYYMMDD-XXXX 格式`, severity: 'error' };
        }
      },
      {
        id: 'R002',
        name: '重复提交检测',
        description: '检查同一批次内是否存在重复样本编号',
        check: (sample: LaboratorySample, context: AuditContext) => {
          const duplicates = context.allSamples.filter(
            s => s.sampleNo === sample.sampleNo && s.id !== sample.id
          );
          if (duplicates.length > 0) {
            return { passed: false, message: `样本编号 ${sample.sampleNo} 在批次内重复提交 ${duplicates.length + 1} 次`, severity: 'error' };
          }
          return { passed: true, message: '无重复提交', severity: 'info' };
        }
      },
      {
        id: 'R003',
        name: '采集时间合理性',
        description: '检查采集时间是否在合理范围内',
        check: (sample: LaboratorySample) => {
          const collectionTime = new Date(sample.collectionTime);
          const now = new Date();
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(now.getMonth() - 3);
          
          if (collectionTime > now) {
            return { passed: false, message: '采集时间不能晚于当前时间', severity: 'warning' };
          }
          if (collectionTime < threeMonthsAgo) {
            return { passed: false, message: '采集时间超过3个月，建议复核', severity: 'warning' };
          }
          return { passed: true, message: '采集时间合理', severity: 'info' };
        }
      },
      {
        id: 'R004',
        name: '检测项目非空校验',
        description: '检查检测项目列表是否为空',
        check: (sample: LaboratorySample) => {
          if (!sample.testItems || sample.testItems.length === 0) {
            return { passed: false, message: '检测项目不能为空', severity: 'error' };
          }
          return { passed: true, message: '检测项目配置有效', severity: 'info' };
        }
      },
      {
        id: 'R005',
        name: '网关错误摘录',
        description: '检查是否存在网关错误并记录',
        check: (sample: LaboratorySample) => {
          if (sample.gatewayError) {
            return { passed: false, message: `网关错误: ${sample.gatewayError}`, severity: 'error' };
          }
          return { passed: true, message: '无网关错误', severity: 'info' };
        }
      }
    ]
  },
  {
    version: 'v1.1.0',
    effectiveDate: '2024-06-01',
    description: '实验室样本单审计规则 - 新增实验室字段校验',
    checks: [
      {
        id: 'R001',
        name: '样本编号格式校验',
        description: '检查样本编号是否符合 LAB-YYYYMMDD-XXXX 格式',
        check: (sample: LaboratorySample) => {
          const pattern = /^LAB-\d{8}-\d{4}$/;
          if (pattern.test(sample.sampleNo)) {
            return { passed: true, message: '样本编号格式正确', severity: 'info' };
          }
          return { passed: false, message: `样本编号 ${sample.sampleNo} 不符合 LAB-YYYYMMDD-XXXX 格式`, severity: 'error' };
        }
      },
      {
        id: 'R002',
        name: '重复提交检测',
        description: '检查同一批次内是否存在重复样本编号',
        check: (sample: LaboratorySample, context: AuditContext) => {
          const duplicates = context.allSamples.filter(
            s => s.sampleNo === sample.sampleNo && s.id !== sample.id
          );
          if (duplicates.length > 0) {
            return { passed: false, message: `样本编号 ${sample.sampleNo} 在批次内重复提交 ${duplicates.length + 1} 次`, severity: 'error' };
          }
          return { passed: true, message: '无重复提交', severity: 'info' };
        }
      },
      {
        id: 'R003',
        name: '采集时间合理性',
        description: '检查采集时间是否在合理范围内',
        check: (sample: LaboratorySample) => {
          const collectionTime = new Date(sample.collectionTime);
          const now = new Date();
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(now.getMonth() - 3);
          
          if (collectionTime > now) {
            return { passed: false, message: '采集时间不能晚于当前时间', severity: 'warning' };
          }
          if (collectionTime < threeMonthsAgo) {
            return { passed: false, message: '采集时间超过3个月，建议复核', severity: 'warning' };
          }
          return { passed: true, message: '采集时间合理', severity: 'info' };
        }
      },
      {
        id: 'R004',
        name: '检测项目非空校验',
        description: '检查检测项目列表是否为空',
        check: (sample: LaboratorySample) => {
          if (!sample.testItems || sample.testItems.length === 0) {
            return { passed: false, message: '检测项目不能为空', severity: 'error' };
          }
          return { passed: true, message: '检测项目配置有效', severity: 'info' };
        }
      },
      {
        id: 'R005',
        name: '网关错误摘录',
        description: '检查是否存在网关错误并记录',
        check: (sample: LaboratorySample) => {
          if (sample.gatewayError) {
            return { passed: false, message: `网关错误: ${sample.gatewayError}`, severity: 'error' };
          }
          return { passed: true, message: '无网关错误', severity: 'info' };
        }
      },
      {
        id: 'R006',
        name: '实验室字段校验',
        description: '检查实验室字段是否在允许列表内',
        check: (sample: LaboratorySample) => {
          const validLaboratories = ['中心实验室', '第一分院实验室', '第二分院实验室', '第三方检测中心'];
          if (validLaboratories.includes(sample.laboratory)) {
            return { passed: true, message: '实验室字段有效', severity: 'info' };
          }
          return { passed: false, message: `实验室 ${sample.laboratory} 不在允许列表内`, severity: 'warning' };
        }
      }
    ]
  }
];

export function getRuleByVersion(version: string): AuditRule | undefined {
  return auditRules.find(r => r.version === version);
}

export function getLatestRule(): AuditRule {
  return auditRules[auditRules.length - 1];
}

export function getRuleVersionHistory(): string[] {
  return auditRules.map(r => r.version);
}
