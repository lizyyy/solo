import React, { useState, useEffect } from 'react';
import { useStore } from '@/store';
import type { ParamValues } from '@/types';
import {
  Play,
  Settings,
  Loader2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Legend,
  ReferenceLine,
} from 'recharts';

export default function WorkspacePage() {
  const {
    currentBatchId,
    currentParamVersionId,
    paramVersions,
    estimationRuns,
    currentRunId,
    estimationResults,
    anomalyRecords,
    sensorRecords,
    loading,
    setCurrentParamVersion,
    updateParamVersion,
    runEstimation,
  } = useStore();

  const [showParamEdit, setShowParamEdit] = useState(false);
  const [editValues, setEditValues] = useState<ParamValues | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [changedBy, setChangedBy] = useState('');
  const [running, setRunning] = useState(false);

  const currentVersion = paramVersions.find((v) => v.id === currentParamVersionId);

  useEffect(() => {
    if (currentVersion && !editValues) {
      setEditValues({ ...currentVersion.values });
    }
  }, [currentVersion]);

  const handleRun = async () => {
    setRunning(true);
    await runEstimation();
    setRunning(false);
  };

  const handleSaveParam = async () => {
    if (!editValues || !currentParamVersionId || !changeNote) return;
    await updateParamVersion(currentParamVersionId, editValues, changeNote, changedBy || '未署名');
    setShowParamEdit(false);
    setChangeNote('');
    setChangedBy('');
  };

  const currentRun = estimationRuns.find((r) => r.id === currentRunId);

  const chartData = estimationResults.map((r) => ({
    time: r.timestamp,
    regenForce: r.regenBrakeForce,
    recoveryRate: r.energyRecoveryRate,
    totalEnergy: r.totalEnergyRecovered,
    anomaly: r.anomalyFlag !== 'none',
    anomalyLevel: r.anomalyFlag,
  }));

  const normalCount = estimationResults.filter((r) => r.anomalyFlag === 'none').length;
  const warnCount = estimationResults.filter((r) => r.anomalyFlag === 'warning').length;
  const severeCount = estimationResults.filter((r) => r.anomalyFlag === 'severe').length;
  const excludedCount = estimationResults.filter((r) => r.anomalyFlag === 'excluded').length;

  const anomalyPoints = estimationResults
    .filter((r) => r.anomalyFlag !== 'none')
    .map((r) => ({
      time: r.timestamp,
      force: r.regenBrakeForce,
      level: r.anomalyFlag,
    }));

  const maxForce = currentVersion?.values.maxBrakeForce ?? 15000;

  if (!currentBatchId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted">
        <Settings size={48} className="mb-4 opacity-30" />
        <p className="text-lg">请先导入数据</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-brand-500">估算工作台</h2>
          <p className="text-sm text-muted mt-1">配置参数、执行估算、查看图表</p>
        </div>
        <div className="flex items-center gap-3">
          {currentVersion && (
            <span className="flex items-center gap-1.5 text-sm bg-brand-500 text-white px-3 py-1.5 rounded-lg font-mono">
              参数 v{currentVersion.versionNumber}
            </span>
          )}
          <select
            value={currentParamVersionId || ''}
            onChange={(e) => setCurrentParamVersion(e.target.value)}
            className="text-sm border border-[var(--color-border)] rounded-lg px-3 py-1.5 bg-white"
          >
            {paramVersions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.versionNumber} — {v.changeNote.substring(0, 30)}...
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (currentVersion) setEditValues({ ...currentVersion.values });
              setShowParamEdit(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg hover:bg-gray-50"
          >
            <Settings size={14} />
            修改参数
          </button>
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1.5 px-4 py-2 bg-ok text-white rounded-lg hover:bg-ok/90 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? '计算中...' : '执行估算'}
          </button>
        </div>
      </div>

      {showParamEdit && editValues && (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5 mb-6">
          <h3 className="font-medium mb-4">修改参数（将创建新版本 v{(currentVersion?.versionNumber ?? 0) + 1}）</h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {Object.entries(editValues)
              .filter(([k]) => k !== 'motorTorqueCoefficients')
              .map(([key, val]) => (
                <div key={key} className="flex flex-col">
                  <label className="text-xs text-muted mb-1">{key}</label>
                  <input
                    type="number"
                    value={val as number}
                    onChange={(e) => setEditValues({ ...editValues, [key]: parseFloat(e.target.value) || 0 })}
                    className="border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
              ))}
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="修改人"
              value={changedBy}
              onChange={(e) => setChangedBy(e.target.value)}
              className="border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm w-32"
            />
            <input
              type="text"
              placeholder="修改原因（必填）"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              className="border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm flex-1"
            />
            <button
              onClick={handleSaveParam}
              disabled={!changeNote}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              保存新版本
            </button>
            <button
              onClick={() => setShowParamEdit(false)}
              className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {currentRun && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={16} className="text-ok" />
                <span className="text-xs text-muted">正常</span>
              </div>
              <span className="text-2xl font-semibold font-mono">{normalCount}</span>
            </div>
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={16} className="text-warn" />
                <span className="text-xs text-muted">警告</span>
              </div>
              <span className="text-2xl font-semibold font-mono text-warn">{warnCount}</span>
            </div>
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle size={16} className="text-danger" />
                <span className="text-xs text-muted">严重/排除</span>
              </div>
              <span className="text-2xl font-semibold font-mono text-danger">{severeCount + excludedCount}</span>
            </div>
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Info size={16} className="text-blue-500" />
                <span className="text-xs text-muted">参数版本</span>
              </div>
              <span className="text-2xl font-semibold font-mono">v{currentVersion?.versionNumber}</span>
            </div>
          </div>

          {estimationResults.length > 0 && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
                <h3 className="text-sm font-medium mb-4">再生制动力 — 速度曲线</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="time" label={{ value: '时间(s)', position: 'insideBottom', offset: -5 }} fontSize={12} />
                    <YAxis label={{ value: '制动力(N)', angle: -90, position: 'insideLeft' }} fontSize={12} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, fontFamily: 'JetBrains Mono' }}
                      formatter={(value: number, name: string) => [
                        name === 'regenForce' ? `${value.toFixed(1)} N` : value,
                        name === 'regenForce' ? '再生制动力' : name,
                      ]}
                    />
                    <ReferenceLine y={maxForce} stroke="#c0392b" strokeDasharray="5 5" label={{ value: `上限 ${maxForce}N`, fill: '#c0392b', fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="regenForce"
                      stroke="#1a2332"
                      strokeWidth={2}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (payload.anomaly) {
                          return <circle key={payload.time} cx={cx} cy={cy} r={4} fill={payload.anomalyLevel === 'severe' ? '#c0392b' : '#e67e22'} stroke="none" />;
                        }
                        return <circle key={payload.time} cx={cx} cy={cy} r={2} fill="#1a2332" />;
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
                <h3 className="text-sm font-medium mb-4">能量回收率 — 时间序列</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="time" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip contentStyle={{ fontSize: 12, fontFamily: 'JetBrains Mono' }} />
                    <Line type="monotone" dataKey="recoveryRate" stroke="#27ae60" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
                <h3 className="text-sm font-medium mb-4">异常点分布</h3>
                {anomalyPoints.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="time" name="时间(s)" fontSize={12} />
                      <YAxis dataKey="force" name="制动力(N)" fontSize={12} />
                      <Tooltip contentStyle={{ fontSize: 12, fontFamily: 'JetBrains Mono' }} />
                      <ReferenceLine y={maxForce} stroke="#c0392b" strokeDasharray="5 5" />
                      <Scatter
                        name="异常点"
                        data={anomalyPoints}
                        fill="#c0392b"
                        shape={(props: any) => {
                          const { cx, cy, payload } = props;
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={6}
                              fill={payload.level === 'severe' ? '#c0392b' : '#e67e22'}
                              stroke="#fff"
                              strokeWidth={1}
                            />
                          );
                        }}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted text-center py-8">无异常点</p>
                )}
              </div>

              {anomalyRecords.length > 0 && (
                <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
                  <h3 className="text-sm font-medium mb-4">异常记录明细</h3>
                  <div className="space-y-3">
                    {anomalyRecords.map((a) => (
                      <div
                        key={a.id}
                        className={`p-3 rounded-lg border ${
                          a.level === 'severe' ? 'border-danger/30 bg-danger/5' : a.level === 'warning' ? 'border-warn/30 bg-warn/5' : 'border-[var(--color-border)] bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {a.level === 'severe' ? <XCircle size={14} className="text-danger" /> : <AlertTriangle size={14} className="text-warn" />}
                          <span className="text-xs font-medium">
                            {a.level === 'severe' ? '严重' : a.level === 'warning' ? '警告' : '排除'}
                          </span>
                          <span className="text-xs text-muted">· {a.type}</span>
                        </div>
                        <p className="text-sm">{a.description}</p>
                        <p className="text-xs text-muted mt-1 font-mono">{a.evidence}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {estimationResults.length === 0 && currentRun.status === 'completed' && (
            <div className="text-center text-muted py-12">估算完成但无有效结果</div>
          )}
        </>
      )}

      {!currentRun && !running && (
        <div className="flex flex-col items-center justify-center py-20 text-muted">
          <Play size={48} className="mb-4 opacity-30" />
          <p className="text-lg mb-2">选择参数版本后执行估算</p>
          <p className="text-sm">点击"执行估算"开始计算再生制动力和能量回收率</p>
        </div>
      )}
    </div>
  );
}
