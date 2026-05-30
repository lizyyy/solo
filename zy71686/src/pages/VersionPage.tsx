import { useState, useEffect, useRef } from 'react';
import { versionApi } from '../services/apiClient';
import { useAppStore, formatDate, getRiskLevelText } from '../store';
import { PageLoading } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import { RiskBadge } from '../components/RiskBadge';
import {
  History,
  GitBranch,
  CheckCircle2,
  ArrowLeftCircle,
  Play,
  Plus,
  FileText,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  Diff,
  Trash2,
} from 'lucide-react';
import type { VersionSnapshot, OperationLog, RollbackRequest } from '../../shared/types';

export function VersionPage() {
  const [selectedVersion, setSelectedVersion] = useState<VersionSnapshot | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionDesc, setNewVersionDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [compareVersion1, setCompareVersion1] = useState<string>('');
  const [compareVersion2, setCompareVersion2] = useState<string>('');
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareResult, setCompareResult] = useState<any>(null);

  const versions = useAppStore((state) => state.versions);
  const activeVersion = useAppStore((state) => state.activeVersion);
  const operationLogs = useAppStore((state) => state.operationLogs);
  const setVersions = useAppStore((state) => state.setVersions);
  const setActiveVersion = useAppStore((state) => state.setActiveVersion);
  const setOperationLogs = useAppStore((state) => state.setOperationLogs);
  const addNotification = useAppStore((state) => state.addNotification);

  const [logsLoading, setLogsLoading] = useState(true);
  const logsLoadedRef = useRef(false);

  useEffect(() => {
    if (logsLoadedRef.current) return;
    logsLoadedRef.current = true;

    const loadLogs = async () => {
      setLogsLoading(true);
      try {
        const res = await versionApi.listLogs(50);
        if (res.success && res.data) {
          setOperationLogs(res.data);
        }
      } catch (error) {
        console.error('Failed to load logs:', error);
      } finally {
        setLogsLoading(false);
      }
    };

    loadLogs();
  }, []);

  const versionsLoadedRef = useRef(false);
  useEffect(() => {
    if (versionsLoadedRef.current) return;
    versionsLoadedRef.current = true;
    loadVersions();
  }, []);

  const loadVersions = async () => {
    try {
      const [allVersionsRes, activeVersionRes] = await Promise.all([
        versionApi.listSnapshots(50),
        versionApi.getActiveSnapshot(),
      ]);
      if (allVersionsRes.success && allVersionsRes.data) {
        setVersions(allVersionsRes.data);
      }
      if (activeVersionRes.success && activeVersionRes.data) {
        setActiveVersion(activeVersionRes.data);
      }
    } catch (error) {
      console.error('Failed to load versions:', error);
    }
  };

  const handleActivateVersion = async (versionId: string) => {
    setLoading(true);
    try {
      const res = await versionApi.setActiveSnapshot(versionId);
      if (res.success && res.data) {
        setActiveVersion(res.data);
        addNotification({
          type: 'success',
          title: '切换成功',
          message: `已切换到版本：${res.data.name}`,
        });
        loadVersions();
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: '切换失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!selectedVersion || !rollbackReason.trim()) {
      addNotification({
        type: 'warning',
        title: '请填写撤回原因',
        message: '撤回操作需要说明原因',
      });
      return;
    }

    setLoading(true);
    try {
      const data: RollbackRequest = {
        snapshotId: selectedVersion.id,
        reason: rollbackReason,
      };
      const res = await versionApi.rollback(data);
      if (res.success && res.data) {
        addNotification({
          type: 'success',
          title: '撤回成功',
          message: `已撤回至版本：${selectedVersion.name}，影响 ${res.data.affectedCount} 条记录`,
        });
        setShowRollbackModal(false);
        setRollbackReason('');
        loadVersions();
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: '撤回失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!newVersionName.trim()) {
      addNotification({
        type: 'warning',
        title: '请输入版本名称',
        message: '版本名称不能为空',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await versionApi.createSnapshot({
        name: newVersionName,
        description: newVersionDesc,
      });
      if (res.success && res.data) {
        addNotification({
          type: 'success',
          title: '创建成功',
          message: `已创建新版本：${res.data.name}`,
        });
        setShowCreateModal(false);
        setNewVersionName('');
        setNewVersionDesc('');
        loadVersions();
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: '创建失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUndoOperation = async (logId: string) => {
    setLoading(true);
    try {
      const res = await versionApi.undoOperation(logId);
      if (res.success && res.data) {
        addNotification({
          type: 'success',
          title: '撤销成功',
          message: '操作已撤销',
        });
        loadVersions();
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: '撤销失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!compareVersion1 || !compareVersion2) {
      addNotification({
        type: 'warning',
        title: '请选择两个版本',
        message: '需要选择两个版本进行对比',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await versionApi.compare(compareVersion1, compareVersion2);
      if (res.success && res.data) {
        setCompareResult(res.data);
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: '对比失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    } finally {
      setLoading(false);
    }
  };

  const versionColumns = [
    {
      key: 'name',
      header: '版本名称',
      sortable: true,
      width: '200px',
      render: (row: VersionSnapshot) => (
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-primary-500" />
          <span className="font-medium text-gray-900">{row.name}</span>
          {row.isActive && (
            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded">
              当前
            </span>
          )}
        </div>
      ),
    },
    { key: 'description', header: '说明', width: '250px' },
    { key: 'createdBy', header: '创建人', width: '100px', render: (row: VersionSnapshot) => (
      <div className="flex items-center gap-1">
        <User className="w-3 h-3 text-gray-400" />
        <span className="text-sm text-gray-600">{row.createdBy}</span>
      </div>
    )},
    {
      key: 'createdAt',
      header: '创建时间',
      sortable: true,
      width: '160px',
      render: (row: VersionSnapshot) => formatDate(row.createdAt),
    },
    {
      key: 'dataFiles',
      header: '包含文件',
      width: '100px',
      align: 'center' as const,
      render: (row: VersionSnapshot) => (
        <span className="text-sm text-gray-600">{row.dataFiles?.length || 0} 个</span>
      ),
    },
    {
      key: 'actions',
      header: '操作',
      width: '220px',
      render: (row: VersionSnapshot) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setSelectedVersion(row); setShowDetailModal(true); }}
            className="px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 rounded"
          >
            详情
          </button>
          {!row.isActive && (
            <button
              onClick={() => handleActivateVersion(row.id)}
              disabled={loading}
              className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded"
            >
              切换
            </button>
          )}
          {row.canRollback && (
            <button
              onClick={() => { setSelectedVersion(row); setShowRollbackModal(true); }}
              className="px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 rounded"
            >
              撤回
            </button>
          )}
        </div>
      ),
    },
  ];

  const logColumns = [
    {
      key: 'operationType',
      header: '操作类型',
      width: '120px',
      render: (row: OperationLog) => (
        <span className={`px-2 py-1 text-xs font-medium rounded ${
          row.operationType.includes('导入') ? 'bg-blue-100 text-blue-700' :
          row.operationType.includes('撤回') ? 'bg-amber-100 text-amber-700' :
          row.operationType.includes('分析') ? 'bg-purple-100 text-purple-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {row.operationType}
        </span>
      ),
    },
    { key: 'description', header: '操作描述', width: '300px' },
    { key: 'operator', header: '操作人', width: '100px' },
    {
      key: 'timestamp',
      header: '操作时间',
      sortable: true,
      width: '160px',
      render: (row: OperationLog) => formatDate(row.timestamp),
    },
    {
      key: 'affectedObjects',
      header: '影响对象',
      width: '100px',
      align: 'center' as const,
      render: (row: OperationLog) => (
        <span className="text-sm text-gray-600">{row.affectedObjects?.length || 0} 个</span>
      ),
    },
    {
      key: 'actions',
      header: '操作',
      width: '100px',
      render: (row: OperationLog) =>
        row.canUndo ? (
          <button
            onClick={() => handleUndoOperation(row.id)}
            disabled={loading}
            className="px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 rounded"
          >
            撤销
          </button>
        ) : (
          <span className="text-xs text-gray-400">不可撤销</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">版本管理</h1>
          <p className="text-gray-500 mt-1">管理数据版本，支持切换、撤回和版本对比</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setCompareVersion1('');
              setCompareVersion2('');
              setCompareResult(null);
              setShowCompareModal(true);
            }}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Diff className="w-4 h-4" />
            版本对比
          </button>
          <button
            onClick={() => {
              const date = new Date();
              const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
              setNewVersionName(`手动快照_${dateStr}`);
              setNewVersionDesc('');
              setShowCreateModal(true);
            }}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            创建快照
          </button>
        </div>
      </div>

      {activeVersion && (
        <div className="card border-primary-200 bg-primary-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center">
                <GitBranch className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">{activeVersion.name}</h3>
                  <span className="px-2 py-0.5 bg-primary-500 text-white text-xs font-medium rounded">
                    当前版本
                  </span>
                </div>
                <p className="text-sm text-primary-700 mt-0.5">{activeVersion.description || '无描述'}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-primary-600">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {activeVersion.createdBy}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(activeVersion.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {activeVersion.dataFiles?.length || 0} 个数据文件
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-primary-600">数据版本</p>
              <p className="text-sm font-mono font-medium text-primary-700">{activeVersion.dataVersion}</p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">版本快照</h2>
        <DataTable
          columns={versionColumns}
          data={versions}
          pageSize={10}
          emptyMessage="暂无版本快照"
        />
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">操作日志</h2>
        {logsLoading ? (
          <PageLoading message="加载操作日志..." />
        ) : (
          <DataTable
            columns={logColumns}
            data={operationLogs}
            pageSize={10}
            emptyMessage="暂无操作日志"
          />
        )}
      </div>

      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="版本详情"
        size="lg"
      >
        {selectedVersion && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">版本名称</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{selectedVersion.name}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">创建人</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{selectedVersion.createdBy}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">创建时间</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{formatDate(selectedVersion.createdAt)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">数据文件数</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{selectedVersion.dataFiles?.length || 0} 个</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">版本说明</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                {selectedVersion.description || '无'}
              </p>
            </div>

            {selectedVersion.dataFiles && selectedVersion.dataFiles.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">包含的数据文件</p>
                <div className="space-y-2">
                  {selectedVersion.dataFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{file}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowDetailModal(false)}
                className="btn btn-secondary"
              >
                关闭
              </button>
              {!selectedVersion.isActive && (
                <button
                  onClick={() => {
                    handleActivateVersion(selectedVersion.id);
                    setShowDetailModal(false);
                  }}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  切换到此版本
                </button>
              )}
              {selectedVersion.canRollback && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setShowRollbackModal(true);
                  }}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <ArrowLeftCircle className="w-4 h-4" />
                  撤回到此版本
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showRollbackModal}
        onClose={() => setShowRollbackModal(false)}
        title="确认撤回"
        size="md"
      >
        {selectedVersion && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">撤回操作不可逆</p>
                  <p className="text-xs text-amber-600 mt-1">
                    撤回后，系统将恢复到版本「{selectedVersion.name}」的状态，之后的数据变更将会被撤销。请谨慎操作。
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                撤回原因 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                placeholder="请说明撤回原因，便于后续追溯..."
                rows={3}
                className="input w-full resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowRollbackModal(false)}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleRollback}
                disabled={loading || !rollbackReason.trim()}
                className="btn bg-red-500 hover:bg-red-600 text-white flex items-center gap-2"
              >
                <ArrowLeftCircle className="w-4 h-4" />
                确认撤回
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="创建版本快照"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              版本名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newVersionName}
              onChange={(e) => setNewVersionName(e.target.value)}
              placeholder="请输入版本名称"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              版本说明（可选）
            </label>
            <textarea
              value={newVersionDesc}
              onChange={(e) => setNewVersionDesc(e.target.value)}
              placeholder="请输入版本说明..."
              rows={3}
              className="input w-full resize-none"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              <CheckCircle2 className="w-4 h-4 inline mr-1" />
              快照将保存当前所有数据的完整状态，便于后续追溯和恢复。
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => setShowCreateModal(false)}
              className="btn btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleCreateVersion}
              disabled={loading || !newVersionName.trim()}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              创建快照
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        title="版本对比"
        size="xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">基准版本</label>
              <select
                value={compareVersion1}
                onChange={(e) => setCompareVersion1(e.target.value)}
                className="input w-full"
              >
                <option value="">请选择版本</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.isActive ? '(当前)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">对比版本</label>
              <select
                value={compareVersion2}
                onChange={(e) => setCompareVersion2(e.target.value)}
                className="input w-full"
              >
                <option value="">请选择版本</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.isActive ? '(当前)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleCompare}
            disabled={loading || !compareVersion1 || !compareVersion2}
            className="w-full btn btn-primary flex items-center justify-center gap-2"
          >
            <Diff className="w-4 h-4" />
            {loading ? '对比中...' : '开始对比'}
          </button>

          {compareResult && (
            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">对比结果</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{compareResult.added || 0}</p>
                  <p className="text-xs text-gray-500">新增记录</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{compareResult.modified || 0}</p>
                  <p className="text-xs text-gray-500">修改记录</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{compareResult.removed || 0}</p>
                  <p className="text-xs text-gray-500">删除记录</p>
                </div>
              </div>

              {compareResult.details && compareResult.details.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-2">变更详情</p>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {compareResult.details.map((item: any, index: number) => (
                      <div
                        key={index}
                        className={`p-2 rounded-lg text-sm ${
                          item.type === 'added'
                            ? 'bg-green-50 text-green-700'
                            : item.type === 'modified'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        <span className="font-medium">
                          {item.type === 'added' ? '+ 新增' : item.type === 'modified' ? '~ 修改' : '- 删除'}
                        </span>
                        <span className="ml-2">{item.objectName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
