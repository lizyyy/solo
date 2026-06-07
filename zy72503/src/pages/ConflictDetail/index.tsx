import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Layers,
  Clock,
  Send,
  Edit3,
  CheckCircle,
  XCircle,
  History,
  Settings,
  ClipboardList,
  Link,
  MessageSquare,
} from 'lucide-react';
import { useConflictStore } from '@/store/useConflictStore';
import { StatusBadge } from '@/components/StatusBadge';
import { Timeline } from '@/components/Timeline';
import { cn } from '@/lib/utils';
import type { AssigneeRole } from '@/types';

export default function ConflictDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getConflict, getRemarkHistories, getModelParams, getReview, addRemark, updateConflict } = useConflictStore();
  
  const conflict = getConflict(id || '');
  const remarkHistories = getRemarkHistories(id || '');
  const modelParams = getModelParams(id || '');
  const review = getReview(id || '');
  
  const [isEditingRemark, setIsEditingRemark] = useState(false);
  const [newRemark, setNewRemark] = useState(conflict?.currentRemark || '');
  const [selectedRole, setSelectedRole] = useState<AssigneeRole>('annotator');
  const [operatorName, setOperatorName] = useState('周姐');

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

  const handleSaveRemark = () => {
    if (newRemark.trim() && newRemark !== conflict.currentRemark) {
      addRemark(conflict.id, newRemark.trim(), operatorName, selectedRole);
    }
    setIsEditingRemark(false);
  };

  const handleResolve = (resolved: boolean) => {
    updateConflict(conflict.id, {
      status: resolved ? 'resolved' : 'dismissed',
    });
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const roleOptions: { value: AssigneeRole; label: string }[] = [
    { value: 'annotator', label: '周姐（标注负责人）' },
    { value: 'operator', label: '李运营（运营复核人）' },
    { value: 'product', label: '张产品（产品经理）' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 transition-colors shadow-sm border border-slate-200/60"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-serif font-bold text-slate-800">
                冲突详情
              </h1>
              <StatusBadge status={conflict.status} />
              {conflict.isModelVersionChanged && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium border border-purple-200">
                  <Layers className="w-3.5 h-3.5" />
                  模型版本变更
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5 font-mono">
              样本编号: {conflict.sampleNumber}
            </p>
          </div>
        </div>

        {conflict.status === 'pending' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleResolve(false)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              标记忽略
            </button>
            <button
              onClick={() => handleResolve(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/25 hover:shadow-xl transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              确认解决
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600" />
              标签冲突信息
            </h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-5 rounded-xl bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-200/60">
                <p className="text-xs font-medium text-rose-600 mb-2">标签 A (模型预测)</p>
                <p className="text-xl font-bold text-rose-700">{conflict.labelA}</p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-rose-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{ width: `${conflict.confidenceA * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-rose-600">
                    {(conflict.confidenceA * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200/60">
                <p className="text-xs font-medium text-blue-600 mb-2">标签 B (人工标注/另一模型)</p>
                <p className="text-xl font-bold text-blue-700">{conflict.labelB}</p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-blue-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${conflict.confidenceB * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-blue-600">
                    {(conflict.confidenceB * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-400 mb-1">模型版本</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-slate-700">{conflict.modelVersion}</span>
                  {conflict.previousModelVersion && (
                    <span className="text-xs text-slate-400">
                      ← {conflict.previousModelVersion}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-slate-400 mb-1">创建时间</p>
                <p className="font-medium text-slate-700">{formatTime(conflict.createdAt)}</p>
              </div>
              <div>
                <p className="text-slate-400 mb-1">更新时间</p>
                <p className="font-medium text-slate-700">{formatTime(conflict.updatedAt)}</p>
              </div>
              <div>
                <p className="text-slate-400 mb-1">溯源链接</p>
                <a
                  href={conflict.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium"
                >
                  知识库 <ExternalLink className="w-3.5 h-3.5" />
                </a>
                {conflict.ticketUrl && (
                  <>
                    <span className="text-slate-300 mx-1">|</span>
                    <a
                      href={conflict.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium"
                    >
                      工单 <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary-600" />
                备注信息
              </h2>
              {!isEditingRemark && (
                <button
                  onClick={() => {
                    setNewRemark(conflict.currentRemark || '');
                    setIsEditingRemark(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  编辑备注
                </button>
              )}
            </div>

            {isEditingRemark ? (
              <div className="space-y-4">
                <textarea
                  value={newRemark}
                  onChange={(e) => setNewRemark(e.target.value)}
                  placeholder="输入备注信息..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={selectedRole}
                    onChange={(e) => {
                      const role = e.target.value as AssigneeRole;
                      setSelectedRole(role);
                      setOperatorName(role === 'annotator' ? '周姐' : role === 'operator' ? '李运营' : '张产品');
                    }}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  >
                    {roleOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <div className="flex-1" />
                  <button
                    onClick={() => setIsEditingRemark(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveRemark}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg text-sm font-medium shadow-md shadow-primary-500/20 hover:shadow-lg transition-all"
                  >
                    <Send className="w-4 h-4" />
                    保存备注
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                {conflict.currentRemark ? (
                  <p className="text-slate-700">{conflict.currentRemark}</p>
                ) : (
                  <p className="text-slate-400 italic">暂无备注，点击右上角编辑添加</p>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-primary-600" />
              备注修改历史
            </h2>
            <Timeline items={remarkHistories} />
          </div>
        </div>

        <div className="space-y-6">
          {modelParams && (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary-600" />
                模型参数与取舍理由
              </h2>
              
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-500 mb-2">模型版本</p>
                <p className="font-mono text-sm font-semibold text-slate-700">{modelParams.modelVersion}</p>
              </div>

              <div className="mb-4">
                <p className="text-xs font-medium text-slate-500 mb-2">模型参数</p>
                <div className="p-3 bg-slate-900 rounded-xl overflow-x-auto">
                  <pre className="text-xs text-emerald-400 font-mono leading-relaxed">
                    {JSON.stringify(modelParams.parameters, null, 2)}
                  </pre>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">取舍理由</p>
                <div className="p-4 bg-amber-50 border border-amber-200/60 rounded-xl">
                  <p className="text-sm text-amber-800 leading-relaxed">
                    {modelParams.decisionReason}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary-600" />
              产品复盘
            </h2>
            
            {review ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">复盘状态</p>
                  <StatusBadge status={review.status} size="sm" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">原因分析</p>
                  <p className="text-sm text-slate-700">{review.reason}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">下一步动作</p>
                  <p className="text-sm text-slate-700">{review.nextStep}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">当前负责人</p>
                  <p className="text-sm text-slate-700">{review.assigneeName}</p>
                </div>
                <button
                  onClick={() => navigate(`/review/${conflict.id}`)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-50 text-primary-700 rounded-xl font-medium hover:bg-primary-100 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  查看/编辑复盘详情
                </button>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500 mb-4">暂无复盘记录</p>
                <button
                  onClick={() => navigate(`/review/${conflict.id}`)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-primary-500/25 hover:shadow-xl transition-all"
                >
                  <ClipboardList className="w-4 h-4" />
                  创建产品复盘
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Link className="w-5 h-5 text-primary-600" />
              快速溯源
            </h2>
            <div className="space-y-3">
              <a
                href={conflict.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">知识库引用链接</p>
                  <p className="text-xs text-slate-500 truncate">{conflict.sourceUrl}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-primary-600 transition-colors" />
              </a>
              
              {conflict.ticketUrl && (
                <a
                  href={conflict.ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">线上反馈工单</p>
                    <p className="text-xs text-slate-500 truncate">{conflict.ticketUrl}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-primary-600 transition-colors" />
                </a>
              )}
              
              {!conflict.ticketUrl && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/60">
                  <p className="text-xs text-amber-700">
                    <span className="font-medium">提示：</span>标注负责人周姐需补充线上反馈工单链接
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
