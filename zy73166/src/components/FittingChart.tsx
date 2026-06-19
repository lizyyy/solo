import { useMemo } from 'react';
import {
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, LineChart, Line, ComposedChart, ReferenceLine, Area,
} from 'recharts';
import type { Material, FittingResult } from '../types';
import { generateCurvePoints, formatEquation, evaluatePolynomial } from '../utils/fitting';

interface Props {
  material: Material | null;
  result: FittingResult | undefined;
}

export default function FittingChart({ material, result }: Props) {
  const chartData = useMemo(() => {
    if (!material || !result) return { scatter: [], curve: [], composed: [] };
    const sorted = [...material.dataPoints].sort((a, b) => a.x - b.x);
    const xMin = sorted[0]?.x ?? 0;
    const xMax = sorted[sorted.length - 1]?.x ?? 0;
    const pad = (xMax - xMin) * 0.1;
    const curve = generateCurvePoints(result.coefficients, xMin - pad, xMax + pad, 80).map(p => ({
      x: Number(p.x.toFixed(4)),
      y: Number(p.y.toFixed(4)),
      type: '拟合曲线',
    }));
    const scatter = sorted.map(p => ({
      x: p.x,
      y: p.y,
      label: p.label,
      source: p.source === 'student' ? '学生自测' : '参考数据',
      isBoundary: p.isBoundary ? '边界点' : '内点',
      note: p.note || '',
    }));
    const composed = curve.map(c => ({ ...c, point: undefined as number | undefined }));
    for (const s of scatter) {
      const hit = composed.find(c => Math.abs(c.x - s.x) < (xMax - xMin) * 0.01);
      if (hit) hit.point = s.y;
    }
    return { scatter, curve, composed };
  }, [material, result]);

  if (!material || !result) {
    return (
      <div className="card h-[480px] flex items-center justify-center">
        <div className="text-slate-400 text-center">
          <div className="text-5xl mb-3">📊</div>
          <p>请从左侧选择材料查看拟合曲线</p>
        </div>
      </div>
    );
  }

  const sorted = [...material.dataPoints].sort((a, b) => a.x - b.x);
  const minX = sorted[0].x;
  const maxX = sorted[sorted.length - 1].x;

  return (
    <div className="card">
      <div className="card-header flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-slate-800">{material.currentName}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{material.id} · 单位: {material.unit}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`tag ${result.rSquared >= 0.999 ? 'tag-green' : result.rSquared >= 0.99 ? 'tag-yellow' : 'tag-red'}`}>
            R² = {result.rSquared.toFixed(6)}
          </span>
          {result.boundaryWarning
            ? <span className="tag tag-red">⚠️ 边界样本不足 ({result.boundarySampleCount}份，边界最少要求已在筛选口径中设置)</span>
            : <span className="tag tag-green">✅ 边界样本齐全 ({result.boundarySampleCount}份)</span>}
          {result.unstableSort?.unstable && <span className="tag tag-yellow">⚠️ 排序不稳定</span>}
        </div>
      </div>
      <div className="card-body">
        <div className="mb-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-700 font-mono">
          <div className="text-xs text-slate-500 mb-1">拟合方程</div>
          <div className="font-semibold">y = {formatEquation(result.coefficients)}</div>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mt-2">
            <div className="bg-white px-2 py-1.5 rounded border border-slate-200">
              <span className="text-slate-500">边界预测 低({minX})：</span>
              <strong className="ml-1">{evaluatePolynomial(result.coefficients, minX).toFixed(4)}</strong>
            </div>
            <div className="bg-white px-2 py-1.5 rounded border border-slate-200">
              <span className="text-slate-500">边界预测 高({maxX})：</span>
              <strong className="ml-1">{evaluatePolynomial(result.coefficients, maxX).toFixed(4)}</strong>
            </div>
            <div className="bg-white px-2 py-1.5 rounded border border-slate-200">
              <span className="text-slate-500">数据点总数：</span>
              <strong className="ml-1">{material.dataPoints.length}</strong>
            </div>
            <div className="bg-white px-2 py-1.5 rounded border border-slate-200">
              <span className="text-slate-500">边界点数：</span>
              <strong className="ml-1">{result.boundaryPoints.length}</strong>
            </div>
          </div>
        </div>

        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={{ top: 20, right: 30, left: 20, bottom: 30 }} data={chartData.curve}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="x"
                type="number"
                domain={['dataMin - 0.1', 'dataMax + 0.1']}
                label={{ value: `X (${material.unit})`, position: 'insideBottom', offset: -10, fontSize: 12 }}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                label={{ value: 'Y', angle: -90, position: 'insideLeft', fontSize: 12 }}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
                      <div className="font-medium text-slate-700 mb-1">
                        x = {p.x.toFixed(4)} {material.unit}
                      </div>
                      <div className="text-primary-600">拟合 y ≈ {p.y.toFixed(4)}</div>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />

              <Line
                type="monotone"
                dataKey="y"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={false}
                name="拟合曲线"
              />

              {sorted.map(dp => (
                <ReferenceLine
                  key={'x-' + dp.id}
                  x={dp.x}
                  stroke={dp.isBoundary ? '#f59e0b' : '#cbd5e1'}
                  strokeDasharray={dp.isBoundary ? '4 4' : '2 2'}
                  strokeWidth={dp.isBoundary ? 1.5 : 1}
                />
              ))}

              <Scatter name="学生自测" data={chartData.scatter.filter(s => s.source === '学生自测')} fill="#10b981">
                {chartData.scatter.filter(s => s.source === '学生自测').map((s, i) => (
                  <Cell key={i} stroke={s.isBoundary === '边界点' ? '#f59e0b' : 'none'} strokeWidth={s.isBoundary === '边界点' ? 3 : 0} />
                ))}
              </Scatter>
              <Scatter name="参考数据" data={chartData.scatter.filter(s => s.source === '参考数据')} fill="#8b5cf6" shape="diamond" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-y border-slate-200">
              <tr>
                <th className="th">标签</th>
                <th className="th">X ({material.unit})</th>
                <th className="th">Y (实测)</th>
                <th className="th">Y (拟合)</th>
                <th className="th">残差</th>
                <th className="th">来源</th>
                <th className="th">类型</th>
                <th className="th">备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map(dp => {
                const yPred = evaluatePolynomial(result.coefficients, dp.x);
                const residual = dp.y - yPred;
                return (
                  <tr key={dp.id} className={dp.isBoundary ? 'bg-amber-50/40' : ''}>
                    <td className="td font-mono">{dp.label}</td>
                    <td className="td font-mono">{dp.x}</td>
                    <td className="td font-mono">{dp.y.toFixed(4)}</td>
                    <td className="td font-mono text-primary-600">{yPred.toFixed(4)}</td>
                    <td className={`td font-mono ${Math.abs(residual) > 0.01 ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                      {residual >= 0 ? '+' : ''}{residual.toFixed(4)}
                    </td>
                    <td className="td">
                      <span className={`tag ${dp.source === 'student' ? 'tag-green' : 'tag-blue'}`}>
                        {dp.source === 'student' ? '学生自测' : '参考数据'}
                      </span>
                    </td>
                    <td className="td">
                      {dp.isBoundary
                        ? <span className="tag tag-yellow">🔸 边界点</span>
                        : <span className="tag tag-gray">内点</span>}
                    </td>
                    <td className="td text-slate-500 text-xs">{dp.note || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Cell(props: { key?: string | number; stroke?: string; strokeWidth?: number }) {
  return null;
}
