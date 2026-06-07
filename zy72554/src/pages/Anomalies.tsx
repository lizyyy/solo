import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  FileText,
  Eye,
  Filter
} from 'lucide-react';
import { useAppStore } from '../store';
import { dataScientist } from '../data/mockData';

export const AnomaliesPage = () => {
  const navigate = useNavigate();
  const { anomalies, playbackRecords, reviewAnomaly, addToast } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('all');

  const filteredAnomalies = anomalies.filter(a => {
    if (filter === 'pending') return !a.reviewResult;
    if (filter === 'reviewed') return !!a.reviewResult;
    return true;
  });

  const getPlaybackInfo = (playbackId: string) => {
    return playbackRecords.find(r => r.id === playbackId);
  };

  const handleReview = (anomalyId: string, result: 'confirmed_normal' | 'needs_modification') => {
    reviewAnomaly(anomalyId, result, dataScientist.name);
    addToast('success', result === 'confirmed_normal' ? '已确认正常' : '已标记需修改');
  };

  const pendingCount = anomalies.filter(a => !a.reviewResult).length;
  const reviewedCount = anomalies.filter(a => a.reviewResult).length;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 font-display mb-2">异常检测面板</h1>
        <p className="text-gray-500">集中查看所有阈值与报告值不一致的记录，快速复核</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{pendingCount}</p>
              <p className="text-sm text-gray-500">待复核</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{reviewedCount}</p>
              <p className="text-sm text-gray-500">已复核</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{anomalies.length}</p>
              <p className="text-sm text-gray-500">异常总数</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <div className="flex gap-2">
            {[
              { key: 'all', label: '全部' },
              { key: 'pending', label: '待复核' },
              { key: 'reviewed', label: '已复核' }
            ].map(item => (
              <button
                key={item.key}
                onClick={() => setFilter(item.key as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === item.key
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredAnomalies.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
            <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无异常记录</p>
          </div>
        ) : (
          filteredAnomalies.map((anomaly, index) => {
            const playback = getPlaybackInfo(anomaly.playbackId);
            return (
              <div
                key={anomaly.id}
                className={`bg-white rounded-xl shadow-sm border p-6 animate-fade-in ${
                  anomaly.reviewResult
                    ? anomaly.reviewResult === 'confirmed_normal'
                      ? 'border-green-200'
                      : 'border-blue-200'
                    : 'border-orange-300 border-2'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      {!anomaly.reviewResult ? (
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium animate-pulse-glow">
                          <AlertTriangle className="w-4 h-4" />
                          待复核
                        </span>
                      ) : anomaly.reviewResult === 'confirmed_normal' ? (
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          <CheckCircle className="w-4 h-4" />
                          已确认正常
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                          <AlertTriangle className="w-4 h-4" />
                          需修改
                        </span>
                      )}
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {anomaly.detectedAt}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-800 mb-3">
                      {anomaly.metricName}
                    </h3>

                    <div className="flex items-center gap-8 mb-4">
                      <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <p className="text-sm text-orange-600 mb-1">实际阈值（已修改）</p>
                        <p className="text-2xl font-bold font-mono text-orange-700">{anomaly.thresholdValue}</p>
                      </div>
                      <div className="text-2xl text-gray-300">≠</div>
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm text-gray-500 mb-1">报告值（旧值）</p>
                        <p className="text-2xl font-bold font-mono text-gray-400 line-through">{anomaly.reportValue}</p>
                      </div>
                      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-sm text-red-600 mb-1">差异</p>
                        <p className="text-2xl font-bold font-mono text-red-700">
                          +{((anomaly.thresholdValue - anomaly.reportValue) / anomaly.reportValue * 100).toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    {playback && (
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {playback.fileName}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {playback.operator}
                        </span>
                      </div>
                    )}

                    {anomaly.reviewResult && anomaly.reviewedBy && (
                      <p className="mt-3 text-xs text-gray-500">
                        复核人：{anomaly.reviewedBy} · {anomaly.reviewedAt}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 ml-6">
                    {!anomaly.reviewResult && (
                      <>
                        <button
                          onClick={() => handleReview(anomaly.id, 'confirmed_normal')}
                          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
                        >
                          确认正常
                        </button>
                        <button
                          onClick={() => handleReview(anomaly.id, 'needs_modification')}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                        >
                          需修改
                        </button>
                      </>
                    )}
                    {playback && (
                      <button
                        onClick={() => navigate(`/playbacks/${playback.id}`)}
                        className="flex items-center justify-center gap-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        查看详情
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
