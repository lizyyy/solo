import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Download, Filter, Bot, Calendar, AlertTriangle, CheckCircle, Eye } from 'lucide-react';
import { useEnvelopeStore } from '../store/envelopeStore';
import { StatusBadge } from '../components/StatusBadge';
import { ImportModal } from '../components/ImportModal';
import { formatDate } from '../../shared/utils/formatters';
import type { ProcessingStatus } from '../../shared/types';
import { cn } from '../lib/utils';

export function EnvelopeList() {
  const navigate = useNavigate();
  const { envelopes, loading, error, fetchEnvelopes, exportEnvelope, currentUser, setCurrentUser } = useEnvelopeStore();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProcessingStatus | ''>('');

  useEffect(() => {
    fetchEnvelopes(statusFilter || undefined, searchQuery || undefined);
  }, [statusFilter, searchQuery]);

  const handleExport = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await exportEnvelope(id);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">工厂机械臂安全包络</h1>
              <p className="text-xs text-slate-400">坐标混合检测 · 审计追踪 · 三步工作流</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>当前用户：</span>
              <select
                value={currentUser}
                onChange={(e) => setCurrentUser(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="许工">许工（设备工程师）</option>
                <option value="巡检组-王工">巡检组-王工</option>
                <option value="现场班组-李班长">现场班组-李班长</option>
                <option value="系统管理员">系统管理员</option>
              </select>
            </div>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-sm font-medium hover:bg-blue-600 active:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              导入日志
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-700/50 rounded-lg text-red-300 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Bot className="h-5 w-5 text-blue-400" />
              </div>
              <span className="text-slate-400 text-sm">总记录数</span>
            </div>
            <div className="text-3xl font-bold text-white">{envelopes.length}</div>
          </div>
          
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <span className="text-slate-400 text-sm">待巡检组复核</span>
            </div>
            <div className="text-3xl font-bold text-amber-400">
              {envelopes.filter(e => e.status === 'INSPECTION_REVIEW').length}
            </div>
          </div>
          
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-blue-400" />
              </div>
              <span className="text-slate-400 text-sm">处理中</span>
            </div>
            <div className="text-3xl font-bold text-blue-400">
              {envelopes.filter(e => e.status === 'ENGINEER_REVIEW' || e.status === 'IMPORTED').length}
            </div>
          </div>
          
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
              </div>
              <span className="text-slate-400 text-sm">已发布</span>
            </div>
            <div className="text-3xl font-bold text-emerald-400">
              {envelopes.filter(e => e.status === 'PUBLISHED').length}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索机械臂编号..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ProcessingStatus | '')}
              className="bg-slate-800 border border-slate-700 rounded-sm px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">全部状态</option>
              <option value="IMPORTED">已导入</option>
              <option value="ENGINEER_REVIEW">工程师复核中</option>
              <option value="INSPECTION_REVIEW">巡检组复核中</option>
              <option value="PUBLISHED">已发布</option>
              <option value="ROLLBACK">已回滚</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="inline-block h-8 w-8 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : envelopes.length === 0 ? (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
            <Bot className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">暂无安全包络记录</h3>
            <p className="text-slate-500 mb-6">导入点云抽稀日志开始计算安全包络</p>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-sm font-medium hover:bg-blue-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              导入点云抽稀日志
            </button>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50">
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">机械臂编号</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">计算日期</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">安全半径版本</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">坐标点数</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">混合坐标数</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">处理步骤</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">状态</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">创建人</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {envelopes.map((envelope) => (
                    <tr
                      key={envelope.id}
                      onClick={() => navigate(`/envelopes/${envelope.id}`)}
                      className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-white">{envelope.robotArmId}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-slate-300">
                          <Calendar className="h-4 w-4 text-slate-500" />
                          {envelope.calculationDate}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-300">{envelope.safetyRadiusVersion}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-white font-mono">{envelope.totalPoints}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'font-mono font-medium',
                          envelope.mixedPoints > 0 ? 'text-amber-400' : 'text-slate-400'
                        )}>
                          {envelope.mixedPoints}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3].map((step) => (
                            <div
                              key={step}
                              className={cn(
                                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                                envelope.currentStep >= step
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-slate-700 text-slate-400'
                              )}
                            >
                              {step}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={envelope.status} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {envelope.createdBy}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/envelopes/${envelope.id}`);
                            }}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                            title="查看详情"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleExport(envelope.id, e)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                            title="导出明细"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
}
