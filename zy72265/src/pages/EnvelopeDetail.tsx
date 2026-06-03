import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, AlertTriangle, CheckCircle, Clock, User, FileText, Eye, Filter, Search } from 'lucide-react';
import { useEnvelopeStore } from '../store/envelopeStore';
import { StatusBadge, CoordinateTypeBadge, RadiusSourceBadge } from '../components/StatusBadge';
import { WorkflowStepper } from '../components/WorkflowStepper';
import { AuditTrail } from '../components/AuditTrail';
import { ReviewModal } from '../components/ReviewModal';
import { formatDate } from '../../shared/utils/formatters';
import type { CoordinatePoint, ProcessingStatus } from '../../shared/types';
import { cn } from '../lib/utils';

export function EnvelopeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentEnvelope,
    currentPoints,
    currentAuditLogs,
    workflowSteps,
    loading,
    error,
    fetchEnvelopeDetail,
    advanceWorkflow,
    confirmNormalPoint,
    exportEnvelope,
    currentUser,
    clearError,
  } = useEnvelopeStore();

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<CoordinatePoint | null>(null);
  const [filterMixed, setFilterMixed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (id) {
      fetchEnvelopeDetail(id);
    }
    return () => clearError();
  }, [id]);

  const handleAdvanceWorkflow = async () => {
    if (!id) return;
    await advanceWorkflow(id);
  };

  const handleConfirmPoint = async (pointId: string) => {
    await confirmNormalPoint(pointId);
  };

  const handleOpenReview = (point: CoordinatePoint) => {
    setSelectedPoint(point);
    setIsReviewModalOpen(true);
  };

  const handleExport = async () => {
    if (!id) return;
    await exportEnvelope(id);
  };

  const filteredPoints = currentPoints
    .filter(p => !filterMixed || p.isMixed)
    .filter(p => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        p.rawValue.toLowerCase().includes(query) ||
        p.originalLineNumber.toString().includes(query) ||
        p.xValue.toString().includes(query) ||
        p.yValue.toString().includes(query)
      );
    });

  const mixedPoints = currentPoints.filter(p => p.isMixed);
  const unreviewedMixed = mixedPoints.filter(p => p.status === 'INSPECTION_REVIEW');
  const unconfirmedNormal = currentPoints.filter(p => !p.isMixed && p.status === 'IMPORTED');
  
  const canAdvance = currentEnvelope && (
    (currentEnvelope.currentStep === 1 && unconfirmedNormal.length === 0) ||
    (currentEnvelope.currentStep === 2 && unreviewedMixed.length === 0)
  );

  if (loading && !currentEnvelope) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="inline-block h-8 w-8 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentEnvelope) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">记录不存在</p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-sm hover:bg-blue-600"
          >
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold">安全包络详情</h1>
                  <StatusBadge status={currentEnvelope.status} />
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                  <span>机械臂: <span className="text-white font-mono">{currentEnvelope.robotArmId}</span></span>
                  <span>计算日期: <span className="text-white">{currentEnvelope.calculationDate}</span></span>
                  <span>安全半径版本: <span className="text-white">{currentEnvelope.safetyRadiusVersion}</span></span>
                </div>
              </div>
            </div>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-sm hover:bg-slate-600 transition-colors"
            >
              <Download className="h-4 w-4" />
              导出明细
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
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-400 mb-1">总坐标点数</div>
            <div className="text-2xl font-bold text-white font-mono">{currentEnvelope.totalPoints}</div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-400 mb-1">坐标混合数</div>
            <div className={cn('text-2xl font-bold font-mono', mixedPoints.length > 0 ? 'text-amber-400' : 'text-slate-400')}>
              {mixedPoints.length}
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-400 mb-1">待确认正常记录</div>
            <div className={cn('text-2xl font-bold font-mono', unconfirmedNormal.length > 0 ? 'text-blue-400' : 'text-emerald-400')}>
              {unconfirmedNormal.length}
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="text-xs text-slate-400 mb-1">待复核混合记录</div>
            <div className={cn('text-2xl font-bold font-mono', unreviewedMixed.length > 0 ? 'text-amber-400' : 'text-emerald-400')}>
              {unreviewedMixed.length}
            </div>
          </div>
        </div>

        <div className="mb-8">
          <WorkflowStepper
            steps={workflowSteps}
            onAdvance={currentEnvelope.currentStep < 3 ? handleAdvanceWorkflow : undefined}
            canAdvance={canAdvance ?? false}
            loading={loading}
          />
        </div>

        {currentEnvelope.currentStep >= 2 && unreviewedMixed.length > 0 && (
          <div className="mb-8 bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-300 font-medium">
                  还有 {unreviewedMixed.length} 条坐标混合记录待巡检组复核
                </p>
                <p className="text-sm text-amber-200/70 mt-1">
                  这些记录不会自动归一化，需要巡检组人工判定后才能推进到下一步
                </p>
              </div>
            </div>
          </div>
        )}

        {currentEnvelope.currentStep === 1 && unconfirmedNormal.length > 0 && (
          <div className="mb-8 bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-300 font-medium">
                  还有 {unconfirmedNormal.length} 条正常坐标记录待许工确认
                </p>
                <p className="text-sm text-blue-200/70 mt-1">
                  对照安全半径表确认这些记录的安全半径取值无误后，可推进到下一步
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <div className="bg-slate-800 rounded-lg border border-slate-700">
              <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-400" />
                  坐标点明细
                  <span className="text-sm font-normal text-slate-400">
                    共 {filteredPoints.length} 条
                  </span>
                </h3>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索..."
                      className="pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-600 rounded-sm text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-48"
                    />
                  </div>
                  <button
                    onClick={() => setFilterMixed(!filterMixed)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm transition-colors',
                      filterMixed
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    )}
                  >
                    <Filter className="h-4 w-4" />
                    仅显示混合
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-800">
                    <tr className="border-b border-slate-700">
                      <th className="px-3 py-2 text-left text-slate-400 font-medium">行号</th>
                      <th className="px-3 py-2 text-left text-slate-400 font-medium">原始值</th>
                      <th className="px-3 py-2 text-left text-slate-400 font-medium">X</th>
                      <th className="px-3 py-2 text-left text-slate-400 font-medium">Y</th>
                      <th className="px-3 py-2 text-left text-slate-400 font-medium">类型</th>
                      <th className="px-3 py-2 text-left text-slate-400 font-medium">安全半径</th>
                      <th className="px-3 py-2 text-left text-slate-400 font-medium">状态</th>
                      <th className="px-3 py-2 text-left text-slate-400 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPoints.map((point) => (
                      <tr
                        key={point.id}
                        className={cn(
                          'border-b border-slate-700/50 transition-colors',
                          point.isMixed ? 'bg-amber-900/10 hover:bg-amber-900/20' : 'hover:bg-slate-700/30'
                        )}
                      >
                        <td className="px-3 py-2">
                          <span className="font-mono text-slate-400">{point.originalLineNumber}</span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-mono text-xs text-slate-300 max-w-[200px] truncate" title={point.rawValue}>
                            {point.rawValue}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-300">
                          {point.xValue.toFixed(4)}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-300">
                          {point.yValue.toFixed(4)}
                        </td>
                        <td className="px-3 py-2">
                          <CoordinateTypeBadge type={point.coordinateType} showIcon />
                        </td>
                        <td className="px-3 py-2">
                          {point.safetyRadius ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-300">{point.safetyRadius.toFixed(2)}m</span>
                              {point.radiusSource && <RadiusSourceBadge source={point.radiusSource} />}
                            </div>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={point.status} size="sm" />
                        </td>
                        <td className="px-3 py-2">
                          {point.isMixed ? (
                            <button
                              onClick={() => handleOpenReview(point)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 rounded-sm text-xs hover:bg-amber-500/30 transition-colors"
                            >
                              <Eye className="h-3 w-3" />
                              复核
                            </button>
                          ) : point.status === 'IMPORTED' && currentEnvelope.currentStep === 1 ? (
                            <button
                              onClick={() => handleConfirmPoint(point.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-sm text-xs hover:bg-emerald-500/30 transition-colors"
                            >
                              <CheckCircle className="h-3 w-3" />
                              确认
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-slate-400" />
                基本信息
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">创建人</span>
                  <span className="text-white">{currentEnvelope.createdBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">创建时间</span>
                  <span className="text-white">{formatDate(currentEnvelope.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">更新时间</span>
                  <span className="text-white">{formatDate(currentEnvelope.updatedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">当前用户</span>
                  <span className="text-white">{currentUser}</span>
                </div>
              </div>
            </div>

            <AuditTrail logs={currentAuditLogs} />
          </div>
        </div>
      </main>

      <ReviewModal
        isOpen={isReviewModalOpen}
        point={selectedPoint}
        onClose={() => {
          setIsReviewModalOpen(false);
          setSelectedPoint(null);
        }}
      />
    </div>
  );
}
