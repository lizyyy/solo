import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  User,
  Clock,
  AlertTriangle,
  CheckCircle,
  Link2,
  TrendingUp,
  History,
  Edit3,
  Save,
  X,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus
} from 'lucide-react';
import { useAppStore } from '../store';
import { getStatusLabel, getStatusColor, getStepLabel, checkThresholdConsistency } from '../utils';
import { dataScientist } from '../data/mockData';
import type { ThresholdItem } from '../types';

export const PlaybackDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getPlaybackById,
    getAnomaliesByPlaybackId,
    getBucketsByPlaybackId,
    getLayerMetricsByPlaybackId,
    getVersionHistoriesByPlaybackId,
    reviewAnomaly,
    updatePlaybackRemark,
    rollbackToVersion,
    addToast
  } = useAppStore();

  const [isEditingRemark, setIsEditingRemark] = useState(false);
  const [remarkInput, setRemarkInput] = useState('');
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  const playback = id ? getPlaybackById(id) : undefined;
  const anomalies = id ? getAnomaliesByPlaybackId(id) : [];
  const buckets = id ? getBucketsByPlaybackId(id) : [];
  const metrics = id ? getLayerMetricsByPlaybackId(id) : [];
  const versionHistories = id ? getVersionHistoriesByPlaybackId(id) : [];

  if (!playback) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">记录不存在</h2>
        <p className="text-gray-500 mb-6">找不到指定的回放记录</p>
        <button
          onClick={() => navigate('/playbacks')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </button>
      </div>
    );
  }

  const handleStartEditRemark = () => {
    setRemarkInput(playback.remark || '');
    setIsEditingRemark(true);
  };

  const handleSaveRemark = () => {
    if (playback.id) {
      updatePlaybackRemark(playback.id, remarkInput);
      addToast('success', '备注已更新');
      setIsEditingRemark(false);
    }
  };

  const handleReviewAnomaly = (anomalyId: string, result: 'confirmed_normal' | 'needs_modification') => {
    reviewAnomaly(anomalyId, result, dataScientist.name);
    addToast('success', result === 'confirmed_normal' ? '已确认正常' : '已标记需修改');
  };

  const handleRollback = (versionId: string, fieldName: string, oldValue: string) => {
    if (playback.id) {
      rollbackToVersion(playback.id, versionId);

      if (fieldName === 'thresholds') {
        const oldThresholds = parseThresholds(oldValue);
        if (oldThresholds) {
          const hasInconsistent = oldThresholds.some(
            t => !checkThresholdConsistency(t.thresholdValue, t.reportValue)
          );
          if (hasInconsistent) {
            addToast('warning', '回滚完成，检测到阈值与报告不一致，已标记为待复核');
          } else {
            addToast('success', '回滚完成，所有阈值与报告一致');
          }
        } else {
          addToast('success', '已回滚到指定版本');
        }
      } else {
        addToast('success', '已回滚到指定版本');
      }
    }
  };

  const getFieldLabel = (fieldName: string) => {
    const labels: Record<string, string> = {
      'remark': '备注',
      'thresholds': '阈值配置',
      'record': '记录'
    };
    return labels[fieldName] || fieldName;
  };

  const parseThresholds = (value: string): ThresholdItem[] | null => {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed) && parsed.length > 0 && 'metricName' in parsed[0]) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  };

  const renderThresholdDiff = (oldValue: string, newValue: string) => {
    const oldThresholds = parseThresholds(oldValue);
    const newThresholds = parseThresholds(newValue);

    if (!oldThresholds || !newThresholds) {
      return (
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="p-3 bg-red-50 rounded-lg">
            <p className="text-xs text-red-600 font-medium mb-1">修改前</p>
            <p className="text-sm text-gray-700 font-mono break-all">{oldValue || '(空)'}</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-xs text-green-600 font-medium mb-1">修改后</p>
            <p className="text-sm text-gray-700 font-mono break-all">{newValue || '(空)'}</p>
          </div>
        </div>
      );
    }

    const allMetrics = Array.from(
      new Set([...oldThresholds.map(t => t.metricName), ...newThresholds.map(t => t.metricName)])
    );

    return (
      <div className="mt-4 space-y-2">
        {allMetrics.map(metricName => {
          const oldT = oldThresholds.find(t => t.metricName === metricName);
          const newT = newThresholds.find(t => t.metricName === metricName);
          const changed = JSON.stringify(oldT) !== JSON.stringify(newT);

          return (
            <div
              key={metricName}
              className={`p-3 rounded-lg border ${changed ? 'bg-gray-50 border-gray-200' : 'bg-gray-50/50 border-gray-100'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-800 text-sm">{metricName}</span>
                {changed && (
                  <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                    已变更
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-gray-500 mb-1">修改前</p>
                  {oldT ? (
                    <div className="space-y-1">
                      <p className="font-mono">
                        阈值: <span className="text-gray-700">{oldT.thresholdValue}</span>
                      </p>
                      <p className="font-mono">
                        报告值: <span className={!checkThresholdConsistency(oldT.thresholdValue, oldT.reportValue) ? 'text-orange-600' : 'text-gray-700'}>
                          {oldT.reportValue}
                        </span>
                      </p>
                      {!checkThresholdConsistency(oldT.thresholdValue, oldT.reportValue) && (
                        <p className="text-orange-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          阈值与报告不一致
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400">(新增)</p>
                  )}
                </div>
                <div>
                  <p className="text-gray-500 mb-1">修改后</p>
                  {newT ? (
                    <div className="space-y-1">
                      <p className="font-mono">
                        阈值: <span className="text-gray-700">{newT.thresholdValue}</span>
                      </p>
                      <p className="font-mono">
                        报告值: <span className={!checkThresholdConsistency(newT.thresholdValue, newT.reportValue) ? 'text-orange-600' : 'text-gray-700'}>
                          {newT.reportValue}
                        </span>
                      </p>
                      {!checkThresholdConsistency(newT.thresholdValue, newT.reportValue) && (
                        <p className="text-orange-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          阈值与报告不一致
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400">(删除)</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/playbacks')}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 font-display mb-2">
              {playback.fileName}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                笔记ID: {playback.noteId}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {playback.operator}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {playback.createdAt}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              playback.status === 'normal'
                ? 'bg-green-100 text-green-700'
                : playback.status === 'pending_review'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              <span className={`w-2 h-2 rounded-full ${getStatusColor(playback.status)}`}></span>
              {getStatusLabel(playback.status)}
            </span>
            <span className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm">
              {getStepLabel(playback.currentStep)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800 font-display">阈值配置</h2>
              {playback.hasAnomaly && (
                <span className="flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 text-sm rounded-full">
                  <AlertTriangle className="w-4 h-4" />
                  存在不一致项
                </span>
              )}
            </div>
            <div className="space-y-3">
              {playback.thresholds.map((threshold, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    !threshold.isConsistent
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-800">{threshold.metricName}</span>
                    {threshold.isConsistent ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        一致
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-orange-600 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        不一致
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">实际阈值：</span>
                      <span className={`font-mono font-medium ${!threshold.isConsistent ? 'text-orange-600' : 'text-gray-700'}`}>
                        {threshold.thresholdValue}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">报告值：</span>
                      <span className={`font-mono ${!threshold.isConsistent ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                        {threshold.reportValue}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {anomalies.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 font-display mb-4">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  异常检测记录
                </span>
              </h2>
              <div className="space-y-4">
                {anomalies.map((anomaly) => (
                  <div
                    key={anomaly.id}
                    className={`p-4 rounded-lg border ${
                      anomaly.reviewResult
                        ? anomaly.reviewResult === 'confirmed_normal'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-blue-50 border-blue-200'
                        : 'bg-orange-50 border-orange-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{anomaly.metricName}</p>
                        <div className="mt-2 flex items-center gap-4 text-sm">
                          <span>
                            阈值：<span className="font-mono font-semibold text-orange-600">{anomaly.thresholdValue}</span>
                          </span>
                          <span>
                            报告值：<span className="font-mono text-gray-500 line-through">{anomaly.reportValue}</span>
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          检测时间：{anomaly.detectedAt}
                        </p>
                        {anomaly.reviewResult && (
                          <p className="mt-1 text-xs text-gray-500">
                            复核人：{anomaly.reviewedBy} · {anomaly.reviewedAt}
                          </p>
                        )}
                      </div>
                      <div>
                        {!anomaly.reviewResult ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReviewAnomaly(anomaly.id, 'confirmed_normal')}
                              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                            >
                              确认正常
                            </button>
                            <button
                              onClick={() => handleReviewAnomaly(anomaly.id, 'needs_modification')}
                              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              需修改
                            </button>
                          </div>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                            anomaly.reviewResult === 'confirmed_normal'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {anomaly.reviewResult === 'confirmed_normal' ? '已确认正常' : '需修改'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 font-display mb-4">
              <span className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary-500" />
                版本历史
              </span>
            </h2>
            <div className="space-y-3">
              {versionHistories.length === 0 ? (
                <p className="text-gray-500 text-sm py-4 text-center">暂无版本历史</p>
              ) : (
                versionHistories.map((version) => (
                  <div
                    key={version.id}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedVersion(expandedVersion === version.id ? null : version.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          version.changeType === 'create'
                            ? 'bg-green-100 text-green-700'
                            : version.changeType === 'update'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {version.changeType === 'create' ? '创建' : version.changeType === 'update' ? '更新' : '回滚'}
                        </span>
                        <span className="font-medium text-gray-700">
                          {getFieldLabel(version.fieldName)}
                        </span>
                        <span className="text-sm text-gray-500">
                          v{version.version}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">
                          {version.modifiedBy} · {version.modifiedAt}
                        </span>
                        {expandedVersion === version.id ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </button>
                    {expandedVersion === version.id && (
                      <div className="px-4 pb-4 border-t border-gray-100">
                        {version.fieldName === 'thresholds'
                          ? renderThresholdDiff(version.oldValue, version.newValue)
                          : (
                            <div className="mt-4 grid grid-cols-2 gap-4">
                              <div className="p-3 bg-red-50 rounded-lg">
                                <p className="text-xs text-red-600 font-medium mb-1">修改前</p>
                                <p className="text-sm text-gray-700 break-all">
                                  {version.oldValue || '(空)'}
                                </p>
                              </div>
                              <div className="p-3 bg-green-50 rounded-lg">
                                <p className="text-xs text-green-600 font-medium mb-1">修改后</p>
                                <p className="text-sm text-gray-700 break-all">
                                  {version.newValue || '(空)'}
                                </p>
                              </div>
                            </div>
                          )
                        }
                        {version.changeType !== 'rollback' && version.fieldName !== 'record' && (
                          <button
                            onClick={() => handleRollback(version.id, version.fieldName, version.oldValue)}
                            className="mt-4 inline-flex items-center gap-1 px-3 py-1.5 text-sm text-yellow-700 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                            回滚到此版本
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800 font-display">备注</h2>
              {!isEditingRemark ? (
                <button
                  onClick={handleStartEditRemark}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveRemark}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsEditingRemark(false)}
                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            {isEditingRemark ? (
              <textarea
                value={remarkInput}
                onChange={(e) => setRemarkInput(e.target.value)}
                placeholder="添加备注..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                rows={3}
              />
            ) : (
              <p className="text-gray-600 text-sm">
                {playback.remark || '暂无备注'}
              </p>
            )}
          </div>

          {buckets.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 font-display mb-4">
                <span className="flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-primary-500" />
                  关联实验桶
                </span>
              </h2>
              <div className="space-y-3">
                {buckets.map((bucket) => (
                  <a
                    key={bucket.id}
                    href={bucket.bucketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <p className="font-medium text-gray-800 text-sm">{bucket.bucketName}</p>
                    <p className="text-xs text-primary-600 truncate mt-1">{bucket.bucketUrl}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {metrics.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 font-display mb-4">
                <span className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary-500" />
                  分层指标
                </span>
              </h2>
              <div className="space-y-3">
                {metrics.map((metric) => (
                  <div key={metric.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">
                        {metric.layerName} - {metric.metricName}
                      </span>
                      <span className={`text-sm font-semibold ${
                        metric.newValue >= metric.oldValue ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {metric.newValue >= metric.oldValue ? '+' : ''}
                        {((metric.newValue - metric.oldValue) / metric.oldValue * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="font-mono">{metric.oldValue}</span>
                      <span>→</span>
                      <span className="font-mono font-medium text-gray-700">{metric.newValue}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
