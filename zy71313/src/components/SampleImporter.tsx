import { Upload, FileText, AlertCircle, CheckCircle2, Clock, X } from 'lucide-react';
import { useState } from 'react';
import { useFlowStore } from '@/store/useFlowStore';
import type { SampleRecord } from '@/types';

interface SampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (sample: SampleRecord) => void;
}

function SampleModal({ isOpen, onClose, onSelect }: SampleModalProps) {
  const samples = useFlowStore((s) => s.getSamples());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const getStatusIcon = (status: SampleRecord['status']) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'incomplete':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'anomaly':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusLabel = (status: SampleRecord['status']) => {
    switch (status) {
      case 'complete': return { text: '完整', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
      case 'incomplete': return { text: '待补', class: 'bg-amber-100 text-amber-700 border-amber-200' };
      case 'anomaly': return { text: '异常', class: 'bg-red-100 text-red-700 border-red-200' };
    }
  };

  const handleConfirm = () => {
    const sample = samples.find(s => s.id === selectedId);
    if (sample) {
      onSelect(sample);
      onClose();
      setSelectedId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-zinc-100">
          <h3 className="text-lg font-bold text-zinc-800" style={{ fontFamily: '"LXGW WenKai", "Noto Sans SC", serif' }}>
            <FileText className="w-5 h-5 inline mr-2 text-teal-700" />
            导入样例数据
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto max-h-[60vh]">
          {samples.map((sample) => {
            const status = getStatusLabel(sample.status);
            return (
              <div
                key={sample.id}
                onClick={() => setSelectedId(sample.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedId === sample.id
                    ? 'border-teal-500 bg-teal-50'
                    : sample.status === 'incomplete'
                    ? 'border-dashed border-amber-300 bg-amber-50/30 hover:bg-amber-50'
                    : 'border-zinc-200 hover:border-teal-300 hover:bg-zinc-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(sample.status)}
                    <div>
                      <h4 className="font-semibold text-zinc-800">{sample.name}</h4>
                      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 font-mono">
                        <span>d={sample.pipeDiameter.value}{sample.pipeDiameter.unit}</span>
                        <span>v={sample.velocity.value}{sample.velocity.unit}</span>
                        <span>μ={sample.viscosity.value ?? '—'}{sample.viscosity.unit}</span>
                        <span>T={sample.temperature.value ?? '—'}℃</span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${status.class}`}>
                    {status.text}
                  </span>
                </div>
                {(sample.todoNotes.length > 0 || sample.anomalyNotes.length > 0) && (
                  <div className="mt-3 pt-3 border-t border-zinc-200 space-y-1">
                    {sample.todoNotes.length > 0 && (
                      <div className="text-xs">
                        <span className="text-amber-600 font-medium">待办：</span>
                        {sample.todoNotes.map((note, i) => (
                          <span key={i} className="text-zinc-600">{note}{i < sample.todoNotes.length - 1 ? '；' : ''}</span>
                        ))}
                      </div>
                    )}
                    {sample.anomalyNotes.length > 0 && (
                      <div className="text-xs">
                        <span className="text-orange-600 font-medium">备注：</span>
                        {sample.anomalyNotes.map((note, i) => (
                          <span key={i} className="text-zinc-600">{note}{i < sample.anomalyNotes.length - 1 ? '；' : ''}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-100 bg-zinc-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-zinc-200 text-zinc-600 hover:bg-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedId}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            导入选中样例
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SampleImporter() {
  const [isOpen, setIsOpen] = useState(false);
  const loadSample = useFlowStore((s) => s.loadSample);
  const currentSampleName = useFlowStore((s) => s.currentSampleName);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-teal-300 text-zinc-700 transition-all group"
      >
        <Upload className="w-4 h-4 text-teal-600 group-hover:scale-110 transition-transform" />
        <span>导入样例</span>
        {currentSampleName && (
          <span className="text-xs text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">
            {currentSampleName}
          </span>
        )}
      </button>
      <SampleModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSelect={loadSample}
      />
    </>
  );
}
