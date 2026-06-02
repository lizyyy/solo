
import React, { useState } from 'react';
import { Play, AlertTriangle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { EvidenceCard } from '../components/EvidenceCard';
import { ConflictPanel } from '../components/ConflictPanel';
import { getDriftLevel, formatDate } from '../utils';

export const Detection: React.FC = () => {
  const {
    samples,
    detections,
    selectedSampleId,
    isRunningDetection,
    runDetection,
    updateSampleStatus,
    addReview,
    setSelectedSampleId,
    getSampleById,
    getDetectionBySampleId,
  } = useAppStore();

  const [showConflict, setShowConflict] = useState(false);
  const [conflictDetection, setConflictDetection] = useState<any>(null);

  const handleRunDetection = async () => {
    await runDetection();
  };

  const handleViewEvidence = (sampleId: string) => {
    setSelectedSampleId(sampleId);
    const detection = getDetectionBySampleId(sampleId);
    if (detection && detection.hasConflict) {
      setConflictDetection(detection);
      setShowConflict(true);
    }
  };

  const handleAcceptModel = () => {
    if (conflictDetection) {
      addReview({
        sampleId: conflictDetection.sampleId,
        reviewer: '周姐',
        finalIntent: conflictDetection.modelIntent,
        reason: '采纳模型判断',
        isRemarkAdded: false,
      });
      updateSampleStatus(conflictDetection.sampleId, 'completed');
      setShowConflict(false);
      setConflictDetection(null);
    }
  };

  const handleAcceptManual = () => {
    if (conflictDetection) {
      addReview({
        sampleId: conflictDetection.sampleId,
        reviewer: '周姐',
        finalIntent: conflictDetection.manualIntent,
        reason: '采纳人工标注',
        isRemarkAdded: false,
      });
      updateSampleStatus(conflictDetection.sampleId, 'completed');
      setShowConflict(false);
      setConflictDetection(null);
    }
  };

  const handleNeedReview = () => {
    if (conflictDetection) {
      updateSampleStatus(conflictDetection.sampleId, 'reviewing');
      setShowConflict(false);
      setConflictDetection(null);
    }
  };

  const driftSamples = samples.filter((s) => {
    const detection = getDetectionBySampleId(s.id);
    return detection?.isDrift;
  });

  const normalSamples = samples.filter((s) => {
    const detection = getDetectionBySampleId(s.id);
    return detection && !detection.isDrift;
  });

  const selectedSample = selectedSampleId ? getSampleById(selectedSampleId) : null;
  const selectedDetection = selectedSampleId ? getDetectionBySampleId(selectedSampleId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">漂移检测</h1>
          <p className="text-gray-500 mt-1">自动检测客服意图漂移情况</p>
        </div>
        <button
          onClick={handleRunDetection}
          disabled={isRunningDetection}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunningDetection ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          {isRunningDetection ? '检测中...' : '运行检测'}
        </button>
      </div>

      {showConflict && conflictDetection ? (
        <ConflictPanel
          detection={conflictDetection}
          onAcceptModel={handleAcceptModel}
          onAcceptManual={handleAcceptManual}
          onNeedReview={handleNeedReview}
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-500 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-700">疑似漂移样本</p>
                  <p className="text-3xl font-bold text-orange-600">{driftSamples.length}</p>
                </div>
              </div>
              <p className="text-xs text-orange-600">需要重点关注和复核</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-500 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-700">正常样本</p>
                  <p className="text-3xl font-bold text-green-600">{normalSamples.length}</p>
                </div>
              </div>
              <p className="text-xs text-green-600">模型判断与标注一致</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl p-6 border border-blue-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <RefreshCw className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-700">待检测样本</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {samples.filter((s) => s.status === 'pending').length}
                  </p>
                </div>
              </div>
              <p className="text-xs text-blue-600">点击上方按钮运行检测</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">疑似漂移样本列表</h2>
              </div>
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {driftSamples.map((sample) => {
                  const detection = getDetectionBySampleId(sample.id);
                  if (!detection) return null;
                  const driftLevel = getDriftLevel(detection.driftScore);

                  return (
                    <div
                  key={sample.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedSampleId === sample.id ? 'bg-orange-50' : ''
                  }`}
                  onClick={() => handleViewEvidence(sample.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">{sample.id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${driftLevel.color}`}>
                          {driftLevel.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{sample.content.split('\n')[0]}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>模型: {detection.modelIntent}</span>
                        <span>→</span>
                        <span>人工: {detection.manualIntent}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {formatDate(detection.detectedAt)}
                    </span>
                  </div>
                </div>
                  );
                })}
                {driftSamples.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    暂无漂移样本
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">证据详情</h2>
              </div>
              <div className="p-6">
                {selectedSample && selectedDetection ? (
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">样本对话内容</h4>
                      <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans">
                        {selectedSample.content}
                      </pre>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <p className="text-xs text-blue-600 mb-1">模型判断</p>
                        <p className="font-bold text-blue-700">{selectedDetection.modelIntent}</p>
                        <p className="text-xs text-blue-500 mt-1">
                          置信度: {(selectedDetection.modelConfidence * 100).toFixed(0)}%
                        </p>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                        <p className="text-xs text-emerald-600 mb-1">人工标注</p>
                        <p className="font-bold text-emerald-700">{selectedDetection.manualIntent}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-700">证据链</h4>
                      {selectedDetection.evidences.map((evidence) => (
                        <EvidenceCard key={evidence.id} evidence={evidence} />
                      ))}
                    </div>

                    {selectedDetection.hasConflict && (
                      <button
                        onClick={() => {
                          setConflictDetection(selectedDetection);
                          setShowConflict(true);
                        }}
                        className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-600 transition-all"
                      >
                        处理此冲突
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>请从左侧选择一个样本查看证据详情</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
