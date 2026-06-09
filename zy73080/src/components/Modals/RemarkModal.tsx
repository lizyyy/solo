import { useState, useEffect } from 'react';
import { useReviewStore } from '@/store/useReviewStore';
import {
  MessageSquarePlus,
  X,
  FileText,
  Crosshair,
  User,
  AlertTriangle,
  CheckCircle2,
  Radio,
  MessageCircle,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RemarkType } from '@/types';

const typeOptions: {
  value: RemarkType;
  label: string;
  icon: typeof Radio;
  description: string;
  activeClass: string;
  inactiveClass: string;
}[] = [
  {
    value: '正式',
    label: '正式',
    icon: FileText,
    description: '盖章/签字文件确认',
    activeClass: 'border-accent-blue/60 bg-accent-blue/15 text-accent-blue ring-2 ring-accent-blue/20',
    inactiveClass: 'border-metal/20 bg-metal/5 text-metal/70 hover:border-metal/40 hover:text-metal-light',
  },
  {
    value: '口头',
    label: '口头',
    icon: MessageCircle,
    description: '电话/现场沟通确认',
    activeClass: 'border-accent-orange/60 bg-accent-orange/15 text-accent-orange ring-2 ring-accent-orange/20',
    inactiveClass: 'border-metal/20 bg-metal/5 text-metal/70 hover:border-metal/40 hover:text-metal-light',
  },
  {
    value: '后补',
    label: '后补',
    icon: Clock,
    description: '后续补变更单/说明',
    activeClass: 'border-accent-green/60 bg-accent-green/15 text-accent-green ring-2 ring-accent-green/20',
    inactiveClass: 'border-metal/20 bg-metal/5 text-metal/70 hover:border-metal/40 hover:text-metal-light',
  },
];

export default function RemarkModal() {
  const uiState = useReviewStore((s) => s.uiState);
  const closeRemark = useReviewStore((s) => s.closeRemark);
  const addRemark = useReviewStore((s) => s.addRemark);
  const components = useReviewStore((s) => s.components);
  const materialItems = useReviewStore((s) => s.materialItems);

  const [type, setType] = useState<RemarkType>('口头');
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('岑（BIM协调）');
  const [affectsConclusion, setAffectsConclusion] = useState(true);
  const [linkedComponentId, setLinkedComponentId] = useState<string | ''>('');
  const [linkedMaterialId, setLinkedMaterialId] = useState<string | ''>('');

  const open = uiState.openRemarkModal;

  useEffect(() => {
    if (open) {
      setLinkedComponentId(uiState.defaultLinkedComponentId ?? '');
      setLinkedMaterialId(uiState.defaultLinkedMaterialId ?? '');
      setContent('');
      setType('口头');
      setAffectsConclusion(true);
    }
  }, [open, uiState.defaultLinkedComponentId, uiState.defaultLinkedMaterialId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    addRemark({
      type,
      content: content.trim(),
      author,
      affectsConclusion,
      linkedComponentId: linkedComponentId || undefined,
      linkedMaterialId: linkedMaterialId || undefined,
    });
  };

  const linkedMaterial = materialItems.find((m) => m.id === linkedMaterialId);
  const linkedComponent = components.find((c) => c.id === linkedComponentId);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center transition-all duration-200',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      )}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeRemark}
      />

      <div
        className={cn(
          'relative w-full max-w-lg panel shadow-2xl transition-all duration-200',
          open ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4',
        )}
      >
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="w-4 h-4 text-accent-blue" />
            <span className="panel-title text-[12px]">添加审核备注</span>
            {type && (
              <span
                className={cn(
                  'chip text-[10px]',
                  type === '正式' && 'border-accent-blue/40 bg-accent-blue/10 text-accent-blue',
                  type === '口头' && 'border-accent-orange/40 bg-accent-orange/10 text-accent-orange',
                  type === '后补' && 'border-accent-green/40 bg-accent-green/10 text-accent-green',
                )}
              >
                {type}备注
              </span>
            )}
          </div>
          <button
            onClick={closeRemark}
            className="p-1 text-metal/50 hover:text-metal-light hover:bg-metal/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-metal/60 mb-1.5">
              备注类型
            </label>
            <div className="grid grid-cols-3 gap-2">
              {typeOptions.map((opt) => {
                const Icon = opt.icon;
                const isActive = type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={cn(
                      'p-2.5 border text-left transition-all duration-150 flex flex-col gap-1',
                      isActive ? opt.activeClass : opt.inactiveClass,
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold">{opt.label}</span>
                    </div>
                    <div className="text-[9px] opacity-70 line-clamp-1">
                      {opt.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-metal/60 mb-1.5">
              备注内容 <span className="text-accent-red">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="请输入备注说明，例如：张工电话确认玻璃厚度按新版执行..."
              className="w-full resize-none"
              autoFocus
            />
            <div className="mt-1 text-[10px] text-metal/40 text-right">
              {content.length} 字
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium uppercase tracking-wider text-metal/60 mb-1.5">
                关联构件
              </label>
              <div className="relative">
                <select
                  value={linkedComponentId}
                  onChange={(e) => setLinkedComponentId(e.target.value)}
                  className="w-full appearance-none pr-8"
                >
                  <option value="">不关联</option>
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.category}
                    </option>
                  ))}
                </select>
                <Crosshair className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-metal/40 pointer-events-none" />
              </div>
              {linkedComponent && (
                <div className="mt-1 text-[10px] text-metal/60">
                  {linkedComponent.zone} · F{linkedComponent.floor}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-medium uppercase tracking-wider text-metal/60 mb-1.5">
                关联材料
              </label>
              <div className="relative">
                <select
                  value={linkedMaterialId}
                  onChange={(e) => setLinkedMaterialId(e.target.value)}
                  className="w-full appearance-none pr-8"
                >
                  <option value="">不关联</option>
                  {materialItems.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.materialName}
                      {m.isMismatch && ' ⚠'}
                    </option>
                  ))}
                </select>
                <FileText className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-metal/40 pointer-events-none" />
              </div>
              {linkedMaterial && (
                <div className="mt-1 text-[10px] flex items-center gap-1">
                  {linkedMaterial.isMismatch ? (
                    <span className="text-accent-orange flex items-center gap-0.5">
                      <AlertTriangle className="w-2 h-2" />
                      口径不一致
                    </span>
                  ) : (
                    <span className="text-accent-green flex items-center gap-0.5">
                      <CheckCircle2 className="w-2 h-2" />
                      口径一致
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-metal/60 mb-1.5">
              填写人
            </label>
            <div className="relative">
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full pl-7"
              />
              <User className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-metal/40" />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={affectsConclusion}
              onChange={(e) => setAffectsConclusion(e.target.checked)}
              className="w-3.5 h-3.5 rounded-none border-metal/30 bg-bg-elevated accent-accent-blue"
            />
            <span className="text-[11px] text-metal-light group-hover:text-white transition-colors">
              此备注影响复核结论
            </span>
            <span className="text-[10px] text-metal/50">
              （勾选后将参与结论计算）
            </span>
          </label>

          <div className="pt-3 border-t border-metal/10 flex items-center justify-between">
            <div className="text-[10px] text-metal/50">
              提交后将自动生成时间轴事件
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeRemark}
                className="btn"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!content.trim()}
                className={cn(
                  'btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                <MessageSquarePlus className="w-3 h-3" />
                提交备注
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
