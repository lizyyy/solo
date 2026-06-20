import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Eye, MessageSquare, Copy } from 'lucide-react';
import type { Sample, SampleStatus } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { NoteInput } from '@/components/common/NoteInput';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

interface SampleRowProps {
  sample: Sample;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}

const statusOptions: { value: SampleStatus; label: string }[] = [
  { value: 'normal', label: '标记为正常' },
  { value: 'abnormal', label: '标记为异常' },
  { value: 'duplicate', label: '标记为重复' },
  { value: 'pending', label: '标记为待确认' },
];

export function SampleRow({ sample, index, isSelected, onSelect }: SampleRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const { updateSampleStatus, getSampleNotes, samples, getCurrentParamVersion } = useAppStore();
  const currentVersion = getCurrentParamVersion();
  const threshold = currentVersion?.threshold || 5;

  const notes = getSampleNotes(sample.id);
  const supplementNotes = notes.filter((n) => n.type === 'supplement');
  const hasNewNote = supplementNotes.length > 0;

  const duplicateSampleCodes = sample.duplicateOf
    .map((id) => samples.find((s) => s.id === id)?.sampleCode)
    .filter(Boolean);

  useEffect(() => {
    if (isSelected) {
      setIsHighlighted(true);
      const timer = setTimeout(() => setIsHighlighted(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSelected]);

  return (
    <>
      <tr
        className={cn(
          'cursor-pointer transition-all',
          index % 2 === 0 ? 'bg-white' : 'bg-slate-50',
          isSelected && 'bg-blue-50',
          isHighlighted && 'animate-pulse bg-yellow-50',
          'hover:bg-blue-50/50'
        )}
        onClick={onSelect}
      >
        <td className="whitespace-nowrap px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <span className="font-mono text-sm font-medium text-slate-800">{sample.sampleCode}</span>
            {hasNewNote && (
              <span className="flex h-5 items-center rounded-full bg-amber-100 px-2 text-xs font-medium text-amber-700">
                <MessageSquare size={10} className="mr-1" />
                {supplementNotes.length}条备注
              </span>
            )}
          </div>
        </td>
        <td className="whitespace-nowrap px-4 py-3">
          <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
            [{sample.sequence.join(', ')}]
          </code>
        </td>
        <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-slate-700">
          {sample.expected}
        </td>
        <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-slate-700">
          {sample.actual.toFixed(2)}
        </td>
        <td className="whitespace-nowrap px-4 py-3">
          <span
            className={cn(
              'font-mono text-sm font-semibold',
              sample.deviation > threshold ? 'text-red-600' : 'text-emerald-600'
            )}
          >
            {sample.deviation.toFixed(2)}%
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-3">
          <StatusBadge status={sample.status} />
        </td>
        <td className="whitespace-nowrap px-4 py-3">
          {sample.duplicateOf.length > 0 ? (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <Copy size={12} />
              <span>重复: {duplicateSampleCodes.join(', ')}</span>
            </div>
          ) : (
            <span className="text-xs text-slate-400">-</span>
          )}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
          {sample.updatedAt}
        </td>
        <td className="whitespace-nowrap px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
            >
              <Eye size={12} />
              追溯
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className={cn(index % 2 === 0 ? 'bg-white' : 'bg-slate-50')}>
          <td colSpan={9} className="px-4 py-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 grid grid-cols-2 gap-4">
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-500">评分备注</div>
                  <div className="text-sm text-slate-700">{sample.scoreNote}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-500">计算过程</div>
                  <div className="font-mono text-sm text-slate-700">{sample.calculationTrace}</div>
                </div>
              </div>

              {supplementNotes.length > 0 && (
                <div className="mb-3">
                  <div className="mb-2 text-xs font-medium text-slate-500">补充备注 ({supplementNotes.length})</div>
                  <div className="space-y-2">
                    {supplementNotes.map((note) => (
                      <div key={note.id} className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                        <div className="flex items-center justify-between text-xs text-amber-600">
                          <span>{note.operator}</span>
                          <span>{note.createdAt}</span>
                        </div>
                        <div className="mt-1 text-sm text-amber-800">{note.content}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">批量标记：</span>
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateSampleStatus(sample.id, option.value);
                      }}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                        sample.status === option.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <NoteInput sampleId={sample.id} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
