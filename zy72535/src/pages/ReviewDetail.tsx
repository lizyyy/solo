import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  FileText,
  Layers,
  History,
  Gavel,
  CheckCircle,
  XCircle,
  FileCheck,
  User,
  Clock,
  AlertCircle,
  FileQuestion,
  ArrowRight,
} from 'lucide-react';
import { useReviewStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import { formatDate } from '@/utils/hash';

export default function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    records,
    getRuleById,
    getBatchById,
    getChangeHistoryByRecord,
    getJudgmentByRecord,
    getReportByRecord,
    addManualJudgment,
    reviewJudgment,
    generateReport,
  } = useReviewStore();

  const [showJudgmentForm, setShowJudgmentForm] = useState(false);
  const [judgmentResult, setJudgmentResult] = useState<'PASS' | 'FAIL'>('PASS');
  const [judgmentReason, setJudgmentReason] = useState('');

  const record = records.find(r => r.id === id);
  const rule = record ? getRuleById(record.ruleId) : undefined;
  const batch = record?.batchId ? getBatchById(record.batchId) : undefined;
  const changeHistory = record ? getChangeHistoryByRecord(record.id) : [];
  const judgment = record ? getJudgmentByRecord(record.id) : undefined;
  const report = record ? getReportByRecord(record.id) : undefined;

  if (!record) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">未找到该审查记录</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 text-primary-500 hover:text-primary-600"
        >
          返回总览
        </button>
      </div>
    );
  }

  const handleAddJudgment = () => {
    if (!judgmentReason.trim()) {
      alert('请填写改判理由');
      return;
    }
    addManualJudgment(record.id, judgmentResult, judgmentReason);
    setShowJudgmentForm(false);
    setJudgmentReason('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary-500">
            审查详情
          </h1>
          <p className="text-sm text-slate-500">
            记录ID：{record.id.substring(0, 12)}...
          </p>
        </div>
      </div>

      {record.status === 'PENDING_REVIEW' && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800">
              ⚠️ 人工改判待复核
            </h3>
            <p className="text-sm text-amber-700 mt-1">
              该记录存在人工改判，上一次批跑已标记为待复核，暂未覆盖原改判结果。请安全审核同事尽快完成复核。
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-primary-500 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              脚本内容
            </h2>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-slate-800 leading-relaxed">
                {record.scriptContent}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-6">
              <div>
                <span className="text-sm text-slate-500">自动审查结果：</span>
                <StatusBadge status={record.autoResult} />
              </div>
              <div>
                <span className="text-sm text-slate-500">当前状态：</span>
                <StatusBadge status={record.status} />
              </div>
              {record.hasManualJudgment && (
                <span className="text-sm text-amber-600 flex items-center gap-1">
                  <Gavel className="w-4 h-4" />
                  已有人工改判
                </span>
              )}
            </div>
          </div>

          {rule && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-primary-500 mb-4 flex items-center gap-2">
                <FileCheck className="w-5 h-5" />
                关联脱敏规则备注
              </h2>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-slate-500">规则内容：</span>
                  <p className="text-slate-800 mt-1">{rule.content}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-500">备注结论：</span>
                  <p className="text-slate-700 mt-1 bg-primary-50 px-3 py-2 rounded">
                    {rule.remark}
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  创建人：{rule.createdBy} · {formatDate(rule.createdAt)}
                </p>
              </div>
            </div>
          )}

          {batch && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-primary-500 mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5" />
                关联灰度批次
              </h2>
              <div className="bg-slate-50 p-4 rounded-lg">
                <h4 className="font-medium text-slate-800">{batch.batchName}</h4>
                <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">批次编号：</span>
                    <span className="text-slate-700">{batch.batchNo}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">灰度时间：</span>
                    <span className="text-slate-700">{formatDate(batch.grayTime)}</span>
                  </div>
                </div>
                {batch.remark && (
                  <p className="mt-3 text-sm text-primary-600 bg-primary-50 px-3 py-2 rounded">
                    {batch.remark}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-primary-500 mb-4 flex items-center gap-2">
              <History className="w-5 h-5" />
              变更历史
            </h2>
            {changeHistory.length === 0 ? (
              <p className="text-slate-500 text-sm">暂无变更记录</p>
            ) : (
              <div className="space-y-4">
                {changeHistory.map((h) => (
                  <div key={h.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">
                          {h.changedBy}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        {formatDate(h.changedAt)}
                      </div>
                    </div>
                    <span className="inline-block text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded mb-3">
                      变更原因：{h.changeReason}
                    </span>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-red-50 p-3 rounded">
                        <p className="text-xs text-red-600 font-medium mb-1 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          变更前
                        </p>
                        <p className="text-sm text-slate-700 line-through">{h.oldValue}</p>
                      </div>
                      <div className="bg-emerald-50 p-3 rounded">
                        <p className="text-xs text-emerald-600 font-medium mb-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          变更后
                        </p>
                        <p className="text-sm text-slate-700">{h.newValue}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-primary-500 mb-4 flex items-center gap-2">
              <Gavel className="w-5 h-5" />
              人工改判
            </h2>

            {judgment ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${
                  judgment.judgmentResult === 'PASS'
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      改判结果：
                      <StatusBadge status={judgment.judgmentResult} />
                    </span>
                    <StatusBadge status={judgment.reviewStatus} />
                  </div>
                  <p className="text-sm text-slate-600 mt-2">
                    理由：{judgment.judgmentReason}
                  </p>
                  <p className="text-xs text-slate-500 mt-3">
                    改判人：{judgment.judgedBy} · {formatDate(judgment.judgedAt)}
                  </p>
                </div>

                {judgment.reviewStatus === 'PENDING' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => reviewJudgment(judgment.id, 'APPROVED')}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm"
                    >
                      <CheckCircle className="w-4 h-4" />
                      批准改判
                    </button>
                    <button
                      onClick={() => reviewJudgment(judgment.id, 'REJECTED')}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                    >
                      <XCircle className="w-4 h-4" />
                      驳回改判
                    </button>
                  </div>
                )}

                {judgment.reviewStatus !== 'PENDING' && (
                  <p className="text-xs text-slate-500">
                    复核人：{judgment.reviewedBy} · {judgment.reviewedAt && formatDate(judgment.reviewedAt)}
                  </p>
                )}
              </div>
            ) : showJudgmentForm ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    改判结果
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setJudgmentResult('PASS')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        judgmentResult === 'PASS'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      通过
                    </button>
                    <button
                      onClick={() => setJudgmentResult('FAIL')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        judgmentResult === 'FAIL'
                          ? 'bg-red-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      未通过
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    改判理由
                  </label>
                  <textarea
                    value={judgmentReason}
                    onChange={(e) => setJudgmentReason(e.target.value)}
                    className="w-full h-24 p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none text-sm"
                    placeholder="请详细说明改判原因..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowJudgmentForm(false)}
                    className="flex-1 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleAddJudgment}
                    className="flex-1 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm transition-colors"
                  >
                    提交改判
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowJudgmentForm(true)}
                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-primary-400 hover:text-primary-500 transition-colors text-sm"
              >
                + 人工改判
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-primary-500 mb-4 flex items-center gap-2">
              <FileQuestion className="w-5 h-5" />
              评测报告
            </h2>

            {report ? (
              <div className="space-y-4">
                <div className="border-l-4 border-primary-500 pl-4 py-1">
                  <p className="font-medium text-slate-800">{report.conclusion}</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">原因说明</h4>
                  <p className="text-sm text-slate-600">{report.reason}</p>
                </div>

                {report.missingMaterials.length > 0 && (
                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <h4 className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      缺失材料
                    </h4>
                    <ul className="space-y-1">
                      {report.missingMaterials.map((m, i) => (
                        <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">•</span>
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bg-accent-teal/10 p-4 rounded-lg border border-accent-teal/30">
                  <h4 className="text-sm font-medium text-teal-800 mb-2 flex items-center gap-1">
                    <ArrowRight className="w-4 h-4" />
                    下一步行动
                  </h4>
                  <p className="text-sm text-teal-700">{report.nextStep}</p>
                  <p className="text-xs text-teal-600 mt-2">
                    负责人：<span className="font-medium">{report.assignee}</span>
                  </p>
                </div>

                <p className="text-xs text-slate-400">
                  生成时间：{formatDate(report.createdAt)} · {report.generatedBy}
                </p>
              </div>
            ) : (
              <button
                onClick={() => generateReport(record.id)}
                className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all shadow-md text-sm font-medium"
              >
                生成评测报告
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
