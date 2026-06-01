import React, { useEffect, useState } from 'react';
import { useStore } from '@/store';
import {
  Upload,
  FileText,
  Settings,
  Edit3,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

export default function ImportPage() {
  const {
    sensorBatches,
    currentBatchId,
    sensorRecords,
    fieldNotes,
    manualCorrections,
    paramVersions,
    dirtyDataRecords,
    loading,
    loadSampleData,
    loadAllData,
  } = useStore();

  const [sampleLoaded, setSampleLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'sensor' | 'params' | 'notes' | 'corrections'>('sensor');

  useEffect(() => {
    loadAllData();
  }, []);

  const handleLoadSample = async () => {
    await loadSampleData();
    setSampleLoaded(true);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'normal': return <CheckCircle size={14} className="text-ok" />;
      case 'empty_field': return <AlertCircle size={14} className="text-warn" />;
      case 'duplicate': return <XCircle size={14} className="text-danger" />;
      case 'boundary': return <AlertCircle size={14} className="text-warn" />;
      case 'anomaly': return <XCircle size={14} className="text-danger" />;
      case 'corrected': return <Edit3 size={14} className="text-blue-500" />;
      default: return null;
    }
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      normal: '正常',
      empty_field: '空值',
      duplicate: '重复',
      boundary: '边界',
      anomaly: '异常',
      corrected: '已修正',
    };
    return map[status] || status;
  };

  const dirtyCount = dirtyDataRecords.filter((d) => !d.resolution).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-muted" size={32} />
        <span className="ml-3 text-muted">加载数据中...</span>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-brand-500">数据导入</h2>
          <p className="text-sm text-muted mt-1">导入传感器记录、设备参数、现场备注和人工修正</p>
        </div>
        {!sampleLoaded && sensorBatches.length === 0 && (
          <button
            onClick={handleLoadSample}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors text-sm font-medium"
          >
            <Upload size={16} />
            加载样例数据
          </button>
        )}
      </div>

      {sensorBatches.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 mb-6">
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-brand-500" />
              <div>
                <span className="font-medium text-sm">当前批次：</span>
                <span className="text-sm text-brand-500">{sensorBatches.find((b) => b.id === currentBatchId)?.name}</span>
              </div>
              <span className="text-xs text-muted ml-4">
                {sensorRecords.length} 条记录 · {fieldNotes.length} 条备注 · {manualCorrections.length} 条修正
              </span>
              {dirtyCount > 0 && (
                <span className="ml-4 text-xs bg-warn/10 text-warn px-2 py-0.5 rounded-full font-medium">
                  {dirtyCount} 条脏数据待处理
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            {[
              { key: 'sensor', label: '传感器记录', icon: Database },
              { key: 'params', label: '设备参数', icon: Settings },
              { key: 'notes', label: '现场备注', icon: FileText },
              { key: 'corrections', label: '人工修正', icon: Edit3 },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as typeof activeTab)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                  activeTab === key
                    ? 'bg-brand-500 text-white font-medium'
                    : 'bg-white text-muted hover:bg-gray-50 border border-[var(--color-border)]'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'sensor' && (
            <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-3 font-medium text-muted">状态</th>
                      <th className="px-4 py-3 font-medium text-muted">时间(s)</th>
                      <th className="px-4 py-3 font-medium text-muted font-mono">车速(km/h)</th>
                      <th className="px-4 py-3 font-medium text-muted font-mono">制动压力(MPa)</th>
                      <th className="px-4 py-3 font-medium text-muted font-mono">电机转速(rpm)</th>
                      <th className="px-4 py-3 font-medium text-muted font-mono">电池电压(V)</th>
                      <th className="px-4 py-3 font-medium text-muted font-mono">电池电流(A)</th>
                      <th className="px-4 py-3 font-medium text-muted font-mono">温度(°C)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensorRecords.map((r) => (
                      <tr
                        key={r.id}
                        className={`border-t border-[var(--color-border)] ${
                          r.status !== 'normal' && r.status !== 'corrected'
                            ? r.status === 'anomaly'
                              ? 'bg-danger/5'
                              : 'bg-warn/5'
                            : r.status === 'corrected'
                            ? 'bg-blue-50/50'
                            : ''
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-1.5">
                            {statusIcon(r.status)}
                            <span className="text-xs">{statusLabel(r.status)}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono">{r.timestamp}</td>
                        <td className="px-4 py-2.5 font-mono">{r.vehicleSpeed ?? <span className="text-warn">空</span>}</td>
                        <td className="px-4 py-2.5 font-mono">{r.brakePressure ?? <span className="text-warn">空</span>}</td>
                        <td className="px-4 py-2.5 font-mono">{r.motorRpm ?? <span className="text-warn">空</span>}</td>
                        <td className="px-4 py-2.5 font-mono">{r.batteryVoltage ?? <span className="text-warn">空</span>}</td>
                        <td className="px-4 py-2.5 font-mono">{r.batteryCurrent ?? <span className="text-warn">空</span>}</td>
                        <td className="px-4 py-2.5 font-mono">{r.temperature ?? <span className="text-warn">空</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'params' && (
            <div className="space-y-4">
              {paramVersions.map((pv) => (
                <div key={pv.id} className="bg-white rounded-xl border border-[var(--color-border)] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="bg-brand-500 text-white text-xs px-2.5 py-1 rounded-full font-mono font-medium">
                        v{pv.versionNumber}
                      </span>
                      <span className="text-sm font-medium">参数版本 {pv.versionNumber}</span>
                    </div>
                    <div className="text-xs text-muted">
                      {pv.changedBy} · {new Date(pv.changedAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <p className="text-xs text-muted mb-3 bg-gray-50 px-3 py-2 rounded-lg">{pv.changeNote}</p>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    {Object.entries(pv.values)
                      .filter(([k]) => k !== 'motorTorqueCoefficients')
                      .map(([key, val]) => (
                        <div key={key} className="flex justify-between bg-gray-50 px-3 py-2 rounded">
                          <span className="text-muted">{key}</span>
                          <span className="font-mono font-medium">{String(val)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-3">
              {fieldNotes.map((note) => (
                <div key={note.id} className="bg-white rounded-xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                      {note.eventType}
                    </span>
                    <span className="text-xs text-muted font-mono">
                      {note.startTime}s — {note.endTime}s
                    </span>
                  </div>
                  <p className="text-sm">{note.content}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'corrections' && (
            <div className="space-y-3">
              {manualCorrections.map((corr) => (
                <div key={corr.id} className="bg-white rounded-xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Edit3 size={14} className="text-blue-500" />
                    <span className="text-sm font-medium">修正字段：{corr.field}</span>
                    <span className="text-xs text-muted ml-auto">
                      {corr.correctedBy} · {new Date(corr.correctedAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm mb-2">
                    <span className="text-muted">原值：</span>
                    <span className="font-mono line-through text-danger">{String(corr.oldValue)}</span>
                    <span className="text-muted">→</span>
                    <span className="text-muted">修正值：</span>
                    <span className="font-mono text-ok font-medium">{String(corr.newValue)}</span>
                  </div>
                  <p className="text-xs text-muted bg-gray-50 px-3 py-2 rounded">{corr.reason}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {sensorBatches.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-muted">
          <Upload size={48} className="mb-4 opacity-30" />
          <p className="text-lg mb-2">暂无数据</p>
          <p className="text-sm mb-6">点击上方按钮加载样例数据，或通过 CSV/JSON 导入传感器记录</p>
        </div>
      )}
    </div>
  );
}

function Database(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
}
