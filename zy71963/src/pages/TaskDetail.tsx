import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit3, Download, History, FileText, GitCompare, User, Calendar, Tag, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useTaskStore } from '../store/taskStore';
import { FieldLabels } from '../types';
import { StatusBadge, SourceBadge } from '../components/StatusBadge';
import { DiffViewer } from '../components/DiffViewer';
import { exportEvaluation, downloadMarkdown } from '../utils/export';

type TabType = 'info' | 'history' | 'log' | 'evaluation';

export function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getTaskById, getTaskHistory } = useTaskStore();
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  const task = getTaskById(id || '');
  const history = getTaskHistory(id || '');

  if (!task) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">任务不存在</h2>
          <p className="text-gray-500 mb-6">未找到指定的训练任务</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  const selectedHistory = history.find((h) => h.id === selectedHistoryId);

  const handleExport = () => {
    const content = exportEvaluation(task, history);
    downloadMarkdown(content, `${task.id}-评估报告.md`);
  };

  const tabs = [
    { id: 'info' as TabType, label: '基本信息', icon: FileText },
    { id: 'history' as TabType, label: '修改历史', icon: History, badge: history.length },
    { id: 'log' as TabType, label: '训练日志', icon: GitCompare },
    { id: 'evaluation' as TabType, label: '评估说明', icon: CheckCircle2 },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-primary-600 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回任务列表
        </button>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm text-gray-500 font-mono">{task.id}</span>
              <StatusBadge status={task.status} />
              <SourceBadge source={task.source} />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">{task.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              导出评估
            </button>
            <button
              onClick={() => navigate(`/tasks/${task.id}/edit`)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              编辑任务
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="border-b border-gray-100">
          <nav className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-1">
                      <Tag className="w-4 h-4" />
                      任务标题
                    </label>
                    <p className="text-gray-800">{task.title}</p>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-1">
                      <User className="w-4 h-4" />
                      负责人
                    </label>
                    <p className="text-gray-800">{task.assignee}</p>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-1">
                      <Calendar className="w-4 h-4" />
                      创建时间
                    </label>
                    <p className="text-gray-800">
                      {format(new Date(task.createdAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-1 block">来源详情</label>
                    <p className="text-gray-800">{task.sourceDetail || '无'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-1 block">待处理原因</label>
                    <p className="text-gray-800">{task.pendingReason || '无'}</p>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-500 mb-1">
                      <Calendar className="w-4 h-4" />
                      更新时间
                    </label>
                    <p className="text-gray-800">
                      {format(new Date(task.updatedAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 mb-2 block">任务描述</label>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-wrap">{task.description || '无描述'}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              {history.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>暂无修改记录</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    {history.map((record) => (
                      <div
                        key={record.id}
                        onClick={() => setSelectedHistoryId(record.id)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedHistoryId === record.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="text-sm font-medium text-gray-800">
                              {FieldLabels[record.fieldName] || record.fieldName}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">
                              {record.modifiedBy}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {format(new Date(record.createdAt), 'MM-dd HH:mm')}
                          </span>
                        </div>
                        {record.changeReason && (
                          <p className="text-sm text-gray-600 mb-2">{record.changeReason}</p>
                        )}
                        <div className="text-xs text-gray-500">
                          <span className="text-rose-600">旧值</span>: {record.oldValue.substring(0, 50)}
                          {record.oldValue.length > 50 && '...'}
                          {' → '}
                          <span className="text-emerald-600">新值</span>: {record.newValue.substring(0, 50)}
                          {record.newValue.length > 50 && '...'}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    {selectedHistory ? (
                      <div className="space-y-4">
                        <h4 className="font-medium text-gray-700">变更详情</h4>
                        <div className="text-sm text-gray-600">
                          <p><strong>修改人:</strong> {selectedHistory.modifiedBy}</p>
                          <p><strong>修改时间:</strong> {format(new Date(selectedHistory.createdAt), 'yyyy-MM-dd HH:mm:ss')}</p>
                          <p><strong>修改原因:</strong> {selectedHistory.changeReason || '无'}</p>
                        </div>
                        <div className="mt-4">
                          <DiffViewer
                            oldText={selectedHistory.oldValue}
                            newText={selectedHistory.newValue}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-64 text-gray-400">
                        <p>点击左侧记录查看详情</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'log' && (
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-700">当前训练日志</span>
                </div>
                <div className="p-4 max-h-[500px] overflow-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {task.trainingLog || '暂无训练日志'}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'evaluation' && (
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">评估说明</span>
                  <span className="text-xs text-gray-500">导出前请复核评估说明与明细是否一致</span>
                </div>
                <div className="p-4">
                  <div className="text-gray-700 whitespace-pre-wrap">
                    {task.evaluation || (
                      <span className="text-gray-400 italic">暂无评估说明</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 mb-1">复核提示</p>
                    <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                      <li>确认评估说明与训练日志中的指标数据一致</li>
                      <li>检查修改历史中是否有影响评估结论的变更</li>
                      <li>确保待处理原因已明确说明（如为补材料任务）</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
