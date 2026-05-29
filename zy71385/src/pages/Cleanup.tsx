import { useState, useEffect } from 'react';
import { Trash2, Play, RotateCcw, CheckSquare, Square, AlertTriangle, CheckCircle, Clock, User, FileText, Info } from 'lucide-react';
import { useFlagStore } from '../store/flagStore';
import { Card } from '../components/Card';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { RiskBadge } from '../components/RiskBadge';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmModal } from '../components/ConfirmModal';
import { getSuggestedActionLabel } from '../utils/riskCalculator';
import { formatDateTime } from '../utils/dateUtils';
import type { FlagWithDetails } from '../types';

export function Cleanup() {
  const {
    flags,
    cleanupLogs,
    initData,
    loading,
    selectedFlags,
    toggleFlagSelection,
    selectAllFlags,
    clearSelection,
    executeCleanup,
    rollbackCleanup,
    getStatistics,
  } = useFlagStore();

  const [cleanupNote, setCleanupNote] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  useEffect(() => {
    if (flags.length === 0) initData();
  }, [flags.length, initData]);

  const stats = getStatistics();
  
  const safeToDeleteFlags = flags.filter(f => f.suggestedAction === 'safe_delete');
  const needVerifyFlags = flags.filter(f => f.suggestedAction === 'verify_first');
  const selectedSafeFlags = selectedFlags.filter(id => {
    const flag = flags.find(f => f.id === id);
    return flag?.suggestedAction === 'safe_delete';
  }).length;

  const runSimulation = () => {
    const willDelete = flags.filter(f => selectedFlags.includes(f.id));
    const blocked = willDelete.filter(f => f.riskLevel === 'blocker' || f.riskLevel === 'high');
    
    setSimulationResult({
      total: selectedFlags.length,
      safe: selectedSafeFlags,
      needVerify: selectedFlags.length - selectedSafeFlags,
      blocked: blocked.length,
      flags: willDelete,
    });
  };

  const handleExecuteCleanup = () => {
    executeCleanup(selectedFlags, cleanupNote || '批量清理过期开关');
    setShowConfirm(false);
    setSimulationResult(null);
    setCleanupNote('');
  };

  const allSafeSelected = safeToDeleteFlags.length > 0 && 
    safeToDeleteFlags.every(f => selectedFlags.includes(f.id));

  return (
    <div className="space-y-6">
      {loading && <LoadingOverlay message="正在处理..." />}
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">清理执行台</h1>
          <p className="text-gray-500 mt-1">生成删除清单，执行批量清理，支持回滚操作</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (!allSafeSelected) {
                safeToDeleteFlags.forEach(f => toggleFlagSelection(f.id));
              } else {
                safeToDeleteFlags.forEach(f => {
                  if (selectedFlags.includes(f.id)) {
                    toggleFlagSelection(f.id);
                  }
                });
              }
            }}
            className="btn-secondary flex items-center gap-2"
          >
            <CheckSquare className="w-4 h-4" />
            {allSafeSelected ? '取消全选安全项' : '全选可安全清理'}
          </button>
          <button
            onClick={runSimulation}
            disabled={selectedFlags.length === 0}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            模拟清理
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={selectedFlags.length === 0}
            className="btn-danger flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            执行清理 ({selectedFlags.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <Card
          title="可安全删除"
          value={safeToDeleteFlags.length}
          icon={<CheckCircle className="w-6 h-6" />}
          color="green"
          trend="建议优先清理"
        />
        <Card
          title="需人工确认"
          value={needVerifyFlags.length}
          icon={<AlertTriangle className="w-6 h-6" />}
          color="orange"
          trend="请逐一核查"
        />
        <Card
          title="已选择"
          value={selectedFlags.length}
          icon={<CheckSquare className="w-6 h-6" />}
          color="blue"
          trend={`${selectedSafeFlags} 个安全项`}
        />
        <Card
          title="今日已清理"
          value={cleanupLogs.filter(l => l.action === 'delete' && new Date(l.timestamp).toDateString() === new Date().toDateString()).length}
          icon={<Trash2 className="w-6 h-6" />}
          color="red"
        />
      </div>

      {simulationResult && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">清理模拟结果</h2>
            <button
              onClick={() => setSimulationResult(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              关闭
            </button>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <p className="text-3xl font-bold text-gray-900">{simulationResult.total}</p>
              <p className="text-sm text-gray-500">总计</p>
            </div>
            <div className="p-4 bg-green-50 rounded-xl text-center">
              <p className="text-3xl font-bold text-green-600">{simulationResult.safe}</p>
              <p className="text-sm text-green-600">安全删除</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-xl text-center">
              <p className="text-3xl font-bold text-orange-600">{simulationResult.needVerify}</p>
              <p className="text-sm text-orange-600">需确认</p>
            </div>
            <div className="p-4 bg-red-50 rounded-xl text-center">
              <p className="text-3xl font-bold text-red-600">{simulationResult.blocked}</p>
              <p className="text-sm text-red-600">高风险</p>
            </div>
          </div>
          {simulationResult.blocked > 0 && (
            <div className="p-4 bg-red-50 rounded-xl border border-red-100 mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800 mb-1">高风险警告</p>
                  <p className="text-sm text-red-700">
                    您选择的 {simulationResult.blocked} 个开关包含高风险或阻塞项，建议移除后再执行清理。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">删除清单</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                已选择 {selectedFlags.length} 项
              </span>
              {selectedFlags.length > 0 && (
                <button onClick={clearSelection} className="text-sm text-primary-600 hover:text-primary-700">
                  清除选择
                </button>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">清理备注</label>
            <input
              type="text"
              placeholder="请输入清理备注，便于后续追溯..."
              value={cleanupNote}
              onChange={(e) => setCleanupNote(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-100">
                  <th className="table-header w-12">
                    <button onClick={selectAllFlags} className="p-1">
                      <CheckSquare className="w-4 h-4 text-primary-600" />
                    </button>
                  </th>
                  <th className="table-header">开关名称</th>
                  <th className="table-header">负责人</th>
                  <th className="table-header">风险等级</th>
                  <th className="table-header">建议操作</th>
                  <th className="table-header">状态</th>
                </tr>
              </thead>
              <tbody>
                {flags
                  .filter(f => f.suggestedAction !== 'do_not_delete')
                  .sort((a, b) => {
                    const order = { low: 0, medium: 1, high: 2, blocker: 3 };
                    return (order[a.riskLevel || 'medium'] || 0) - (order[b.riskLevel || 'medium'] || 0);
                  })
                  .map((flag) => (
                    <tr
                      key={flag.id}
                      className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                        flag.riskLevel === 'blocker' ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <td className="table-cell">
                        <button
                          onClick={() => toggleFlagSelection(flag.id)}
                          disabled={flag.suggestedAction === 'do_not_delete'}
                          className="p-1 disabled:opacity-30"
                        >
                          {selectedFlags.includes(flag.id) ? (
                            <CheckSquare className="w-4 h-4 text-primary-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-300" />
                          )}
                        </button>
                      </td>
                      <td className="table-cell">
                        <div>
                          <p className="font-medium text-gray-900">{flag.name}</p>
                          <p className="text-xs text-gray-400 font-mono">{flag.key}</p>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className={flag.owner ? 'text-gray-700' : 'text-risk-medium'}>
                          {flag.owner || '-'}
                        </span>
                      </td>
                      <td className="table-cell">
                        {flag.riskLevel && <RiskBadge level={flag.riskLevel} />}
                      </td>
                      <td className="table-cell">
                        <span className={`text-xs font-medium ${
                          flag.suggestedAction === 'safe_delete' ? 'text-risk-low' :
                          flag.suggestedAction === 'verify_first' ? 'text-risk-medium' :
                          'text-risk-high'
                        }`}>
                          {flag.suggestedAction && getSuggestedActionLabel(flag.suggestedAction)}
                        </span>
                      </td>
                      <td className="table-cell">
                        <StatusBadge status={flag.status} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">操作日志</h2>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {cleanupLogs.slice(0, 20).map((log) => {
              const flag = flags.find(f => f.id === log.flagId);
              return (
                <div key={log.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {log.action === 'delete' ? (
                        <Trash2 className="w-4 h-4 text-red-500" />
                      ) : log.action === 'rollback' ? (
                        <RotateCcw className="w-4 h-4 text-blue-500" />
                      ) : log.action === 'scan' ? (
                        <FileText className="w-4 h-4 text-green-500" />
                      ) : (
                        <Info className="w-4 h-4 text-gray-400" />
                      )}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        log.action === 'delete' ? 'bg-red-100 text-red-700' :
                        log.action === 'rollback' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {log.action === 'delete' ? '删除' : 
                         log.action === 'rollback' ? '回滚' :
                         log.action === 'scan' ? '扫描' :
                         log.action === 'assess' ? '评估' : '导入'}
                      </span>
                    </div>
                    {log.action === 'delete' && (
                      <button
                        onClick={() => rollbackCleanup(log.id)}
                        className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        回滚
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 font-medium">
                    {flag?.name || '未知开关'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{log.note}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {log.operator}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(log.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleExecuteCleanup}
        title="确认执行清理"
        message={`确定要清理选中的 ${selectedFlags.length} 个功能开关吗？此操作将记录在操作日志中，可以通过日志回滚。${
          selectedSafeFlags < selectedFlags.length
            ? ` 注意：其中 ${selectedFlags.length - selectedSafeFlags} 个不是低风险项，请确认已人工核查。`
            : ''
        }`}
        confirmText="确认清理"
        variant="danger"
      />
    </div>
  );
}
