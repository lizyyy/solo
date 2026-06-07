import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { useRecordStore } from '@/stores/useRecordStore';
import { StepIndicator } from '@/components/StepIndicator';
import { ConflictStatusBadge, NameStatusBadge } from '@/components/StatusBadges';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentRecord, loading, fetchById, submitReview, updateSummary, confirmName, recalcRecord } =
    useRecordStore();
  const [gridText, setGridText] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [selectedName, setSelectedName] = useState('');

  useEffect(() => {
    if (id) {
      fetchById(id);
    }
    return () => {
      useRecordStore.getState().clearCurrent();
    };
  }, [id, fetchById]);

  useEffect(() => {
    if (currentRecord) {
      setGridText(currentRecord.gridInspection || '');
      setSummaryText(currentRecord.streetSummary || '');
      setSelectedName(currentRecord.communityName);
    }
  }, [currentRecord]);

  if (loading && !currentRecord) {
    return <div className="text-center py-12 text-slate-500">加载中...</div>;
  }

  if (!currentRecord) {
    return <div className="text-center py-12 text-slate-500">记录不存在</div>;
  }

  const handleSubmitReview = async () => {
    if (!id || !gridText.trim()) return;
    await submitReview(id, gridText);
  };

  const handleUpdateSummary = async () => {
    if (!id || !summaryText.trim()) return;
    await updateSummary(id, summaryText);
  };

  const handleConfirmName = async () => {
    if (!id || !selectedName) return;
    await confirmName(id, selectedName);
  };

  const handleRecalc = async () => {
    if (!id) return;
    await recalcRecord(id);
  };

  const canReview = currentRecord.status === 'pending_review';
  const canSummary = currentRecord.status === 'pending_summary';
  const showNameReview = currentRecord.hasNameIssue && currentRecord.nameReviewStatus === 'pending';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="p-2 hover:bg-slate-100 rounded">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-slate-900">验收记录详情</h2>
          <p className="text-sm text-slate-500">
            红线图编号：{currentRecord.redLineNo}
          </p>
        </div>
      </div>

      <div className="card p-5">
        <StepIndicator status={currentRecord.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-municipal-600 rounded" />
            基础信息
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">红线图编号</span>
              <span className="font-medium text-slate-900">{currentRecord.redLineNo}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">小区名称</span>
              <div className="text-right">
                <span className="font-medium text-slate-900">{currentRecord.communityName}</span>
                {currentRecord.communityNameOld && (
                  <div className="text-xs text-warning-600">
                    旧称：{currentRecord.communityNameOld}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">冲突状态</span>
              <ConflictStatusBadge
                hasConflict={currentRecord.hasConflict}
                status={currentRecord.conflictStatus}
              />
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">名称状态</span>
              <NameStatusBadge
                hasNameIssue={currentRecord.hasNameIssue}
                status={currentRecord.nameReviewStatus}
              />
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">操作人</span>
              <span className="font-medium text-slate-900">{currentRecord.operator}</span>
            </div>
          </div>
        </div>

        {currentRecord.calculationMeta && (
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-municipal-600" />
              计算参数与取舍说明
            </h3>
            <div className="space-y-3 text-sm bg-municipal-50 p-4 rounded">
              <div className="flex justify-between">
                <span className="text-municipal-700">参数版本</span>
                <span className="font-mono font-medium">{currentRecord.calculationMeta.paramVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-municipal-700">算法标识</span>
                <span className="font-mono font-medium">{currentRecord.calculationMeta.algorithm}</span>
              </div>
              <div>
                <span className="text-municipal-700 block mb-1">取舍理由</span>
                <p className="text-slate-700 bg-white p-2 rounded border border-municipal-100">
                  {currentRecord.calculationMeta.decisionReason}
                </p>
              </div>
              <div className="text-xs text-municipal-500">
                计算时间：
                {format(new Date(currentRecord.calculationMeta.calculationTime), 'yyyy-MM-dd HH:mm', {
                  locale: zhCN,
                })}
              </div>
            </div>
            <button onClick={handleRecalc} className="btn-secondary w-full text-sm" disabled={loading}>
              补录后重算
            </button>
          </div>
        )}
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-municipal-600 rounded" />
          第一步：红线图备注
        </h3>
        <div className="remark-text">{currentRecord.redLineRemark || '（未导入）'}</div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-warning-500 rounded" />
          第二步：网格员巡查表（市政巡检员小付复核）
        </h3>
        {canReview ? (
          <div className="space-y-3">
            <textarea
              value={gridText}
              onChange={(e) => setGridText(e.target.value)}
              placeholder="请输入或粘贴网格员巡查表内容..."
              rows={6}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-municipal-500 focus:border-transparent font-mono text-sm"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSubmitReview}
                className="btn-primary flex items-center gap-2"
                disabled={loading || !gridText.trim()}
              >
                <Save className="w-4 h-4" />
                提交复核
              </button>
            </div>
          </div>
        ) : (
          <div className="remark-text">{currentRecord.gridInspection || '（未填写）'}</div>
        )}

        {currentRecord.conflictPoints && currentRecord.conflictPoints.length > 0 && (
          <div className="mt-4 p-4 bg-warning-50 border border-warning-200 rounded space-y-3">
            <div className="flex items-center gap-2 text-warning-800 font-medium">
              <AlertTriangle className="w-5 h-5" />
              检测到 {currentRecord.conflictPoints.length} 处冲突，请人工处理
            </div>
            {currentRecord.conflictPoints.map((cp, idx) => (
              <div key={idx} className="text-sm bg-white p-3 rounded border border-warning-100">
                <div className="font-medium text-warning-700 mb-1">冲突字段：{cp.field}</div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">红线图：</span>
                    <span className="text-slate-900">{cp.redLineValue}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">网格员：</span>
                    <span className="text-slate-900">{cp.gridValue}</span>
                  </div>
                </div>
                <div className="text-xs text-slate-600 mt-1">{cp.description}</div>
              </div>
            ))}
            <Link
              to={`/conflict/${currentRecord.id}`}
              className="inline-flex items-center gap-1 text-warning-700 hover:text-warning-800 text-sm font-medium"
            >
              前往处理冲突 →
            </Link>
          </div>
        )}

        {showNameReview && (
          <div className="mt-4 p-4 bg-warning-50 border border-warning-200 rounded space-y-3">
            <div className="flex items-center gap-2 text-warning-800 font-medium">
              <AlertTriangle className="w-5 h-5" />
              检测到小区存在新旧名称，请复核确认
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="communityName"
                  value={currentRecord.communityName}
                  checked={selectedName === currentRecord.communityName}
                  onChange={(e) => setSelectedName(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm">{currentRecord.communityName}（新名称）</span>
              </label>
              {currentRecord.communityNameOld && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="communityName"
                    value={currentRecord.communityNameOld}
                    checked={selectedName === currentRecord.communityNameOld}
                    onChange={(e) => setSelectedName(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{currentRecord.communityNameOld}（旧名称）</span>
                </label>
              )}
            </div>
            <button
              onClick={handleConfirmName}
              className="btn-warning text-sm"
              disabled={loading}
            >
              确认使用此名称
            </button>
          </div>
        )}
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-success-600 rounded" />
          第三步：更新街道会看摘要
        </h3>
        {canSummary || currentRecord.status === 'completed' ? (
          <div className="space-y-3">
            <textarea
              value={summaryText}
              onChange={(e) => setSummaryText(e.target.value)}
              placeholder="请输入给街道会看的摘要信息..."
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-municipal-500 focus:border-transparent"
              disabled={currentRecord.status === 'completed'}
            />
            {canSummary && (
              <div className="flex justify-end">
                <button
                  onClick={handleUpdateSummary}
                  className="btn-primary flex items-center gap-2"
                  disabled={loading || !summaryText.trim()}
                >
                  <Save className="w-4 h-4" />
                  更新摘要并完成
                </button>
              </div>
            )}
            {currentRecord.status === 'completed' && (
              <div className="flex items-center gap-2 text-success-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                流程已完成，摘要已更新
              </div>
            )}
          </div>
        ) : (
          <div className="text-slate-400 text-sm">请先完成前两步后再更新摘要</div>
        )}
      </div>
    </div>
  );
}
