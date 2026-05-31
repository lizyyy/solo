import React, { useState } from 'react';
import { Download, FileText, CheckCircle, XCircle, Hash, FileSpreadsheet, File } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { StatusBadge } from '@/components/StatusBadge';
import type { ExportFormat } from '@/types';

export const ExportCenter: React.FC = () => {
  const { exportHistory, filterFingerprint } = useAppStore();
  const [selectedExport, setSelectedExport] = useState<string | null>(null);

  const formatIcon = (format: ExportFormat) => {
    switch (format) {
      case 'csv': return <File className="w-4 h-4" />;
      case 'xlsx': return <FileSpreadsheet className="w-4 h-4" />;
      case 'pdf': return <FileText className="w-4 h-4" />;
    }
  };

  const formatFilterSummary = (conditions: any) => {
    const parts: string[] = [];
    if (conditions.battleId) parts.push(`战报ID: ${conditions.battleId}`);
    if (conditions.playerId) parts.push(`玩家ID: ${conditions.playerId}`);
    if (conditions.playerName) parts.push(`玩家: ${conditions.playerName}`);
    if (conditions.status?.length) parts.push(`状态: ${conditions.status.join(',')}`);
    if (conditions.scoreRange) parts.push(`分数: ${conditions.scoreRange[0]}-${conditions.scoreRange[1]}`);
    if (conditions.settlementRange) parts.push(`结算: ${conditions.settlementRange[0]}-${conditions.settlementRange[1]}`);
    return parts.length > 0 ? parts.join(' | ') : '无筛选';
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary-200 bg-white">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary-600" />
            <h1 className="font-mono font-bold text-lg text-primary-800">导出中心</h1>
          </div>
          <span className="text-sm text-primary-500 font-mono">
            共 {exportHistory.length} 次导出
          </span>
        </div>
        <div className="text-sm text-primary-500 font-mono">
          当前筛选指纹: {filterFingerprint || '(无筛选)'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b border-primary-200 bg-primary-50">
        <div className="p-4 bg-white border border-primary-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-success-500" />
            <span className="text-sm font-medium text-primary-700 font-mono">一致性通过</span>
          </div>
          <div className="font-mono text-2xl font-bold text-success-600">
            {exportHistory.filter(e => e.consistencyCheckPassed).length}
          </div>
        </div>
        <div className="p-4 bg-white border border-primary-200">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-danger-500" />
            <span className="text-sm font-medium text-primary-700 font-mono">一致性失败</span>
          </div>
          <div className="font-mono text-2xl font-bold text-danger-600">
            {exportHistory.filter(e => !e.consistencyCheckPassed).length}
          </div>
        </div>
        <div className="p-4 bg-white border border-primary-200">
          <div className="flex items-center gap-2 mb-2">
            <Hash className="w-4 h-4 text-info-500" />
            <span className="text-sm font-medium text-primary-700 font-mono">唯一筛选指纹</span>
          </div>
          <div className="font-mono text-2xl font-bold text-info-600">
            {new Set(exportHistory.map(e => e.filterFingerprint)).size}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-4">
          {exportHistory.length === 0 ? (
            <div className="text-center py-12 text-primary-400">
              <Download className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-mono">暂无导出记录</p>
              <p className="text-sm mt-2">在数据工作台进行首次导出</p>
            </div>
          ) : (
            <div className="border border-primary-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-primary-100 border-b border-primary-200">
                      <th className="px-4 py-3 text-left font-mono font-medium text-primary-600">文件</th>
                      <th className="px-4 py-3 text-left font-mono font-medium text-primary-600">格式</th>
                      <th className="px-4 py-3 text-left font-mono font-medium text-primary-600">导出时间</th>
                      <th className="px-4 py-3 text-left font-mono font-medium text-primary-600">操作人</th>
                      <th className="px-4 py-3 text-left font-mono font-medium text-primary-600">版本</th>
                      <th className="px-4 py-3 text-left font-mono font-medium text-primary-600">记录数</th>
                      <th className="px-4 py-3 text-left font-mono font-medium text-primary-600">一致性</th>
                      <th className="px-4 py-3 text-left font-mono font-medium text-primary-600">筛选指纹</th>
                      <th className="px-4 py-3 text-left font-mono font-medium text-primary-600">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exportHistory.map(exp => (
                      <React.Fragment key={exp.id}>
                        <tr
                          className={`border-b border-primary-100 hover:bg-primary-50/50 cursor-pointer ${
                            selectedExport === exp.id ? 'bg-primary-50' : ''
                          }`}
                          onClick={() => setSelectedExport(selectedExport === exp.id ? null : exp.id)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {formatIcon(exp.format)}
                              <span className="font-mono text-primary-700">{exp.fileName}</span>
                            </div>
                            {exp.remark && (
                              <p className="text-xs text-primary-400 mt-1 ml-6 font-mono">{exp.remark}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono uppercase text-primary-600">{exp.format}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-primary-500">
                            {new Date(exp.exportedAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-mono text-primary-700">{exp.operator}</td>
                          <td className="px-4 py-3 font-mono text-info-600">v{exp.versionId}</td>
                          <td className="px-4 py-3 font-mono text-primary-700 text-right">
                            {exp.consistencyCheckDetails?.exportCount || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              status={exp.consistencyCheckPassed ? 'completed' : 'failed'}
                              size="sm"
                            />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-primary-500">
                            {exp.filterFingerprint}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              className="text-info-600 hover:text-info-700 text-xs font-mono"
                              onClick={(e) => e.stopPropagation()}
                            >
                              查看
                            </button>
                          </td>
                        </tr>
                        {selectedExport === exp.id && (
                          <tr className="bg-primary-50 border-b border-primary-200">
                            <td colSpan={9} className="px-6 py-4">
                              <div className="grid md:grid-cols-2 gap-4">
                                <div className="p-3 bg-white border border-primary-200">
                                  <h4 className="font-mono text-sm font-medium text-primary-700 mb-2">筛选条件</h4>
                                  <p className="text-xs font-mono text-primary-600">
                                    {formatFilterSummary(exp.filterConditions)}
                                  </p>
                                </div>
                                <div className="p-3 bg-white border border-primary-200">
                                  <h4 className="font-mono text-sm font-medium text-primary-700 mb-2">一致性校验详情</h4>
                                  <div className="text-xs font-mono space-y-1">
                                    <p>屏幕数据指纹: {exp.screenDataFingerprint}</p>
                                    <p>导出数据指纹: {exp.dataFingerprint}</p>
                                    <p>记录数量匹配: {exp.consistencyCheckDetails?.recordCountMatch ? '是' : '否'}</p>
                                    <p>屏幕数量: {exp.consistencyCheckDetails?.screenCount}</p>
                                    <p>导出数量: {exp.consistencyCheckDetails?.exportCount}</p>
                                    {exp.consistencyCheckDetails?.mismatchedRecords?.length > 0 && (
                                      <div className="mt-2 p-2 bg-danger-50 text-danger-600">
                                        不匹配记录: {exp.consistencyCheckDetails.mismatchedRecords.join(', ')}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
