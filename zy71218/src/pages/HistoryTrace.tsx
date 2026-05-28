import { useState, useEffect } from 'react';
import {
  Clock,
  User,
  FileText,
  Filter,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  GitCompare,
  Eye,
  Globe,
  Monitor,
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import Card from '@/components/Card';
import Table from '@/components/Table';
import Loading from '@/components/Loading';
import ErrorState from '@/components/ErrorState';
import Modal from '@/components/Modal';
import Tabs from '@/components/Tabs';
import Timeline from '@/components/Timeline';
import SearchBar from '@/components/SearchBar';
import { auditService } from '@/services/auditService';
import { historyService } from '@/services/historyService';
import { cn } from '@/lib/utils';
import type { AuditLog, VersionHistory } from '../../shared/types';
import { DATA_TYPE_LABELS } from '../../shared/types';

interface VersionDiff {
  field: string;
  before: any;
  after: any;
  changeType: 'added' | 'removed' | 'modified';
}

const ACTION_OPTIONS = [
  { key: 'create', label: '创建', value: 'create' },
  { key: 'update', label: '更新', value: 'update' },
  { key: 'delete', label: '删除', value: 'delete' },
  { key: 'login', label: '登录', value: 'login' },
  { key: 'export', label: '导出', value: 'export' },
];

const TARGET_TYPE_OPTIONS = [
  { key: 'case', label: '案件', value: 'case' },
  { key: 'invoice', label: '发票', value: 'invoice' },
  { key: 'confirmation', label: '买方确认', value: 'confirmation' },
  { key: 'contract', label: '保理合同', value: 'contract' },
  { key: 'repayment_plan', label: '回款计划', value: 'repayment_plan' },
  { key: 'collection_note', label: '催收记录', value: 'collection_note' },
  { key: 'risk_report', label: '风险报告', value: 'risk_report' },
];

const OPERATOR_OPTIONS = [
  { key: 'u001', label: '张明', value: 'u001' },
  { key: 'u002', label: '李华', value: 'u002' },
  { key: 'u003', label: '王芳', value: 'u003' },
];

const DATA_TYPE_OPTIONS = Object.entries(DATA_TYPE_LABELS).map(([value, label]) => ({
  key: value,
  label,
  value,
}));

export default function HistoryTrace() {
  const [activeTab, setActiveTab] = useState<'audit' | 'changes'>('audit');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditPagination, setAuditPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [versionHistory, setVersionHistory] = useState<VersionHistory[]>([]);
  const [versionPagination, setVersionPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    targetType: '',
    userId: '',
    startDate: '',
    endDate: '',
  });
  
  const [historyFilters, setHistoryFilters] = useState({
    recordType: '',
    operatorId: '',
    startDate: '',
    endDate: '',
  });
  
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<VersionHistory | null>(null);
  const [compareData, setCompareData] = useState<{ diffs: VersionDiff[] } | null>(null);

  const loadAuditLogs = async () => {
    try {
      const res = await auditService.getAuditLogs(
        {
          action: auditFilters.action || undefined,
          targetType: auditFilters.targetType || undefined,
          userId: auditFilters.userId || undefined,
          startDate: auditFilters.startDate || undefined,
          endDate: auditFilters.endDate || undefined,
        },
        auditPagination.current,
        auditPagination.pageSize
      );

      if (res.success && res.data) {
        setAuditLogs(res.data.list);
        setAuditPagination((prev) => ({ ...prev, total: res.data!.total }));
      }
    } catch (err: any) {
      setError(err.message || '加载审计日志失败');
    }
  };

  const loadVersionHistory = async () => {
    try {
      const res = await historyService.getChanges(
        versionPagination.current,
        versionPagination.pageSize,
        {
          recordType: historyFilters.recordType || undefined,
          operatorId: historyFilters.operatorId || undefined,
          startDate: historyFilters.startDate || undefined,
          endDate: historyFilters.endDate || undefined,
        }
      );

      if (res.success && res.data) {
        setVersionHistory(res.data.list);
        setVersionPagination((prev) => ({ ...prev, total: res.data!.total }));
      }
    } catch (err: any) {
      setError(err.message || '加载变更记录失败');
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadAuditLogs(), loadVersionHistory()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, auditPagination.current, auditPagination.pageSize, versionPagination.current, versionPagination.pageSize]);

  useEffect(() => {
    setAuditPagination((prev) => ({ ...prev, current: 1 }));
    setVersionPagination((prev) => ({ ...prev, current: 1 }));
  }, [auditFilters, historyFilters]);

  const handleAuditFilterChange = (key: string, value: string) => {
    setAuditFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleHistoryFilterChange = (key: string, value: string) => {
    setHistoryFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleViewLogDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const handleViewVersionCompare = (version: VersionHistory) => {
    setSelectedVersion(version);
    
    const beforeData = JSON.parse(version.beforeData || '{}');
    const afterData = JSON.parse(version.afterData || '{}');
    const changedFields = JSON.parse(version.changedFields || '[]');
    
    const diffs: VersionDiff[] = changedFields.map((field: string) => ({
      field,
      before: beforeData[field],
      after: afterData[field],
      changeType: beforeData[field] === undefined ? 'added' : afterData[field] === undefined ? 'removed' : 'modified',
    }));
    
    setCompareData({ diffs });
    setShowCompareModal(true);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return <CheckCircle size={14} className="text-green-500" />;
      case 'update':
        return <AlertTriangle size={14} className="text-amber-500" />;
      case 'delete':
        return <XCircle size={14} className="text-red-500" />;
      default:
        return <FileText size={14} className="text-blue-500" />;
    }
  };

  const auditColumns = [
    {
      key: 'timestamp',
      title: '操作时间',
      dataIndex: 'timestamp' as keyof AuditLog,
      render: (record: AuditLog) => (
        <span className="text-sm">
          {new Date(record.timestamp).toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      key: 'userName',
      title: '操作人',
      dataIndex: 'userName' as keyof AuditLog,
      render: (record: AuditLog) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
            <User size={12} className="text-blue-600" />
          </div>
          <span className="text-sm">{record.userName}</span>
        </div>
      ),
    },
    {
      key: 'action',
      title: '操作类型',
      dataIndex: 'action' as keyof AuditLog,
      render: (record: AuditLog) => (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
          {getActionIcon(record.action)}
          {record.action}
        </span>
      ),
    },
    {
      key: 'targetType',
      title: '操作对象',
      dataIndex: 'targetType' as keyof AuditLog,
      render: (record: AuditLog) => (
        <span className="text-sm">
          {DATA_TYPE_LABELS[record.targetType as keyof typeof DATA_TYPE_LABELS] || record.targetType}
        </span>
      ),
    },
    {
      key: 'targetId',
      title: '对象ID',
      dataIndex: 'targetId' as keyof AuditLog,
      render: (record: AuditLog) => (
        <span className="font-mono text-xs text-blue-600">{record.targetId}</span>
      ),
    },
    {
      key: 'ipAddress',
      title: 'IP地址',
      dataIndex: 'ipAddress' as keyof AuditLog,
      render: (record: AuditLog) => (
        <div className="flex items-center gap-1">
          <Globe size={12} className="text-slate-400" />
          <span className="font-mono text-xs text-slate-500">{record.ipAddress}</span>
        </div>
      ),
    },
    {
      key: 'action',
      title: '操作',
      render: (record: AuditLog) => (
        <button
          onClick={() => handleViewLogDetail(record)}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          <Eye size={14} />
          详情
        </button>
      ),
    },
  ];

  const versionColumns = [
    {
      key: 'timestamp',
      title: '变更时间',
      dataIndex: 'timestamp' as keyof VersionHistory,
      render: (record: VersionHistory) => (
        <span className="text-sm">
          {new Date(record.timestamp).toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      key: 'recordType',
      title: '数据类型',
      dataIndex: 'recordType' as keyof VersionHistory,
      render: (record: VersionHistory) => (
        <span className="text-sm">
          {DATA_TYPE_LABELS[record.recordType]}
        </span>
      ),
    },
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version' as keyof VersionHistory,
      render: (record: VersionHistory) => (
        <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
          v{record.version}
        </span>
      ),
    },
    {
      key: 'operatorName',
      title: '操作人',
      dataIndex: 'operatorName' as keyof VersionHistory,
    },
    {
      key: 'changeReason',
      title: '变更原因',
      dataIndex: 'changeReason' as keyof VersionHistory,
      render: (record: VersionHistory) => (
        <span className="text-sm text-slate-600 max-w-xs truncate">
          {record.changeReason || '-'}
        </span>
      ),
    },
    {
      key: 'action',
      title: '操作',
      render: (record: VersionHistory) => (
        <button
          onClick={() => handleViewVersionCompare(record)}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          <GitCompare size={14} />
          对比
        </button>
      ),
    },
  ];

  if (loading && auditLogs.length === 0 && versionHistory.length === 0) {
    return <Loading size="lg" text="加载历史数据..." className="h-[calc(100vh-180px)]" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <Tabs
          items={[
            { key: 'audit', label: '操作审计日志', icon: <Monitor size={16} /> },
            { key: 'changes', label: '变更记录时间线', icon: <Clock size={16} /> },
          ]}
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'audit' | 'changes')}
        />

        {activeTab === 'audit' ? (
          <>
            <div className="mb-4">
              <SearchBar
                placeholder="搜索操作人、对象ID..."
                value=""
                onChange={() => {}}
                filters={[
                  {
                    key: 'action',
                    label: '操作类型',
                    options: ACTION_OPTIONS,
                    value: auditFilters.action,
                    onChange: handleAuditFilterChange,
                  },
                  {
                    key: 'targetType',
                    label: '操作对象',
                    options: TARGET_TYPE_OPTIONS,
                    value: auditFilters.targetType,
                    onChange: handleAuditFilterChange,
                  },
                  {
                    key: 'userId',
                    label: '操作人',
                    options: OPERATOR_OPTIONS,
                    value: auditFilters.userId,
                    onChange: handleAuditFilterChange,
                  },
                ]}
                extraButtons={
                  <>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-600 whitespace-nowrap">
                        <Calendar size={12} className="inline mr-1" />
                        开始
                      </label>
                      <input
                        type="date"
                        value={auditFilters.startDate}
                        onChange={(e) => handleAuditFilterChange('startDate', e.target.value)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <label className="text-sm text-slate-600 whitespace-nowrap">结束</label>
                      <input
                        type="date"
                        value={auditFilters.endDate}
                        onChange={(e) => handleAuditFilterChange('endDate', e.target.value)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={loadAuditLogs}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      <RefreshCw size={14} />
                      刷新
                    </button>
                  </>
                }
              />
            </div>

            <Table<AuditLog>
              columns={auditColumns}
              data={auditLogs}
              loading={loading}
              rowKey={(record) => record.id}
              pagination={{
                current: auditPagination.current,
                pageSize: auditPagination.pageSize,
                total: auditPagination.total,
                onChange: (page, pageSize) => setAuditPagination({ ...auditPagination, current: page, pageSize }),
              }}
            />
          </>
        ) : (
          <>
            <div className="mb-4">
              <SearchBar
                placeholder="搜索记录ID..."
                value=""
                onChange={() => {}}
                filters={[
                  {
                    key: 'recordType',
                    label: '数据类型',
                    options: DATA_TYPE_OPTIONS,
                    value: historyFilters.recordType,
                    onChange: handleHistoryFilterChange,
                  },
                  {
                    key: 'operatorId',
                    label: '操作人',
                    options: OPERATOR_OPTIONS,
                    value: historyFilters.operatorId,
                    onChange: handleHistoryFilterChange,
                  },
                ]}
                extraButtons={
                  <>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-600 whitespace-nowrap">
                        <Calendar size={12} className="inline mr-1" />
                        开始
                      </label>
                      <input
                        type="date"
                        value={historyFilters.startDate}
                        onChange={(e) => handleHistoryFilterChange('startDate', e.target.value)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <label className="text-sm text-slate-600 whitespace-nowrap">结束</label>
                      <input
                        type="date"
                        value={historyFilters.endDate}
                        onChange={(e) => handleHistoryFilterChange('endDate', e.target.value)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={loadVersionHistory}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      <RefreshCw size={14} />
                      刷新
                    </button>
                  </>
                }
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-slate-700 mb-4 flex items-center gap-2">
                  <Clock size={18} />
                  变更时间线
                </h4>
                <Timeline
                  items={versionHistory.slice(0, 10).map((record) => ({
                    id: record.id,
                    title: `${DATA_TYPE_LABELS[record.recordType]} 变更 - v${record.version}`,
                    description: record.changeReason || '数据更新',
                    time: new Date(record.timestamp).toLocaleString('zh-CN'),
                    status: 'success',
                    extra: (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">操作人: {record.operatorName}</span>
                        <button
                          onClick={() => handleViewVersionCompare(record)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          查看变更
                        </button>
                      </div>
                    ),
                  }))}
                />
              </div>

              <div>
                <h4 className="font-medium text-slate-700 mb-4 flex items-center gap-2">
                  <FileText size={18} />
                  变更记录列表
                </h4>
                <Table<VersionHistory>
                  columns={versionColumns}
                  data={versionHistory}
                  loading={loading}
                  rowKey={(record) => record.id}
                  pagination={{
                    current: versionPagination.current,
                    pageSize: versionPagination.pageSize,
                    total: versionPagination.total,
                    onChange: (page, pageSize) => setVersionPagination({ ...versionPagination, current: page, pageSize }),
                  }}
                />
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal
        open={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedLog(null);
        }}
        title="操作详情"
        width="max-w-2xl"
      >
        {selectedLog && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500 mb-1">操作时间</p>
                <p className="font-medium text-slate-800">
                  {new Date(selectedLog.timestamp).toLocaleString('zh-CN')}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">操作人</p>
                <p className="font-medium text-slate-800">{selectedLog.userName}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">操作类型</p>
                <p className="font-medium text-slate-800">{selectedLog.action}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">操作对象</p>
                <p className="font-medium text-slate-800">
                  {DATA_TYPE_LABELS[selectedLog.targetType as keyof typeof DATA_TYPE_LABELS] || selectedLog.targetType}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">对象ID</p>
                <p className="font-mono font-medium text-blue-600">{selectedLog.targetId}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">IP地址</p>
                <p className="font-mono font-medium text-slate-800">{selectedLog.ipAddress}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-slate-500 mb-1">User Agent</p>
              <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg font-mono break-all">
                {selectedLog.userAgent}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500 mb-1">操作详情</p>
              <pre className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg overflow-auto max-h-48">
                {JSON.stringify(JSON.parse(selectedLog.detail || '{}'), null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={showCompareModal}
        onClose={() => {
          setShowCompareModal(false);
          setSelectedVersion(null);
          setCompareData(null);
        }}
        title="版本对比"
        width="max-w-2xl"
      >
        {selectedVersion && compareData && (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="text-sm text-slate-500">
                  {DATA_TYPE_LABELS[selectedVersion.recordType]} · v{selectedVersion.version - 1} → v{selectedVersion.version}
                </p>
                <p className="text-sm font-medium text-slate-800 mt-1">
                  操作人: {selectedVersion.operatorName} · {new Date(selectedVersion.timestamp).toLocaleString('zh-CN')}
                </p>
              </div>
              {selectedVersion.changeReason && (
                <p className="text-sm text-slate-600 bg-white px-3 py-1.5 rounded-lg">
                  原因: {selectedVersion.changeReason}
                </p>
              )}
            </div>

            {compareData.diffs.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-slate-600">两个版本完全一致，无差异</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {compareData.diffs.map((diff, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'p-4 border rounded-lg',
                      diff.changeType === 'added'
                        ? 'border-green-200 bg-green-50'
                        : diff.changeType === 'removed'
                        ? 'border-red-200 bg-red-50'
                        : 'border-amber-200 bg-amber-50'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          diff.changeType === 'added'
                            ? 'bg-green-200 text-green-800'
                            : diff.changeType === 'removed'
                            ? 'bg-red-200 text-red-800'
                            : 'bg-amber-200 text-amber-800'
                        )}
                      >
                        {diff.changeType === 'added' ? '新增' : diff.changeType === 'removed' ? '删除' : '修改'}
                      </span>
                      <span className="font-medium text-slate-800">{diff.field}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {diff.changeType !== 'added' && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">变更前</p>
                          <p
                            className={cn(
                              'p-2 rounded font-mono text-sm',
                              diff.changeType === 'removed' ? 'bg-red-100 line-through' : 'bg-slate-100'
                            )}
                          >
                            {String(diff.before)}
                          </p>
                        </div>
                      )}
                      {diff.changeType !== 'removed' && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">变更后</p>
                          <p className="p-2 rounded font-mono text-sm bg-green-100">
                            {String(diff.after)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
