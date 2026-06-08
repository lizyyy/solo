import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, AlertTriangle, MapPin, Ruler, Eye, MessageSquare, Clock, User } from 'lucide-react';
import { useAppStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import type { AlarmReview } from '@/types';

type FilterType = 'all' | 'pending' | 'reviewed' | 'normal' | 'abnormal' | 'onsite';

const filters: { key: FilterType; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待复核' },
  { key: 'reviewed', label: '已复核' },
  { key: 'normal', label: '正常' },
  { key: 'abnormal', label: '异常' },
  { key: 'onsite', label: '需现场' },
];

export default function ReviewPage() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedReview, setSelectedReview] = useState<AlarmReview | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { alarmReviews, obstacleNotes, reviewAlarm, getNoteForRecord, getUniqueRecords, setSelectedRecordId } = useAppStore();

  const uniqueRecords = getUniqueRecords();
  const occludedRecords = uniqueRecords.filter((r) => r.alarmOccluded);

  const filteredReviews = alarmReviews.filter((review) => {
    const record = uniqueRecords.find((r) => r.id === review.recordId);
    if (!record) return false;

    switch (activeFilter) {
      case 'all':
        return true;
      case 'pending':
        return review.reviewStatus === 'pending';
      case 'reviewed':
        return review.reviewStatus !== 'pending';
      default:
        return review.reviewStatus === activeFilter;
    }
  });

  const handleReview = (status: AlarmReview['reviewStatus']) => {
    if (!selectedReview) return;
    reviewAlarm(selectedReview.id, status, reviewComment, '施工经理');
    setSelectedReview(null);
    setReviewComment('');
  };

  const getRecord = (recordId: string) => {
    setSelectedRecordId(recordId);
    return uniqueRecords.find((r) => r.id === recordId);
  };
  const getNote = (recordId: string) => getNoteForRecord(recordId);

  const getChangeHistoriesForNote = (noteId: string) => {
    return useAppStore.getState().changeHistories.filter(
      (h) => h.entityType === 'obstacle_note' && h.entityId === noteId
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-industrial-900 mb-2">告警复核</h1>
        <p className="text-gray-500">施工经理复核被遮挡的告警记录</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              activeFilter === f.key
                ? 'bg-industrial-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredReviews.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>暂无符合条件的复核记录</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredReviews.map((review) => {
              const record = getRecord(review.recordId);
              const note = getNote(review.recordId);
              if (!record) return null;

              return (
                <div key={review.id} className="p-4 flex items-start gap-4 hover:bg-gray-50">
                  <div
                    className="w-32 h-24 rounded overflow-hidden shrink-0 cursor-pointer border border-gray-200"
                    onClick={() => setPreviewImage(record.screenshotUrl)}
                  >
                    <img
                      src={`https://picsum.photos/256/192?random=${record.id}`}
                      alt="截图"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-medium text-industrial-700">
                        测距点 ({record.pointX}, {record.pointY})
                      </span>
                      <StatusBadge status={review.reviewStatus} />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                      <span className="flex items-center gap-1">
                        <Ruler className="w-4 h-4" />
                        {record.distance} 米
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {record.batchNo}
                      </span>
                    </div>
                    {note && (
                      <p className="text-sm text-gray-500 line-clamp-2">
                        <MessageSquare className="w-4 h-4 inline mr-1" />
                        {note.content}
                      </p>
                    )}
                    {review.reviewedBy && (
                      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {review.reviewedBy} 于 {review.reviewedAt?.slice(0, 16).replace('T', ' ')} 复核
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setSelectedReview(review);
                        setReviewComment('');
                      }}
                      disabled={review.reviewStatus !== 'pending'}
                      className="px-4 py-2 text-sm font-medium rounded bg-success-500 text-white hover:bg-success-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      <Check className="w-4 h-4 inline mr-1" />
                      正常
                    </button>
                    <button
                      onClick={() => {
                        setSelectedReview(review);
                        setReviewComment('');
                      }}
                      disabled={review.reviewStatus !== 'pending'}
                      className="px-4 py-2 text-sm font-medium rounded bg-red-500 text-white hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      <AlertTriangle className="w-4 h-4 inline mr-1" />
                      异常
                    </button>
                    <button
                      onClick={() => {
                        setSelectedReview(review);
                        setReviewComment('');
                      }}
                      disabled={review.reviewStatus !== 'pending'}
                      className="px-4 py-2 text-sm font-medium rounded bg-caution-500 text-white hover:bg-caution-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      <Eye className="w-4 h-4 inline mr-1" />
                      需现场
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedReview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-industrial-900">告警复核</h3>
              <button
                onClick={() => {
                  setSelectedReview(null);
                  setReviewComment('');
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {(() => {
                const record = getRecord(selectedReview.recordId);
                const note = getNote(selectedReview.recordId);
                if (!record) return null;

                return (
                  <>
                    <div className="mb-6">
                      <img
                        src={`https://picsum.photos/800/600?random=${record.id}`}
                        alt="截图"
                        className="w-full h-64 object-cover rounded-lg"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="p-4 bg-gray-50 rounded">
                        <p className="text-xs text-gray-500 mb-1">测距点</p>
                        <p className="font-medium">({record.pointX}, {record.pointY})</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded">
                        <p className="text-xs text-gray-500 mb-1">实测距离</p>
                        <p className="font-medium">{record.distance} 米</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded">
                        <p className="text-xs text-gray-500 mb-1">批次</p>
                        <p className="font-medium">{record.batchNo}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded">
                        <p className="text-xs text-gray-500 mb-1">操作人</p>
                        <p className="font-medium">施工经理</p>
                      </div>
                    </div>

                    {note && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">障碍物备注</h4>
                        <p className="text-sm text-gray-600 p-3 bg-gray-50 rounded">{note.content}</p>
                        {getChangeHistoriesForNote(note.id).length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              备注历史
                            </p>
                            {getChangeHistoriesForNote(note.id).map((h) => (
                              <div key={h.id} className="text-xs text-gray-500 p-2 bg-gray-50 rounded mb-1">
                                <span className="text-red-500 line-through">{h.oldValue}</span>
                                <span className="mx-2">→</span>
                                <span className="text-green-600">{h.newValue}</span>
                                <span className="float-right">{h.operator} {h.operatedAt.slice(0, 16).replace('T', ' ')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">复核意见</label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="请输入复核意见..."
                        className="w-full p-3 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-industrial-500"
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleReview('normal')}
                        className="flex-1 py-3 bg-success-500 text-white font-medium rounded hover:bg-success-600 transition-colors"
                      >
                        <Check className="w-4 h-4 inline mr-2" />
                        正常
                      </button>
                      <button
                        onClick={() => handleReview('abnormal')}
                        className="flex-1 py-3 bg-red-500 text-white font-medium rounded hover:bg-red-600 transition-colors"
                      >
                        <AlertTriangle className="w-4 h-4 inline mr-2" />
                        异常
                      </button>
                      <button
                        onClick={() => handleReview('onsite')}
                        className="flex-1 py-3 bg-caution-500 text-white font-medium rounded hover:bg-caution-600 transition-colors"
                      >
                        <Eye className="w-4 h-4 inline mr-2" />
                        需现场
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={`https://picsum.photos/1200/900?random=${previewImage}`}
            alt="大图预览"
            className="max-w-[90vw] max-h-[90vh] object-contain"
          />
        </div>
      )}
    </div>
  );
}
