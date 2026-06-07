import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, User, Volume2, RefreshCw } from 'lucide-react';
import { useCaseStore } from '../store/useCaseStore';
import { StepProgress } from '../components/StepProgress';
import { EvidencePanel } from '../components/EvidencePanel';
import { ConflictReviewTable } from '../components/ConflictReviewTable';
import { HistoryTimeline } from '../components/HistoryTimeline';
import { StatusBadge, ResultTypeBadge } from '../components/StatusBadge';

export function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getCaseById, getEvidencesByCaseId, getConflictsByCaseId, getHistoryByCaseId, resetToInitialData } = useCaseStore();

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
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-gray-900">{caseItem.title}</h2>
                <StatusBadge status={caseItem.status} />
                <ResultTypeBadge resultType={caseItem.resultType} />
              </div>
              <p className="text-sm text-gray-600 mb-3">{caseItem.description}</p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {caseItem.address}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  创建时间：{caseItem.createdAt}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  更新时间：{caseItem.updatedAt}
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  经办人：小姜
                </span>
              </div>
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
          <h3 className="text-sm font-semibold text-gray-800 mb-3">统一处理结果</h3>
          <div
            className={`p-4 rounded-lg border ${
              caseItem.resultType === 'smooth'
                ? 'bg-success-50 border-success-200'
                : caseItem.resultType === 'summary_only'
                ? 'bg-warning-50 border-warning-200'
                : 'bg-primary-50 border-primary-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <ResultTypeBadge resultType={caseItem.resultType} />
              <div className="flex-1">
                {caseItem.resultType === 'smooth' && (
                  <p className="text-sm text-gray-700">
                    路口照片与公交刷卡时段证据一致，居民意见完整。两类证据互相印证，已形成完整证据链。
                    调解结论：噪声问题属实，已通知相关方整改。
                  </p>
                )}
                {caseItem.resultType === 'summary_only' && (
                  <div>
                    <p className="text-sm text-gray-700 mb-2">
                      路口照片证据已收集，但居民意见仅剩汇总记录，无原始材料。
                    </p>
                    <p className="text-sm font-medium text-warning-700">
                      ⚠️ 此案件暂不归入正常结案，需社区书记复核确认汇总意见有效性后再处理。
                    </p>
                  </div>
                )}
                {caseItem.resultType === 'old_supplemented' && (
                  <div>
                    <p className="text-sm text-gray-700 mb-2">
                      路口照片为5月主流程证据，公交刷卡时段为后来补录的历史口径数据。
                    </p>
                    <p className="text-sm text-primary-700">
                      📝 补录说明：公交刷卡数据从历史档案中追溯补录，与主流程存在时间差，
                      已标注补录来源，调解结论参考双方证据综合判断。
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
