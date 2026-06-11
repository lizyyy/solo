import { useEffect, useRef, useState } from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/store';

interface Props {
  collisionId: string;
  initialValue: string;
  label?: string;
  placeholder?: string;
  rows?: number;
  /** 改判/标异常时需要填写原因 */
  requireReasonHint?: boolean;
  onSaved?: () => void;
}

export default function RemarkEditor({
  collisionId,
  initialValue,
  label = '备注（失焦自动保存）',
  placeholder = '请输入备注说明，离开输入框后立即同步到后端和导出数据…',
  rows = 4,
  requireReasonHint,
  onSaved,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [reason, setReason] = useState('');
  const [showReason, setShowReason] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastValue = useRef(initialValue);
  const user = useAppStore((s) => s.user);
  const patchCollision = useAppStore((s) => s.patchCollision);
  const flashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue(initialValue);
    lastValue.current = initialValue;
  }, [initialValue]);

  async function save() {
    if (value === lastValue.current) {
      setStatus('idle');
      return;
    }
    if (requireReasonHint && !reason.trim()) {
      setShowReason(true);
      setStatus('error');
      setErrMsg('改判/标异常必填改判原因');
      return;
    }
    if (!user) return;
    setStatus('saving');
    setErrMsg('');
    try {
      await patchCollision(collisionId, {
        remark: value,
        changedBy: user.id,
        changedByName: user.name,
        changeReason: reason || undefined,
      });
      lastValue.current = value;
      setStatus('saved');
      setReason('');
      setShowReason(false);
      flashRef.current?.classList.add('animate-save-flash');
      setTimeout(() => flashRef.current?.classList.remove('animate-save-flash'), 700);
      setTimeout(() => setStatus('idle'), 1500);
      onSaved?.();
    } catch (e: any) {
      setStatus('error');
      setErrMsg(e?.message ?? '保存失败');
    }
  }

  return (
    <div ref={flashRef} className="rounded-sm">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-engineering-navy/90 flex items-center gap-1">
          {label}
          {status === 'saving' && (
            <span className="text-[10px] font-normal text-blue-600">保存中…</span>
          )}
          {status === 'saved' && (
            <span className="text-[10px] font-normal text-audit-green flex items-center gap-0.5 animate-badge-in">
              <Check size={11} /> 已同步到后端 + 导出缓存
            </span>
          )}
          {status === 'error' && (
            <span className="text-[10px] font-normal text-red-600 flex items-center gap-0.5">
              <AlertTriangle size={11} /> {errMsg}
            </span>
          )}
        </label>
        <span className="text-[10px] text-history-gray mono">{value.length}字</span>
      </div>
      <textarea
        ref={textareaRef}
        className={`eng-input resize-y font-mono text-[12px] leading-relaxed ${
          requireReasonHint ? 'border-caution-orange/60' : ''
        }`}
        rows={rows}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            textareaRef.current?.blur();
          }
        }}
        placeholder={placeholder}
      />
      {requireReasonHint && (
        <div className={`mt-2 ${showReason ? '' : 'opacity-70'}`}>
          <label className="text-[11px] font-semibold text-caution-orange flex items-center gap-1 mb-1">
            <AlertTriangle size={11} /> 改判/异常原因（必填，记录到审计历史）
          </label>
          <input
            className="eng-input text-[12px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例如：与 CP-xxxx 属重复碰撞，合并处理；或：设计院助理阿宁口头确认留洞放大至 800"
          />
          <div className="mt-1 text-[10px] text-history-gray">
            小提示：此原因会写入版本快照和交接班审计历史，便于下一班追溯。
          </div>
        </div>
      )}
      <div className="mt-1 text-[10px] text-history-gray flex items-center justify-between">
        <span>失焦或 ⌘/Ctrl + Enter 即保存</span>
        <span className="mono">
          {user ? `${user.name}·${user.id}` : '未登录'}
        </span>
      </div>
    </div>
  );
}
