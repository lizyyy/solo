import { RenewalBatch } from '../types';

const now = new Date().toISOString();
const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
const twoHoursAgo = new Date(Date.now() - 7200000).toISOString();
const threeHoursAgo = new Date(Date.now() - 10800000).toISOString();

export const mockBatches: RenewalBatch[] = [
  {
    id: 'batch-001',
    name: '2026年5月第一批证书续期',
    createdAt: threeHoursAgo,
    createdBy: 'admin',
    status: 'partial',
    deviceGroups: ['factory-a', 'factory-b'],
    expiryThresholdDays: 30,
    totalDevices: 10,
    records: [
      { deviceId: 'dev-001', status: 'success', oldCertSn: 'OLD-CERT-001', newCertSn: 'NEW-CERT-001', issuedAt: twoHoursAgo, issueReceipt: 'CA-RECEIPT-20260515-0001' },
      { deviceId: 'dev-002', status: 'success', oldCertSn: 'OLD-CERT-002', newCertSn: 'NEW-CERT-002', issuedAt: twoHoursAgo, issueReceipt: 'CA-RECEIPT-20260515-0002' },
      { deviceId: 'dev-003', status: 'compensating', oldCertSn: 'OLD-CERT-003' },
      { deviceId: 'dev-004', status: 'failed', oldCertSn: 'OLD-CERT-004', issueError: '设备证书CSR格式错误' },
      { deviceId: 'dev-005', status: 'compensating', oldCertSn: 'OLD-CERT-005' },
      { deviceId: 'dev-006', status: 'revoke_failed', oldCertSn: 'OLD-CERT-006', newCertSn: 'NEW-CERT-006', issuedAt: twoHoursAgo, issueReceipt: 'CA-RECEIPT-20260515-0006', revokeError: 'CA服务连接超时' },
      { deviceId: 'dev-007', status: 'success', oldCertSn: 'OLD-CERT-007', newCertSn: 'NEW-CERT-007', issuedAt: oneHourAgo, issueReceipt: 'CA-RECEIPT-20260515-0007', revokedAt: oneHourAgo, revokeReceipt: 'CA-REVOKE-007' },
      { deviceId: 'dev-008', status: 'compensating', oldCertSn: 'OLD-CERT-008' },
      { deviceId: 'dev-009', status: 'pending', oldCertSn: 'OLD-CERT-009' },
      { deviceId: 'dev-010', status: 'success', oldCertSn: 'OLD-CERT-010', newCertSn: 'NEW-CERT-010', issuedAt: oneHourAgo, issueReceipt: 'CA-RECEIPT-20260515-0010', revokedAt: oneHourAgo, revokeReceipt: 'CA-REVOKE-010' },
    ],
    compensationAttempts: [
      { id: 'comp-001', deviceId: 'dev-003', operator: 'operator_zhang', attemptedAt: twoHoursAgo, status: 'failed', errorMessage: '设备离线，无法建立连接' },
      { id: 'comp-002', deviceId: 'dev-003', operator: 'operator_li', attemptedAt: oneHourAgo, status: 'failed', errorMessage: '设备仍离线' },
      { id: 'comp-003', deviceId: 'dev-005', operator: 'operator_zhang', attemptedAt: oneHourAgo, status: 'failed', errorMessage: '网络超时' },
      { id: 'comp-004', deviceId: 'dev-008', operator: 'operator_wang', attemptedAt: oneHourAgo, status: 'failed', errorMessage: '设备响应超时' },
    ]
  },
  {
    id: 'batch-002',
    name: '仓库物流设备续期',
    createdAt: twoHoursAgo,
    createdBy: 'operator_zhang',
    status: 'processing',
    deviceGroups: ['warehouse', 'logistics'],
    expiryThresholdDays: 15,
    totalDevices: 6,
    records: [
      { deviceId: 'dev-011', status: 'pending', oldCertSn: 'OLD-CERT-011' },
      { deviceId: 'dev-012', status: 'compensating', oldCertSn: 'OLD-CERT-012' },
      { deviceId: 'dev-013', status: 'pending', oldCertSn: 'OLD-CERT-013' },
      { deviceId: 'dev-016', status: 'compensating', oldCertSn: 'OLD-CERT-016' },
      { deviceId: 'dev-017', status: 'pending', oldCertSn: 'OLD-CERT-017' },
      { deviceId: 'dev-018', status: 'pending', oldCertSn: 'OLD-CERT-018' },
    ],
    compensationAttempts: [
      { id: 'comp-005', deviceId: 'dev-012', operator: 'operator_zhang', attemptedAt: oneHourAgo, status: 'failed', errorMessage: '分拣系统维护中' },
      { id: 'comp-006', deviceId: 'dev-016', operator: 'operator_li', attemptedAt: oneHourAgo, status: 'failed', errorMessage: '车辆信号弱' },
    ]
  }
];