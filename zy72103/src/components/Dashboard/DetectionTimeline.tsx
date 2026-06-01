import { useDataStore } from '@/store/useDataStore';
import { STEP_LABELS, RESULT_LABELS, FIELD_UNITS } from '@/config/thresholds';
import { formatDateTime } from '@/utils/csvParser';
import {
  Database,
  CheckCircle2,
  Flame,
  Gauge,
  ShieldAlert,
  ChevronRight,
  FileText,
} from 'lucide-react';

const stepIcons = {
  raw: Database,
  qualityCheck: CheckCircle2,
  extremeDetection: Flame,
  thresholdCompare: Gauge,
  riskRating: ShieldAlert,
};

const stepColors = {
  normal: 'border-emerald-500 bg-emerald-500/10 text-emerald-400',
  warning: 'border-amber-500 bg-amber-500/10 text-amber-400',
  danger: 'border-red-500 bg-red-500/10 text-red-400',
};

export function DetectionTimeline() {
  const { records, selectedRecordId } = useDataStore();

  const selectedRecord = records.find((r) => r.id === selectedRecordId);

  if (!selectedRecord) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-slate-200">判断过程追溯</h3>
        </div>
        <div className="text-center py-12 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>请在表格中点击一条记录查看判断过程</p>
          <p className="text-sm mt-2">每一步的计算公式和结果都可追溯</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-slate-200">判断过程追溯</h3>
        </div>
        <div className="text-sm text-slate-400">
          <span className="font-mono text-slate-300">{selectedRecord.id}</span>
          <span className="mx-2">·</span>
          {formatDateTime(selectedRecord.timestamp)}
        </div>
      </div>

      <div className="relative">
        {selectedRecord.detectionSteps.map((step, index) => {
          const Icon = stepIcons[step.step];
          const colorClass = stepColors[step.result];
          const isLast = index === selectedRecord.detectionSteps.length - 1;

          return (
            <div key={step.step} className="relative flex gap-4">
              {!isLast && (
                <div className="absolute left-6 top-12 w-0.5 h-12 bg-slate-700" />
              )}

              <div className={`flex-shrink-0 w-12 h-12 rounded-lg border-2 ${colorClass} flex items-center justify-center`}>
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 pb-8">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-slate-200">
                    {index + 1}. {STEP_LABELS[step.step]}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${colorClass}`}>
                    {RESULT_LABELS[step.result]}
                  </span>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-3 mt-2">
                  <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                    <div>
                      <span className="text-slate-500">当前值</span>
                      <div className="font-mono text-slate-200 mt-0.5">
                        {step.value.toFixed(1)} {FIELD_UNITS.temperature}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">阈值</span>
                      <div className="font-mono text-slate-400 mt-0.5">
                        {step.threshold.toFixed(1)} {FIELD_UNITS.temperature}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">判定</span>
                      <div className={`font-mono mt-0.5 ${
                        step.result === 'danger' ? 'text-red-400' :
                        step.result === 'warning' ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {step.value >= step.threshold ? '≥' : '<'} 阈值
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 font-mono bg-slate-800 p-2 rounded">
                    {step.formula}
                  </div>
                </div>
              </div>

              {!isLast && (
                <div className="flex-shrink-0 self-center">
                  <ChevronRight className="w-5 h-5 text-slate-600" />
                </div>
              )}
            </div>
          );
        })}

        {selectedRecord.supplementNote && (
          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-blue-400 mb-2">
              <FileText className="w-4 h-4" />
              补录备注 · {selectedRecord.supplementNote.author} · {formatDateTime(selectedRecord.supplementNote.timestamp)}
            </div>
            <p className="text-slate-300">{selectedRecord.supplementNote.content}</p>
          </div>
        )}
      </div>
    </div>
  );
}
