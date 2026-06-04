import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  PlusCircle,
  RefreshCw,
  ArrowRightCircle,
  Edit3,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import useAuditStore from '@/stores/auditStore';
import useImportStore from '@/stores/importStore';
import type { LucideIcon } from 'lucide-react';

const ACTION_CONFIG: Record<string, { Icon: LucideIcon; color: string }> = {
  record_created: { Icon: PlusCircle, color: 'text-blue-500' },
  sensor_id_changed: { Icon: RefreshCw, color: 'text-amber-500' },
  status_updated: { Icon: ArrowRightCircle, color: 'text-gray-500' },
  manual_edit: { Icon: Edit3, color: 'text-purple-500' },
  sensor_change_confirmed: { Icon: CheckCircle, color: 'text-emerald-500' },
  sensor_change_rejected: { Icon: XCircle, color: 'text-red-500' },
};

const TIMELINE_DOT_COLORS: Record<string, string> = {
  sensor_id_changed: 'bg-amber-400',
  sensor_change_confirmed: 'bg-emerald-400',
  sensor_change_rejected: 'bg-red-400',
};

export default function Audit() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryImportId = searchParams.get('importId') || '';
  const [selectedImportId, setSelectedImportId] = useState(queryImportId);
  const [selectedRecordId, setSelectedRecordId] = useState('');

  const { entries, loading, fetchBatchAudit } = useAuditStore();
  const { importHistory, fetchHistory } = useImportStore();

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (queryImportId && queryImportId !== selectedImportId) {
      setSelectedImportId(queryImportId);
    }
  }, [queryImportId, selectedImportId]);

  const loadAudit = useCallback(async () => {
    if (!selectedImportId) return;
    try {
      await fetchBatchAudit(selectedImportId);
    } catch {
      /* ignore audit load errors */
    }
  }, [selectedImportId, fetchBatchAudit]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const handleImportChange = useCallback((id: string) => {
    setSelectedImportId(id);
    setSelectedRecordId('');
    setSearchParams(id ? { importId: id } : {}, { replace: true });
  }, [setSearchParams]);

  const recordIds = useMemo(() => {
    const ids = new Set<string>();
    entries.forEach((e) => {
      if (e.record_id) ids.add(e.record_id);
    });
    return Array.from(ids);
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (!selectedRecordId) return entries;
    return entries.filter((e) => e.record_id === selectedRecordId);
  }, [entries, selectedRecordId]);

  const summaryRows = useMemo(() => {
    const map = new Map<string, {
      record_id: string;
      original_row_number: string | number;
      sensor_id: string;
      previous_sensor_id: string;
      status: string;
      manual_edit_count: number;
    }>();
    entries.forEach((e) => {
      const rid = e.record_id;
      if (!rid) return;
      if (!map.has(rid)) {
        map.set(rid, {
          record_id: rid,
          original_row_number: e.original_row_number ?? '-',
          sensor_id: e.sensor_id ?? '-',
          previous_sensor_id: e.previous_sensor_id ?? '-',
          status: e.record_status ?? '-',
          manual_edit_count: 0,
        });
      }
      if (e.action === 'manual_edit') {
        map.get(rid)!.manual_edit_count++;
      }
      if (e.sensor_id) map.get(rid)!.sensor_id = e.sensor_id;
      if (e.previous_sensor_id) map.get(rid)!.previous_sensor_id = e.previous_sensor_id;
      if (e.record_status) map.get(rid)!.status = e.record_status;
      if (e.original_row_number) map.get(rid)!.original_row_number = e.original_row_number;
    });
    return Array.from(map.values());
  }, [entries]);

  const formatTime = (ts: string) => {
    if (!ts) return '';
    return new Date(ts).toLocaleString('zh-CN');
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">审计追踪</h1>

      <div className="flex items-center gap-4 flex-wrap">
        <select
          value={selectedImportId}
          onChange={(e) => handleImportChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[240px]"
        >
          <option value="">选择导入批次</option>
          {importHistory.map((imp) => (
            <option key={imp.id} value={imp.id}>
              {imp.batch_label || imp.id}
            </option>
          ))}
        </select>

        {recordIds.length > 0 && (
          <select
            value={selectedRecordId}
            onChange={(e) => setSelectedRecordId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
          >
            <option value="">全部记录</option>
            {recordIds.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-500">加载中...</span>
        </div>
      )}

      {!loading && filteredEntries.length > 0 && (
        <div className="relative pl-8">
          <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />

          <div className="space-y-4">
            {filteredEntries.map((entry, idx) => {
              const config = ACTION_CONFIG[entry.action] || { Icon: ArrowRightCircle, color: 'text-gray-400' };
              const dotColor = TIMELINE_DOT_COLORS[entry.action] || 'bg-gray-300';
              const { Icon } = config;

              return (
                <div key={idx} className="relative">
                  <div className={`absolute -left-5 top-1.5 w-3 h-3 rounded-full border-2 border-white ${dotColor}`} />

                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${config.color}`} />
                      <span className="text-sm font-medium text-gray-900">{entry.action}</span>
                      {entry.field && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{entry.field}</span>
                      )}
                    </div>

                    <div className="text-xs text-gray-400 mb-2">
                      {formatTime(entry.timestamp)} · {entry.operator || '系统'}
                    </div>

                    {entry.old_value != null && entry.new_value != null && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500 line-through bg-red-50 px-2 py-0.5 rounded">
                          {String(entry.old_value)}
                        </span>
                        <ArrowRightCircle className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-gray-900 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                          {String(entry.new_value)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && filteredEntries.length === 0 && selectedImportId && (
        <div className="text-center py-12 text-gray-400">暂无审计记录</div>
      )}

      {!selectedImportId && (
        <div className="text-center py-12 text-gray-400">请先选择导入批次</div>
      )}

      {summaryRows.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">原始行号对照表</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">原始行号</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">传感器编号</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">变更前编号</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">状态</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">手动编辑次数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summaryRows.map((row) => (
                  <tr key={row.record_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-700">{row.original_row_number}</td>
                    <td className="px-4 py-2.5 text-gray-700 font-mono text-xs">{row.sensor_id}</td>
                    <td className="px-4 py-2.5 text-gray-700 font-mono text-xs">{row.previous_sensor_id}</td>
                    <td className="px-4 py-2.5 text-gray-700">{row.status}</td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {row.manual_edit_count > 0 ? (
                        <span className="text-amber-600 font-medium">{row.manual_edit_count}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
