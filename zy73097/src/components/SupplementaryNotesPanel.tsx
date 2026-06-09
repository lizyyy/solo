import { useState } from 'react';
import { Plus, MessageSquareText, User, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Modal } from './Modal';
import { NoteResultTag } from './Tags';
import type { SupplementaryNote, NoteResult } from '../types';
import { NOTE_RESULT_LABEL } from '../types';
import { useMaterialStore } from '../store';
import { cn } from '../lib/utils';

interface Props {
  recordId: string;
  notes: SupplementaryNote[];
}

const RESULT_OPTIONS: { v: NoteResult; label: string; hint: string }[] = [
  { v: 'RESOLVED', label: NOTE_RESULT_LABEL.RESOLVED, hint: '问题已解决，无需后续处理' },
  { v: 'IN_PROGRESS', label: NOTE_RESULT_LABEL.IN_PROGRESS, hint: '处理中，需要下一班同事继续跟进' },
  { v: 'ESCALATED', label: NOTE_RESULT_LABEL.ESCALATED, hint: '已上报上级 / 跨部门协调' },
];

export function SupplementaryNotesPanel({ recordId, notes }: Props) {
  const [open, setOpen] = useState(false);
  const addNote = useMaterialStore((s) => s.addSupplementaryNote);

  const [content, setContent] = useState('');
  const [process, setProcess] = useState('');
  const [result, setResult] = useState<NoteResult>('IN_PROGRESS');
  const [resultText, setResultText] = useState('');

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const submit = () => {
    if (!content.trim() || !process.trim() || !resultText.trim()) return;
    addNote(recordId, {
      content: content.trim(),
      handler: '岑工',
      handledAt: new Date().toISOString(),
      process: process.trim(),
      result,
      resultText: resultText.trim(),
    });
    setOpen(false);
    setContent('');
    setProcess('');
    setResult('IN_PROGRESS');
    setResultText('');
  };

  const canSubmit = content.trim() && process.trim() && resultText.trim();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-song font-bold text-navy-700 text-sm flex items-center gap-2">
          <MessageSquareText size={16} />
          后补备注处理过程
          <span className="chip">{notes.length}</span>
        </h4>
        <button className="btn btn-primary !py-1.5 !px-3 text-xs" onClick={() => setOpen(true)}>
          <Plus size={14} />
          新增后补备注
        </button>
      </div>

      {notes.length === 0 && (
        <div className="card p-6 text-center text-sm text-ink-500 bg-ink-50/50">
          暂无后补备注记录
        </div>
      )}

      <div className="space-y-2">
        {notes.map((n, idx) => {
          const isOpen = expanded[n.id] ?? true;
          return (
            <div
              key={n.id}
              className="card overflow-hidden anim-grow-y"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <div
                className="px-3 py-2 flex items-center gap-3 bg-ink-50 border-b border-ink-200 cursor-pointer hover:bg-ink-100 transition"
                onClick={() =>
                  setExpanded((s) => ({ ...s, [n.id]: !(s[n.id] ?? true) }))
                }
              >
                <NoteResultTag result={n.result} />
                <div className="flex-1 text-xs text-ink-700 font-medium truncate">
                  {n.content}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-ink-500 shrink-0">
                  <span className="flex items-center gap-1">
                    <User size={12} />
                    {n.handler}
                  </span>
                  <span className="flex items-center gap-1 font-mono tabular-nums">
                    <Clock size={12} />
                    {new Date(n.handledAt).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>
              {isOpen && (
                <div className="p-3 space-y-3 anim-fade-in">
                  <div>
                    <div className="field-label">备注内容</div>
                    <p className="text-sm text-ink-900 bg-white border border-ink-200 p-2.5 leading-relaxed">
                      {n.content}
                    </p>
                  </div>
                  <div>
                    <div className="field-label">处理过程（步骤说明）</div>
                    <pre className="text-xs font-sans text-ink-800 bg-navy-50 border-2 border-navy-100 p-2.5 leading-relaxed whitespace-pre-wrap font-mono">
{n.process}
                    </pre>
                  </div>
                  <div className="flex items-start gap-2">
                    <NoteResultTag result={n.result} />
                    <div className="flex-1 text-xs text-ink-700 bg-white border-l-4 border-navy-400 pl-3 py-1">
                      {n.resultText}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="新增后补备注"
        subtitle="处理过程必须填写完整步骤，便于下一班同事接手继续"
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)}>
              取消
            </button>
            <button
              className={cn('btn btn-primary', !canSubmit && 'opacity-50 cursor-not-allowed')}
              disabled={!canSubmit}
              onClick={submit}
            >
              保存并写入历史
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="field-label">备注内容（必填）</span>
            <textarea
              className="field-input min-h-[80px]"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="如：厂家报告3月到期，需重新出具"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="field-label">
              处理过程（必填 · 分步写清楚联系了谁 / 做了什么 / 对方怎么回复）
            </span>
            <textarea
              className="field-input min-h-[120px] font-mono text-xs"
              value={process}
              onChange={(e) => setProcess(e.target.value)}
              placeholder="1. 电话联系厂家李经理（138xxxx）&#10;2. 确认报告已于 2026-03 到期&#10;3. 要求 6/8 前寄出新报告…"
            />
          </label>

          <label className="block">
            <span className="field-label">处理结果状态</span>
            <div className="grid grid-cols-3 gap-2">
              {RESULT_OPTIONS.map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setResult(o.v)}
                  className={cn(
                    'text-left p-2 border-2 transition',
                    result === o.v
                      ? 'border-navy-500 bg-navy-50 ring-1 ring-navy-300'
                      : 'border-ink-200 bg-white hover:border-ink-300',
                  )}
                >
                  <div className="text-xs font-bold text-navy-700">{o.label}</div>
                  <div className="text-[10px] text-ink-500 mt-0.5">{o.hint}</div>
                </button>
              ))}
            </div>
          </label>

          <label className="block">
            <span className="field-label">处理结果描述（必填）</span>
            <input
              className="field-input"
              value={resultText}
              onChange={(e) => setResultText(e.target.value)}
              placeholder="如：待厂家6/8到件后复核"
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
