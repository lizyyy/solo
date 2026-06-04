import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FileText,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  User,
  Clock,
  ChevronRight,
  Download,
  Share2,
  Info,
  Droplets,
  Gauge,
  Zap,
  Activity,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import type { ReviewDecision } from '../../shared/types';

export const ReviewReport: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { calculations, loadAllData, isLoading, generateReport, createReview, changeRecords, loadChangeRecords, currentUser } = useStore();

  const [reportData, setReportData] = useState<any>(null);
  const [decisions, setDecisions] = useState<ReviewDecision[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const calc = calculations.find(c => c.id === id);

  useEffect(() => {
    loadAllData();
    if (id) {
      loadChangeRecords('calculation', id);
    }
  }, [id]);

  useEffect(() => {
    if (id && calc) {
      handleGenerateReport();
      initDecisions();
    }
  }, [id, calc]);

  const initDecisions = () => {
    if (!calc) return;
    const initialDecisions: ReviewDecision[] = calc.parameters.sampleTimes?.map((_, idx) => ({
      dataPointId: `point-${idx}`,
      keepReason: '',
      missingMaterials: [],
      nextAction: 'none',
    })) || [];
    setDecisions(initialDecisions);
  };

  const handleGenerateReport = async () => {
    if (!id) return;
    setIsGenerating(true);
    const data = await generateReport(id);
    setReportData(data);
    setIsGenerating(false);
  };

  const handleSaveReview = async () => {
    if (!id) return;
    const validDecisions = decisions.filter(d => d.keepReason.trim());
    if (validDecisions.length === 0) {
      alert('请至少填写一个数据点的留存原因');
      return;
    }
    await createReview(id, validDecisions);
    navigate(`/calculations/${id}`);
  };

  const updateDecision = (index: number, field: keyof ReviewDecision, value: any) => {
    setDecisions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const toggleMissingMaterial = (index: number, material: string) => {
    setDecisions(prev => {
      const updated = [...prev];
      const current = updated[index].missingMaterials;
      if (current.includes(material)) {
        updated[index].missingMaterials = current.filter(m => m !== material);
      } else {
        updated[index].missingMaterials = [...current, material];
      }
      return updated;
    });
  };

  const riskColors: Record<string, string> = {
    low: 'text-emerald-400',
    medium: 'text-amber-400',
    high: 'text-orange-400',
    critical: 'text-red-400',
  };

  const missingMaterialOptions = [
    '维修群截图',
    '采样间隔说明',
    '现场照片',
    '历史数据对比',
    '实验记录',
    '质检员签字',
  ];

  if (isLoading || !calc) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">加载报告中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/calculations/${id}`)}
          className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-1">实验复盘报告</h1>
          <p className="text-slate-400 text-sm">
            {calc.name} · 泵站编号: {calc.pumpId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateReport}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            导出PDF
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-slate-800 rounded-2xl p-6">
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-3 mb-6">
          <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-emerald-300 mb-1">
              人文化实验复盘报告
            </p>
            <p className="text-xs text-emerald-200/80">
              报告别写成冷冰冰的系统日志。实验复盘图里要说明这条为什么被留下、还缺什么材料、下一步该找质检员还是找实验老师林老师。
            </p>
          </div>
        </div>

        {isGenerating ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-400 text-sm">正在生成人文化报告...</p>
            </div>
          </div>
        ) : reportData ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <Gauge className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs text-slate-400">风险评分</span>
                </div>
                <p className={cn('text-2xl font-bold', riskColors[calc.riskLevel])}>
                  {calc.riskScore}
                  <span className="text-sm font-normal text-slate-500 ml-1">分</span>
                </p>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <Droplets className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs text-slate-400">NPSH 可用</span>
                </div>
                <p className="text-2xl font-bold text-cyan-400">
                  {calc.result.npshAvailable.toFixed(2)}m
                </p>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-slate-400">汽蚀概率</span>
                </div>
                <p className="text-2xl font-bold text-amber-400">
                  {(calc.result.cavitationProbability * 100).toFixed(1)}%
                </p>
              </div>
              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-slate-400">数据完整度</span>
                </div>
                <p className="text-2xl font-bold text-purple-400">
                  {reportData.dataQuality?.completeness || 85}%
                </p>
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/50">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Info className="w-4 h-4 text-cyan-400" />
                数据质量评估
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {reportData.dataQuality?.isGood ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <p className="text-sm text-slate-300">
                    {reportData.dataQuality?.assessment || '数据质量良好，但存在缺失采样间隔需要复核'}
                  </p>
                </div>
                {reportData.dataQuality?.issues?.length > 0 && (
                  <div className="pl-7 space-y-1">
                    {reportData.dataQuality.issues.map((issue: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Minus className="w-3 h-3 text-amber-400 shrink-0 mt-1" />
                        <span className="text-xs text-slate-400">{issue}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/50">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                风险分析结论
              </h3>
              <div className="prose prose-invert prose-sm max-w-none">
                <p className="text-sm text-slate-300 leading-relaxed">
                  {reportData.riskAnalysis || `
                    根据NPSH计算结果，该泵站${calc.riskLevel === 'low' ? '当前汽蚀风险较低' : 
                    calc.riskLevel === 'medium' ? '存在一定汽蚀风险' :
                    calc.riskLevel === 'high' ? '汽蚀风险较高' : '汽蚀风险严重'}。
                    NPSH可用值为${calc.result.npshAvailable.toFixed(2)}m，必需值为${calc.result.npshRequired.toFixed(2)}m，
                    ${calc.result.npshAvailable > calc.result.npshRequired ? '安全余量充足' : '安全余量不足'}。
                    ${calc.result.affectedAreas.length > 0 ? `主要影响区域包括：${calc.result.affectedAreas.join('、')}。` : ''}
                    ${calc.parameters.missingIntervals.length > 0 ? 
                      `检测到${calc.parameters.missingIntervals.length}个缺失采样间隔，已流转质检员复核，目前尚未最终确认。` : ''}
                  `}
                </p>
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/50">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                关键决策记录
              </h3>
              <div className="space-y-4">
                {reportData.keyDecisions?.map((decision: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-slate-900/30 rounded-lg">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-400 text-xs font-bold">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm text-slate-200 mb-1">{decision.title}</p>
                      <p className="text-xs text-slate-400">{decision.reason}</p>
                      {decision.madeBy && (
                        <p className="text-xs text-cyan-400 mt-1">决策人: {decision.madeBy}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/50">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                缺失材料清单
              </h3>
              {reportData.missingMaterials?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {reportData.missingMaterials.map((material: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <Minus className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-sm text-amber-200">{material}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">暂无缺失材料</p>
              )}
            </div>

            <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/50">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-cyan-400" />
                下一步行动计划
              </h3>
              <div className="space-y-3">
                {reportData.nextActions?.map((action: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-slate-900/30 rounded-lg">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      action.assignee === 'inspector' ? 'bg-purple-500/20' :
                      action.assignee === 'teacher' ? 'bg-amber-500/20' : 'bg-cyan-500/20'
                    )}>
                      {action.assignee === 'inspector' ? (
                        <UserCheck className="w-4 h-4 text-purple-400" />
                      ) : action.assignee === 'teacher' ? (
                        <UserPlus className="w-4 h-4 text-amber-400" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-cyan-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-200">{action.action}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        责任人: {action.assignee === 'inspector' ? '质检员' : 
                                  action.assignee === 'teacher' ? '实验老师林老师' : '系统自动处理'}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </div>
                ))}
              </div>
            </div>

            {changeRecords.length > 0 && (
              <div className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/50">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  变更历史追溯
                </h3>
                <p className="text-xs text-slate-400 mb-3">
                  谁改了什么、为什么改、改完影响哪些结果，都要说清楚
                </p>
                <div className="space-y-2">
                  {changeRecords.slice(0, 5).map((record) => (
                    <div key={record.id} className="flex items-center gap-3 p-2 bg-slate-900/30 rounded-lg text-sm">
                      <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0 text-cyan-400 text-xs">
                        {record.changedBy.slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-300">
                          <span className="font-medium">{record.changedBy}</span>
                          <span className="text-slate-500"> 修改了 </span>
                          <span className="text-cyan-300">{record.fieldName}</span>
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {record.changeReason || '未说明原因'}
                        </p>
                      </div>
                      <div className="text-xs text-slate-500 shrink-0">
                        {new Date(record.changedAt).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-2">实验复盘决策</h2>
        <p className="text-sm text-slate-400 mb-6">
          请为每个数据点说明留存原因、缺失材料和下一步责任人
        </p>

        <div className="space-y-4">
          {calc.parameters.sampleTimes?.map((time, idx) => (
            <div key={idx} className="bg-slate-800/30 rounded-xl p-5 border border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-sm font-bold">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-medium">数据点 #{idx + 1}</p>
                    <p className="text-xs text-slate-500">
                      采样时间: {new Date(time).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-cyan-300">
                    {calc.parameters.pressure?.[idx] || '-'} MPa
                  </p>
                  <p className="text-xs text-slate-500">
                    {calc.parameters.flowRate?.[idx] || '-'} m³/h · {calc.parameters.temperatures?.[idx] || '-'} ℃
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    为什么被留下 <span className="text-amber-400">*</span>
                  </label>
                  <textarea
                    value={decisions[idx]?.keepReason || ''}
                    onChange={(e) => updateDecision(idx, 'keepReason', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50"
                    rows={2}
                    placeholder="说明这个数据点为什么被保留，依据是什么..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    还缺什么材料
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {missingMaterialOptions.map((material) => (
                      <button
                        key={material}
                        onClick={() => toggleMissingMaterial(idx, material)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                          decisions[idx]?.missingMaterials.includes(material)
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                        )}
                      >
                        {decisions[idx]?.missingMaterials.includes(material) ? (
                          <CheckCircle className="w-3 h-3 inline mr-1" />
                        ) : (
                          <Plus className="w-3 h-3 inline mr-1" />
                        )}
                        {material}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    下一步该找谁
                  </label>
                  <div className="flex gap-3">
                    {[
                      { value: 'none', label: '无需处理', icon: CheckCircle, color: 'emerald' },
                      { value: 'inspector', label: '找质检员', icon: UserCheck, color: 'purple' },
                      { value: 'teacher', label: '找林老师', icon: UserPlus, color: 'amber' },
                    ].map((option) => {
                      const isActive = decisions[idx]?.nextAction === option.value;
                      const colorClasses: Record<string, string> = {
                        emerald: isActive ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600',
                        purple: isActive ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600',
                        amber: isActive ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600',
                      };
                      return (
                        <button
                          key={option.value}
                          onClick={() => updateDecision(idx, 'nextAction', option.value)}
                          className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                            colorClasses[option.color]
                          )}
                        >
                          <option.icon className="w-4 h-4" />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => navigate(`/calculations/${id}`)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSaveReview}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl text-sm font-medium hover:from-emerald-400 hover:to-green-500 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            保存复盘报告
          </button>
        </div>
      </div>
    </div>
  );
};
