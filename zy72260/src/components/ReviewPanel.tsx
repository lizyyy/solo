import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import { Route, SelfCheckItem } from '@/types';
import { useAppStore } from '@/store';
import { db } from '@/db';
import { cn } from '@/lib/utils';

interface ReviewPanelProps {
  routes: Route[];
  onReviewed?: () => void;
}

export default function ReviewPanel({ routes, onReviewed }: ReviewPanelProps) {
  const [remarkMap, setRemarkMap] = useState<Record<string, string>>({});
  const [reviewerName, setReviewerName] = useState<string>('展陈客户');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const updateRoute = useAppStore((s) => s.updateRoute);
  const setSelfChecks = useAppStore((s) => s.setSelfChecks);
  const selfChecks = useAppStore((s) => s.selfChecks);

  const pendingRoutes = routes.filter((r) => r.reviewStatus === 'pending');
  const approvedRoutes = routes.filter((r) => r.reviewStatus === 'approved');
  const rejectedRoutes = routes.filter((r) => r.reviewStatus === 'rejected');

  const handleReview = async (
    routeId: string,
    decision: 'approved' | 'rejected'
  ) => {
    const remark = remarkMap[routeId] || '';
    if (!remark.trim()) {
      alert('请填写复核意见，说明确认或驳回的理由');
      return;
    }

    setProcessingId(routeId);
    try {
      const now = new Date().toISOString();
      const updates: Partial<Route> = {
        reviewStatus: decision,
        reviewRemark: remark,
        reviewer: reviewerName,
        reviewTime: now,
        lengthRecalculated: decision === 'approved',
      };

      await db.routes.update(routeId, updates);
      updateRoute(routeId, updates);

      const updatedChecks = selfChecks.map((check) => {
        if (check.type === 'length_not_recalculated') {
          const remainingPending = routes.filter(
            (r) => r.id !== routeId && r.reviewStatus === 'pending'
          ).length;
          return {
            ...check,
            status: (remainingPending > 0 ? 'pending_review' : 'pass') as SelfCheckItem['status'],
            message:
              remainingPending > 0
                ? `还有 ${remainingPending} 条补录路线待客户复核`
                : '所有补录路线均已完成复核',
            details: {
              ...check.details,
              notRecalculatedCount: remainingPending,
            },
          };
        }
        return check;
      });
      setSelfChecks(updatedChecks);

      setRemarkMap((prev) => {
        const next = { ...prev };
        delete next[routeId];
        return next;
      });
      onReviewed?.();
    } catch (error) {
      console.error('Review failed:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const renderRouteCard = (route: Route, showActions: boolean = false) => {
    const diff =
      route.reportedLength !== undefined
        ? Math.abs(route.calculatedLength - route.reportedLength)
        : 0;

    return (
      <motion.div
        key={route.id}
        layout
        className={cn(
          'border rounded-lg overflow-hidden mb-3',
          route.reviewStatus === 'pending'
            ? 'border-warning-400 bg-white animate-blink-orange'
            : route.reviewStatus === 'approved'
            ? 'border-success-300 bg-success-50'
            : 'border-gray-300 bg-gray-50'
        )}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {route.reviewStatus === 'pending' ? (
                <Clock className="w-5 h-5 text-warning-500 animate-pulse" />
              ) : route.reviewStatus === 'approved' ? (
                <CheckCircle className="w-5 h-5 text-success-500" />
              ) : (
                <XCircle className="w-5 h-5 text-gray-400" />
              )}
              <span className="font-semibold text-gray-800">
                补录路线
              </span>
              <span
                className={cn(
                  'status-badge',
                  route.reviewStatus === 'pending' && 'status-pending-review',
                  route.reviewStatus === 'approved' && 'status-pass',
                  route.reviewStatus === 'rejected' && 'bg-gray-200 text-gray-600'
                )}
              >
                {route.reviewStatus === 'pending'
                  ? '待客户复核'
                  : route.reviewStatus === 'approved'
                  ? '已确认'
                  : '已驳回'}
              </span>
            </div>
            {route.supplementaryTime && (
              <span className="text-xs text-gray-500">
                补录时间：{new Date(route.supplementaryTime).toLocaleString('zh-CN')}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">上报长度</p>
              <p className="text-lg font-bold data-mono text-survey-700">
                {route.reportedLength?.toFixed(2)}m
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">计算长度</p>
              <p className="text-lg font-bold data-mono text-success-700">
                {route.calculatedLength.toFixed(2)}m
              </p>
            </div>
            <div className="bg-white rounded-lg border border-warning-300 p-3">
              <p className="text-xs text-gray-500 mb-1">差值</p>
              <p className="text-lg font-bold data-mono text-warning-700">
                +{diff.toFixed(2)}m
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
            <p className="text-xs text-gray-500 mb-2">路径点（{route.waypoints.length}个）</p>
            <div className="flex flex-wrap gap-2">
              {route.waypoints.map((wp, idx) => (
                <span
                  key={idx}
                  className="inline-block px-2 py-1 bg-gray-100 rounded text-xs data-mono"
                >
                  ({wp.x.toFixed(1)}, {wp.y.toFixed(1)})
                </span>
              ))}
            </div>
          </div>

          {route.reviewStatus !== 'pending' && (
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {route.reviewer}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {route.reviewTime &&
                    new Date(route.reviewTime).toLocaleString('zh-CN')}
                </span>
              </div>
              <p className="text-sm text-gray-700">
                <MessageSquare className="w-4 h-4 inline mr-1" />
                {route.reviewRemark}
              </p>
            </div>
          )}

          {showActions && route.reviewStatus === 'pending' && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  复核人
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  disabled={processingId === route.id}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  复核意见 <span className="text-danger-500">*</span>
                </label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="请说明确认或驳回的理由..."
                  value={remarkMap[route.id] || ''}
                  onChange={(e) =>
                    setRemarkMap((prev) => ({
                      ...prev,
                      [route.id]: e.target.value,
                    }))
                  }
                  disabled={processingId === route.id}
                />
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-success flex-1"
                  onClick={() => handleReview(route.id, 'approved')}
                  disabled={processingId === route.id}
                >
                  确认（长度无误）
                </button>
                <button
                  className="btn-danger flex-1"
                  onClick={() => handleReview(route.id, 'rejected')}
                  disabled={processingId === route.id}
                >
                  驳回（需要修改）
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {pendingRoutes.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning-500" />
            待客户复核 ({pendingRoutes.length})
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            以下补录路线的上报长度与系统计算长度不一致，差值超过0.5m。
            请展陈客户确认后才能标记为正常。
          </p>
          {pendingRoutes.map((r) => renderRouteCard(r, true))}
        </div>
      )}

      {approvedRoutes.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success-500" />
            已确认 ({approvedRoutes.length})
          </h3>
          {approvedRoutes.map((r) => renderRouteCard(r))}
        </div>
      )}

      {rejectedRoutes.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-gray-400" />
            已驳回 ({rejectedRoutes.length})
          </h3>
          {rejectedRoutes.map((r) => renderRouteCard(r))}
        </div>
      )}

      {pendingRoutes.length === 0 && approvedRoutes.length === 0 && rejectedRoutes.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-success-400" />
          <p className="font-medium">暂无待复核的补录路线</p>
          <p className="text-sm mt-1">
            所有路线长度计算正常，无需复核
          </p>
        </div>
      )}
    </div>
  );
}
