import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, Info } from 'lucide-react';
import type { BattleRecord, Anomaly } from '@/types';
import { StatusBadge } from './StatusBadge';
import { getAnomalyTypeLabel, getSeverityLabel } from '@/utils/anomalyDetector';

interface DataTableProps {
  records: BattleRecord[];
  anomalies: Anomaly[];
}

type SortField = 'battleId' | 'playerId' | 'playerName' | 'score' | 'settlement' | 'battleTime';
type SortDirection = 'asc' | 'desc';

export const DataTable: React.FC<DataTableProps> = ({ records, anomalies }) => {
  const [sortField, setSortField] = useState<SortField>('battleTime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedRecords = [...records].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    if (sortDirection === 'asc') {
      return String(aVal).localeCompare(String(bVal));
    }
    return String(bVal).localeCompare(String(aVal));
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronDown className="w-3 h-3 text-primary-300" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-3 h-3 text-info-500" />
      : <ChevronDown className="w-3 h-3 text-info-500" />;
  };

  const getRecordAnomalies = (recordId: string) => {
    return anomalies.filter(a => a.recordId === recordId && a.status === 'open');
  };

  const toggleRow = (recordId: string) => {
    setExpandedRow(expandedRow === recordId ? null : recordId);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-primary-100 border-b border-primary-200">
            <th className="w-10 px-3 py-2 text-left"></th>
            <th 
              className="px-3 py-2 text-left font-mono font-medium text-primary-600 cursor-pointer hover:bg-primary-200/50 select-none"
              onClick={() => handleSort('battleId')}
            >
              <div className="flex items-center gap-1">
                战报ID <SortIcon field="battleId" />
              </div>
            </th>
            <th 
              className="px-3 py-2 text-left font-mono font-medium text-primary-600 cursor-pointer hover:bg-primary-200/50 select-none"
              onClick={() => handleSort('playerId')}
            >
              <div className="flex items-center gap-1">
                玩家ID <SortIcon field="playerId" />
              </div>
            </th>
            <th 
              className="px-3 py-2 text-left font-mono font-medium text-primary-600 cursor-pointer hover:bg-primary-200/50 select-none"
              onClick={() => handleSort('playerName')}
            >
              <div className="flex items-center gap-1">
                玩家名称 <SortIcon field="playerName" />
              </div>
            </th>
            <th 
              className="px-3 py-2 text-right font-mono font-medium text-primary-600 cursor-pointer hover:bg-primary-200/50 select-none"
              onClick={() => handleSort('score')}
            >
              <div className="flex items-center justify-end gap-1">
                分数 <SortIcon field="score" />
              </div>
            </th>
            <th 
              className="px-3 py-2 text-right font-mono font-medium text-primary-600 cursor-pointer hover:bg-primary-200/50 select-none"
              onClick={() => handleSort('settlement')}
            >
              <div className="flex items-center justify-end gap-1">
                结算 <SortIcon field="settlement" />
              </div>
            </th>
            <th className="px-3 py-2 text-center font-mono font-medium text-primary-600">状态</th>
            <th 
              className="px-3 py-2 text-left font-mono font-medium text-primary-600 cursor-pointer hover:bg-primary-200/50 select-none"
              onClick={() => handleSort('battleTime')}
            >
              <div className="flex items-center gap-1">
                战斗时间 <SortIcon field="battleTime" />
              </div>
            </th>
            <th className="px-3 py-2 text-left font-mono font-medium text-primary-600">数据指纹</th>
          </tr>
        </thead>
        <tbody>
          {sortedRecords.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-3 py-8 text-center text-primary-400">
                暂无数据
              </td>
            </tr>
          ) : (
            sortedRecords.map((record, idx) => {
              const recordAnomalies = getRecordAnomalies(record.id);
              const isExpanded = expandedRow === record.id;
              
              return (
                <React.Fragment key={record.id}>
                  <tr 
                    className={`
                      border-b border-primary-100 hover:bg-primary-50/50 cursor-pointer
                      ${idx % 2 === 0 ? 'bg-white' : 'bg-primary-50/30'}
                      ${record.status === 'anomaly' ? 'border-l-2 border-l-danger-500' : ''}
                      ${record.status === 'warning' ? 'border-l-2 border-l-warning-500' : ''}
                      ${isExpanded ? 'bg-primary-50' : ''}
                    `}
                    onClick={() => toggleRow(record.id)}
                  >
                    <td className="px-3 py-2">
                      {recordAnomalies.length > 0 ? (
                        <AlertCircle className="w-4 h-4 text-danger-500" />
                      ) : isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-primary-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-primary-300" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-primary-700">{record.battleId}</td>
                    <td className="px-3 py-2 font-mono text-primary-600">{record.playerId}</td>
                    <td className="px-3 py-2 text-primary-800">{record.playerName}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-primary-700">{record.score.toLocaleString()}</td>
                    <td className={`px-3 py-2 text-right font-mono font-medium ${
                      Math.abs(record.score - record.settlement * 2) > record.score * 0.1 
                        ? 'text-danger-600' 
                        : 'text-success-600'
                    }`}>
                      {record.settlement.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge status={record.status} size="sm" />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-primary-500">
                      {new Date(record.battleTime).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-primary-400">
                      {record.dataFingerprint.substring(0, 8)}...
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-primary-50 border-b border-primary-200">
                      <td colSpan={9} className="px-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-mono text-sm font-medium text-primary-700 mb-2 flex items-center gap-2">
                              <Info className="w-4 h-4 text-info-500" />
                              记录详情
                            </h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="font-mono text-primary-500">完整ID:</div>
                              <div className="font-mono text-primary-700">{record.id}</div>
                              <div className="font-mono text-primary-500">完整指纹:</div>
                              <div className="font-mono text-primary-700">{record.dataFingerprint}</div>
                              <div className="font-mono text-primary-500">创建时间:</div>
                              <div className="font-mono text-primary-700">{new Date(record.createdAt).toLocaleString()}</div>
                              <div className="font-mono text-primary-500">更新时间:</div>
                              <div className="font-mono text-primary-700">{new Date(record.updatedAt).toLocaleString()}</div>
                              <div className="font-mono text-primary-500">战报/结算比例:</div>
                              <div className={`font-mono font-medium ${
                                Math.abs(record.score - record.settlement * 2) > record.score * 0.1 
                                  ? 'text-danger-600' 
                                  : 'text-success-600'
                              }`}>
                                {((record.settlement / record.score) * 100).toFixed(2)}% 
                                ({record.settlement} / {record.score})
                              </div>
                            </div>
                          </div>
                          
                          {recordAnomalies.length > 0 && (
                            <div>
                              <h4 className="font-mono text-sm font-medium text-danger-600 mb-2 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                检测到 {recordAnomalies.length} 个异常
                              </h4>
                              <div className="space-y-2">
                                {recordAnomalies.map(anomaly => (
                                  <div key={anomaly.id} className="p-3 bg-danger-50 border border-danger-200">
                                    <div className="flex items-center gap-2 mb-1">
                                      <StatusBadge status={anomaly.severity} size="sm" />
                                      <span className="font-mono text-sm font-medium text-primary-700">
                                        {getAnomalyTypeLabel(anomaly.type)}
                                      </span>
                                      <span className="text-xs text-primary-500 font-mono">
                                        {getSeverityLabel(anomaly.severity)}
                                      </span>
                                    </div>
                                    <p className="text-sm text-primary-600 mb-1">{anomaly.description}</p>
                                    {anomaly.fieldName && (
                                      <p className="text-xs font-mono text-primary-500">
                                        字段: {anomaly.fieldName} | 
                                        预期: {anomaly.expectedValue} | 
                                        实际: {anomaly.actualValue}
                                      </p>
                                    )}
                                    <details className="mt-2">
                                      <summary className="text-xs text-info-600 cursor-pointer hover:text-info-700">
                                        查看异常解释和处理建议
                                      </summary>
                                      <div className="mt-2 p-2 bg-white border border-primary-200 text-xs">
                                        <p className="text-primary-600 mb-1">
                                          <span className="font-medium">原因解释:</span> {anomaly.explanation}
                                        </p>
                                        <p className="text-primary-600">
                                          <span className="font-medium">处理建议:</span> {anomaly.suggestion}
                                        </p>
                                      </div>
                                    </details>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
