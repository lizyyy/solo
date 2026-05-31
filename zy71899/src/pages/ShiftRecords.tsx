import React, { useEffect, useState } from 'react';
import { FileText, Clock, User, ChevronRight, Plus } from 'lucide-react';
import { useRecordsStore } from '@/stores/recordsStore';
import { useUIStore } from '@/stores/uiStore';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDateTime } from '@/utils/helpers';
import type { ShiftRecord } from '@/types';

export const ShiftRecords: React.FC = () => {
  const { shiftRecords, loadShiftRecords } = useRecordsStore();
  const { navigateToSource } = useUIStore();
  const [selectedRecord, setSelectedRecord] = useState<ShiftRecord | null>(null);

  useEffect(() => {
    loadShiftRecords();
  }, []);

  const handleViewSource = (record: ShiftRecord) => {
    navigateToSource({
      sourceType: 'shift_record',
      sourceId: record.id,
      sourceVersion: 1,
      sourceLine: 1,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-industrial-text">班组记录</h1>
          <p className="text-industrial-text-muted mt-1">
            交接班时的现场工况记录
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          新建记录
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {shiftRecords.length === 0 ? (
            <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-12 text-center">
              <FileText className="w-12 h-12 text-industrial-text-dim mx-auto mb-3" />
              <p className="text-industrial-text-muted">暂无班组记录</p>
            </div>
          ) : (
            shiftRecords.map((record) => (
              <div
                key={record.id}
                className={`bg-industrial-bg-light border rounded-lg p-5 cursor-pointer transition-colors ${
                  selectedRecord?.id === record.id
                    ? 'border-tech-blue'
                    : 'border-industrial-border hover:border-tech-blue/50'
                }`}
                onClick={() => setSelectedRecord(record)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      type="custom"
                      label={record.shift === 'day' ? '白班' : '夜班'}
                      className={record.shift === 'day' ? 'bg-tech-blue/20 text-tech-blue' : 'bg-data-purple/20 text-data-purple'}
                    />
                    {record.hasAbnormal && (
                      <StatusBadge
                        type="threshold"
                        level="warning"
                      />
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewSource(record);
                    }}
                    className="p-1.5 hover:bg-industrial-bg rounded transition-colors text-industrial-text-muted hover:text-tech-blue"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-industrial-text mb-3 line-clamp-2">
                  {record.content}
                </p>

                <div className="flex items-center gap-4 text-sm text-industrial-text-muted">
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {record.operator}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDateTime(record.recordTime)}
                  </div>
                </div>

                {record.pressureReadings && record.pressureReadings.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-industrial-border">
                    <p className="text-xs text-industrial-text-muted mb-2">压力读数</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {record.pressureReadings.slice(0, 5).map((reading, idx) => (
                        <span
                          key={idx}
                          className={`px-2 py-1 text-xs font-mono rounded ${
                            reading.pressure > 10
                              ? 'bg-danger-red/20 text-danger-red'
                              : reading.pressure > 8
                              ? 'bg-alert-orange/20 text-alert-orange'
                              : 'bg-signal-green/20 text-signal-green'
                          }`}
                        >
                          {reading.pressure.toFixed(1)} MPa
                        </span>
                      ))}
                      {record.pressureReadings.length > 5 && (
                        <span className="text-xs text-industrial-text-dim">
                          +{record.pressureReadings.length - 5} 条
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="space-y-4">
          {selectedRecord ? (
            <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-5 sticky top-6">
              <h3 className="text-sm font-medium text-industrial-text mb-4">记录详情</h3>

              <div className="space-y-4">
                <div>
                  <p className="text-xs text-industrial-text-muted mb-1">操作员</p>
                  <p className="text-sm text-industrial-text">{selectedRecord.operator}</p>
                </div>

                <div>
                  <p className="text-xs text-industrial-text-muted mb-1">班次</p>
                  <p className="text-sm text-industrial-text">
                    {selectedRecord.shift === 'day' ? '白班 (08:00 - 20:00)' : '夜班 (20:00 - 08:00)'}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-industrial-text-muted mb-1">记录时间</p>
                  <p className="text-sm text-industrial-text">
                    {formatDateTime(selectedRecord.recordTime)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-industrial-text-muted mb-1">记录内容</p>
                  <p className="text-sm text-industrial-text whitespace-pre-wrap">
                    {selectedRecord.content}
                  </p>
                </div>

                {selectedRecord.hasAbnormal && selectedRecord.abnormalDescription && (
                  <div className="p-3 bg-alert-orange/10 border border-alert-orange/30 rounded-lg">
                    <p className="text-xs text-alert-orange font-medium mb-1">异常情况</p>
                    <p className="text-sm text-industrial-text">
                      {selectedRecord.abnormalDescription}
                    </p>
                  </div>
                )}

                {selectedRecord.pressureReadings && (
                  <div>
                    <p className="text-xs text-industrial-text-muted mb-2">压力读数</p>
                    <div className="bg-industrial-bg rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-industrial-bg-lighter">
                          <tr>
                            <th className="text-left p-2 text-xs text-industrial-text-muted font-medium">时间</th>
                            <th className="text-right p-2 text-xs text-industrial-text-muted font-medium">压力</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRecord.pressureReadings.map((reading, idx) => (
                            <tr key={idx} className="border-t border-industrial-border">
                              <td className="p-2 text-industrial-text-muted font-mono text-xs">
                                {formatDateTime(reading.timestamp)}
                              </td>
                              <td className="p-2 text-right">
                                <span
                                  className={`font-mono ${
                                    reading.pressure > 10
                                      ? 'text-danger-red'
                                      : reading.pressure > 8
                                      ? 'text-alert-orange'
                                      : 'text-signal-green'
                                  }`}
                                >
                                  {reading.pressure.toFixed(1)} MPa
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => handleViewSource(selectedRecord)}
                  className="w-full btn-secondary text-sm"
                >
                  追溯原始记录
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-industrial-bg-light border border-industrial-border rounded-lg p-8 text-center sticky top-6">
              <FileText className="w-10 h-10 text-industrial-text-dim mx-auto mb-3" />
              <p className="text-industrial-text-muted text-sm">
                选择左侧记录查看详情
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
