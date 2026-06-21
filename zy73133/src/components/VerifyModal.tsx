import {
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ShieldCheck,
  X,
  AlertTriangle,
} from 'lucide-react';
import type { VerifyResult } from '@/types';

export default function VerifyModal({
  result,
  onClose,
}: {
  result: VerifyResult;
  onClose: () => void;
}) {
  const passedCount = result.steps.filter((s) => s.passed).length;
  const failedCount = result.steps.length - passedCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
      <div className="panel w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ocean-line">
          <div className="flex items-center gap-3">
            {result.passed ? (
              <div className="w-12 h-12 rounded-full bg-buoy-green/15
                border-2 border-buoy-green flex items-center justify-center">
                <ShieldCheck size={26} className="text-buoy-green" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-buoy-red/15
                border-2 border-buoy-red flex items-center justify-center">
                <ShieldAlert size={26} className="text-buoy-red" />
              </div>
            )}
            <div>
              <h2 className="font-mono text-lg tracking-wider text-console-text">
                接班流程验证报告
              </h2>
              <p className="font-mono text-[12px] text-console-muted mt-0.5">
                {result.summary}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-console-muted hover:text-console-text p-1"
          >
            <X size={22} />
          </button>
        </div>

        {/* 统计条 */}
        <div className="flex items-center gap-6 px-6 py-3 border-b border-ocean-line
          bg-ocean-deep/40">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-buoy-green" />
            <span className="font-mono text-[12px] text-console-muted">
              通过
            </span>
            <span className="font-mono text-[18px] font-bold text-buoy-green">
              {passedCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle size={16} className="text-buoy-red" />
            <span className="font-mono text-[12px] text-console-muted">
              失败
            </span>
            <span className="font-mono text-[18px] font-bold text-buoy-red">
              {failedCount}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="font-mono text-[12px] text-console-muted">
              通过率
            </span>
            <div className="w-48 h-2 bg-ocean-mid rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  result.passed ? 'bg-buoy-green' : 'bg-buoy-yellow'
                }`}
                style={{
                  width: `${result.steps.length > 0
                    ? (passedCount / result.steps.length) * 100
                    : 0
                  }%`,
                }}
              />
            </div>
            <span className="font-mono text-[13px] text-console-text">
              {result.steps.length > 0
                ? `${Math.round((passedCount / result.steps.length) * 100)}%`
                : '—'}
            </span>
          </div>
        </div>

        {/* 内容：左右分栏 */}
        <div className="flex-1 overflow-hidden grid grid-cols-2 gap-0 min-h-0">
          {/* 左侧：步骤列表 */}
          <div className="flex flex-col border-r border-ocean-line min-h-0">
            <div className="px-4 py-2 text-[11px] font-mono text-console-dim
              uppercase tracking-wider border-b border-ocean-line bg-ocean-surface/40">
              步骤详情 ({result.steps.length})
            </div>
            <div className="flex-1 overflow-y-auto console-scroll p-3 space-y-1.5">
              {result.steps.map((step, i) => (
                <div
                  key={i}
                  className={`p-2.5 border rounded-sm transition-colors ${
                    step.passed
                      ? 'bg-buoy-green/5 border-buoy-greenDim/30 hover:border-buoy-greenDim/60'
                      : 'bg-buoy-red/5 border-buoy-redDim/40 hover:border-buoy-redDim'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {step.passed ? (
                      <CheckCircle2
                        size={15}
                        className="text-buoy-green mt-0.5 shrink-0"
                      />
                    ) : (
                      <XCircle
                        size={15}
                        className="text-buoy-red mt-0.5 shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div
                        className={`font-mono text-[12px] leading-snug ${
                          step.passed ? 'text-console-text' : 'text-buoy-red'
                        }`}
                      >
                        {step.name}
                      </div>
                      {step.detail && (
                        <div className="font-mono text-[10.5px] text-console-dim
                          mt-1 leading-snug break-all">
                          {step.detail}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 右侧：失败项汇总 */}
          <div className="flex flex-col min-h-0">
            <div className="px-4 py-2 text-[11px] font-mono text-console-dim
              uppercase tracking-wider border-b border-ocean-line bg-ocean-surface/40">
              失败项汇总 ({result.errors.length})
            </div>
            <div className="flex-1 overflow-y-auto console-scroll p-3">
              {result.errors.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <CheckCircle2 size={40} className="text-buoy-green mb-3 opacity-70" />
                  <p className="font-mono text-[13px] text-buoy-green mb-1">
                    所有检查项均通过
                  </p>
                  <p className="font-mono text-[11px] text-console-dim">
                    可以执行接班流程
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {result.errors.map((err, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-3 bg-buoy-red/8
                        border border-buoy-redDim/40 rounded-sm"
                    >
                      <AlertTriangle
                        size={14}
                        className="text-buoy-red mt-0.5 shrink-0"
                      />
                      <div className="font-mono text-[11.5px] text-buoy-red/95 leading-relaxed break-all">
                        {err}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-ocean-line">
          <div className="font-mono text-[11px] text-console-dim">
            {result.passed
              ? '验证通过：空间标注和潮位数据完整，符合接班标准。'
              : '验证失败：请根据失败项汇总修正数据后重新验证。'}
          </div>
          <button
            onClick={onClose}
            className={
              result.passed ? 'btn-bevel-primary' : 'btn-bevel-warn'
            }
          >
            {result.passed ? '确认并接班' : '关闭并修正'}
          </button>
        </div>
      </div>
    </div>
  );
}
