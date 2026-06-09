import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  History,
  Edit3,
  Calculator,
  CheckCircle2,
  XCircle,
  FileText,
  AlertTriangle,
  Users,
  Briefcase,
  Layers,
  User,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useAppStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import type { AnswerStatus } from '@/types';
import { cn } from '@/lib/utils';

const AnswerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    studentAnswers,
    getStudentAnswersByStudentId,
    getHistoryByTargetId,
    updateAnswerStatus,
    updateAnswerRemark,
    updateAnswerManualExample,
    getErrorsByAnswerId,
  } = useAppStore();

  const answer = studentAnswers.find((a) => a.id === id);
  const [editingRemark, setEditingRemark] = useState(false);
  const [remarkValue, setRemarkValue] = useState(answer?.remark || '');
  const [editingExample, setEditingExample] = useState(false);
  const [exampleValue, setExampleValue] = useState(answer?.manualExample || '');
  const [showHistory, setShowHistory] = useState(false);

  if (!answer) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">答案不存在</p>
        <button
          onClick={() => navigate('/answers')}
          className="mt-4 text-amber-600 hover:text-amber-700"
        >
          返回列表
        </button>
      </div>
    );
  }

  const allVersions = getStudentAnswersByStudentId(answer.studentId);
  const historyRecords = getHistoryByTargetId(answer.id);
  const linkedErrors = getErrorsByAnswerId(answer.id);
  const hasMultipleVersions = allVersions.length > 1;

  const handleSaveRemark = () => {
    updateAnswerRemark(answer.id, remarkValue);
    setEditingRemark(false);
  };

  const handleSaveExample = () => {
    updateAnswerManualExample(answer.id, exampleValue);
    setEditingExample(false);
  };

  const handleStatusChange = (status: AnswerStatus) => {
    updateAnswerStatus(answer.id, status);
  };

  const nextStepIcon =
    linkedErrors[0]?.nextStep === 'business' ? Briefcase : Users;
  const nextStepLabel =
    linkedErrors[0]?.nextStep === 'business' ? '业务运营' : '教研负责人吴老师';
  const nextStepColor =
    linkedErrors[0]?.nextStep === 'business' ? 'blue' : 'emerald';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/answers')}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">
              {answer.studentName} - 答案详情
            </h1>
            <StatusBadge status={answer.status} />
            {hasMultipleVersions && (
              <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-medium flex items-center gap-1">
                <Layers className="w-3 h-3" />
                多版答案 ({allVersions.length}版)
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-1">
            版本 v{answer.version} · 提交于 {answer.createdAt} · 学生ID: {answer.studentId}
          </p>
        </div>
        <button
          onClick={() => navigate('/reports')}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-lg hover:from-slate-700 hover:to-slate-800 transition-colors"
        >
          <FileText className="w-4 h-4" />
          查看报告中的误差说明
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {hasMultipleVersions && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-amber-800">
                ⚠️ 该学生提交了 {allVersions.length} 版答案 - 请业务运营复核
              </p>
              <p className="text-sm text-amber-700 mt-1">
                注意：别急着归为正常。请对比所有版本后，结合吴老师补充的手算反例做最终判断。
                当前答案状态：<span className="font-medium">{answer.status}</span>
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                {allVersions
                  .sort((a, b) => a.version - b.version)
                  .map((v) => (
                    <button
                      key={v.id}
                      onClick={() => navigate(`/answers/${v.id}`)}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                        v.id === answer.id
                          ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/30'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span>v{v.version}</span>
                        <StatusBadge status={v.status} />
                        {v.id === answer.id && <span>(当前)</span>}
                        {v.manualExample && v.id !== answer.id && (
                          <span className="text-xs opacity-80">✓ 已有手算</span>
                        )}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 text-lg">📝 原始答案内容</h3>
              <span className="text-xs text-slate-400">
                {answer.content.length} 字符
              </span>
            </div>
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                {answer.content}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calculator className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-lg">
                    手算反例（吴老师补充 - 三步流程 ②）
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    保存后将自动同步到报告的误差说明中
                  </p>
                </div>
              </div>
              {!editingExample ? (
                <button
                  onClick={() => {
                    setExampleValue(answer.manualExample || '');
                    setEditingExample(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  编辑手算
                </button>
              ) : (
                <button
                  onClick={handleSaveExample}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors font-medium"
                >
                  <Save className="w-4 h-4" />
                  保存并同步到报告
                </button>
              )}
            </div>
            {editingExample ? (
              <textarea
                value={exampleValue}
                onChange={(e) => setExampleValue(e.target.value)}
                className="w-full h-36 px-4 py-3 border-2 border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none bg-blue-50/30"
                placeholder="请吴老师补充手算反例验证过程，例如：
当x=5, y=3时：
  f(x,y) = 2x² + 3y² = 2*25 + 3*9 = 50 + 27 = 77
  约束 g(x,y) = x + y = 8 ✓ 满足
  ∴ v2版本答案正确，v1版本存在∂L/∂x符号错误"
              />
            ) : (
              <div
                className={cn(
                  'rounded-xl p-5 border',
                  answer.manualExample
                    ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
                    : 'bg-slate-50 border-dashed border-slate-200'
                )}
              >
                {answer.manualExample ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-medium text-blue-700">
                        已由吴老师补充，报告中已同步
                      </span>
                    </div>
                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed font-mono text-sm">
                      {answer.manualExample}
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-center py-4">
                    ⏳ 暂无手算反例，点击"编辑手算"添加
                    <br />
                    <span className="text-xs">
                      添加后误差报告中的"缺少材料"会自动标记为已完成
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>

          {linkedErrors.length > 0 && (
            <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-600" />
                  🔗 关联的报告误差说明（数据实时同步）
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  这里展示的内容与报告中心完全一致，确保同一份数据
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {linkedErrors.map((err) => (
                  <div key={err.id} className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {err.resolved ? (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            已处理
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            待处理 - 保留在异常列表
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          误差ID: {err.id}
                        </span>
                      </div>
                      <div
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
                          nextStepColor === 'blue'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        )}
                      >
                        {React.createElement(nextStepIcon, {
                          className: 'w-4 h-4',
                        })}
                        下一步找：{nextStepLabel}
                      </div>
                    </div>

                    <p className="font-medium text-slate-800">{err.description}</p>

                    {err.originalContent && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                          <p className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            原始说法（保留）
                          </p>
                          <p className="text-sm text-red-700 line-clamp-3">
                            {err.originalContent}
                          </p>
                        </div>
                        <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
                          <p className="text-xs font-semibold text-emerald-600 mb-2 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            改后的值 / 正确解
                          </p>
                          <p className="text-sm text-emerald-700 line-clamp-3">
                            {err.correctedContent || '（仍待修正）'}
                          </p>
                        </div>
                      </div>
                    )}

                    {err.reviewProcess && (
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                        <p className="text-xs font-semibold text-slate-600 mb-2">
                          📋 处理原因 / 复核经过
                        </p>
                        <p className="text-sm text-slate-700">{err.reviewProcess}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2">
                        缺少材料清单（按实际进度更新）
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {err.missingMaterials.map((m, i) => (
                          <span
                            key={i}
                            className={cn(
                              'px-3 py-1 rounded-full text-xs',
                              m.startsWith('✅')
                                ? 'bg-emerald-100 text-emerald-700'
                                : m.startsWith('⏳')
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            )}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showHistory && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-800 mb-6 flex items-center gap-2">
                <History className="w-5 h-5 text-slate-600" />
                🕒 修改历史记录（与历史记录页完全一致）
              </h3>
              <div className="space-y-1">
                {historyRecords.length > 0 ? (
                  historyRecords.map((record) => (
                    <div key={record.id} className="flex gap-4 pb-6 relative">
                      <div className="flex flex-col items-center relative z-10">
                        <div className="w-4 h-4 bg-slate-300 rounded-full border-4 border-white shadow" />
                        <div className="w-0.5 flex-1 bg-slate-200 absolute top-4 bottom-0 left-[7px]" />
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {record.operator}
                          </span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {record.operatedAt}
                          </span>
                          <code className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600 font-mono">
                            {record.fieldName}
                          </code>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-slate-400 mb-1.5 font-medium">
                              改前
                            </p>
                            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                              {record.oldValue || '(空)'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1.5 font-medium">
                              改后
                            </p>
                            <p className="text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                              {record.newValue || '(空)'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-sm text-center py-8">
                    暂无修改记录
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-5 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-slate-600" />
              状态管理（三步流程 - 第三步复核）
            </h3>
            <div className="mb-4 p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 mb-1">当前状态</p>
              <StatusBadge status={answer.status} />
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handleStatusChange('normal')}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all border',
                  answer.status === 'normal'
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'hover:bg-emerald-50 border-transparent'
                )}
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="font-medium text-slate-800">标记为正常</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    （运营已复核通过）
                  </p>
                </div>
              </button>
              <button
                onClick={() => handleStatusChange('exception')}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all border',
                  answer.status === 'exception'
                    ? 'bg-red-50 border-red-300'
                    : 'hover:bg-red-50 border-transparent'
                )}
              >
                <XCircle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="font-medium text-slate-800">标记为异常</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    （确定有错误）
                  </p>
                </div>
              </button>
              <button
                onClick={() => handleStatusChange('reviewing')}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all border',
                  answer.status === 'reviewing'
                    ? 'bg-amber-50 border-amber-300'
                    : 'hover:bg-amber-50 border-transparent'
                )}
              >
                <History className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="font-medium text-slate-800">
                    ⭐ 留待业务运营复核
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    （先别急着归正常）
                  </p>
                </div>
              </button>
              <button
                onClick={() => handleStatusChange('pending')}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all border',
                  answer.status === 'pending'
                    ? 'bg-slate-100 border-slate-300'
                    : 'hover:bg-slate-50 border-transparent'
                )}
              >
                <Clock className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="font-medium text-slate-800">退回待审核</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    （需要重新初检）
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">📝 备注</h3>
              {!editingRemark ? (
                <button
                  onClick={() => {
                    setRemarkValue(answer.remark);
                    setEditingRemark(true);
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Edit3 className="w-4 h-4 text-slate-400" />
                </button>
              ) : (
                <button
                  onClick={handleSaveRemark}
                  className="p-1.5 hover:bg-emerald-50 rounded-lg transition-colors"
                >
                  <Save className="w-4 h-4 text-emerald-600" />
                </button>
              )}
            </div>
            {editingRemark ? (
              <textarea
                value={remarkValue}
                onChange={(e) => setRemarkValue(e.target.value)}
                className="w-full h-28 px-3 py-2 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 text-sm resize-none"
              />
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {answer.remark || '暂无备注'}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium"
          >
            <History className="w-4 h-4" />
            {showHistory ? '隐藏修改历史' : '📜 查看修改历史'}
          </button>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              三步流程进度追踪
            </p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">1</span>
                </div>
                <span className="text-sm text-slate-700">
                  参数表导入
                  <span className="text-emerald-600 ml-1">✓ 已完成</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                    answer.manualExample ? 'bg-emerald-500' : 'bg-amber-500'
                  )}
                >
                  <span className="text-white text-xs font-bold">2</span>
                </div>
                <span className="text-sm text-slate-700">
                  吴老师补看手算反例
                  {answer.manualExample ? (
                    <span className="text-emerald-600 ml-1">✓ 已补充</span>
                  ) : (
                    <span className="text-amber-600 ml-1">⏳ 待补充</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                    answer.status === 'normal'
                      ? 'bg-emerald-500'
                      : 'bg-slate-300'
                  )}
                >
                  <span className="text-white text-xs font-bold">3</span>
                </div>
                <span className="text-sm text-slate-700">
                  误差说明更新 & 运营复核
                  {answer.status === 'normal' ? (
                    <span className="text-emerald-600 ml-1">✓ 已归档</span>
                  ) : (
                    <span className="text-slate-500 ml-1">
                      → 报告中保留待处理
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnswerDetail;
