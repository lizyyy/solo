import { HandoverForm, HandoverItem, AnomalySample } from '../types';
import { store } from '../store';

export class SampleGenerator {
  generateNormalItems(): HandoverItem[] {
    return [
      {
        id: store.generateId(),
        packageName: '@internal/utils',
        version: '2.1.0',
        author: 'zhangsan',
        submitTime: '2024-01-15T10:30:00+08:00',
        timezoneOffset: -480,
        description: '工具函数库，包含常用工具方法',
        dependencies: [
          { name: 'lodash', version: '4.17.21' },
          { name: 'dayjs', version: '1.11.0' },
        ],
        riskLevel: 'low',
      },
      {
        id: store.generateId(),
        packageName: '@internal/components',
        version: '1.5.2',
        author: 'lisi',
        submitTime: '2024-01-15T14:20:00+08:00',
        timezoneOffset: -480,
        description: 'UI组件库',
        dependencies: [
          { name: 'react', version: '18.2.0' },
          { name: 'vue', version: '3.3.0' },
        ],
        riskLevel: 'medium',
      },
      {
        id: store.generateId(),
        packageName: '@internal/auth',
        version: '3.0.0',
        author: 'wangwu',
        submitTime: '2024-01-15T16:45:00+08:00',
        timezoneOffset: -480,
        description: '认证授权模块',
        dependencies: [
          { name: 'jsonwebtoken', version: '9.0.0' },
          { name: 'bcrypt', version: '5.1.0' },
          { name: 'passport', version: '0.6.0' },
        ],
        riskLevel: 'high',
      },
    ];
  }

  generateTimezoneAnomalyItems(): HandoverItem[] {
    return [
      {
        id: store.generateId(),
        packageName: '@external/logger',
        version: '1.0.0',
        author: 'zhaoliu',
        submitTime: '2024-01-15T09:00:00-05:00',
        timezoneOffset: 300,
        description: '海外团队提交的日志库',
        dependencies: [{ name: 'winston', version: '3.8.0' }],
        riskLevel: 'low',
      },
      {
        id: store.generateId(),
        packageName: '@hack/malicious',
        version: '0.0.1',
        author: 'hacker',
        submitTime: '2024-01-15T00:00:00-12:00',
        timezoneOffset: 720,
        description: '可疑的包，时区异常',
        dependencies: [],
        riskLevel: 'high',
      },
      {
        id: store.generateId(),
        packageName: '@test/experimental',
        version: 'alpha-1.0',
        author: 'tester',
        submitTime: '2024-01-15T23:59:59+14:00',
        timezoneOffset: -840,
        description: '实验性测试包',
        dependencies: [
          { name: 'dep1', version: '1.0' },
          { name: 'dep2', version: '2.0' },
          { name: 'dep3', version: '3.0' },
          { name: 'dep4', version: '4.0' },
          { name: 'dep5', version: '5.0' },
          { name: 'dep6', version: '6.0' },
        ],
        riskLevel: 'high',
      },
    ];
  }

  generateHandoverForm(): HandoverForm {
    const batchId = store.generateId();
    const normalItems = this.generateNormalItems();
    const anomalyItems = this.generateTimezoneAnomalyItems();

    const form: HandoverForm = {
      id: store.generateId(),
      batchId,
      title: '2024年第1批次内部包交接单',
      submitter: 'admin',
      submitTime: new Date().toISOString(),
      items: [...normalItems, ...anomalyItems],
      status: 'pending',
      ruleVersion: '1.0.0',
    };

    store.saveHandoverForm(form);
    return form;
  }

  createAnomalySamples(batchId: string, items: HandoverItem[]): AnomalySample[] {
    const anomalies: AnomalySample[] = [];

    for (const item of items) {
      if (item.timezoneOffset < -480 || item.timezoneOffset > 480) {
        const anomaly: AnomalySample = {
          id: store.generateId(),
          batchId,
          itemId: item.id,
          type: 'timezone',
          originalData: item,
          detectedAt: new Date().toISOString(),
          detectedByRule: '时区偏移检查（范围超限）',
          status: 'open',
        };
        store.saveAnomaly(anomaly);
        anomalies.push(anomaly);
      } else if (item.timezoneOffset !== -480) {
        const anomaly: AnomalySample = {
          id: store.generateId(),
          batchId,
          itemId: item.id,
          type: 'timezone',
          originalData: item,
          detectedAt: new Date().toISOString(),
          detectedByRule: '时区偏移检查（非北京时间）',
          status: 'open',
        };
        store.saveAnomaly(anomaly);
        anomalies.push(anomaly);
      }
    }

    return anomalies;
  }

  generateMembershipRenewalEdit(): void {
    const resourceScope = 'membership-renewal-2024-q1';
    
    const beforeData = {
      id: 'renewal-001',
      userId: 'user-123',
      amount: 99,
      renewDate: '2024-01-01',
      status: 'completed',
    };

    const afterData = {
      ...beforeData,
      amount: 199,
      status: 'updated',
    };

    store.saveHistoryRecord({
      id: store.generateId(),
      resourceType: 'handover',
      resourceId: 'renewal-001',
      resourceScope,
      action: 'update',
      before: beforeData,
      after: afterData,
      reason: '补改会员续费流水：用户升级套餐，从99元调整为199元',
      operator: 'finance-admin',
      operatedAt: new Date().toISOString(),
    });

    store.saveHistoryRecord({
      id: store.generateId(),
      resourceType: 'handover',
      resourceId: 'renewal-002',
      resourceScope,
      action: 'create',
      before: null,
      after: {
        id: 'renewal-002',
        userId: 'user-456',
        amount: 299,
        renewDate: '2024-01-15',
        status: 'added',
      },
      reason: '补录遗漏的会员续费记录',
      operator: 'finance-admin',
      operatedAt: new Date().toISOString(),
    });
  }
}

export const sampleGenerator = new SampleGenerator();
