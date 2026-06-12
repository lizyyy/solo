import { useState, useEffect } from 'react';
import { Search, CheckCircle, HelpCircle, MapPin, FileText, AlertCircle, Save } from 'lucide-react';
import { getMatchResults, updateReviewStatus } from '@/utils/mergeData';
import { MatchResult, ReviewStatus } from '@/types';
import { getReviewStatusLabel, getReviewStatusColor } from '@/utils/export';
import { getAnomalyTypeLabel, getSeverityColor } from '@/utils/anomaly';

export default function Review() {
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<MatchResult | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'all'>('all');
  const [reviewNote, setReviewNote] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const results = await getMatchResults();
    setMatchResults(results);
  }

  const filteredResults = matchResults.filter(r => {
    const matchesSearch = r.mergedRecord.lamp_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.mergedRecord.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.mergedRecord.review_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function handleSetStatus(status: ReviewStatus) {
    if (!selectedRecord) return;
    
    await updateReviewStatus(selectedRecord.mergedRecord.id, status, reviewNote);
    await loadData();
    
    const updated = matchResults.find(r => r.mergedRecord.id === selectedRecord.mergedRecord.id);
    if (updated) {
      setSelectedRecord({ ...updated, mergedRecord: { ...updated.mergedRecord, review_status: status, review_note: reviewNote } });
    }
  }

  const statusActions: { status: ReviewStatus; label: string; icon: React.ReactNode; color: string }[] = [
    { status: 'confirmed', label: '已处理', icon: <CheckCircle className="w-4 h-4" />, color: 'bg-green-500 hover:bg-green-600' },
    { status: 'need_verify', label: '待核实', icon: <HelpCircle className="w-4 h-4" />, color: 'bg-yellow-500 hover:bg-yellow-600' },
    { status: 'on_site', label: '需现场复看', icon: <MapPin className="w-4 h-4" />, color: 'bg-red-500 hover:bg-red-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">人工复核</h2>
        <p className="text-sm text-gray-500">逐条审核记录，标记处理状态，添加复核备注</p>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索路灯编号或地址..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as ReviewStatus | 'all')}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">全部状态</option>
          <option value="pending">待复核</option>
          <option value="confirmed">已处理</option>
          <option value="need_verify">待核实</option>
          <option value="on_site">需现场复看</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="font-semibold text-gray-800">记录列表 ({filteredResults.length})</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {filteredResults.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p>暂无记录</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredResults.map(result => (
                  <div
                    key={result.mergedRecord.id}
                    onClick={() => {
                      setSelectedRecord(result);
                      setReviewNote(result.mergedRecord.review_note);
                    }}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      selectedRecord?.mergedRecord.id === result.mergedRecord.id
                        ? 'bg-orange-50 border-l-2 border-orange-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-800 text-sm">{result.mergedRecord.lamp_id}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getReviewStatusColor(result.mergedRecord.review_status)}`}>
                            {getReviewStatusLabel(result.mergedRecord.review_status)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 truncate max-w-xs">{result.mergedRecord.address}</p>
                      </div>
                      {result.anomalies.length > 0 && (
                        <span className="flex items-center space-x-1 text-xs text-orange-600">
                          <AlertCircle className="w-3 h-3" />
                          <span>{result.anomalies.length}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          {selectedRecord ? (
            <div className="flex flex-col h-full">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">{selectedRecord.mergedRecord.lamp_id}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getReviewStatusColor(selectedRecord.mergedRecord.review_status)}`}>
                    {getReviewStatusLabel(selectedRecord.mergedRecord.review_status)}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{selectedRecord.mergedRecord.address}</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedRecord.gisPoint && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs font-medium text-blue-700 mb-2">GIS点位</p>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>功率: {selectedRecord.gisPoint.power_rating}W</p>
                      <p>运行时间: {selectedRecord.gisPoint.operating_hours}</p>
                      <p>坐标: {selectedRecord.gisPoint.longitude.toFixed(6)}, {selectedRecord.gisPoint.latitude.toFixed(6)}</p>
                    </div>
                  </div>
                )}

                {selectedRecord.feedback && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                    <p className="text-xs font-medium text-green-700 mb-2">居民反馈</p>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>描述: {selectedRecord.feedback.description}</p>
                      <p>反馈人: {selectedRecord.feedback.reporter}</p>
                    </div>
                    {selectedRecord.feedback.raw_note && (
                      <div className="mt-2 p-2 bg-white rounded border border-green-200">
                        <p className="text-xs text-gray-500 mb-1">原始备注（未清洗）：</p>
                        <p className="text-xs text-gray-700 whitespace-pre-wrap">{selectedRecord.feedback.raw_note}</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedRecord.inspection && (
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <p className="text-xs font-medium text-purple-700 mb-2">巡检记录</p>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>巡检人: {selectedRecord.inspection.inspector}</p>
                      <p>时间: {selectedRecord.inspection.inspection_time}</p>
                      <p>状态: {selectedRecord.inspection.status}</p>
                    </div>
                    {selectedRecord.inspection.manual_note && (
                      <div className="mt-2 p-2 bg-white rounded border border-purple-200">
                        <p className="text-xs text-gray-500 mb-1">手改备注：</p>
                        <p className="text-xs text-gray-700 whitespace-pre-wrap">{selectedRecord.inspection.manual_note}</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedRecord.auditLogs && selectedRecord.auditLogs.length > 0 && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs font-medium text-gray-700 mb-2">📋 变更记录</p>
                    <div className="space-y-1">
                      {selectedRecord.auditLogs.map(log => (
                        <div key={log.id} className="text-xs text-gray-600 flex items-start space-x-2">
                          <span className="text-gray-400 flex-shrink-0">{new Date(log.created_at).toLocaleString('zh-CN')}</span>
                          <span>{log.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedRecord.anomalies.length > 0 && (
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                    <p className="text-xs font-medium text-orange-700 mb-2">异常检测 ({selectedRecord.anomalies.length})</p>
                    <div className="space-y-2">
                      {selectedRecord.anomalies.map(anomaly => (
                        <div key={anomaly.id} className="p-2 bg-white rounded border border-orange-200">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(anomaly.severity)}`}>
                              {getAnomalyTypeLabel(anomaly.type)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-700">{anomaly.human_readable}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">复核备注</label>
                  <textarea
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    placeholder="添加复核备注..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 min-h-20"
                  />
                </div>
              </div>

              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                <div className="flex items-center space-x-2">
                  {statusActions.map(action => (
                    <button
                      key={action.status}
                      onClick={() => handleSetStatus(action.status)}
                      className={`flex items-center space-x-2 px-3 py-2 text-white text-sm rounded-lg transition-colors ${action.color}`}
                    >
                      {action.icon}
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">请从左侧选择一条记录进行复核</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
