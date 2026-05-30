import { useMemo } from 'react';
import { AlertTriangle, ArrowRight, FileEdit, Scale, Wrench } from 'lucide-react';
import usePianoStore from '../../store/usePianoStore';
import { EvidenceType } from '../../types';

interface EvidenceTimelineProps {
  keyNumber: number;
}

const typeConfig: Record<EvidenceType, { icon: typeof AlertTriangle; color: string; label: string }> = {
  key_mismatch: { icon: AlertTriangle, color: '#eab308', label: '键号错位修正' },
  unit_conversion: { icon: Scale, color: '#3b82f6', label: '单位转换' },
  note_change: { icon: FileEdit, color: '#8b5cf6', label: '备注变更' },
  pressure_adjust: { icon: Wrench, color: '#ff6b35', label: '压力调整' },
};

export default function EvidenceTimeline({ keyNumber }: EvidenceTimelineProps) {
  const { evidence } = usePianoStore();

  const keyEvidence = useMemo(() => {
    return evidence
      .filter(e => e.keyNumber === keyNumber)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [evidence, keyNumber]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (keyEvidence.length === 0) {
    return (
      <div className="mt-2 p-4 bg-zinc-800/30 rounded-lg">
        <p className="text-sm text-zinc-600 text-center italic">暂无操作记录</p>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-3">
      {keyEvidence.map((record, index) => {
        const config = typeConfig[record.type];
        const Icon = config.icon;
        
        return (
          <div key={record.id} className="relative pl-6">
            {index < keyEvidence.length - 1 && (
              <div className="absolute left-2 top-6 bottom-0 w-px bg-zinc-700" />
            )}
            <div className="absolute left-0 top-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: config.color + '20' }}>
              <Icon size={12} style={{ color: config.color }} />
            </div>
            
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: config.color }}>
                  {config.label}
                </span>
                <span className="text-xs text-zinc-500">{formatTime(record.timestamp)}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm mb-1">
                <span className="text-zinc-400">{record.beforeValue}</span>
                <ArrowRight size={12} className="text-zinc-600" />
                <span className="text-zinc-200 font-medium">{record.afterValue}</span>
              </div>
              
              <p className="text-xs text-zinc-500">{record.description}</p>
              <p className="text-xs text-zinc-600 mt-1">操作人：{record.operator}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
