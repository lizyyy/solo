import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlanStore } from '../store/usePlanStore';
import { StatusBadge, JudgmentBadge } from '../components/StatusBadge';
import { HistoryTimeline } from '../components/HistoryTimeline';
import { RemarkModal, JudgmentModal, MaterialModal } from '../components/Modal';
import { formatDate } from '../utils/date';
import { api } from '../lib/api';
import { Lock, ArrowLeft, MessageSquare, Gavel, Package, Download, FileText, History, AlertCircle } from 'lucide-react';

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentPlan, loading, error, fetchPlanDetail, clearCurrentPlan } = usePlanStore();
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'materials'>('info');
  const [remarkModal, setRemarkModal] = useState(false);
  const [judgmentModal, setJudgmentModal] = useState(false);
  const [materialModal, setMaterialModal] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPlanDetail(id);
    }
    return () => clearCurrentPlan();
  }, [id, fetchPlanDetail, clearCurrentPlan]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500 animate-pulse">加载中...</div>
      </div>
    );
  }

  if (error || !currentPlan) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-red-500">{error || '方案不存在'}</div>
      </div>
    );
  }

  const tabs: { id: 'info' | 'history' | 'materials'; label: string; icon: any; badge?: number }[] = [
    { id: 'info', label: '基础信息', icon: FileText },
    { id: 'history', label: '历史时间线', icon: History, badge: currentPlan.history.length },
    { id: 'materials', label: '材料批次', icon: Package, badge: currentPlan.materials.length },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-industrial-dark text-white shadow-lg">
        <div className="container px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold">{currentPlan.projectName}</h1>
                  <StatusBadge status={currentPlan.status} />
                  <JudgmentBadge judgment={currentPlan.judgment} />
                </div>
                <div className="text-sm text-slate-300 mt-1 font-mono">
                  方案编号：{currentPlan.planNo}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRemarkModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors text-sm"
              >
                <MessageSquare className="w-4 h-4" />
                修改备注
              </button>
              <button
                onClick={() => setJudgmentModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded transition-colors text-sm"
              >
                <Gavel className="w-4 h-4" />
                调整判断
              </button>
              <button
                onClick={() => setMaterialModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded transition-colors text-sm"
              >
                <Package className="w-4 h-4" />
                补录材料
              </button>
              <button
                onClick={() => api.exportPlan(currentPlan.id, 'json')}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                导出
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white">
        <div className="container px-4">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'text-primary-600 border-primary-600'
                      : 'text-slate-500 border-transparent hover:text-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="container px-4 py-6">
        {activeTab === 'info' && (
          <div className="grid grid-cols-3 gap-6 animate-fade-in-up">
            <div className="col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <h2 className="text-base font-semibold text-slate-800">原始信息（不可修改）</h2>
                  <Lock className="w-4 h-4 text-slate-400" />
                </div>
                <div className="p-6 space-y-4 bg-slate-50">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">原始意见</label>
                    <div className="text-sm text-slate-700 bg-white px-4 py-3 rounded border border-slate-200">
                      {currentPlan.originalOpinion}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">原始来源</label>
                    <div className="text-sm text-slate-600 font-mono bg-white px-4 py-3 rounded border border-slate-200">
                      {currentPlan.originalSource}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-800">当前备注</h2>
                  <button
                    onClick={() => setRemarkModal(true)}
                    className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <MessageSquare className="w-4 h-4" />
                    编辑
                  </button>
                </div>
                <div className="p-6">
                  <div className="text-sm text-slate-700 font-mono bg-slate-50 px-4 py-3 rounded border border-slate-200 min-h-[80px]">
                    {currentPlan.currentRemark || (
                      <span className="text-slate-400">暂无备注，点击右上角编辑按钮添加</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-base font-semibold text-slate-800">方案属性</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">方案编号</span>
                    <span className="text-sm font-mono text-slate-800">{currentPlan.planNo}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">状态</span>
                    <StatusBadge status={currentPlan.status} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">判断结论</span>
                    <JudgmentBadge judgment={currentPlan.judgment} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">材料批次</span>
                    <span className="text-sm font-mono text-slate-800">
                      {currentPlan.materialBatch || '-'}
                    </span>
                  </div>
                  <div className="border-t border-slate-200 pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-slate-500">创建人</span>
                      <span className="text-sm text-slate-700">{currentPlan.createdBy}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-slate-500">创建时间</span>
                      <span className="text-sm font-mono text-slate-600 text-xs">
                        {formatDate(currentPlan.createdAt)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500">更新时间</span>
                      <span className="text-sm font-mono text-slate-600 text-xs">
                        {formatDate(currentPlan.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-lg p-6 text-white">
                <h3 className="font-semibold mb-2">操作提示</h3>
                <ul className="text-sm text-blue-100 space-y-1">
                  <li>• 修改备注会自动记录历史版本</li>
                  <li>• 调整判断需说明调整原因</li>
                  <li>• 补录材料后状态自动恢复正常</li>
                  <li>• 导出文件包含完整历史记录</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-3xl animate-fade-in-up">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-800 mb-1">历史时间线</h2>
              <p className="text-sm text-slate-500">所有变更操作都会被记录，支持版本对比查看</p>
            </div>
            <HistoryTimeline history={currentPlan.history} />
          </div>
        )}

        {activeTab === 'materials' && (
          <div className="animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">材料批次记录</h2>
                <p className="text-sm text-slate-500">补录的材料会单独标记，便于追溯</p>
              </div>
              <button
                onClick={() => setMaterialModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors text-sm"
              >
                <Package className="w-4 h-4" />
                补录材料
              </button>
            </div>

            {currentPlan.materials.length === 0 ? (
              <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-500">
                暂无材料批次记录
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">批次号</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">材料名称</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">数量</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">类型</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">补录说明</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">录入时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {currentPlan.materials.map((mat) => (
                      <tr key={mat.id} className={mat.isSupplement ? 'bg-amber-50/30' : ''}>
                        <td className="px-4 py-3 font-mono text-sm text-slate-800">{mat.batchNo}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{mat.materialName}</td>
                        <td className="px-4 py-3 text-center text-sm text-slate-600">{mat.quantity}</td>
                        <td className="px-4 py-3 text-center">
                          {mat.isSupplement ? (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                              补录
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                              原始
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 max-w-[300px]">
                          {mat.supplementReason || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-500 text-xs">
                          {formatDate(mat.recordedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      <RemarkModal
        isOpen={remarkModal}
        onClose={() => setRemarkModal(false)}
        planId={currentPlan.id}
        currentRemark={currentPlan.currentRemark}
      />

      <JudgmentModal
        isOpen={judgmentModal}
        onClose={() => setJudgmentModal(false)}
        planId={currentPlan.id}
        currentJudgment={currentPlan.judgment}
      />

      <MaterialModal
        isOpen={materialModal}
        onClose={() => setMaterialModal(false)}
        planId={currentPlan.id}
      />
    </div>
  );
}
