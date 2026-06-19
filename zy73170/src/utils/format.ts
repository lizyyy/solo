export const formatDate = (iso: string) => iso;

export const statusColorMap: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  异常:   { bg: 'bg-coral-50',   text: 'text-coral-700',   border: 'border-coral-200',   dot: 'bg-coral-500' },
  空集合: { bg: 'bg-ink-50',    text: 'text-ink-700',     border: 'border-ink-200',    dot: 'bg-ink-500' },
  重复:   { bg: 'bg-amber2-50', text: 'text-amber2-700',  border: 'border-amber2-200', dot: 'bg-amber2-500' },
  待确认: { bg: 'bg-amber2-50', text: 'text-amber2-700',  border: 'border-amber2-200', dot: 'bg-amber2-500' },
  可放行: { bg: 'bg-emerald2-50', text: 'text-emerald2-700', border: 'border-emerald2-200', dot: 'bg-emerald2-500' },
};

export const verdictColorMap: Record<string, { bg: string; text: string; border: string }> = {
  需补材料: { bg: 'bg-coral-50', text: 'text-coral-700', border: 'border-coral-200' },
  可放行:   { bg: 'bg-emerald2-50', text: 'text-emerald2-700', border: 'border-emerald2-200' },
};
