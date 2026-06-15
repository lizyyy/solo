import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getRoleName, getStatusName } from '../utils/storage';
import { getRelatedRecords } from '../utils/business';
import type { ReviewRecord } from '../types';

const ReplayPage: React.FC = () => {
  const { state } = useApp();
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const finalizedRecords = state.reviewRecords.filter(r => r.status === 'finalized');
  const selectedRecord = selectedRecordId 
    ? state.reviewRecords.find(r => r.recordId === selectedRecordId) 
    : null;

  const stats = {
    total: state.reviewRecords.length,
    finalized: finalizedRecords.length,
    hasConflict: state.reviewRecords.filter(r => r.conflicts.length > 0).length,
    withPrompt: state.reviewRecords.filter(r => r.promptVersion).length,
    multiModel: new Set(
      state.reviewRecords
        .filter(r => getRelatedRecords(r, state.reviewRecords).length > 0)
        .map(r => r.sampleId)
    ).size,
    avgAiScore: state.reviewRecords.length > 0 
      ? (state.reviewRecords.reduce((sum, r) => sum + r.interview.aiScore, 0) / state.reviewRecords.length).toFixed(1)
      : '0',
    avgHumanScore: finalizedRecords.length > 0
      ? (finalizedRecords.reduce((sum, r) => sum + (r.finalScore ?? 0), 0) / finalizedRecords.length).toFixed(1)
      : '0',
  };

  const renderHistoryTimeline = (record: ReviewRecord) => {
    const related = getRelatedRecords(record, state.reviewRecords);
    return (
      <div className="space-y-4">
        <h4 className="font-semibold text-gray-700 mb-3">历史追溯（证据链）</h4>
        {related.length > 0 && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded text-sm mb-4">
            <p className="font-medium text-orange-800 mb-1">关联记录提示</p>
            <p className="text-orange-700 text-xs">
              样本编号 {record.sampleId} 在不同模型版本下共 {related.length + 1} 条独立记录。
              当前展示的是模型版本 {record.interview.modelVersion} 的记录。
            </p>
            <div className="mt-2 space-y-1">
              {related.map(r => (
                <div key={r.recordId} className="text-xs text-orange-600">
                  → 另一条记录：{r.interview.modelVersion}，AI评分 {r.interview.aiScore}，状态 {getStatusName(r.status)}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="relative">
          {[...record.history].reverse().map((h, idx) => (
            <div key={h.historyId} className="relative pl-8 pb-6 last:pb-0">
              {idx < record.history.length - 1 && (
                <div className="absolute left-3 top-3 bottom-0 w-0.5 bg-gray-200" />
              )}
              <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                {record.history.length - idx}
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{h.action}</span>
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                    {getRoleName(h.role)}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  操作人：{h.operator} · {h.timestamp}
                </p>
                {h.remark && (
                  <p className="text-sm text-gray-700 mt-2 p-2 bg-white rounded border">
                    {h.remark}
                  </p>
                )}
                {h.before && Object.keys(h.before).length > 0 && (
                  <div className="mt-2 text-xs">
                    <span className="text-red-500">变更前：</span>
                    <code className="bg-red-50 px-1 rounded">{JSON.stringify(h.before)}</code>
                  </div>
                )}
                {h.after && Object.keys(h.after).length > 0 && (
                  <div className="mt-1 text-xs">
                    <span className="text-green-500">变更后：</span>
                    <code className="bg-green-50 px-1 rounded">{JSON.stringify(h.after)}</code>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (selectedRecord) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setSelectedRecordId(null)} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">
            ← 返回复盘列表
          </button>
          <h2 className="text-2xl font-bold">
            复盘详情 - {selectedRecord.sampleId}
            <span className="text-sm font-normal text-gray-500 ml-2">
              @{selectedRecord.interview.modelVersion}
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">基本信息</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">候选人</span>
                  <p className="font-medium">{selectedRecord.interview.candidateName}</p>
                </div>
                <div>
                  <span className="text-gray-500">岗位</span>
                  <p className="font-medium">{selectedRecord.interview.position}</p>
                </div>
                <div>
                  <span className="text-gray-500">模型版本</span>
                  <p>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                      {selectedRecord.interview.modelVersion}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">提示词版本</span>
                  <p>
                    {selectedRecord.promptVersion ? (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        {selectedRecord.promptVersion.versionNumber}
                      </span>
                    ) : (
                      <span className="text-gray-400">无</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">评分对比</h3>
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-1">AI 评分</p>
                  <p className={`text-3xl font-bold ${selectedRecord.interview.aiScore >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedRecord.interview.aiScore}
                  </p>
                </div>
                <div className="text-2xl text-gray-300">→</div>
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-1">最终评分</p>
                  <p className={`text-3xl font-bold ${(selectedRecord.finalScore ?? 0) >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedRecord.finalScore ?? '-'}
                  </p>
                </div>
              </div>
              {selectedRecord.correction && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500 mb-1">人工改判理由</p>
                  <p className="text-sm p-2 bg-gray-50 rounded">{selectedRecord.correction.reason}</p>
                </div>
              )}
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">最终结论</h3>
              <div className="text-center py-4">
                <span className={`px-6 py-2 rounded-full text-lg font-bold ${
                  (selectedRecord.finalConclusion || '').includes('通过') 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {selectedRecord.finalConclusion || '待定'}
                </span>
                <p className="text-xs text-gray-500 mt-2">
                  样本编号 {selectedRecord.sampleId} · 模型版本 {selectedRecord.interview.modelVersion}
                </p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            {renderHistoryTimeline(selectedRecord)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">产品复盘页</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">总记录数</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">已归档</p>
          <p className="text-2xl font-bold text-green-600">{stats.finalized}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">有冲突</p>
          <p className="text-2xl font-bold text-red-600">{stats.hasConflict}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">已补录提示词</p>
          <p className="text-2xl font-bold text-blue-600">{stats.withPrompt}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">跨模型版本</p>
          <p className="text-2xl font-bold text-orange-600">{stats.multiModel}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">平均AI评分</p>
          <p className="text-2xl font-bold">{stats.avgAiScore}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">平均最终评分</p>
          <p className="text-2xl font-bold text-green-600">{stats.avgHumanScore}</p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 font-medium">
          已归档记录 ({finalizedRecords.length})
        </div>
        {finalizedRecords.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>暂无归档记录</p>
            <p className="text-sm mt-1">审核完成后点击「归档」即可在此处查看</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-t">
              <tr>
                <th className="px-4 py-2 text-left">样本编号</th>
                <th className="px-4 py-2 text-left">候选人</th>
                <th className="px-4 py-2 text-center">模型版本</th>
                <th className="px-4 py-2 text-center">提示词版本</th>
                <th className="px-4 py-2 text-right">AI评分</th>
                <th className="px-4 py-2 text-right">最终评分</th>
                <th className="px-4 py-2 text-center">最终结论</th>
                <th className="px-4 py-2 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {finalizedRecords.map(record => (
                <tr key={record.recordId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono">
                    {record.sampleId}
                    <span className="text-xs text-gray-400 ml-1">@{record.interview.modelVersion}</span>
                  </td>
                  <td className="px-4 py-3">{record.interview.candidateName}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                      {record.interview.modelVersion}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {record.promptVersion ? (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        {record.promptVersion.versionNumber}
                      </span>
                    ) : '-'}
                  </td>
                  <td className={`px-4 py-3 text-right ${record.interview.aiScore >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                    {record.interview.aiScore}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${(record.finalScore ?? 0) >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                    {record.finalScore ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      (record.finalConclusion || '').includes('通过') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {record.finalConclusion || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setSelectedRecordId(record.recordId)}
                      className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                    >
                      追溯证据链
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h4 className="font-semibold text-yellow-800 mb-2">复盘设计原则</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• 所有结论均可追溯至原始操作，证据链完整</li>
          <li>• 历史记录不可篡改，每一步操作均有时间戳和操作人</li>
          <li>• 冲突处理过程透明，确认/驳回均留痕</li>
          <li>• 产品复盘页与历史记录数据一致，不会出现「结论看着很满，追证据时断在半路」</li>
          <li>• 同样本编号不同模型版本 = 多条独立记录，每条独立审核，不自动归正常</li>
        </ul>
      </div>
    </div>
  );
};

export default ReplayPage;
