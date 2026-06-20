
import { useState } from 'react';
import {
  History,
  Upload,
  Map,
  FileText,
  AlertTriangle,
  ClipboardCheck,
  Download,
  User,
  ChevronDown,
  ChevronUp,
  Edit3,
  GitCompare,
  Eye,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { DataChangeRecord } from '../../shared/types';

const actionIcons: Record<string, React.ReactNode> = {
  '导入': <Upload className="w-4 h-4" />,
  '生成': <Map className="w-4 h-4" />,
  '录入': <FileText className="w-4 h-4" />,
  '检测': <AlertTriangle className="w-4 h-4" />,
  '执行': <ClipboardCheck className="w-4 h-4" />,
  '重算': <Map className="w-4 h-4" />,
  '导出': <Download className="w-4 h-4" />,
  '处理': <ClipboardCheck className="w-4 h-4" />,
  '修改': <Edit3 className="w-4 h-4" />,
};

const targetTypeLabels: Record<string, string> = {
  bus_swipe: '公交刷卡记录',
  redline_note: '红线图备注',
  heatmap: '热力图版本',
  conflict: '冲突记录',
};

const targetTypeIcons: Record<string, React.ReactNode> = {
  bus_swipe: <Upload className="w-4 h-4" />,
  redline_note: <FileText className="w-4 h-4" />,
  heatmap: <Map className="w-4 h-4" />,
  conflict: <AlertTriangle className="w-4 h-4" />,
};

const getActionIcon = (action: string) => {
  for (const [key, icon] of Object.entries(actionIcons)) {
    if (action.includes(key)) return icon;
  }
  return <History className="w-4 h-4" />;
};

function ChangeDiffView({ change }: { change: DataChangeRecord }) {
  return (
    <div className="space-y-2 mt-3">
      {change.reason && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-2">
          <p className="text-xs text-red-500 font-medium">修改原因</p>
          <p className="text-sm text-red-700">{change.reason}</p>
        </div>
      )}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">字段变更明细</p>
        <div className="space-y-1.5">
          {change.changes.map((c, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 text-sm items-center">
              <div className="col-span-3 text-gray-500 bg-gray-50 p-2 rounded">
                {c.fieldLabel}
              </div>
              <div className="col-span-4 text-red-600 bg-red-50 p-2 rounded line-through break-all">
                {c.before || <span className="italic text-red-400">(空)</span>}
              </div>
              <div className="col-span-1 flex justify-center text-gray-400">
                →
              </div>
              <div className="col-span-4 text-green-700 bg-green-50 p-2 rounded break-all">
                {c.after || <span className="italic text-green-400">(空)</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      {change.snapshotAfter && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500 mb-1">变更后快照</p>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap">
            {JSON.stringify(change.snapshotAfter, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const { operationLogs, currentProject, heatmapData, addOperationLog, dataChangeHistory, exportHistory } =
    useAppStore();
  const [activeTab, setActiveTab] = useState<'logs' | 'changes'>('logs');
  const [expandedChange, setExpandedChange] = useState<string | null>(null);
  const [exportPreview, setExportPreview] = useState<string | null>(null);
  const [showExportPreview, setShowExportPreview] = useState(false);

  const projectLogs = operationLogs.filter((l) => l.projectId === currentProject?.id);
  const projectHeatmaps = heatmapData.filter((h) => h.projectId === currentProject?.id);
  const projectChanges = dataChangeHistory.filter((c) => c.projectId === currentProject?.id);

  const handleExport = () => {
    addOperationLog('导出操作日志', '导出完整操作日志记录');
    const result = exportHistory();
    if (result.success) {
      setExportPreview(result.contentPreview);
      setShowExportPreview(true);
      if (result.downloadUrl) {
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.download = result.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  };

  const actionLabel = (action: string) => {
    switch (action) {
      case 'create':
        return '新建';
      case 'update':
        return '修改';
      case 'delete':
        return '删除';
      case 'import':
        return '批量导入';
      default:
        return action;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">历史记录</h1>
          <p className="text-gray-500 mt-1">操作日志、数据变更前后对比、热力图版本回溯</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-[#f59e0b] text-white rounded-lg hover:bg-[#d97706] transition-colors"
        >
          <Download className="w-4 h-4" />
          导出日志
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-6 py-4 font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'text-[#f59e0b] border-b-2 border-[#f59e0b]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <History className="w-5 h-5" />
            操作时间线（{projectLogs.length}）
          </button>
          <button
            onClick={() => setActiveTab('changes')}
            className={`px-6 py-4 font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'changes'
                ? 'text-[#f59e0b] border-b-2 border-[#f59e0b]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <GitCompare className="w-5 h-5" />
            数据变更对比（{projectChanges.length}）
          </button>
        </div>

        <div className="p-5">
          {activeTab === 'logs' ? (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              <div className="space-y-6">
                {projectLogs.length === 0 && (
                  <p className="text-center text-gray-400 py-8">暂无操作日志</p>
                )}
                {projectLogs.map((log) => (
                  <div key={log.id} className="relative pl-10">
                    <div className="absolute left-0 w-8 h-8 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center text-gray-500">
                      {getActionIcon(log.action)}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800">{log.action}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{log.details}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <User className="w-3 h-3" />
                        <span>{log.operator}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {projectChanges.length === 0 && (
                <div className="text-center py-10">
                  <GitCompare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">暂无数据变更记录</p>
                  <p className="text-xs text-gray-400 mt-1">
                    在导入页面导入公交刷卡数据、修改红线图备注或处理冲突后，变更明细会在这里显示
                  </p>
                </div>
              )}
              {projectChanges.map((change) => {
                const isOpen = expandedChange === change.id;
                return (
                  <div
                    key={change.id}
                    className="border border-gray-100 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedChange(isOpen ? null : change.id)}
                      className="w-full p-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center gap-3 text-left"
                    >
                      <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600">
                        {targetTypeIcons[change.targetType]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-gray-800">
                            {targetTypeLabels[change.targetType]}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            change.action === 'create' ? 'bg-green-100 text-green-700' :
                            change.action === 'update' ? 'bg-blue-100 text-blue-700' :
                            change.action === 'import' ? 'bg-purple-100 text-purple-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {actionLabel(change.action)}
                          </span>
                          {change.reason && (
                            <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                              含修改原因
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          操作人：{change.operator} · {new Date(change.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 mr-1">
                          {change.changes.length} 项变更
                        </span>
                        {isOpen ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="p-4 border-t border-gray-100 bg-white">
                        <ChangeDiffView change={change} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">热力图版本</h3>
          <div className="space-y-3">
            {projectHeatmaps.slice().reverse().map((heatmap) => (
              <div
                key={heatmap.id}
                className="p-3 bg-gray-50 rounded-lg border border-gray-100"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-800">{heatmap.version}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      heatmap.status === 'confirmed'
                        ? 'bg-green-100 text-green-700'
                        : heatmap.status === 'pending_review'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {heatmap.status === 'confirmed'
                      ? '已确认'
                      : heatmap.status === 'pending_review'
                        ? '待规划员复核'
                        : '草稿'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {new Date(heatmap.createdAt).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {heatmap.data.length} 个数据点
                </p>
                {heatmap.hasLowSampling && (
                  <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    夜间采样不足：{heatmap.lowSamplingAreas?.join('、')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">统计信息</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">总操作次数</span>
              <span className="text-sm font-medium text-gray-800">{projectLogs.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">数据变更次数</span>
              <span className="text-sm font-medium text-gray-800">{projectChanges.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">热力图版本数</span>
              <span className="text-sm font-medium text-gray-800">{projectHeatmaps.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">参与人员</span>
              <span className="text-sm font-medium text-gray-800">
                {new Set(projectLogs.map((l) => l.operator)).size} 人
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[#1e3a5f] rounded-xl p-5 text-white">
          <h3 className="font-semibold mb-3">操作提示</h3>
          <ul className="space-y-2 text-sm text-white/80">
            <li>• 数据变更对比页可查看改前/改后逐字段对比</li>
            <li>• 所有红线图备注修改必须填写原因留痕</li>
            <li>• 补录数据导入后热力图自动重算并标记状态</li>
            <li>• 夜间采样不足的热力图版本标记"待规划员复核"</li>
            <li>• 数据冲突需周姐手动确认或驳回，系统不自动拍板</li>
          </ul>
        </div>
      </div>

      {showExportPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-4xl w-full rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">导出文件预览</h2>
              <p className="text-sm text-gray-500 mt-1">CSV格式已开始下载</p>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <pre className="text-xs bg-gray-50 p-4 rounded-lg whitespace-pre-wrap break-all overflow-auto">
                {exportPreview}
              </pre>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowExportPreview(false)}
                className="px-6 py-2 text-white rounded-lg transition-colors"
                style={{ backgroundColor: '#f59e0b' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#d97706')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f59e0b')}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
