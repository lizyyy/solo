import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, User, Volume2, RefreshCw, Play, AlertTriangle, CheckCircle, XCircle, FileWarning, Clock, Download } from 'lucide-react';
import { useCaseStore } from '../store/useCaseStore';
import { StepProgress } from '../components/StepProgress';
import { EvidencePanel } from '../components/EvidencePanel';
import { ConflictReviewTable } from '../components/ConflictReviewTable';
import { HistoryTimeline } from '../components/HistoryTimeline';
import { StatusBadge, ResultTypeBadge } from '../components/StatusBadge';

export function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getCaseById,
    getEvidencesByCaseId,
    getConflictsByCaseId,
    getHistoryByCaseId,
    resetToInitialData,
    simulateStep1ImportRoadPhoto,
    simulateStep2ReviewBusCard,
    simulateStep3ConflictReview,
    generateReport,
  } = useCaseStore();

  const caseItem = id ? getCaseById(id) : undefined;
  const evidences = id ? getEvidencesByCaseId(id) : [];
  const conflicts = id ? getConflictsByCaseId(id) : [];
  const historyLogs = id ? getHistoryByCaseId(id) : [];

  if (!caseItem) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">案件不存在</p>
          <button
            onClick={() => navigate('/')}
            className="text-primary-700 hover:text-primary-800 font-medium"
          >
            返回工作台
          </button>
        </div>
      </div>
    );
  }

  const hasUnresolvedConflict = caseItem.status === 'conflict' && !caseItem.conflictResolved;

  const handleExportReport = () => {
    if (!id) return;
    const report = generateReport(id);
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${caseItem.title}-调解报告.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderFinalConclusion = () => {
    if (caseItem.finalConclusion) {
      return <p className="text-sm text-gray-700 leading-relaxed">{caseItem.finalConclusion}</p>;
    }

    if (caseItem.status === 'conflict' && !caseItem.conflictResolved) {
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-danger-700 mb-1">
                证据冲突，尚未完成人工复核
              </p>
              <p className="text-sm text-gray-700">
                路口照片与公交刷卡时段证据存在矛盾，<strong className="text-danger-600">系统不会自动拍板</strong>。
                请街道规划员小姜在下方冲突复核表中人工选择「确认采信」或「驳回补充」。
              </p>
            </div>
          </div>
          <div className="p-3 bg-red-50 rounded border border-red-200">
            <p className="text-xs font-medium text-red-700 mb-1">此案件不得显示以下内容：</p>
            <ul className="text-xs text-gray-600 space-y-0.5 list-disc pl-4">
              <li>「证据一致」「已形成完整证据链」「调解结论属实」</li>
              <li>「顺利记录」标签</li>
            </ul>
          </div>
        </div>
      );
    }

    if (caseItem.status === 'pending_review' && caseItem.resultType === 'summary_only') {
      return (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">
            路口照片证据已收集，但居民意见仅剩汇总记录，无原始材料。
          </p>
          <p className="text-sm font-medium text-warning-700 flex items-start gap-1.5">
            <FileWarning className="w-4 h-4 mt-0.5 flex-shrink-0" />
            此案件暂不归入正常结案，需社区书记复核确认汇总意见有效性后再处理。
          </p>
        </div>
      );
    }

    if (caseItem.resultType === 'old_supplemented') {
      return (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">
            路口照片为主流程证据，公交刷卡时段为后来补录的历史口径数据。
          </p>
          <p className="text-sm text-primary-700 flex items-start gap-1.5">
            <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
            补录说明：公交刷卡数据从历史档案中追溯补录，与主流程存在时间差，
            已标注补录来源，调解结论参考双方证据综合判断。
          </p>
        </div>
      );
    }

    if (caseItem.status === 'normal' && caseItem.resultType === 'smooth') {
      return (
        <p className="text-sm text-gray-700">
          路口照片与公交刷卡时段证据一致，居民意见完整。两类证据互相印证，<strong>已形成完整证据链</strong>。
          <strong>调解结论：噪声问题属实</strong>，已通知相关方整改。
        </p>
      );
    }

    if (caseItem.resultType === 'conflict_confirmed' && caseItem.conflictResolved) {
      return (
        <p className="text-sm text-gray-700">
          路口照片与公交刷卡时段证据冲突已由小姜人工确认采信。两类证据描述的时段不同（21:00 vs 22:30后），均属实，
          说明<strong>噪声问题存在时段性差异</strong>。
          调解结论：噪声问题属实，但具有时段性，21:00前后相对正常，22:30后明显加重，需加强深夜时段管控。
        </p>
      );
    }

    if (caseItem.resultType === 'conflict_rejected') {
      return (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">
            路口照片与公交刷卡时段证词矛盾点未消除，21:00照片与22:30后公交刷卡说法的时段差异尚无法判定是噪声时段性变化还是取证偏差，暂不形成最终结论，需补充更多时段证据。
          </p>
          <p className="text-sm font-medium text-orange-700">
            此案件驳回原因是照片与公交刷卡时段冲突，与居民原文缺失无关。
          </p>
        </div>
      );
    }

    return <p className="text-sm text-gray-500">请完成三步流程后查看最终结论</p>;
  };

  const getResultBoxStyle = () => {
    if (caseItem.status === 'conflict' && !caseItem.conflictResolved) {
      return 'bg-danger-50 border-danger-200';
    }
    if (caseItem.resultType === 'conflict_confirmed') {
      return 'bg-green-50 border-green-200';
    }
    if (caseItem.resultType === 'conflict_rejected') {
      return 'bg-orange-50 border-orange-200';
    }
    if (caseItem.status === 'pending_review') {
      return 'bg-warning-50 border-warning-200';
    }
    if (caseItem.resultType === 'old_supplemented') {
      return 'bg-primary-50 border-primary-200';
    }
    return 'bg-success-50 border-success-200';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-1.5 text-sm text-primary-200 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                返回工作台
              </button>
              <div className="h-6 w-px bg-primary-600" />
              <div className="flex items-center gap-2">
                <Volume2 className="w-6 h-6" />
                <h1 className="text-base font-bold">夜间经济噪声调解系统</h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleExportReport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-md transition-colors"
              >
                <Download className="w-4 h-4" />
                导出报告
              </button>
              <button
                onClick={resetToInitialData}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-md transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                重置演示数据
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-medium">
                  姜
                </div>
                <span className="text-sm">街道规划员 小姜</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900">{caseItem.title}</h2>
                <StatusBadge status={caseItem.status} />
                <ResultTypeBadge resultType={caseItem.resultType} />
                {caseItem.conflictResolved && caseItem.conflictResolution === 'confirmed' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                    <CheckCircle className="w-3 h-3" />
                    冲突已确认采信
                  </span>
                )}
                {caseItem.conflictResolved && caseItem.conflictResolution === 'rejected' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                    <XCircle className="w-3 h-3" />
                    冲突已驳回待补
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-3">{caseItem.description}</p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {caseItem.address}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  创建：{caseItem.createdAt}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  更新：{caseItem.updatedAt}
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  经办人：小姜
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => id && simulateStep1ImportRoadPhoto(id)}
                disabled={caseItem.currentStep >= 1}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-primary-700 text-white border-primary-700 hover:bg-primary-800"
              >
                <Play className="w-3.5 h-3.5" />
                重跑第一步
              </button>
              <button
                onClick={() => id && simulateStep2ReviewBusCard(id)}
                disabled={caseItem.currentStep < 1}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-primary-700 text-white border-primary-700 hover:bg-primary-800"
              >
                <Play className="w-3.5 h-3.5" />
                重跑第二步
              </button>
              <button
                onClick={() => id && simulateStep3ConflictReview(id)}
                disabled={caseItem.currentStep < 2}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-primary-700 text-white border-primary-700 hover:bg-primary-800"
              >
                <Play className="w-3.5 h-3.5" />
                重跑第三步
              </button>
            </div>
          </div>
        </div>

        <StepProgress currentStep={caseItem.currentStep} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <EvidencePanel evidences={evidences} />
            <ConflictReviewTable conflicts={conflicts} evidences={evidences} caseId={caseItem.id} />
          </div>
          <div>
            <HistoryTimeline logs={historyLogs} />
          </div>
        </div>

        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              统一处理结果
              {hasUnresolvedConflict && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-danger-100 text-danger-700">
                  <AlertTriangle className="w-3 h-3" />
                  有未决冲突
                </span>
              )}
            </h3>
            <button
              onClick={handleExportReport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors text-gray-700"
            >
              <Download className="w-3.5 h-3.5" />
              导出报告
            </button>
          </div>
          <div className={`p-4 rounded-lg border ${getResultBoxStyle()}`}>
            <div className="flex items-start gap-3">
              {hasUnresolvedConflict ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger-100 text-danger-700 border border-danger-200 flex-shrink-0">
                  <AlertTriangle className="w-3 h-3" />
                  冲突待人工复核
                </span>
              ) : (
                <ResultTypeBadge resultType={caseItem.resultType} />
              )}
              <div className="flex-1">{renderFinalConclusion()}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
