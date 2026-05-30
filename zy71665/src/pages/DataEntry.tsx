import { useState } from 'react';
import { useFiberStore } from '@/store';
import { validateRecord } from '@/utils/validation';
import type { MeasurementRecord, PowerUnit, LengthUnit, WavelengthUnit, DataSource } from '@/types';
import { Plus, Trash2, AlertTriangle, Zap, FileText, RotateCcw } from 'lucide-react';

function createEmptyRecord(): MeasurementRecord {
  return {
    id: crypto.randomUUID(),
    fiberLength: 0,
    lengthUnit: 'km',
    inputPower: 0,
    outputPower: 0,
    powerUnit: 'dBm',
    wavelength: 1310,
    wavelengthUnit: 'nm',
    connectorCount: 0,
    connectorIds: [],
    dataSource: 'manual',
    notes: '',
    createdAt: new Date().toISOString(),
  };
}

export default function DataEntry() {
  const records = useFiberStore((s) => s.records);
  const anomalies = useFiberStore((s) => s.anomalies);
  const addRecord = useFiberStore((s) => s.addRecord);
  const addRecords = useFiberStore((s) => s.addRecords);
  const updateRecord = useFiberStore((s) => s.updateRecord);
  const deleteRecord = useFiberStore((s) => s.deleteRecord);
  const runCalculation = useFiberStore((s) => s.runCalculation);
  const loadDemoData = useFiberStore((s) => s.loadDemoData);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [connectorInput, setConnectorInput] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});

  const anomalyMap = new Map<string, typeof anomalies>();
  for (const a of anomalies) {
    if (!anomalyMap.has(a.recordId)) anomalyMap.set(a.recordId, []);
    anomalyMap.get(a.recordId)!.push(a);
  }

  const handleAddRow = () => {
    const rec = createEmptyRecord();
    addRecord(rec);
    setEditingId(rec.id);
  };

  const handleFieldChange = (id: string, field: keyof MeasurementRecord, value: string | number) => {
    updateRecord(id, { [field]: value });
    const record = records.find((r) => r.id === id);
    if (record) {
      const updated = { ...record, [field]: value };
      const errors = validateRecord(updated);
      setValidationErrors((prev) => ({ ...prev, [id]: errors }));
    }
  };

  const handleConnectorAdd = (id: string) => {
    const val = connectorInput[id]?.trim();
    if (!val) return;
    const record = records.find((r) => r.id === id);
    if (!record) return;
    updateRecord(id, { connectorIds: [...record.connectorIds, val], connectorCount: record.connectorCount + 1 });
    setConnectorInput((prev) => ({ ...prev, [id]: '' }));
  };

  const handleConnectorRemove = (id: string, cid: string) => {
    const record = records.find((r) => r.id === id);
    if (!record) return;
    updateRecord(id, {
      connectorIds: record.connectorIds.filter((c) => c !== cid),
      connectorCount: record.connectorCount - 1,
    });
  };

  const unitErrorCount = anomalies.filter((a) => a.type === 'unit_error').length;
  const zeroLengthCount = anomalies.filter((a) => a.type === 'zero_length').length;
  const duplicateCount = anomalies.filter((a) => a.type === 'duplicate_connector').length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1B2A4A]">数据录入</h2>
          <p className="text-sm text-gray-500 mt-0.5">录入光纤测量数据，系统自动校验单位和接头编号</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadDemoData}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw size={15} />
            载入示例
          </button>
          <button
            onClick={handleAddRow}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E8A838] text-[#1B2A4A] text-sm font-semibold hover:bg-[#d4962e] transition-colors shadow-sm"
          >
            <Plus size={15} />
            添加记录
          </button>
          <button
            onClick={runCalculation}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1B2A4A] text-white text-sm font-semibold hover:bg-[#2a3d5e] transition-colors shadow-sm"
          >
            <Zap size={15} />
            计算损耗
          </button>
        </div>
      </div>

      {anomalies.length > 0 && (
        <div className="flex gap-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm">
            <AlertTriangle size={14} className="text-amber-600" />
            <span className="text-amber-800">单位错误</span>
            <span className="font-bold text-amber-900" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{unitErrorCount}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm">
            <AlertTriangle size={14} className="text-red-600" />
            <span className="text-red-800">长度为零</span>
            <span className="font-bold text-red-900" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{zeroLengthCount}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 border border-orange-200 text-sm">
            <AlertTriangle size={14} className="text-orange-600" />
            <span className="text-orange-800">接头重复</span>
            <span className="font-bold text-orange-900" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{duplicateCount}</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1B2A4A] text-white text-xs">
                <th className="px-3 py-3 text-left font-medium">来源</th>
                <th className="px-3 py-3 text-left font-medium">光纤长度</th>
                <th className="px-3 py-3 text-left font-medium">输入功率</th>
                <th className="px-3 py-3 text-left font-medium">输出功率</th>
                <th className="px-3 py-3 text-left font-medium">功率单位</th>
                <th className="px-3 py-3 text-left font-medium">波长</th>
                <th className="px-3 py-3 text-left font-medium">接头</th>
                <th className="px-3 py-3 text-left font-medium">备注</th>
                <th className="px-3 py-3 text-left font-medium">校验</th>
                <th className="px-3 py-3 text-center font-medium w-12">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center text-gray-400">
                    <FileText size={40} className="mx-auto mb-3 opacity-30" />
                    <p>暂无数据，点击"添加记录"或"载入示例"开始</p>
                  </td>
                </tr>
              )}
              {records.map((rec) => {
                const recAnomalies = anomalyMap.get(rec.id) || [];
                const recErrors = validationErrors[rec.id] || [];
                const isEditing = editingId === rec.id;
                const hasError = recAnomalies.length > 0 || recErrors.length > 0;

                return (
                  <tr
                    key={rec.id}
                    className={`border-b border-gray-100 transition-colors ${
                      hasError ? 'bg-red-50/50' : isEditing ? 'bg-amber-50/50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <select
                        value={rec.dataSource}
                        onChange={(e) => handleFieldChange(rec.id, 'dataSource', e.target.value)}
                        className={`text-xs px-2 py-1 rounded-md border ${
                          rec.dataSource === 'system' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600'
                        }`}
                      >
                        <option value="system">系统</option>
                        <option value="manual">手动</option>
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={rec.fiberLength}
                          onChange={(e) => handleFieldChange(rec.id, 'fiberLength', parseFloat(e.target.value) || 0)}
                          className={`w-20 px-2 py-1 rounded-md border text-right ${
                            rec.fiberLength === 0 ? 'border-red-400 bg-red-50' : 'border-gray-200'
                          }`}
                          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                          onFocus={() => setEditingId(rec.id)}
                        />
                        <select
                          value={rec.lengthUnit}
                          onChange={(e) => handleFieldChange(rec.id, 'lengthUnit', e.target.value)}
                          className="text-xs px-1 py-1 rounded border border-gray-200"
                        >
                          <option value="km">km</option>
                          <option value="m">m</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        value={rec.inputPower}
                        onChange={(e) => handleFieldChange(rec.id, 'inputPower', parseFloat(e.target.value) || 0)}
                        className={`w-24 px-2 py-1 rounded-md border text-right ${
                          rec.powerUnit === 'mW' ? 'border-amber-400 bg-amber-50' : 'border-gray-200'
                        }`}
                        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                        onFocus={() => setEditingId(rec.id)}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        value={rec.outputPower}
                        onChange={(e) => handleFieldChange(rec.id, 'outputPower', parseFloat(e.target.value) || 0)}
                        className={`w-24 px-2 py-1 rounded-md border text-right ${
                          rec.powerUnit === 'mW' ? 'border-amber-400 bg-amber-50' : 'border-gray-200'
                        }`}
                        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                        onFocus={() => setEditingId(rec.id)}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={rec.powerUnit}
                        onChange={(e) => handleFieldChange(rec.id, 'powerUnit', e.target.value as PowerUnit)}
                        className={`text-xs px-2 py-1 rounded-md border ${
                          rec.powerUnit === 'mW' ? 'bg-amber-50 border-amber-300 text-amber-700 font-semibold' : 'border-gray-200'
                        }`}
                      >
                        <option value="dBm">dBm</option>
                        <option value="mW">mW</option>
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={rec.wavelength}
                          onChange={(e) => handleFieldChange(rec.id, 'wavelength', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 rounded-md border border-gray-200 text-right"
                          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                          onFocus={() => setEditingId(rec.id)}
                        />
                        <select
                          value={rec.wavelengthUnit}
                          onChange={(e) => handleFieldChange(rec.id, 'wavelengthUnit', e.target.value as WavelengthUnit)}
                          className="text-xs px-1 py-1 rounded border border-gray-200"
                        >
                          <option value="nm">nm</option>
                          <option value="μm">μm</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-1">
                          {rec.connectorIds.map((cid) => {
                            const isDuplicate = recAnomalies.some((a) => a.type === 'duplicate_connector');
                            return (
                              <span
                                key={cid}
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs ${
                                  isDuplicate ? 'bg-orange-100 text-orange-700 border border-orange-300' : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {cid}
                                <button
                                  onClick={() => handleConnectorRemove(rec.id, cid)}
                                  className="hover:text-red-500 ml-0.5"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                        <div className="flex gap-1">
                          <input
                            value={connectorInput[rec.id] || ''}
                            onChange={(e) => setConnectorInput((prev) => ({ ...prev, [rec.id]: e.target.value }))}
                            placeholder="接头编号"
                            className="w-16 px-1.5 py-0.5 rounded border border-gray-200 text-xs"
                            onKeyDown={(e) => e.key === 'Enter' && handleConnectorAdd(rec.id)}
                          />
                          <button
                            onClick={() => handleConnectorAdd(rec.id)}
                            className="text-xs px-1.5 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-500"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        value={rec.notes}
                        onChange={(e) => handleFieldChange(rec.id, 'notes', e.target.value)}
                        placeholder="备注"
                        className="w-28 px-2 py-1 rounded-md border border-gray-200 text-xs"
                        onFocus={() => setEditingId(rec.id)}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      {recAnomalies.length > 0 && (
                        <div className="space-y-0.5">
                          {recAnomalies.map((a) => (
                            <div key={a.id} className="flex items-center gap-1" title={a.suggestion}>
                              <AlertTriangle
                                size={12}
                                className={a.severity === 'error' ? 'text-red-500' : 'text-amber-500'}
                              />
                              <span
                                className={`text-xs ${
                                  a.type === 'unit_error' ? 'text-amber-700' : a.type === 'zero_length' ? 'text-red-700' : 'text-orange-700'
                                }`}
                              >
                                {a.type === 'unit_error' ? '单位' : a.type === 'zero_length' ? '零长' : '重复'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {recErrors.map((err, i) => (
                        <div key={i} className="text-xs text-red-600">{err}</div>
                      ))}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => deleteRecord(rec.id)}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {records.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
            <span>共 {records.length} 条记录</span>
            <span>
              来源：系统 {records.filter((r) => r.dataSource === 'system').length} 条 / 手动{' '}
              {records.filter((r) => r.dataSource === 'manual').length} 条
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
