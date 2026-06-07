import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  MapPin,
  User,
  Clock,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { showToast } from '@/utils/errorMessageUtils';
import type { BoundaryStatus } from '@/types';

export default function ReviewCenter() {
  const { points, streets, updatePointBoundaryStatus, currentUser, getPointRemarks } =
    useAppStore();
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [reviewRemark, setReviewRemark] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  const pendingPoints = points.filter((p) => p.boundaryStatus === 'pending');
  const reviewedPoints = points.filter(
    (p) => p.boundaryStatus === 'confirmed' || p.boundaryStatus === 'rejected'
  );

  const getStreetName = (id: string) => streets.find((s) => s.id === id)?.name || id;

  const handleReview = (pointId: string, status: BoundaryStatus) => {
    if (!currentUser) return;
    if (status !== 'pending' && !reviewRemark.trim()) {
      showToast('请填写复核意见', 'error');
      return;
    }
    updatePointBoundaryStatus(pointId, status, currentUser.id, currentUser.name, reviewRemark);
    setReviewRemark('');
    setSelectedPointId(null);
    showToast(status === 'confirmed' ? '已通过复核' : '已驳回', 'success');
  };

  const getStatusBadge = (status: BoundaryStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs flex items-center gap-1">
            <AlertTriangle size={12} />
            待复核
          </span>
        );
      case 'confirmed':
        return (
          <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs flex items-center gap-1">
            <CheckCircle size={12} />
            已通过
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs flex items-center gap-1">
            <XCircle size={12} />
            已驳回
          </span>
        );
      default:
        return null;
    }
  };

  const PointCard = ({ point, showActions = false }: { point: typeof points[0]; showActions?: boolean }) => {
    const remarks = getPointRemarks(point.id);
    const latestRemark = remarks[0];

    return (
      <div
        className={`bg-white rounded-xl shadow-sm border transition-all ${
          selectedPointId === point.id
            ? 'border-blue-400 ring-2 ring-blue-100'
            : 'border-slate-100 hover:border-slate-200'
        }`}
      >
        <button
          onClick={() => setSelectedPointId(selectedPointId === point.id ? null : point.id)}
          className="w-full p-4 text-left"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  point.isBoundary ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
                }`}
              >
                <MapPin size={20} />
              </div>
              <div>
                <h4 className="font-medium text-slate-800">{point.name}</h4>
                <p className="text-sm text-slate-500 mt-0.5">
                  {point.streetIds.map(getStreetName).join(' / ')}
                </p>
              </div>
            </div>
            {getStatusBadge(point.boundaryStatus)}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {point.lng}, {point.lat}
            </span>
            {latestRemark && (
              <span className="flex items-center gap-1">
                <FileText size={12} />
                最新备注：{latestRemark.createdByName}
              </span>
            )}
          </div>
        </button>

        {selectedPointId === point.id && (
          <div className="px-4 pb-4 border-t border-slate-100 pt-4">
            {latestRemark && (
              <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                  <FileText size={12} />
                  红线图备注（版本 {latestRemark.version}）：
                </p>
                <p className="text-sm text-slate-700">{latestRemark.content}</p>
              </div>
            )}

            {showActions && currentUser && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-slate-600 mb-1 block">复核意见</label>
                  <textarea
                    value={reviewRemark}
                    onChange={(e) => setReviewRemark(e.target.value)}
                    placeholder="请输入复核意见..."
                    className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReview(point.id, 'confirmed')}
                    className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <CheckCircle size={16} />
                    通过
                  </button>
                  <button
                    onClick={() => handleReview(point.id, 'rejected')}
                    className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <XCircle size={16} />
                    驳回
                  </button>
                </div>
              </div>
            )}

            {!showActions && point.reviewerName && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                  <User size={14} />
                  <span>复核人：{point.reviewerName}</span>
                </div>
                {point.reviewTime && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                    <Clock size={14} />
                    <span>复核时间：{new Date(point.reviewTime).toLocaleString('zh-CN')}</span>
                  </div>
                )}
                {point.reviewRemark && (
                  <div className="flex items-start gap-2 text-sm text-slate-600">
                    <MessageSquare size={14} className="mt-0.5" />
                    <span>复核意见：{point.reviewRemark}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 font-serif">复核中心</h2>
        <p className="text-slate-500 mt-1">项目经理复核边界点位，判定归属街道</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            待复核 ({pendingPoints.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            复核记录 ({reviewedPoints.length})
          </button>
        </div>

        <div className="p-4">
          {activeTab === 'pending' ? (
            pendingPoints.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CheckCircle size={48} className="mx-auto mb-4 text-green-400" />
                <p>暂无待复核的点位</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pendingPoints.map((point) => (
                  <PointCard key={point.id} point={point} showActions />
                ))}
              </div>
            )
          ) : reviewedPoints.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Clock size={48} className="mx-auto mb-4 opacity-50" />
              <p>暂无复核记录</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {reviewedPoints.map((point) => (
                <PointCard key={point.id} point={point} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">复核规则说明</p>
            <ul className="text-sm text-amber-700 mt-2 space-y-1">
              <li>• 点位在两个街道边界上时，由项目经理最终判定归属</li>
              <li>• 复核通过后，点位状态变为"已确认"，可正常参与摊位轮换</li>
              <li>• 复核驳回后，点位状态变为"已驳回"，需重新核实坐标</li>
              <li>• 所有复核操作都会记录操作日志，支持后续追溯</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
