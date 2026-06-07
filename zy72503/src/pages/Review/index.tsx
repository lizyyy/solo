import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Plus,
  X,
  FileText,
  Layers,
  MessageSquare,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { useConflictStore } from '@/store/useConflictStore';
import { StatusBadge, RoleBadge } from '@/components/StatusBadge';
import type { AssigneeRole, ReviewStatus } from '@/types';
import { cn } from '@/lib/utils';

const assigneeOptions: { value: AssigneeRole; name: string; avatar: string }[] = [
  { value: 'annotator', name: '周姐（标注负责人）', avatar: '周' },
  { value: 'operator', name: '李运营（运营复核人）', avatar: '运' },
  { value: 'product', name: '张产品（产品经理）', avatar: '产' },
];

const statusOptions: { value: ReviewStatus; label: string }[] = [
  { value: 'open', label: '待处理' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
];

const suggestedMaterials = [
  '知识库原始链接',
  '模型预测日志',
  '线上反馈工单',
  '人工标注记录',
  '用户投诉记录',
  '模型版本说明文档',
  '测试集评估报告',
];

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getConflict, getReview, updateReview } = useConflictStore();
  
  const conflict = getConflict(id || '');
  const existingReview = getReview(id || '');
  
  const [reason, setReason] = useState(existingReview?.reason || '');
  const [existingMaterials, setExistingMaterials] = useState<string[]>(existingReview?.existingMaterials || []);
  const [missingMaterials, setMissingMaterials] = useState<string[]>(existingReview?.missingMaterials || []);
  const [nextStep, setNextStep] = useState(existingReview?.nextStep || '');
  const [assignee, setAssignee] = useState<AssigneeRole>(existingReview?.assignee || 'annotator');
  const [status, setStatus] = useState<ReviewStatus>(existingReview?.status || 'open');
  const [newMaterial, setNewMaterial] = useState('');
  const [saved, setSaved] = useState(false);

  const selectedAssignee = useMemo(
    () => assigneeOptions.find((o) => o.value === assignee) || assigneeOptions[0],
    [assignee]
  );

  if (!conflict) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">未找到该冲突记录</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-4 text-primary-600 hover:text-primary-700"
        >
          返回总览
        </button>
      </div>
    );
  }

  const handleAddMaterial = (list: 'existing' | 'missing', value: string) => {
    if (!value.trim()) return;
    if (list === 'existing') {
      if (!existingMaterials.includes(value.trim())) {
        setExistingMaterials([...existingMaterials, value.trim()]);
      }
    } else {
      if (!missingMaterials.includes(value.trim())) {
        setMissingMaterials([...missingMaterials, value.trim()]);
      }
    }
    setNewMaterial('');
  };

  const handleRemoveMaterial = (list: 'existing' | 'missing', value: string) => {
    if (list === 'existing') {
      setExistingMaterials(existingMaterials.filter((m) => m !== value));
    } else {
      setMissingMaterials(missingMaterials.filter((m) => m !== value));
    }
  };

  const handleSave = () => {
    updateReview(conflict.id, {
      reason,
      existingMaterials,
      missingMaterials,
      nextStep,
      assignee,
      assigneeName: selectedAssignee.name.split('（')[0],
      status,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/conflict/${conflict.id}`)}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 transition-colors shadow-sm border border-slate-200/60"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-serif font-bold text-slate-800">产品复盘</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              分析冲突原因，明确材料缺口，指定下一步动作
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {saved && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium animate-slide-in-right">
              <CheckCircle2 className="w-4 h-4" />
              已保存
            </span>
          )}
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl font-medium shadow-lg shadow-primary-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            <Save className="w-4 h-4" />
            保存复盘
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl p-6 text-white shadow-xl shadow-primary-500/20">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-white/80">样本编号</p>
              <p className="text-lg font-bold font-mono">{conflict.sampleNumber}</p>
            </div>
          </div>
          
          <div className="h-12 w-px bg-white/20" />
          
          <div>
            <p className="text-sm text-white/80">标签冲突</p>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-white/20 text-sm font-medium">
                {conflict.labelA}
              </span>
              <span className="text-white/60">vs</span>
              <span className="px-2 py-0.5 rounded-md bg-white/20 text-sm font-medium">
                {conflict.labelB}
              </span>
            </div>
          </div>
          
          <div className="h-12 w-px bg-white/20" />
          
          <div>
            <p className="text-sm text-white/80">模型版本</p>
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold">{conflict.modelVersion}</span>
              {conflict.previousModelVersion && (
                <>
                  <ArrowRight className="w-4 h-4 text-white/60" />
                  <span className="text-white/60 font-mono text-sm">
                    来自 {conflict.previousModelVersion}
                  </span>
                </>
              )}
            </div>
          </div>
          
          {conflict.isModelVersionChanged && (
            <>
              <div className="h-12 w-px bg-white/20" />
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-400/20 border border-amber-300/30">
                <Layers className="w-4 h-4 text-amber-200" />
                <span className="text-sm font-medium text-amber-100">版本变更需复核</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-slate-800">1. 原因分析</h2>
              <span className="ml-auto text-xs text-slate-400">说明这条为什么被留下</span>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请详细描述冲突产生的原因，包括：模型版本变更影响、样本特性、标注标准歧义等..."
              rows={5}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
            />
            {conflict.isModelVersionChanged && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200/60 rounded-xl">
                <p className="text-xs text-amber-700">
                  <span className="font-semibold">⚠️ 重要提示：</span>
                  该记录模型版本从 {conflict.previousModelVersion} 变更为 {conflict.modelVersion}，
                  但样本编号未变。请务必在原因分析中说明版本变更对标签结果的具体影响，
                  此记录需交由运营复核人最终确认，不可自动归为正常。
                </p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-800">2. 已有的材料</h2>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {existingMaterials.map((material) => (
                <span
                  key={material}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm border border-emerald-200"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {material}
                  <button
                    onClick={() => handleRemoveMaterial('existing', material)}
                    className="ml-1 hover:bg-emerald-100 rounded p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {existingMaterials.length === 0 && (
                <span className="text-sm text-slate-400">暂无材料，请从下方添加或选择</span>
              )}
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={newMaterial}
                onChange={(e) => setNewMaterial(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddMaterial('existing', newMaterial)}
                placeholder="输入材料名称..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <button
                onClick={() => handleAddMaterial('existing', newMaterial)}
                className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="mt-4">
              <p className="text-xs text-slate-400 mb-2">快速选择常用材料：</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedMaterials.map((mat) => (
                  <button
                    key={mat}
                    onClick={() => handleAddMaterial('existing', mat)}
                    disabled={existingMaterials.includes(mat)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs transition-colors',
                      existingMaterials.includes(mat)
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    )}
                  >
                    + {mat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-slate-800">3. 还缺的材料</h2>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {missingMaterials.map((material) => (
                <span
                  key={material}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm border border-amber-200"
                >
                  <Clock className="w-3.5 h-3.5" />
                  {material}
                  <button
                    onClick={() => handleRemoveMaterial('missing', material)}
                    className="ml-1 hover:bg-amber-100 rounded p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {missingMaterials.length === 0 && (
                <span className="text-sm text-slate-400">暂无缺失材料</span>
              )}
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="输入缺失的材料名称..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddMaterial('missing', (e.target as HTMLInputElement).value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              <button
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                  handleAddMaterial('missing', input.value);
                  input.value = '';
                }}
                className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ArrowRight className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-800">4. 下一步动作</h2>
            </div>
            <textarea
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="明确下一步该做什么，例如：标注负责人周姐补充线上反馈工单信息后，交由运营复核人最终判定..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-primary-600" />
              当前负责人
            </h2>
            <div className="space-y-2">
              {assigneeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAssignee(opt.value)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all',
                    assignee === opt.value
                      ? 'bg-primary-50 border-2 border-primary-500'
                      : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                  )}
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm',
                      assignee === opt.value
                        ? 'bg-gradient-to-br from-primary-500 to-primary-600'
                        : 'bg-slate-400'
                    )}
                  >
                    {opt.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{opt.name}</p>
                    <RoleBadge role={opt.value} />
                  </div>
                  {assignee === opt.value && (
                    <CheckCircle2 className="w-5 h-5 text-primary-500 ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">复盘状态</h2>
            <div className="space-y-2">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-xl text-left transition-all',
                    status === opt.value
                      ? 'bg-primary-50 border-2 border-primary-500'
                      : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                  )}
                >
                  <StatusBadge status={opt.value} />
                  {status === opt.value && (
                    <CheckCircle2 className="w-5 h-5 text-primary-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200/60 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              快速溯源
            </h2>
            <div className="space-y-3">
              <a
                href={conflict.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-white/70 rounded-xl hover:bg-white transition-colors group"
              >
                <FileText className="w-5 h-5 text-blue-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">知识库链接</p>
                  <p className="text-xs text-slate-500 truncate">{conflict.sourceUrl}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
              </a>
              
              {conflict.ticketUrl && (
                <a
                  href={conflict.ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-white/70 rounded-xl hover:bg-white transition-colors group"
                >
                  <MessageSquare className="w-5 h-5 text-orange-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">线上反馈工单</p>
                    <p className="text-xs text-slate-500 truncate">{conflict.ticketUrl}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-orange-600" />
                </a>
              )}
              
              <button
                onClick={() => navigate(`/conflict/${conflict.id}`)}
                className="w-full flex items-center justify-center gap-2 p-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
              >
                返回冲突详情页
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">使用说明</h2>
            <ul className="space-y-2 text-xs text-slate-500">
              <li className="flex items-start gap-2">
                <span className="text-primary-500 mt-0.5">•</span>
                新同事只凭本页面应能找到冲突来源和下一步动作
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-500 mt-0.5">•</span>
                模型版本变更的记录务必留待运营复核人最终确认
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-500 mt-0.5">•</span>
                材料清单帮助快速了解进展和缺口
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
