import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  AlertTriangle,
  FileText,
  BookOpen,
  FileCheck,
  Check,
  X,
  Music,
  User,
  Store as StoreIcon,
} from 'lucide-react';
import { useEvidenceStore } from '../store/useEvidenceStore';
import { StepProgress } from '../components/StepProgress';
import { Timeline } from '../components/Timeline';
import { ConflictPanel } from '../components/ConflictPanel';
import { cn } from '../lib/utils';

export function EvidenceDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const {
    getEvidenceById,
    getLogsByEvidenceId,
    getConflictsByEvidenceId,
    getTrackAliasById,
    getVerificationOrderById,
    currentRole,
    setCurrentRole,
    resolveConflict,
    managerReview,
    confirmVerificationOrder,
    updateEvidenceStep,
  } = useEvidenceStore();

  const evidence = getEvidenceById(id);
  const logs = getLogsByEvidenceId(id);
  const conflicts = getConflictsByEvidenceId(id);
  const trackAlias = getTrackAliasById(evidence?.trackAliasId);
  const verificationOrder = getVerificationOrderById(evidence?.verificationOrderId);

  if (!evidence) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Music className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 mb-4">未找到该证据包</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const isManagerReview = evidence.status === 'manager_review';
  const hasUnresolvedConflicts = conflicts.some((c) => !c.resolved);
  const canProceedToStep3 = evidence.currentStep === 2 && !hasUnresolvedConflicts;
  const canConfirmOrder = evidence.currentStep === 3 && verificationOrder?.status === 'draft';

  const handleResolveConflict = (conflictId: string, resolution: 'confirm' | 'reject') => {
    resolveConflict(conflictId, resolution);
  };

  const handleManagerReview = (approved: boolean) => {
    managerReview(evidence.id, approved);
  };

  const handleProceedToStep3 = () => {
    updateEvidenceStep(evidence.id, 3);
  };

  const handleConfirmOrder = () => {
    const resolvedConflicts = conflicts.filter((c) => c.resolved && c.resolution === 'confirm');
    let sourceNote: string;
    if (resolvedConflicts.length > 0 && trackAlias) {
      sourceNote = `由合同旧名"${trackAlias.oldName}"更正为别名表标准名"${trackAlias.newName}"，${resolvedConflicts[0].changeDetail?.reason ?? '由阿梅确认采用别名表口径'}`;
    } else if (evidence.hasConflict) {
      sourceNote = '曲目名称来源于曲目别名表补录，已由阿梅确认';
    } else {
      sourceNote = '合同口径与别名表一致，正常核销';
    }
    confirmVerificationOrder(evidence.id, sourceNote);
    setShowConfirmModal(false);
  };

  const sceneLabels = {
    smooth: { label: '顺利记录', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
    missing_city: { label: '授权地区缺城市', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
    old_caliber: { label: '旧口径补录', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  };

  const scene = sceneLabels[evidence.sceneType];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-lg font-semibold text-gray-800">{evidence.title}</h1>
                <span
                  className={cn(
                    'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border',
                    scene.bg,
                    scene.color
                  )}
                >
                  {scene.label}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                创建于 {evidence.createdAt} · 当前角色：{currentRole}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentRole('阿梅')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  currentRole === '阿梅' ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <User className="w-3.5 h-3.5" />
                阿梅
              </button>
              <button
                onClick={() => setCurrentRole('店长')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  currentRole === '店长' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <StoreIcon className="w-3.5 h-3.5" />
                店长
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 pb-32">
        <div className="mb-8">
          <StepProgress
            currentStep={evidence.currentStep}
            hasConflict={evidence.hasConflict}
            isManagerReview={isManagerReview}
          />
        </div>

        {isManagerReview && currentRole === '店长' && (
          <div className="mb-8 bg-amber-50 border-2 border-amber-300 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-700" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-amber-800 mb-2">
                  授权地区异常，需店长复核
                </h3>
                <p className="text-sm text-amber-700 mb-4">
                  合同页截图显示授权地区为：<span className="font-medium">{evidence.authorizedCities.join('、')}</span>
                  ，但巡演计划包含 <span className="font-medium text-red-600">「{evidence.missingCity}」</span>，该城市未在授权范围内。
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleManagerReview(false)}
                    className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    驳回，需重新提交合同
                  </button>
                  <button
                    onClick={() => handleManagerReview(true)}
                    className="px-5 py-2.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    确认是笔误，按完整地区处理
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isManagerReview && currentRole !== '店长' && (
          <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                该记录因授权地区异常，已提交店长复核。请等待店长处理后再继续。
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-slate-600" />
                <h3 className="text-base font-semibold text-gray-800">合同页截图</h3>
              </div>
              <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                <img
                  src={evidence.contractScreenshotUrl}
                  alt="合同页截图"
                  className="w-full h-auto object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                  <p className="text-white text-sm">
                    授权地区：{evidence.authorizedCities.join('、')}
                    {evidence.missingCity && (
                      <span className="ml-2 text-red-400">（缺 {evidence.missingCity}）</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {evidence.currentStep >= 2 && trackAlias && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-5 h-5 text-sky-600" />
                  <h3 className="text-base font-semibold text-gray-800">曲目别名表</h3>
                  <span className="text-xs text-gray-400">第2步：补看参考</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">旧名称（合同可能使用）</p>
                    <p className="text-base font-medium text-gray-800">{trackAlias.oldName}</p>
                  </div>
                  <div className="bg-sky-50 rounded-lg p-4">
                    <p className="text-xs text-sky-600 mb-1">标准名称（现行口径）</p>
                    <p className="text-base font-medium text-sky-700">{trackAlias.newName}</p>
                  </div>
                </div>
                <div className="mt-4 bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">口径说明</p>
                  <p className="text-sm text-gray-700">{trackAlias.caliberNote}</p>
                  <p className="text-xs text-gray-400 mt-2">生效日期：{trackAlias.effectiveDate}</p>
                </div>
              </div>
            )}

            {evidence.hasConflict && (
              <ConflictPanel
                conflicts={conflicts}
                onResolve={handleResolveConflict}
                disabled={currentRole !== '阿梅' || isManagerReview}
              />
            )}

            {evidence.currentStep >= 3 && verificationOrder && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                  <FileCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-semibold text-gray-800">课时核销单</h3>
                  <span className="text-xs text-gray-400">第3步：更新结果</span>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">曲目名称</p>
                    <p className="text-base font-medium text-gray-800">{verificationOrder.trackName}</p>
                    {evidence.hasConflict && trackAlias && verificationOrder.trackName === trackAlias.newName && (
                      <p className="text-xs text-gray-400 mt-1">
                        合同原用名「{trackAlias.oldName}」已更正
                      </p>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">核销课时</p>
                    <p className="text-base font-medium text-gray-800">{verificationOrder.hours} 课时</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">状态</p>
                    <p
                      className={cn(
                        'text-base font-medium',
                        verificationOrder.status === 'confirmed'
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      )}
                    >
                      {verificationOrder.status === 'confirmed' ? '已确认' : '待确认'}
                    </p>
                  </div>
                </div>
                {verificationOrder.sourceNote && (
                  <div className={cn(
                    'rounded-lg p-4',
                    evidence.hasConflict ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50'
                  )}>
                    <p className={cn(
                      'text-xs mb-1',
                      evidence.hasConflict ? 'text-amber-600' : 'text-emerald-600'
                    )}>
                      {evidence.hasConflict ? '口径变更备注' : '来源备注'}
                    </p>
                    <p className={cn(
                      'text-sm',
                      evidence.hasConflict ? 'text-amber-800' : 'text-emerald-700'
                    )}>
                      {verificationOrder.sourceNote}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-slate-600" />
                <h3 className="text-base font-semibold text-gray-800">授权地区</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {evidence.authorizedCities.map((city) => (
                  <span
                    key={city}
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    {city}
                  </span>
                ))}
                {evidence.missingCity && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 text-red-700">
                    <X className="w-3.5 h-3.5 mr-1" />
                    {evidence.missingCity}（缺失）
                  </span>
                )}
              </div>
            </div>

            <Timeline logs={logs} />
          </div>
        </div>
      </main>

      {(canProceedToStep3 || canConfirmOrder) && currentRole === '阿梅' && !isManagerReview && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {canProceedToStep3 && '口径核对完成，可以更新课时核销单'}
              {canConfirmOrder && '核销单信息已填写完成，确认后流程结束'}
            </p>
            <div className="flex items-center gap-3">
              {canProceedToStep3 && (
                <button
                  onClick={handleProceedToStep3}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2"
                >
                  继续下一步：更新核销单
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </button>
              )}
              {canConfirmOrder && (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  确认核销单并完成
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">确认完成处理？</h3>
            <p className="text-sm text-gray-500 mb-6">
              确认后课时核销单将生效，该证据包状态将标记为"已完成"。历史记录将永久保留。
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmOrder}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                确认完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
