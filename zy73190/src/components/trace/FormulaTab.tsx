import { Calculator, AlertTriangle, CheckCircle } from 'lucide-react';
import type { Sample, ParamVersion } from '@/types';

interface FormulaTabProps {
  sample: Sample;
  paramVersion: ParamVersion;
}

export function FormulaTab({ sample, paramVersion }: FormulaTabProps) {
  const sequence = sample.sequence;
  const n = sequence.length;
  const a1 = sequence[n - 1];
  const a2 = sequence[n - 2];
  const { a, b, c } = paramVersion.params;
  const step1 = a1 * a;
  const step2 = a2 * b;
  const expected = step1 + step2 + c;

  const isAbnormal = sample.deviation > paramVersion.threshold;
  const isDuplicate = sample.duplicateOf.length > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Calculator size={16} className="text-blue-600" />
          <h4 className="text-sm font-semibold text-slate-800">计算口径说明</h4>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg bg-blue-50 p-3">
            <div className="text-xs font-medium text-blue-700">递推公式</div>
            <div className="mt-1 font-mono text-base text-blue-900">
              a(n) = a(n-1) × A + a(n-2) × B + C
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-xs text-slate-500">参数 A</div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-800">{a}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-xs text-slate-500">参数 B</div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-800">{b}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-xs text-slate-500">参数 C</div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-800">{c}</div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-xs font-medium text-slate-500">偏差阈值</div>
            <div className="mt-1 font-mono text-lg font-bold text-slate-800">
              {paramVersion.threshold}%
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="mb-3 text-sm font-semibold text-slate-800">计算过程展开</h4>

        <div className="space-y-2 font-mono text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">已知：</span>
            <span className="text-slate-700">
              a({n - 1}) = {a2}, a({n}) = {a1}
            </span>
          </div>

          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-slate-500">计算 a({n + 1})：</div>
            <div className="mt-2 space-y-1 text-slate-700">
              <div>a({n + 1}) = a({n}) × A + a({n - 1}) × B + C</div>
              <div className="text-slate-500">
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; = {a1} × {a} + {a2} × {b} + {c}
              </div>
              <div className="text-slate-500">
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; = {step1} + {step2} + {c}
              </div>
              <div className="text-lg font-semibold text-blue-600">
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; = {expected.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-slate-500">学生答案：</span>
            <span className="text-slate-700">{sample.actual.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">标准答案：</span>
            <span className="text-slate-700">{sample.expected}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">实际偏差：</span>
            <span className={isAbnormal ? 'font-semibold text-red-600' : 'font-semibold text-emerald-600'}>
              {sample.deviation.toFixed(2)}%
            </span>
            {isAbnormal ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                <AlertTriangle size={10} />
                超过阈值
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <CheckCircle size={10} />
                在阈值内
              </span>
            )}
          </div>
        </div>
      </div>

      {isDuplicate && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-amber-700">
            <AlertTriangle size={16} />
            <h4 className="text-sm font-semibold">重复样本检测</h4>
          </div>
          <p className="text-sm text-amber-800">
            该样本的递推序列与其他样本完全相同，已标记为重复样本。
            请核实是否为雷同卷。
          </p>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-xs text-slate-500">系统计算追踪</div>
        <p className="mt-1 font-mono text-xs text-slate-600">{sample.calculationTrace}</p>
      </div>
    </div>
  );
}
