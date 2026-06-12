import { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Clock,
  Upload,
  Edit3,
  Trash2,
  RotateCcw,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Download,
  Layers,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { getFieldDisplayName } from '@/utils/diffUtils';
import { showToast } from '@/utils/errorMessageUtils';

export default function OperationHistory() {
  const { operationLogs, busTimeSlots } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterTargetType, setFilterTargetType] = useState<string>('all');

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'import':
        return <Upload size={16} />;
      case 'edit':
        return <Edit3 size={16} />;
      case 'delete':
        return <Trash2 size={16} />;
      case 'rollback':
        return <RotateCcw size={16} />;
      case 'review':
        return <CheckCircle size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  const getOperationColor = (type: string) => {
    switch (type) {
      case 'import':
        return 'bg-blue-100 text-blue-700';
      case 'edit':
        return 'bg-green-100 text-green-700';
      case 'delete':
        return 'bg-red-100 text-red-700';
      case 'rollback':
        return 'bg-purple-100 text-purple-700';
      case 'review':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getOperationLabel = (type: string) => {
    switch (type) {
      case 'import':
        return '导入';
      case 'edit':
        return '编辑';
      case 'delete':
        return '删除';
      case 'rollback':
        return '回滚';
      case 'review':
        return '复核';
      default:
        return type;
    }
  };

  const getTargetTypeLabel = (type: string) => {
    switch (type) {
      case 'busTimeSlot':
        return '公交时段';
      case 'redlineRemark':
        return '红线备注';
      case 'stallRotation':
        return '摊位轮换';
      case 'point':
        return '点位';
      default:
        return type;
    }
  };

  const filteredLogs = operationLogs.filter((log) => {
    const matchSearch =
      log.operatorName.includes(searchQuery) ||
      getTargetTypeLabel(log.targetType).includes(searchQuery) ||
      getOperationLabel(log.operationType).includes(searchQuery) ||
      (log.metadata?.batchId && String(log.metadata.batchId).includes(searchQuery));
    const matchType = filterType === 'all' || log.operationType === filterType;
    const matchTargetType = filterTargetType === 'all' || log.targetType === filterTargetType;
    return matchSearch && matchType && matchTargetType;
  });

  const handleExport = () => {
    try {
      const exportData = filteredLogs.map((log) => {
        let diffText = '';
        if (log.diff && Object.keys(log.diff).length > 0) {
          diffText = Object.entries(log.diff)
            .map(([field, values]) => {
              const v = values as { before: unknown; after: unknown };
              return `${getFieldDisplayName(field)}: ${v.before} → ${v.after}`;
            })
            .join('; ');
        }

        return {
          记录ID: log.id,
          操作时间: new Date(log.timestamp).toLocaleString('zh-CN'),
          操作人: log.operatorName,
          操作类型: getOperationLabel(log.operationType),
          操作对象: getTargetTypeLabel(log.targetType),
          对象ID: log.targetId,
          修改内容: diffText,
          批次ID: log.metadata?.batchId || '',
          新增数量: log.metadata?.newCount || '',
          更新数量: log.metadata?.updateCount || '',
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, '操作历史');
      XLSX.writeFile(wb, `操作历史_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast(`导出成功，共 ${exportData.length} 条记录`, 'success');
    } catch (e) {
      showToast('导出失败，请重试', 'error');
    }
  };

  const getSlotCountByBatchId = (batchId: string) => {
    return busTimeSlots.filter((s) => s.importBatchId === batchId).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 font-serif">操作历史</h2>
          <p className="text-slate-500 mt-1">查看所有操作记录，对比改前改后差别</p>
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
        >
          <Download size={18} />
          导出操作历史
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索操作人、类型、批次ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">全部操作</option>
              <option value="import">导入</option>
              <option value="edit">编辑</option>
              <option value="delete">删除</option>
              <option value="rollback">回滚</option>
              <option value="review">复核</option>
            </select>
            <select
              value={filterTargetType}
              onChange={(e) => setFilterTargetType(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">全部对象</option>
              <option value="busTimeSlot">公交时段</option>
              <option value="redlineRemark">红线备注</option>
              <option value="stallRotation">摊位轮换</option>
              <option value="point">点位</option>
            </select>
          </div>
          <span className="text-sm text-slate-500">共 {filteredLogs.length} 条记录</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="divide-y divide-slate-100">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Clock size={48} className="mx-auto mb-4 opacity-50" />
              <p>暂无操作记录</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="hover:bg-slate-50 transition-colors">
                <button
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  className="w-full p-4 flex items-center gap-4 text-left"
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${getOperationColor(
                      log.operationType
                    )}`}
                  >
                    {getOperationIcon(log.operationType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-800">{log.operatorName}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${getOperationColor(
                          log.operationType
                        )}`}
                      >
                        {getOperationLabel(log.operationType)}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                        {getTargetTypeLabel(log.targetType)}
                      </span>
                      {log.metadata?.batchId && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-mono flex items-center gap-1">
                          <Layers size={10} />
                          批次 {String(log.metadata.batchId).slice(-8)}
                        </span>
                      )}
                      {log.metadata?.updateCount !== undefined &&
                        Number(log.metadata.updateCount) > 0 && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">
                            更新 {Number(log.metadata.updateCount)} 条
                          </span>
                        )}
                      {log.metadata?.newCount !== undefined && Number(log.metadata.newCount) > 0 && (
                        <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">
                          新增 {Number(log.metadata.newCount)} 条
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1 truncate">
                      {log.metadata?.batchId
                        ? `批次：${log.metadata.batchId} · 操作对象ID：${log.targetId}`
                        : `操作对象ID：${log.targetId}`}
                    </p>
                    {log.diff && Object.keys(log.diff).length > 0 && (
                      <p className="text-sm text-slate-400 mt-1">
                        {Object.keys(log.diff).length} 个字段有变更，点击展开查看详情
                      </p>
                    )}
                  </div>
                  <span className="text-sm text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('zh-CN')}
                  </span>
                  {expandedId === log.id ? (
                    <ChevronUp size={20} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={20} className="text-slate-400" />
                  )}
                </button>

                {expandedId === log.id && (
                  <div className="px-4 pb-4">
                    <div className="bg-slate-50 rounded-lg p-4 ml-14 space-y-4">
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-slate-700 mb-2">批次信息：</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {log.metadata?.batchId && (
                              <div className="bg-white rounded-lg p-3 border border-slate-200">
                                <p className="text-xs text-slate-500">批次ID</p>
                                <p className="font-mono text-sm text-slate-800 mt-0.5">
                                  {String(log.metadata.batchId)}
                                </p>
                              </div>
                            )}
                            {log.metadata?.newCount !== undefined && (
                              <div className="bg-white rounded-lg p-3 border border-slate-200">
                                <p className="text-xs text-slate-500">新增数量</p>
                                <p className="text-lg font-bold text-green-600 mt-0.5">
                                  {Number(log.metadata.newCount)}
                                </p>
                              </div>
                            )}
                            {log.metadata?.updateCount !== undefined && (
                              <div className="bg-white rounded-lg p-3 border border-slate-200">
                                <p className="text-xs text-slate-500">更新数量</p>
                                <p className="text-lg font-bold text-amber-600 mt-0.5">
                                  {Number(log.metadata.updateCount)}
                                </p>
                              </div>
                            )}
                            {log.metadata?.batchId && (
                              <div className="bg-white rounded-lg p-3 border border-slate-200">
                                <p className="text-xs text-slate-500">当前批次记录数</p>
                                <p className="text-lg font-bold text-blue-600 mt-0.5">
                                  {getSlotCountByBatchId(String(log.metadata.batchId))}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {log.diff && Object.keys(log.diff).length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-slate-700 mb-3">修改详情：</p>
                          <div className="space-y-3">
                            {Object.entries(log.diff).map(([field, values]) => (
                              <div key={field}>
                                <p className="text-sm text-slate-500 mb-1">
                                  {getFieldDisplayName(field)}
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm line-through border border-red-200">
                                    {String((values as { before: unknown }).before)}
                                  </span>
                                  <span className="text-slate-300">→</span>
                                  <span className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm border border-green-200">
                                    {String((values as { after: unknown }).after)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(!log.diff || Object.keys(log.diff).length === 0) && !log.metadata?.batchId && (
                        <p className="text-sm text-slate-500">本次操作无字段变更</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
