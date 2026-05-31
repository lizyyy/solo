import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DepositRecord,
  Material,
  AuditLog,
  StatusHistory,
  DepositStatus,
  ChangeType,
  StoreState,
  StoreActions,
  STATUS_LABELS,
} from '../types';
import {
  mockRecords,
  mockMaterials,
  mockAuditLogs,
  mockStatusHistories,
} from '../data/mockData';

const generateId = () => Math.random().toString(36).substring(2, 9);
const getCurrentTime = () => new Date().toISOString();

type Store = StoreState & StoreActions;

export const useDepositStore = create<Store>()(
  persist(
    (set, get) => ({
      records: mockRecords,
      materials: mockMaterials,
      auditLogs: mockAuditLogs,
      statusHistories: mockStatusHistories,
      currentUser: '当前用户',

      addRecord: (record) => {
        const newRecord: DepositRecord = {
          ...record,
          id: generateId(),
          createdAt: getCurrentTime(),
          updatedAt: getCurrentTime(),
        };
        const newLog: AuditLog = {
          id: generateId(),
          recordId: newRecord.id,
          actionType: 'create',
          changeType: 'material',
          operator: get().currentUser,
          timestamp: getCurrentTime(),
          reason: '新建保证金退款记录',
        };
        const newStatusHistory: StatusHistory = {
          id: generateId(),
          recordId: newRecord.id,
          status: record.status,
          operator: get().currentUser,
          timestamp: getCurrentTime(),
          remark: '新建记录',
        };
        set((state) => ({
          records: [...state.records, newRecord],
          auditLogs: [...state.auditLogs, newLog],
          statusHistories: [...state.statusHistories, newStatusHistory],
        }));
        return newRecord.id;
      },

      updateRecord: (id, updates, reason, changeType) => {
        const oldRecord = get().records.find((r) => r.id === id);
        if (!oldRecord) return;

        const newLog: AuditLog = {
          id: generateId(),
          recordId: id,
          actionType: 'update',
          changeType,
          operator: get().currentUser,
          timestamp: getCurrentTime(),
          reason,
          oldValue: JSON.stringify(oldRecord),
          newValue: JSON.stringify({ ...oldRecord, ...updates }),
        };

        set((state) => ({
          records: state.records.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: getCurrentTime() } : r
          ),
          auditLogs: [...state.auditLogs, newLog],
        }));
      },

      addMaterial: (material) => {
        const newMaterial: Material = {
          ...material,
          id: generateId(),
          uploadedAt: getCurrentTime(),
        };
        const newLog: AuditLog = {
          id: generateId(),
          recordId: material.recordId,
          actionType: 'upload',
          changeType: 'material',
          operator: get().currentUser,
          timestamp: getCurrentTime(),
          reason: `上传${material.type === 'refund_list' ? '退款清单' : material.type === 'settlement' ? '结算附件' : '对账单'}: ${material.name}`,
        };

        set((state) => ({
          materials: [...state.materials, newMaterial],
          auditLogs: [...state.auditLogs, newLog],
        }));

        const materials = get().materials.filter((m) => m.recordId === material.recordId);
        const hasRefundList = materials.some((m) => m.type === 'refund_list');
        const hasSettlement = materials.some((m) => m.type === 'settlement');
        const currentRecord = get().records.find((r) => r.id === material.recordId);

        if (material.type === 'refund_list' && hasRefundList) {
          get().changeStatus(
            material.recordId,
            'waiting_settlement',
            get().currentUser,
            '退款清单已上传，等待结算附件',
            '退款清单已上传',
            'material'
          );
        } else if (material.type === 'settlement' && hasSettlement && hasRefundList) {
          if (currentRecord?.status === 'waiting_settlement') {
            get().changeStatus(
              material.recordId,
              'settlement_attached',
              get().currentUser,
              '结算附件已补传',
              '结算附件已上传',
              'material'
            );
          }
        }
      },

      changeStatus: (recordId, newStatus, operator, remark, reason, changeType) => {
        const newStatusHistory: StatusHistory = {
          id: generateId(),
          recordId,
          status: newStatus,
          operator,
          timestamp: getCurrentTime(),
          remark,
        };
        const newLog: AuditLog = {
          id: generateId(),
          recordId,
          actionType: 'status_change',
          changeType,
          operator,
          timestamp: getCurrentTime(),
          reason,
        };

        set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  status: newStatus,
                  pendingReason: remark,
                  updatedAt: getCurrentTime(),
                }
              : r
          ),
          statusHistories: [...state.statusHistories, newStatusHistory],
          auditLogs: [...state.auditLogs, newLog],
        }));
      },

      getRecordById: (id) => {
        return get().records.find((r) => r.id === id);
      },

      getMaterialsByRecordId: (recordId) => {
        return get().materials.filter((m) => m.recordId === recordId);
      },

      getAuditLogsByRecordId: (recordId) => {
        return get().auditLogs.filter((a) => a.recordId === recordId);
      },

      getStatusHistoryByRecordId: (recordId) => {
        return get()
          .statusHistories.filter((s) => s.recordId === recordId)
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      },

      exportRecord: (recordId) => {
        const record = get().getRecordById(recordId);
        if (!record) return '';

        const materials = get().getMaterialsByRecordId(recordId);
        const auditLogs = get().getAuditLogsByRecordId(recordId);
        const statusHistory = get().getStatusHistoryByRecordId(recordId);

        const formatDate = (dateStr: string) => {
          return new Date(dateStr).toLocaleString('zh-CN');
        };

        const formatMoney = (amount: number) => {
          return `¥${amount.toLocaleString('zh-CN')}`;
        };

        let content = '';
        content += '='.repeat(60) + '\n';
        content += '加盟商保证金退款对账说明\n';
        content += '='.repeat(60) + '\n\n';

        content += '【基本信息】\n';
        content += `- 加盟商：${record.franchiseeName}\n`;
        content += `- 保证金金额：${formatMoney(record.amount)}\n`;
        content += `- 来源：${record.source}\n`;
        content += `- 当前状态：${STATUS_LABELS[record.status]}\n`;
        content += `- 创建时间：${formatDate(record.createdAt)}\n`;
        content += `- 更新时间：${formatDate(record.updatedAt)}\n`;
        if (record.pendingReason) {
          content += `- 待处理原因：${record.pendingReason}\n`;
        }
        content += '\n';

        content += '【材料附件清单】\n';
        if (materials.length === 0) {
          content += '  暂无材料\n';
        } else {
          materials.forEach((m, i) => {
            const typeLabel =
              m.type === 'refund_list'
                ? '退款清单'
                : m.type === 'settlement'
                ? '结算附件'
                : '对账单';
            content += `  ${i + 1}. [${typeLabel}] ${m.name}\n`;
            content += `      上传人：${m.uploader} | 时间：${formatDate(m.uploadedAt)}\n`;
            if (m.description) {
              content += `      说明：${m.description}\n`;
            }
          });
        }
        content += '\n';

        content += '【状态流转历史】\n';
        statusHistory.forEach((s, i) => {
          content += `  ${i + 1}. ${formatDate(s.timestamp)}\n`;
          content += `      状态：${STATUS_LABELS[s.status]}\n`;
          content += `      操作人：${s.operator} | 备注：${s.remark}\n`;
        });
        content += '\n';

        content += '【操作审计记录】\n';
        content += '  （注：【补材料】为补充附件，不改变结论；【改结论】为实质修改）\n';
        auditLogs
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
          .forEach((log, i) => {
            const changeLabel = log.changeType === 'material' ? '补材料' : '改结论';
            const changeFlag = log.changeType === 'material' ? '  ' : '*';
            content += `  ${changeFlag}${i + 1}. ${formatDate(log.timestamp)} [${changeLabel}]\n`;
            content += `      操作人：${log.operator}\n`;
            content += `      原因：${log.reason}\n`;
            if (log.oldValue && log.newValue) {
              content += `      变更：有内容修改\n`;
            }
          });

        content += '\n' + '='.repeat(60) + '\n';
        content += '导出时间：' + formatDate(getCurrentTime()) + '\n';
        content += '='.repeat(60) + '\n';

        return content;
      },
    }),
    {
      name: 'deposit-storage',
    }
  )
);
