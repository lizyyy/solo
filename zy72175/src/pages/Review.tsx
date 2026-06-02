
import React, { useState } from 'react';
import { Save, MessageSquare, History, Clock, User, CheckCircle } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { RemarkDiff } from '../components/RemarkDiff';
import { intentOptions } from '../data/mockData';
import { formatDate, getStatusLabel, getStatusColor } from '../utils';

export const Review: React.FC = () => {
  const {
    samples,
    detections,
    reviews,
    getSampleById,
    getDetectionBySampleId,
    getReviewBySampleId,
    addReview,
    updateReviewRemark,
    updateSampleStatus,
  } = useAppStore();

  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [finalIntent, setFinalIntent] = useState('');
  const [reason, setReason] = useState('');
  const [remark, setRemark] = useState('');
  const [showRemarkDiff, setShowRemarkDiff] = useState(false);
  const [oldRemark, setOldRemark] = useState('');

  const pendingSamples = samples.filter(
    (s) => s.status === 'reviewing' || s.status === 'detected'
  );

  const handleSelectSample = (sampleId: string) => {
    setSelectedSampleId(sampleId);
    const review = getReviewBySampleId(sampleId);
    if (review) {
      setFinalIntent(review.finalIntent);
      setReason(review.reason);
      setRemark(review.remark || '');
    } else {
      const detection = getDetectionBySampleId(sampleId);
      setFinalIntent(detection?.modelIntent || '');
      setReason('');
      setRemark('');
    }
  };

  const handleSave = () => {
    if (!selectedSampleId) return;

    const existingReview = getReviewBySampleId(selectedSampleId);
    if (existingReview) {
      addReview({
        sampleId: selectedSampleId,
        reviewer: '周姐',
        finalIntent,
        reason,
        isRemarkAdded: !!remark,
      });
    } else {
      addReview({
        sampleId: selectedSampleId,
        reviewer: '周姐',
        finalIntent,
        reason,
        isRemarkAdded: !!remark,
      });
    }
    updateSampleStatus(selectedSampleId, 'completed');
    alert('评审结果已保存！');
  };

  const handleAddRemark = () => {
    if (!selectedSampleId || !remark) return;

    const existingReview = getReviewBySampleId(selectedSampleId);
    setOldRemark(existingReview?.remark || '');
    setShowRemarkDiff(true);

    updateReviewRemark(selectedSampleId, remark);
  };

  const selectedSample = selectedSampleId ? getSampleById(selectedSampleId) : null;
  const selectedDetection = selectedSampleId ? getDetectionBySampleId(selectedSampleId) : null;
  const selectedReview = selectedSampleId ? getReviewBySampleId(selectedSampleId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">人工改判</h1>
          <p className="text-gray-500 mt-1">对检测结果进行人工复核和改判</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">待复核样本</h2>
              <p className="text-sm text-gray-500 mt-1">共 {pendingSamples.length} 条待处理</p>
            </div>
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {pendingSamples.map((sample) => {
                const detection = getDetectionBySampleId(sample.id);

                return (
                  <div
                    key={sample.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedSampleId === sample.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    onClick={() => handleSelectSample(sample.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{sample.id}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(sample.status)}`}
                      >
                        {getStatusLabel(sample.status)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                      {sample.content.split('\n')[0]}
                    </p>
                    {detection && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-blue-600">{detection.modelIntent}</span>
                        {detection.hasConflict && (
                          <span className="text-orange-500">≠</span>
                        )}
                        {detection.manualIntent && (
                          <span className="text-emerald-600">{detection.manualIntent}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {pendingSamples.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-300" />
                  <p>暂无待复核样本</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-2 space-y-6">
          {selectedSample && selectedDetection ? (
            <>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-800">评审工作台</h2>
                  <span className="text-sm text-gray-500">{selectedSample.id}</span>
                </div>
                <div className="p-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">客服对话内容</h3>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                        {selectedSample.content}
                      </pre>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-blue-500 rounded">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-blue-700">模型输出</span>
                      </div>
                      <p className="text-lg font-bold text-blue-800">{selectedDetection.modelIntent}</p>
                      <p className="text-xs text-blue-600 mt-1">
                        置信度: {(selectedDetection.modelConfidence * 100).toFixed(0)}%
                      </p>
                    </div>

                    {selectedDetection.manualIntent && (
                      <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1.5 bg-emerald-500 rounded">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-sm font-medium text-emerald-700">人工标注</span>
                        </div>
                        <p className="text-lg font-bold text-emerald-800">{selectedDetection.manualIntent}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-800">改判操作</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      最终判定意图
                    </label>
                    <select
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={finalIntent}
                      onChange={(e) => setFinalIntent(e.target.value)}
                    >
                      <option value="">请选择意图</option>
                      {intentOptions.map((intent) => (
                        <option key={intent} value={intent}>
                          {intent}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      改判理由
                    </label>
                    <textarea
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                      placeholder="请填写改判理由，便于后续追溯..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        补录备注
                      </label>
                      {selectedReview?.isRemarkAdded && (
                        <button
                          onClick={() => setShowRemarkDiff(!showRemarkDiff)}
                          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <History className="w-3 h-3" />
                          查看差异
                        </button>
                      )}
                    </div>
                    <textarea
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={2}
                      placeholder="可临时补充备注说明..."
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                    />
                  </div>

                  {showRemarkDiff && selectedReview?.remarkDiff && (
                    <RemarkDiff
                      before={selectedReview.remarkDiff.before}
                      after={selectedReview.remarkDiff.after}
                    />
                  )}

                  <div className="flex gap-4 pt-4">
                    <button
                      onClick={handleSave}
                      disabled={!finalIntent}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="w-5 h-5" />
                      保存评审结果
                    </button>
                    <button
                      onClick={handleAddRemark}
                      disabled={!remark}
                      className="px-6 flex items-center gap-2 py-3 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <MessageSquare className="w-5 h-5" />
                      补录备注
                    </button>
                  </div>
                </div>
              </div>

              {selectedReview && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800">历史记录</h2>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800">{selectedReview.reviewer}</span>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(selectedReview.reviewedAt)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            最终判定：<span className="font-medium text-gray-800">{selectedReview.finalIntent}</span>
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            理由：{selectedReview.reason}
                          </p>
                          {selectedReview.remark && (
                            <p className="text-sm text-gray-500 mt-2 bg-yellow-50 px-3 py-2 rounded border border-yellow-200">
                              备注：{selectedReview.remark}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-gray-500">请从左侧选择一个样本进行复核</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
