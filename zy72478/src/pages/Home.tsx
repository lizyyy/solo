
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  AlertTriangle,
  Clock,
  CheckCircle,
  ChevronRight,
  Play,
  Map,
  Upload,
  ClipboardCheck,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { TodoItem } from '../../shared/types';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  reviewing: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
};

const statusLabels = {
  pending: '待开始',
  processing: '处理中',
  reviewing: '待复核',
  completed: '已完成',
};

const priorityColors = {
  high: 'border-l-red-500',
  medium: 'border-l-orange-500',
  low: 'border-l-blue-500',
};

export default function Home() {
  const navigate = useNavigate();
  const {
    currentProject,
    projects,
    conflicts,
    heatmapData,
    selfChecks,
    todos,
    toggleTodo,
    setCurrentProject,
  } = useAppStore();

  const pendingConflicts = conflicts.filter((c) => c.status === 'pending').length;
  const reviewingHeatmaps = heatmapData.filter((h) => h.status === 'pending_review').length;
  const errorChecks = selfChecks.filter((s) => s.status === 'error' || s.status === 'warning').length;

  const handleTodoClick = (todo: TodoItem) => {
    if (todo.relatedPage) {
      navigate(todo.relatedPage);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">数据概览</h1>
          <p className="text-gray-500 mt-1">欢迎回来，周姐</p>
        </div>
        <select
          value={currentProject?.id}
          onChange={(e) => {
            const proj = projects.find((p) => p.id === e.target.value);
            if (proj) setCurrentProject(proj);
          }}
          className="px-4 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/30"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {errorChecks > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-orange-800">检测到 {errorChecks} 项异常</p>
            <p className="text-sm text-orange-600">请前往自检中心查看详细信息并处理</p>
          </div>
          <button
            onClick={() => navigate('/self-check')}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
          >
            立即处理
          </button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">项目总数</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{projects.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">当前进行中 {projects.filter((p) => p.status === 'processing').length} 个</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">待处理冲突</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{pendingConflicts}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">需周姐确认或驳回</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">待复核热力图</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{reviewingHeatmaps}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">夜间采样不足，需规划员复核</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">自检通过</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {selfChecks.filter((s) => s.status === 'pass').length}/{selfChecks.length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">4项核心自检指标</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">待办事项</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {todos.map((todo) => (
              <div
                key={todo.id}
                onClick={() => handleTodoClick(todo)}
                className={`p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 ${priorityColors[todo.priority]}`}
              >
                <input
                  type="checkbox"
                  checked={todo.status === 'done'}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleTodo(todo.id);
                  }}
                  className="w-5 h-5 rounded border-gray-300 text-[#f59e0b] focus:ring-[#f59e0b]"
                />
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${todo.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {todo.title}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{todo.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">快速操作</h2>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/import')}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Upload className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-700">导入公交刷卡数据</span>
              </button>
              <button
                onClick={() => navigate('/heatmap')}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Map className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-700">查看热力图</span>
              </button>
              <button
                onClick={() => navigate('/self-check')}
                className="w-full flex items-center gap-3 px-4 py-3 bg-[#f59e0b] hover:bg-[#d97706] text-white rounded-lg transition-colors"
              >
                <Play className="w-5 h-5" />
                <span className="font-medium">执行全面自检</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">当前项目状态</h2>
            {currentProject && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">项目名称</span>
                  <span className="text-sm font-medium text-gray-800 truncate max-w-[180px]">
                    {currentProject.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">项目状态</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[currentProject.status]}`}>
                    {statusLabels[currentProject.status]}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">创建时间</span>
                  <span className="text-sm text-gray-800">{currentProject.createdAt}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
