import { useState } from 'react';
import { Play, BarChart3, AlertTriangle, CheckCircle, MessageSquare, Clock, User } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { generateActionSuggestion, generateBatchSummary } from '../utils/heatLossCalc';
import { cn } from '../utils/cn';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function ResultsPanel() {
  const {
    records,
    results,
    calculateResults,
    thresholds,
    activeThresholdId,
    currentBatchId,
    batches,
    addNote,
    notes,
  } = useAppStore();

  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);

  const activeThreshold = thresholds.find(t => t.id === activeThresholdId);
  const currentBatch = batches.find(b => b.id === currentBatchId);

  const currentResults = currentBatchId
    ? results.filter(r => r.batchId === currentBatchId)
    : [];

  const summary = currentResults.length > 0 && activeThreshold
    ? generateBatchSummary(currentResults, activeThreshold)
    : null;

  const chartData = currentResults.map(result => {
    const record = records.find(r => r.id === result.recordId);
    return {
      name: record?.location?.slice(0, 6) || result.recordId.slice(-4),
      value: result.heatLossValue,
      risk: result.riskLevel,
      fullName: record?.location,
    };
  });

  const handleAddNote = () => {
    if (selectedRecordId && noteText.trim()) {
      addNote(selectedRecordId, noteText);
      setNoteText('');
      setShowNoteModal(false);
    }
  };

  const openNoteModal = (recordId: string) => {
    setSelectedRecordId(recordId);
    setShowNoteModal(true);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'danger': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-amber-600 bg-amber-50 border-amber-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'danger': return '危险';
      case 'warning': return '预警';
      default: return '正常';
    }
  };

  const getBarColor = (level: string) => {
    switch (level) {
      case 'danger': return '#F53F3F';
      case 'warning': return '#FF7D00';
      default: return '#00B42A';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          核算结果
        </h2>
        <div className="flex items-center gap-3">
          {currentBatch && (
            <div className="text-sm text-slate-500 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {new Date(currentBatch.createdAt).toLocaleString('zh-CN')}
            </div>
          )}
          <button
            onClick={calculateResults}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
          >
            <Play className="w-4 h-4" />
            执行计算
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold text-green-600">{summary.normalCount}</span>
            </div>
            <div className="text-xs text-green-700 mt-1">正常</div>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span className="text-2xl font-bold text-amber-600">{summary.warningCount}</span>
            </div>
            <div className="text-xs text-amber-700 mt-1">预警</div>
          </div>
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-2xl font-bold text-red-600">{summary.dangerCount}</span>
            </div>
            <div className="text-xs text-red-700 mt-1">危险</div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-2xl font-bold text-slate-600">
              {Math.round(summary.avgHeatLoss * 100) / 100}
            </div>
            <div className="text-xs text-slate-500 mt-1">平均热损失 ({activeThreshold?.unit})</div>
          </div>
        </div>
      )}

      {summary && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">📋 汇总建议</h4>
          <ul className="space-y-1">
            {summary.suggestions.map((s, i) => (
              <li key={i} className="text-sm text-blue-700">{s}</li>
            ))}
          </ul>
        </div>
      )}

      {chartData.length > 0 && activeThreshold && (
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <h3 className="text-sm font-medium text-slate-700 mb-3">热损失分布图</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number, name: string, props: any) => [
                    `${value} ${activeThreshold.unit}`,
                    props.payload.fullName,
                  ]}
                />
                <ReferenceLine y={activeThreshold.warningThreshold} stroke="#FF7D00" strokeDasharray="5 5" label={{ value: '预警线', position: 'insideTopRight', fontSize: 10 }} />
                <ReferenceLine y={activeThreshold.dangerThreshold} stroke="#F53F3F" strokeDasharray="5 5" label={{ value: '危险线', position: 'insideTopRight', fontSize: 10 }} />
                <Bar dataKey="value" fill="#165DFF">
                  {chartData.map((entry, index) => (
                    <rect key={index} fill={getBarColor(entry.risk)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {currentResults.length > 0 ? (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">位置</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">温差</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">热损失</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">等级</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">处理人</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">备注</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentResults.map((result) => {
                  const record = records.find(r => r.id === result.recordId);
                  const recordNotes = notes.filter(n => n.recordId === result.recordId && n.batchId === currentBatchId);

                  return (
                    <tr key={result.id} className={cn(
                      'hover:bg-slate-50',
                      result.riskLevel === 'danger' && 'bg-red-50/50',
                      result.riskLevel === 'warning' && 'bg-amber-50/50',
                    )}>
                      <td className="px-3 py-2 font-medium text-slate-800">{record?.location}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {record && record.temperatureInside !== null && record.temperatureOutside !== null
                          ? `${Math.abs(record.temperatureOutside - record.temperatureInside)}°C`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-800">
                        {result.heatLossValue} {result.unit}
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn(
                          'px-2 py-0.5 text-xs rounded-full border',
                          getRiskColor(result.riskLevel)
                        )}>
                          {getRiskLabel(result.riskLevel)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {result.processedBy}
                      </td>
                      <td className="px-3 py-2">
                        {recordNotes.length > 0 ? (
                          <span className="text-xs text-blue-600">{recordNotes.length}条</span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => openNoteModal(result.recordId)}
                          className="p-1 text-slate-400 hover:text-blue-500 transition-colors"
                          title="添加备注"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-lg">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">点击"执行计算"按钮开始核算</p>
          <p className="text-sm text-slate-400 mt-1">系统将基于当前参数和阈值版本进行计算</p>
        </div>
      )}

      {currentResults.length > 0 && activeThreshold && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-700">📝 处理建议详情</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {currentResults.filter(r => r.riskLevel !== 'normal').map((result) => {
              const record = records.find(r => r.id === result.recordId);
              if (!record) return null;
              return (
                <div key={result.id} className="p-3 bg-slate-50 rounded-lg text-sm">
                  <pre className="whitespace-pre-wrap text-slate-600 font-sans">
                    {generateActionSuggestion(result, record, activeThreshold)}
                  </pre>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showNoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[500px] shadow-xl">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              添加备注
            </h3>
            <div className="mb-4 text-sm text-slate-500">
              测点：{records.find(r => r.id === selectedRecordId)?.location}
            </div>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="请输入备注说明..."
              className="w-full h-32 p-3 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowNoteModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddNote}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
