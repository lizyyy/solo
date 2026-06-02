import React, { useState } from 'react';
import { SignalPoint } from '../types';
import { useAppContext } from '../context/AppContext';
import { checkAllConflicts, getHumanReadableStatus, getSourceTypeLabel } from '../utils/conflictCheck';
import FeedbackList from './FeedbackList';
import VersionPanel from './VersionPanel';

interface PointDetailProps {
  point: SignalPoint;
  onClose: () => void;
}

export default function PointDetail({ point, onClose }: PointDetailProps) {
  const { data, updatePoint } = useAppContext();
  const [manualNote, setManualNote] = useState(point.manualNote || '');
  const [activeTab, setActiveTab] = useState<'overview' | 'feedback' | 'versions'>('overview');

  const pointFeedbacks = data.feedbacks.filter(f => f.pointId === point.id);
  const pointVersions = data.planVersions.filter(v => v.pointId === point.id);
  const pointPhotos = data.photos.filter(p => p.pointId === point.id);
  const conflicts = checkAllConflicts(point, data.points);

  const handleSaveNote = () => {
    updatePoint({
      ...point,
      manualNote,
      status: manualNote ? 'approved' : 'pending'
    });
  };

  const handleApprove = () => {
    updatePoint({
      ...point,
      status: 'approved',
      manualNote: manualNote || point.manualNote
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const getStatusColor = (p: SignalPoint) => {
    if (p.hasConflict) return 'text-red-600 bg-red-50';
    switch (p.status) {
      case 'approved': return 'text-green-600 bg-green-50';
      case 'pending': return 'text-amber-600 bg-amber-50';
      case 'legacy': return 'text-gray-600 bg-gray-50';
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-800">{point.name}</h2>
            <p className="text-sm text-slate-500 mt-1">{point.location}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded transition-colors text-slate-500"
          >
            ✕
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-3">
          <span className={`px-2 py-1 text-xs rounded ${getStatusColor(point)}`}>
            {getHumanReadableStatus(point)}
          </span>
          <span className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-600">
            {getSourceTypeLabel(point.sourceType)}
          </span>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
        {(['overview', 'feedback', 'versions'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'overview' ? '概览' : tab === 'feedback' ? `反馈 (${pointFeedbacks.length})` : `版本 (${pointVersions.length})`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-xs text-slate-500">所属街道</div>
                <div className="text-sm font-medium text-slate-800 mt-1">{point.street}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-xs text-slate-500">设计容量</div>
                <div className="text-sm font-medium text-slate-800 mt-1">
                  {point.designCapacity ? `${point.designCapacity} 辆/小时` : '-'}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-xs text-slate-500">实际容量</div>
                <div className="text-sm font-medium text-slate-800 mt-1">
                  {point.capacity ? `${point.capacity} 辆/小时` : '-'}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-xs text-slate-500">利用率</div>
                <div className={`text-sm font-medium mt-1 ${
                  point.capacity && point.designCapacity && (point.capacity / point.designCapacity) > 1
                    ? 'text-red-600' : 'text-slate-800'
                }`}>
                  {point.capacity && point.designCapacity
                    ? `${Math.round((point.capacity / point.designCapacity) * 100)}%`
                    : '-'}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500">高峰时段</div>
              <div className="text-sm font-medium text-slate-800 mt-1">
                {point.timeSlot || '未设置'}
              </div>
            </div>

            {conflicts.filter(c => c.hasConflict).length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="text-sm font-semibold text-red-700 mb-2">⚠️ 检测到冲突</h4>
                {conflicts.filter(c => c.hasConflict).map((c, i) => (
                  <div key={i} className="text-sm text-red-600 py-1 border-b border-red-100 last:border-0">
                    {c.humanReadable}
                  </div>
                ))}
              </div>
            )}

            {pointPhotos.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">巡检照片</h4>
                <div className="grid grid-cols-2 gap-2">
                  {pointPhotos.map(photo => (
                    <div key={photo.id} className="relative group">
                      <img
                        src={photo.url}
                        alt={photo.description}
                        className="w-full h-24 object-cover rounded"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b truncate">
                        {photo.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">人工复核备注</h4>
              <textarea
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="请输入复核意见或处理说明..."
                className="w-full h-24 px-3 py-2 text-sm border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSaveNote}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  保存备注
                </button>
                {point.hasConflict && (
                  <button
                    onClick={handleApprove}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    确认通过
                  </button>
                )}
              </div>
            </div>

            <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
              <div>创建时间：{formatDate(point.createdAt)}</div>
              <div>更新时间：{formatDate(point.updatedAt)}</div>
            </div>
          </div>
        )}

        {activeTab === 'feedback' && (
          <FeedbackList pointId={point.id} feedbacks={pointFeedbacks} />
        )}

        {activeTab === 'versions' && (
          <VersionPanel versions={pointVersions} />
        )}
      </div>
    </div>
  );
}
