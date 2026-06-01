import React, { useState, useEffect } from 'react';
import { useStore } from '@/store';
import { db } from '@/db';
import type { EstimationResult } from '@/types';
import { GitCompare, ArrowRight } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export default function ComparePage() {
  const {
    estimationRuns,
    paramVersions,
    currentRunId,
  } = useStore();

  const [leftRunId, setLeftRunId] = useState<string>(estimationRuns.length >= 2 ? estimationRuns[estimationRuns.length - 2].id : '');
  const [rightRunId, setRightRunId] = useState<string>(currentRunId || '');
  const [leftResults, setLeftResults] = useState<EstimationResult[]>([]);
  const [rightResults, setRightResults] = useState<EstimationResult[]>([]);

  useEffect(() => {
    if (leftRunId) {
      db.estimationResults.where('runId').equals(leftRunId).toArray().then(setLeftResults);
    } else {
      setLeftResults([]);
    }
  }, [leftRunId]);

  useEffect(() => {
    if (rightRunId) {
      db.estimationResults.where('runId').equals(rightRunId).toArray().then(setRightResults);
    } else {
      setRightResults([]);
    }
  }, [rightRunId]);

  const leftRun = estimationRuns.find((r) => r.id === leftRunId);
  const rightRun = estimationRuns.find((r) => r.id === rightRunId);

  const leftParamVersion = leftRun
    ? paramVersions.find((v) => v.id === leftRun.paramVersionId)
    : null;
  const rightParamVersion = rightRun
    ? paramVersions.find((v) => v.id === rightRun.paramVersionId)
    : null;

  const allTimestamps = Array.from(
    new Set([...leftResults.map((r) => r.timestamp), ...rightResults.map((r) => r.timestamp)])
  ).sort((a, b) => a - b);

  const compareData = allTimestamps.map((t) => {
    const left = leftResults.find((r) => r.timestamp === t);
    const right = rightResults.find((r) => r.timestamp === t);
    return {
      time: t,
      leftForce: left?.regenBrakeForce ?? null,
      rightForce: right?.regenBrakeForce ?? null,
      leftRecovery: left?.energyRecoveryRate ?? null,
      rightRecovery: right?.energyRecoveryRate ?? null,
      diff: left && right ? left.regenBrakeForce - right.regenBrakeForce : null,
    };
  });

  const paramDiff = () => {
    if (!leftParamVersion || !rightParamVersion) return [];
    const diffs: { key: string; left: string; right: string; changed: boolean }[] = [];
    const leftEntries = Object.entries(leftParamVersion.values).filter(([k]) => k !== 'motorTorqueCoefficients');
    for (const [key, leftVal] of leftEntries) {
      const rightVal = rightParamVersion.values[key as keyof typeof rightParamVersion.values];
      const changed = leftVal !== rightVal;
      diffs.push({
        key,
        left: String(leftVal),
        right: String(rightVal),
        changed,
      });
    }
    return diffs;
  };

  if (estimationRuns.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted">
        <GitCompare size={48} className="mb-4 opacity-30" />
        <p className="text-lg">至少需要两次估算运行才能对比</p>
        <p className="text-sm">请先执行估算，然后修改参数重新运行</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-brand-500">历史对比</h2>
        <p className="text-sm text-muted mt-1">并排比较不同参数版本的估算结果，差异一目了然</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
          <label className="text-xs text-muted mb-2 block">对比基准（旧）</label>
          <select
            value={leftRunId}
            onChange={(e) => setLeftRunId(e.target.value)}
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm"
          >
            {estimationRuns.map((r) => (
              <option key={r.id} value={r.id}>
                {new Date(r.runTime).toLocaleString('zh-CN')} · 参数v{paramVersions.find((v) => v.id === r.paramVersionId)?.versionNumber}
              </option>
            ))}
          </select>
          {leftParamVersion && (
            <div className="mt-2 text-xs text-muted">
              参数版本 v{leftParamVersion.versionNumber}: {leftParamVersion.changeNote}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
          <label className="text-xs text-muted mb-2 block">对比目标（新）</label>
          <select
            value={rightRunId}
            onChange={(e) => setRightRunId(e.target.value)}
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm"
          >
            {estimationRuns.map((r) => (
              <option key={r.id} value={r.id}>
                {new Date(r.runTime).toLocaleString('zh-CN')} · 参数v{paramVersions.find((v) => v.id === r.paramVersionId)?.versionNumber}
              </option>
            ))}
          </select>
          {rightParamVersion && (
            <div className="mt-2 text-xs text-muted">
              参数版本 v{rightParamVersion.versionNumber}: {rightParamVersion.changeNote}
            </div>
          )}
        </div>
      </div>

      {leftParamVersion && rightParamVersion && (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-5 mb-6">
          <h3 className="text-sm font-medium mb-4">参数版本差异</h3>
          <div className="grid grid-cols-[1fr_120px_40px_120fr] gap-y-2 gap-x-4 items-center text-sm">
            <span className="text-muted font-medium">参数名</span>
            <span className="text-blue-600 font-medium text-center">v{leftParamVersion.versionNumber}</span>
            <span></span>
            <span className="text-ok font-medium">v{rightParamVersion.versionNumber}</span>
            {paramDiff().map((d) => (
              <React.Fragment key={d.key}>
                <span className="text-muted">{d.key}</span>
                <span className={`font-mono text-center ${d.changed ? 'bg-danger/10 text-danger px-2 py-0.5 rounded' : ''}`}>
                  {d.left}
                </span>
                <span className="text-center">
                  {d.changed && <ArrowRight size={14} className="text-danger" />}
                </span>
                <span className={`font-mono ${d.changed ? 'bg-ok/10 text-ok px-2 py-0.5 rounded font-medium' : ''}`}>
                  {d.right}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {compareData.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-5 mb-6">
            <h3 className="text-sm font-medium mb-4">再生制动力对比</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={compareData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip contentStyle={{ fontSize: 12, fontFamily: 'JetBrains Mono' }} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="leftForce"
                  name={`v${leftParamVersion?.versionNumber} 制动力`}
                  stroke="#6c7a89"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="rightForce"
                  name={`v${rightParamVersion?.versionNumber} 制动力`}
                  stroke="#1a2332"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
            <h3 className="text-sm font-medium mb-4">制动力差异</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={compareData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip contentStyle={{ fontSize: 12, fontFamily: 'JetBrains Mono' }} />
                <Line
                  type="monotone"
                  dataKey="diff"
                  name="制动力差异(N)"
                  stroke="#e67e22"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
