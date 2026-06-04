import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Pencil, X, Loader2 } from 'lucide-react';
import useReviewStore from '@/stores/reviewStore';
import useImportStore from '@/stores/importStore';
import StepIndicator from '@/components/StepIndicator';
import StatusBadge from '@/components/StatusBadge';
import SensorChangeCard from '@/components/SensorChangeCard';
import { cn } from '@/lib/utils';

const stepLabels: Record<number, string> = {
  1: '铭牌参数确认',
  2: '维修群截图补看',
  3: '安全提醒更新',
};

export default function Review() {
  const [searchParams, setSearchParams] = useSearchParams();
  const importId = searchParams.get('importId');

  const { batchData, loading, fetchBatch, confirmSensorChange, editRecord } =
    useReviewStore();
  const { importHistory, fetchHistory } = useImportStore();

  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [expandedParams, setExpandedParams] = useState<Set<string>>(
    new Set()
  );
  const [role] = useState<'设备工程师' | '安全员'>('设备工程师');

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (importId) {
      fetchBatch(importId);
    }
  }, [importId, fetchBatch]);

  const records = useMemo(
    () => batchData?.records ?? [],
    [batchData]
  );
  const sensorChanges = useMemo(
    () => batchData?.sensorChanges ?? [],
    [batchData]
  );

  const currentStep = useMemo(() => {
    if (!records.length) return 1 as const;
    const minStep = Math.min(
      ...records.map((r) => r.current_step ?? 1)
    );
    return Math.max(1, Math.min(3, minStep)) as 1 | 2 | 3;
  }, [records]);

  const handleConfirmChange = useCallback(
    async (changeId: string) => {
      await confirmSensorChange(changeId, 'confirm', role);
      if (importId) fetchBatch(importId);
    },
    [confirmSensorChange, role, importId, fetchBatch]
  );

  const handleRejectChange = useCallback(
    async (changeId: string) => {
      await confirmSensorChange(changeId, 'reject', role);
      if (importId) fetchBatch(importId);
    },
    [confirmSensorChange, role, importId, fetchBatch]
  );

  const handleEditField = useCallback(
    async (recordId: string, field: string, value: string) => {
      await editRecord(recordId, field, value, role);
      setEditingField(null);
      setEditingValue('');
    },
    [editRecord, role]
  );

  const toggleParamExpand = (recordId: string) => {
    setExpandedParams((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  };

  if (!importId) {
    return (
      <div className="mx-auto max-w-xl pt-16">
        <h2 className="mb-6 text-xl font-semibold text-gray-800">
          选择导入批次
        </h2>
        <select
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
          value=""
          onChange={(e) => setSearchParams({ importId: e.target.value })}
        >
          <option value="" disabled>
            请选择批次...
          </option>
          {importHistory.map((h) => (
            <option key={h.id} value={h.id}>
              {h.batch_label ?? h.id} — {h.created_at ?? ''}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!batchData) return null;

  const editingRecord = records.find((r) => r.id === editingRecordId);

  const totalRecords = records.length;
  const pendingSensorChanges = sensorChanges.filter(
    (c) => c.status === 'pending_review'
  ).length;
  const anomalyCount = records.filter((r) => r.status === 'anomaly').length;

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={currentStep} />

      {sensorChanges.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-base font-semibold text-gray-800">
            <AlertTriangle size={18} className="text-amber-500" />
            <span>传感器编号变更</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {sensorChanges.map((change) => (
              <SensorChangeCard
                key={change.id}
                change={{
                  id: change.id,
                  oldSensorId: change.old_sensor_id,
                  newSensorId: change.new_sensor_id,
                  status: change.status,
                  stuckAtStep: (change.stuck_at_step as 1 | 2 | 3) ?? 2,
                  reviewedBy: change.reviewed_by ?? undefined,
                  reviewedAt: change.reviewed_at ?? undefined,
                  note: change.note ?? undefined,
                }}
                onConfirm={() => handleConfirmChange(change.id)}
                onReject={() => handleRejectChange(change.id)}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-3 text-base font-semibold text-gray-800">
          数据明细表
        </h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">原始行号</th>
                <th className="px-4 py-3">传感器ID</th>
                <th className="px-4 py-3">原传感器ID</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">当前步骤</th>
                <th className="px-4 py-3">铭牌参数</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((record) => {
                const isAmber =
                  record.status === 'sensor_id_changed';
                const isRed = record.status === 'anomaly';
                const params = typeof record.nameplate_params === 'string'
                  ? JSON.parse(record.nameplate_params)
                  : (record.nameplate_params ?? {});
                const paramEntries = Object.entries(params);
                const isExpanded = expandedParams.has(record.id);

                return (
                  <tr
                    key={record.id}
                    className={cn(
                      isAmber && 'bg-amber-50',
                      isRed && 'bg-red-50',
                      !isAmber && !isRed && 'hover:bg-gray-50'
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {record.original_row_number ?? '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {record.sensor_id ?? '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {record.previous_sensor_id ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={record.status} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      {stepLabels[record.current_step] ?? record.current_step ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      {paramEntries.length > 0 && (
                        <div>
                          <div className="flex flex-wrap gap-1">
                            {paramEntries.slice(0, 3).map(([k, v]) => (
                              <span
                                key={k}
                                className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs"
                              >
                                {k}: {String(v)}
                              </span>
                            ))}
                          </div>
                          {paramEntries.length > 3 && (
                            <>
                              {isExpanded && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {paramEntries.slice(3).map(([k, v]) => (
                                    <span
                                      key={k}
                                      className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs"
                                    >
                                      {k}: {String(v)}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <button
                                onClick={() => toggleParamExpand(record.id)}
                                className="mt-1 text-xs text-amber-600 hover:text-amber-700"
                              >
                                {isExpanded
                                  ? '收起'
                                  : `+${paramEntries.length - 3} 项`}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setEditingRecordId(record.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                      >
                        <Pencil size={12} />
                        编辑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editingRecord && (
        <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-800">
              编辑铭牌参数 — {editingRecord.sensor_id}
            </h3>
            <button
              onClick={() => {
                setEditingRecordId(null);
                setEditingField(null);
              }}
              className="rounded-md p-1 text-gray-400 transition hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {Object.entries(
              typeof editingRecord.nameplate_params === 'string'
                ? JSON.parse(editingRecord.nameplate_params)
                : (editingRecord.nameplate_params ?? {})
            ).map(
              ([key, value]) => (
                <div
                  key={key}
                  className="flex items-center gap-3 rounded-md bg-white px-3 py-2"
                >
                  <span className="w-32 shrink-0 text-sm font-medium text-gray-600">
                    {key}
                  </span>
                  {editingField === key ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')
                            handleEditField(
                              editingRecord.id,
                              key,
                              editingValue
                            );
                          if (e.key === 'Escape') {
                            setEditingField(null);
                            setEditingValue('');
                          }
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() =>
                          handleEditField(
                            editingRecord.id,
                            key,
                            editingValue
                          )
                        }
                        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setEditingField(null);
                          setEditingValue('');
                        }}
                        className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center gap-2">
                      <span className="text-sm text-gray-800">
                        {String(value)}
                      </span>
                      <button
                        onClick={() => {
                          setEditingField(key);
                          setEditingValue(String(value));
                        }}
                        className="text-gray-400 transition hover:text-amber-600"
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-base font-semibold text-gray-800">
          交接信息
        </h3>
        <p className="mb-4 text-sm text-gray-500">
          当前批次 {totalRecords} 条记录, {pendingSensorChanges} 条编号变更待复核,{' '}
          {anomalyCount} 条异常
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <div className="text-2xl font-bold text-gray-800">
              {totalRecords}
            </div>
            <div className="text-sm text-gray-500">总记录数</div>
          </div>
          <div className="rounded-lg bg-amber-50 px-4 py-3">
            <div className="text-2xl font-bold text-amber-600">
              {pendingSensorChanges}
            </div>
            <div className="text-sm text-amber-600">编号变更待复核</div>
          </div>
          <div className="rounded-lg bg-red-50 px-4 py-3">
            <div className="text-2xl font-bold text-red-600">
              {anomalyCount}
            </div>
            <div className="text-sm text-red-600">异常记录</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="text-sm font-medium text-gray-600">步骤分布</div>
          <div className="mt-2 flex gap-6">
            {[1, 2, 3].map((step) => {
              const count = records.filter(
                (r) => r.current_step === step
              ).length;
              return (
                <div key={step} className="text-sm text-gray-500">
                  步骤{step} ({stepLabels[step]}):{' '}
                  <span className="font-medium text-gray-700">{count}</span> 条
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
