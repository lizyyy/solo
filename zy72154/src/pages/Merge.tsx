import { useState, useEffect } from 'react';
import { Play, AlertCircle, Database, UserCheck, ClipboardList, ChevronDown, ChevronRight } from 'lucide-react';
import { mergeAllData, getMatchResults } from '@/utils/mergeData';
import { MatchResult, MatchConfidence, MatchMethod } from '@/types';
import { getReviewStatusLabel, getReviewStatusColor } from '@/utils/export';

const matchMethodLabels: Record<MatchMethod, string> = {
  lamp_id: '编号匹配',
  address: '地址兜底',
  coordinate: '坐标匹配',
  unmatched: '未匹配'
};

const matchMethodColors: Record<MatchMethod, string> = {
  lamp_id: 'bg-blue-100 text-blue-800',
  address: 'bg-teal-100 text-teal-800',
  coordinate: 'bg-indigo-100 text-indigo-800',
  unmatched: 'bg-gray-100 text-gray-600'
};

export default function Merge() {
  const [loading, setLoading] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | MatchConfidence>('all');

  useEffect(() => {
    loadResults();
  }, []);

  async function loadResults() {
    const results = await getMatchResults();
    setMatchResults(results);
  }

  async function handleMerge() {
    setLoading(true);
    try {
      await mergeAllData();
      await loadResults();
    } catch (error) {
      console.error('归并失败', error);
    }
    setLoading(false);
  }

  const confidenceColors: Record<MatchConfidence, string> = {
    high: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-red-100 text-red-800'
  };

  const confidenceLabels: Record<MatchConfidence, string> = {
    high: '高置信',
    medium: '中置信',
    low: '低置信'
  };

  const filteredResults = filter === 'all' 
    ? matchResults 
    : matchResults.filter(r => r.mergedRecord.match_confidence === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">数据归并</h2>
          <p className="text-sm text-gray-500">基于路灯编号、地址、坐标自动匹配多源数据</p>
        </div>
        <button
          onClick={handleMerge}
          disabled={loading}
          className="flex items-center space-x-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Play className="w-4 h-4" />
          <span>{loading ? '归并中...' : '执行归并'}</span>
        </button>
      </div>

      {matchResults.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">筛选：</span>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                filter === 'all' ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              全部 ({matchResults.length})
            </button>
            {(['high', 'medium', 'low'] as MatchConfidence[]).map(conf => (
              <button
                key={conf}
                onClick={() => setFilter(conf)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  filter === conf ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {confidenceLabels[conf]} ({matchResults.filter(r => r.mergedRecord.match_confidence === conf).length})
              </button>
            ))}
          </div>
        </div>
      )}

      {matchResults.length === 0 ? (
        <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-100">
          <Database className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">暂无归并数据，请先导入数据后执行归并</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {filteredResults.map(result => (
              <div key={result.mergedRecord.id}>
                <div
                  className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(expandedId === result.mergedRecord.id ? null : result.mergedRecord.id)}
                >
                  <div className="flex items-center space-x-4">
                    {expandedId === result.mergedRecord.id ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-800">{result.mergedRecord.lamp_id}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${confidenceColors[result.mergedRecord.match_confidence]}`}>
                          {confidenceLabels[result.mergedRecord.match_confidence]} {result.mergedRecord.match_score.toFixed(0)}%
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${matchMethodColors[result.mergedRecord.match_method]}`}>
                          {matchMethodLabels[result.mergedRecord.match_method]}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getReviewStatusColor(result.mergedRecord.review_status)}`}>
                          {getReviewStatusLabel(result.mergedRecord.review_status)}
                        </span>
                        {result.anomalies.length > 0 && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                            {result.anomalies.length}个异常
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{result.mergedRecord.address}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {result.gisPoint && (
                      <div className="flex items-center space-x-1 text-xs text-blue-600" title="GIS点位">
                        <Database className="w-4 h-4" />
                        <span>GIS</span>
                      </div>
                    )}
                    {result.feedback && (
                      <div className="flex items-center space-x-1 text-xs text-green-600" title="居民反馈">
                        <UserCheck className="w-4 h-4" />
                        <span>反馈</span>
                      </div>
                    )}
                    {result.inspection && (
                      <div className="flex items-center space-x-1 text-xs text-purple-600" title="巡检记录">
                        <ClipboardList className="w-4 h-4" />
                        <span>巡检</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {expandedId === result.mergedRecord.id && (
                  <div className="px-12 py-4 bg-gray-50 border-t border-gray-100">
                    <div className="grid grid-cols-3 gap-4">
                      {result.gisPoint && (
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center space-x-2 text-blue-600 mb-2">
                            <Database className="w-4 h-4" />
                            <span className="text-sm font-medium">GIS点位</span>
                          </div>
                          <div className="text-xs space-y-1 text-gray-600">
                            <p><span className="text-gray-400">编号：</span>{result.gisPoint.lamp_id || '-'}</p>
                            <p><span className="text-gray-400">地址：</span>{result.gisPoint.address || '-'}</p>
                            <p><span className="text-gray-400">功率：</span>{result.gisPoint.power_rating || '-'}W</p>
                            <p><span className="text-gray-400">运行时间：</span>{result.gisPoint.operating_hours || '-'}</p>
                          </div>
                        </div>
                      )}
                      {result.feedback && (
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center space-x-2 text-green-600 mb-2">
                            <UserCheck className="w-4 h-4" />
                            <span className="text-sm font-medium">居民反馈</span>
                          </div>
                          <div className="text-xs space-y-1 text-gray-600">
                            <p><span className="text-gray-400">编号：</span>{result.feedback.lamp_id || '-'}</p>
                            <p><span className="text-gray-400">地址：</span>{result.feedback.address || '-'}</p>
                            <p><span className="text-gray-400">描述：</span>{result.feedback.description || '-'}</p>
                            <p><span className="text-gray-400">反馈人：</span>{result.feedback.reporter || '-'}</p>
                          </div>
                          {result.feedback.old_format_note && (
                            <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-700 border border-yellow-200">
                              <p className="font-medium mb-1">⚠️ 旧口径数据</p>
                              <p>{result.feedback.old_format_note}</p>
                            </div>
                          )}
                        </div>
                      )}
                      {result.inspection && (
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center space-x-2 text-purple-600 mb-2">
                            <ClipboardList className="w-4 h-4" />
                            <span className="text-sm font-medium">巡检记录</span>
                          </div>
                          <div className="text-xs space-y-1 text-gray-600">
                            <p><span className="text-gray-400">编号：</span>{result.inspection.lamp_id || '-'}</p>
                            <p><span className="text-gray-400">地址：</span>{result.inspection.address || '-'}</p>
                            <p><span className="text-gray-400">巡检人：</span>{result.inspection.inspector || '-'}</p>
                            <p><span className="text-gray-400">状态：</span>{result.inspection.status || '-'}</p>
                          </div>
                          {result.inspection.manual_note && (
                            <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700 border border-blue-200">
                              <p className="font-medium mb-1">📝 手改备注</p>
                              <p>{result.inspection.manual_note}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {result.anomalies.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">异常检测：</p>
                        <div className="space-y-2">
                          {result.anomalies.map(anomaly => (
                            <div key={anomaly.id} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                              <div className="flex items-start space-x-2">
                                <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                                <div className="text-xs">
                                  <p className="font-medium text-orange-800">{anomaly.description}</p>
                                  <p className="text-orange-600 mt-1">{anomaly.human_readable}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
