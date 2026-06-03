import { useState } from 'react';
import { Compass, Check, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import type { ZAxisAbnormal, InspectionMark } from '@/types';
import Button from '@/components/ui/Button';
import OriginalNoteDisplay from '@/components/ui/OriginalNoteDisplay';
import { getReviewStatusLabel, getZAxisExplanation } from '@/services/zAxisDetectionService';
import { useAppStore } from '@/store';

interface ZAxisAbnormalCardProps {
  abnormal: ZAxisAbnormal;
  mark?: InspectionMark;
}

export default function ZAxisAbnormalCard({ abnormal, mark }: ZAxisAbnormalCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [reviewResult, setReviewResult] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [signature, setSignature] = useState('');

  const currentTask = useAppStore((state) => state.getCurrentTask());
  const updateAbnormality = useAppStore((state) => state.updateAbnormality);
  const updateMark = useAppStore((state) => state.updateMark);
  const updateTask = useAppStore((state) => state.updateTask);

  const handleSubmitReview = () => {
    if (!reviewResult.trim() || !reviewerName.trim() || !signature.trim() || !currentTask) return;

    const isCorrected = reviewResult.includes('修正') || reviewResult.includes('更正') || reviewResult.includes('反向');

    const updatedAbnormal = {
      ...abnormal,
      reviewStatus: (isCorrected ? 'corrected' : 'approved') as 'corrected' | 'approved',
      reviewRecord: {
        id: '',
        abnormalId: abnormal.id,
        reviewerName: reviewerName.trim(),
        reviewResult: reviewResult.trim(),
        signature: signature.trim(),
        reviewedAt: new Date().toISOString()
      }
    };

    updateAbnormality(currentTask.id, abnormal.id, updatedAbnormal);

    if (isCorrected && mark) {
      updateMark(currentTask.id, mark.id, {
        z: abnormal.expectedZ,
        originalNotes: [
          ...mark.originalNotes,
          {
            id: '',
            markId: mark.id,
            content: `Z轴已由现场班组复核修正: ${abnormal.detectedZ.toFixed(2)} → ${abnormal.expectedZ.toFixed(2)}`,
            noteType: 'typed',
            sourceFile: '现场复核',
            isAmbiguous: false,
            createdAt: new Date().toISOString()
          }
        ]
      });
    }

    const allReviewed = currentTask.abnormalities.every(
      a => a.id === abnormal.id || a.reviewStatus !== 'pending'
    );
    if (allReviewed && currentTask.abnormalities.length > 0) {
      updateTask(currentTask.id, { status: 'completed' });
    }

    setShowReview(false);
    setReviewResult('');
    setReviewerName('');
    setSignature('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-accent-warning border-accent-warning/50 animate-pulse';
      case 'approved': return 'text-accent-success border-accent-success/50';
      case 'corrected': return 'text-accent-info border-accent-info/50';
      default: return 'text-primary-300 border-primary-500';
    }
  };

  const explanation = getZAxisExplanation();

  return (
    <div className="card-industrial mb-4">
      <div
        className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-primary-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <Compass className="text-accent-warning" size={20} />
          <div>
            <h4 className="font-mono text-sm text-primary-200">
              Z轴异常 #{mark?.sequenceNo || '?'}
            </h4>
            <p className="font-mono text-xs text-primary-400 mt-1">
              检测于 {new Date(abnormal.detectedAt).toLocaleString('zh-CN')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className={`px-3 py-1 text-xs font-mono border tracking-wider ${getStatusColor(abnormal.reviewStatus)}`}>
            {getReviewStatusLabel(abnormal.reviewStatus)}
          </span>
          {expanded ? <ChevronUp size={18} className="text-primary-400" /> : <ChevronDown size={18} className="text-primary-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-6 pb-6">
          <div className="bg-primary-700/20 border-2 border-primary-600 p-4 mb-4">
            <div className="grid grid-cols-3 gap-6 mb-4">
              <div>
                <p className="font-mono text-xs text-primary-400 mb-1">检测Z值（旧习惯）</p>
                <p className="font-mono text-2xl text-accent-warning font-bold">
                  {abnormal.detectedZ.toFixed(2)} m
                </p>
              </div>
              <div className="flex items-center justify-center">
                <AlertTriangle className="text-accent-warning animate-pulse" size={32} />
              </div>
              <div>
                <p className="font-mono text-xs text-primary-400 mb-1">预期Z值（新标准）</p>
                <p className="font-mono text-2xl text-accent-success font-bold">
                  {abnormal.expectedZ.toFixed(2)} m
                </p>
              </div>
            </div>
            <p className="text-sm text-primary-300 mb-2">
              {abnormal.suspicionReason}
            </p>
            <div className="bg-primary-800/50 p-3 border-l-4 border-primary-400">
              <p className="font-mono text-xs text-primary-400 mb-1">坐标系说明</p>
              <p className="text-xs text-primary-300">
                <span className="text-accent-warning">{explanation.oldConvention}</span>
                {' → '}
                <span className="text-accent-success">{explanation.newConvention}</span>
              </p>
              <p className="text-xs text-primary-400 mt-1">{explanation.reason}</p>
            </div>
          </div>

          {mark && <OriginalNoteDisplay notes={mark.originalNotes} />}

          {abnormal.reviewRecord && (
            <div className="bg-primary-700/30 border-2 border-primary-600 p-4 mt-4">
              <h5 className="font-mono text-xs font-semibold text-primary-300 mb-3 tracking-wider">
                复核记录
              </h5>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="font-mono text-xs text-primary-400">复核人</p>
                  <p className="text-sm text-primary-200">{abnormal.reviewRecord.reviewerName}</p>
                </div>
                <div>
                  <p className="font-mono text-xs text-primary-400">复核时间</p>
                  <p className="text-sm text-primary-200">
                    {new Date(abnormal.reviewRecord.reviewedAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
              <p className="font-mono text-xs text-primary-400 mb-1">复核结果</p>
              <p className="text-sm text-primary-200">{abnormal.reviewRecord.reviewResult}</p>
              <p className="font-mono text-xs text-primary-400 mt-3 mb-1">签字</p>
              <p className="font-mono text-sm text-accent-success">{abnormal.reviewRecord.signature}</p>
            </div>
          )}

          {abnormal.reviewStatus === 'pending' && !showReview && (
            <div className="mt-4 p-4 bg-accent-warning/10 border-2 border-accent-warning/30">
              <p className="text-sm text-accent-warning mb-3">
                ⚠ 系统不自动修正坐标，请联系现场班组现场复核后手动处理
              </p>
              <Button variant="warning" onClick={(e) => { e.stopPropagation(); setShowReview(true); }}>
                提交复核结果
              </Button>
            </div>
          )}

          {showReview && (
            <div className="mt-4 bg-primary-700/30 border-2 border-accent-warning/50 p-4">
              <h5 className="font-mono text-xs font-semibold text-accent-warning mb-4 tracking-wider">
                现场班组复核
              </h5>
              <div className="space-y-4">
                <div>
                  <label className="block font-mono text-xs text-primary-300 mb-2">
                    复核人姓名 <span className="text-accent-warning">*</span>
                  </label>
                  <input
                    type="text"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    className="input-industrial"
                    placeholder="请输入现场复核人员姓名"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-primary-300 mb-2">
                    复核结果 <span className="text-accent-warning">*</span>
                    <span className="text-primary-500 ml-2">（修正/更正/反向表示需要修正Z轴）</span>
                  </label>
                  <textarea
                    value={reviewResult}
                    onChange={(e) => setReviewResult(e.target.value)}
                    className="input-industrial min-h-[80px] resize-none"
                    placeholder="请描述现场复核结果，如：'现场确认Z轴写反，已修正为-5.5m' 或 '坐标正确，无需修改'"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-primary-300 mb-2">
                    签字确认 <span className="text-accent-warning">*</span>
                  </label>
                  <input
                    type="text"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    className="input-industrial"
                    placeholder="请输入签字确认"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-4">
                <Button
                  variant="success"
                  onClick={(e) => { e.stopPropagation(); handleSubmitReview(); }}
                  disabled={!reviewResult.trim() || !reviewerName.trim() || !signature.trim()}
                >
                  <Check size={16} className="mr-2 inline" />
                  提交复核
                </Button>
                <Button
                  variant="secondary"
                  onClick={(e) => { e.stopPropagation(); setShowReview(false); setReviewResult(''); setReviewerName(''); setSignature(''); }}
                >
                  取消
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
