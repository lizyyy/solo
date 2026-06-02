import { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle, XCircle, Info, ChevronRight } from 'lucide-react';
import { getMatchResults } from '@/utils/mergeData';
import { MatchResult, Anomaly, AnomalyType } from '@/types';
import { getAnomalyTypeLabel, getSeverityLabel, getSeverityColor } from '@/utils/anomaly';

export default function Anomalies() {
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [selectedAnomaly, setSelectedAnomaly] = useState<{ anomaly: Anomaly; record: MatchResult } | null>(null);
  const [typeFilter, setTypeFilter] = useState<AnomalyType | 'all'>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const results = await getMatchResults();
    setMatchResults(results);
  }

  const allAnomalies: { anomaly: Anomaly; record: MatchResult }[] = [];
  matchResults.forEach(record => {
    record.anomalies.forEach(anomaly => {
      allAnomalies.push({ anomaly, record });
    });
  });

  const filteredAnomalies = typeFilter === 'all'
    ? allAnomalies
    : allAnomalies.filter(a => a.anomaly.type === typeFilter);

  const typeCounts: Record<string, number> = {};
  allAnomalies.forEach(({ anomaly }) => {
    typeCounts[anomaly.type] = (typeCounts[anomaly.type] || 0) + 1;
  });

  const severityCounts = {
    high: allAnomalies.filter(a => a.anomaly.severity === 'high').length,
    medium: allAnomalies.filter(a => a.anomaly.severity === 'medium').length,
    low: allAnomalies.filter(a => a.anomaly.severity === 'low').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">异常检测</h2>
        <p className="text-sm text-gray-500">查看容量超限、时间段冲突、空值缺失、重复项等异常，附人话解释</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">异常总数</p>
              <p className="text-2xl font-bold text-gray-800">{allAnomalies.length}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-orange-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-red-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">严重</p>
              <p className="text-2xl font-bold text-red-600">{severityCounts.high}</p>
            </div>
            <XCircle className="w-10 h-10 text-red-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-yellow-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">中等</p>
              <p className="text-2xl font-bold text-yellow-600">{severityCounts.medium}</p>
            </div>
            <AlertCircle className="w-10 h-10 text-yellow-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-green-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">轻微</p>
              <p className="text-2xl font-bold text-green-600">{severityCounts.low}</p>
            </div>
            <Info className="w-10 h-10 text-green-500 opacity-20" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
        <p className="text-sm text-gray-600 mb-3">按异常类型筛选：</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              typeFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            全部 ({allAnomalies.length})
          </button>
          {Object.entries(typeCounts).map(([type, count]) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type as AnomalyType)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                typeFilter === type ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {getAnomalyTypeLabel(type as AnomalyType)} ({count})
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="font-semibold text-gray-800">异常列表 ({filteredAnomalies.length})</h3>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {filteredAnomalies.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p>暂无异常</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredAnomalies.map(({ anomaly, record }, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedAnomaly({ anomaly, record })}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      selectedAnomaly?.anomaly.id === anomaly.id
                        ? 'bg-orange-50 border-l-2 border-orange-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(anomaly.severity)}`}>
                            {getSeverityLabel(anomaly.severity)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {getAnomalyTypeLabel(anomaly.type)}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-800">{record.mergedRecord.lamp_id}</p>
                        <p className="text-xs text-gray-500 truncate">{anomaly.description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          {selectedAnomaly ? (
            <div className="flex flex-col h-full">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">
                    {selectedAnomaly.record.mergedRecord.lamp_id} - {selectedAnomaly.record.mergedRecord.address}
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(selectedAnomaly.anomaly.severity)}`}>
                    {getSeverityLabel(selectedAnomaly.anomaly.severity)}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{getAnomalyTypeLabel(selectedAnomaly.anomaly.type)}</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-xs font-medium text-orange-700 mb-2">🔍 系统检测到的问题</p>
                  <p className="text-sm text-gray-700">{selectedAnomaly.anomaly.description}</p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs font-medium text-blue-700 mb-2">💡 人话解释（给社区看的）</p>
                  <p className="text-sm text-gray-700">{selectedAnomaly.anomaly.human_readable}</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-700 mb-2">📋 关联记录详情</p>
                  <div className="text-xs text-gray-600 space-y-2">
                    {selectedAnomaly.record.gisPoint && (
                      <div>
                        <p className="font-medium text-blue-600">GIS点位：</p>
                        <p>地址: {selectedAnomaly.record.gisPoint.address}</p>
                        <p>功率: {selectedAnomaly.record.gisPoint.power_rating}W</p>
                        <p>运行时间: {selectedAnomaly.record.gisPoint.operating_hours}</p>
                      </div>
                    )}
                    {selectedAnomaly.record.feedback && (
                      <div className="mt-2">
                        <p className="font-medium text-green-600">居民反馈：</p>
                        <p>描述: {selectedAnomaly.record.feedback.description}</p>
                        {selectedAnomaly.record.feedback.raw_note && (
                          <p className="mt-1 p-2 bg-white rounded border text-gray-500">
                            原始备注: {selectedAnomaly.record.feedback.raw_note}
                          </p>
                        )}
                      </div>
                    )}
                    {selectedAnomaly.record.inspection && (
                      <div className="mt-2">
                        <p className="font-medium text-purple-600">巡检记录：</p>
                        <p>巡检人: {selectedAnomaly.record.inspection.inspector}</p>
                        <p>状态: {selectedAnomaly.record.inspection.status}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <AlertTriangle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">请从左侧选择一条异常查看详情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
