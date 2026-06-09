import { Modal } from './Modal';
import {
  AlertTriangle,
  Phone,
  User,
  Briefcase,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface OffsetAlertModalProps {
  open: boolean;
  onClose: () => void;
  blockerReason: string;
  contactInfo: {
    nextContact: string;
    nextContactRole: string;
    nextContactPhone: string;
  };
  offsetMm: number;
  onFlagAwaiting: () => void;
  onConfirmAnyway?: () => void;
}

export function OffsetAlertModal({
  open,
  onClose,
  blockerReason,
  contactInfo,
  offsetMm,
  onFlagAwaiting,
  onConfirmAnyway,
}: OffsetAlertModalProps) {
  const handleCall = () => {
    window.location.href = `tel:${contactInfo.nextContactPhone.replace(/-/g, '')}`;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="warning"
      size="lg"
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 ring-2 ring-orange-400/30">
            <ShieldAlert className="h-5 w-5 text-orange-600" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">模型坐标偏移告警</h3>
            <p className="mt-0.5 text-xs text-orange-700">
              当前偏移量 <span className="font-mono font-bold">{offsetMm} mm</span>，超过安全阈值，需要人工确认处理
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            先关闭，稍后处理
          </button>
          {onConfirmAnyway && (
            <button
              onClick={onConfirmAnyway}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              忽略偏移，强制确认
            </button>
          )}
          <button
            onClick={onFlagAwaiting}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
          >
            <AlertTriangle className="h-4 w-4" strokeWidth={2.2} />
            标记为待补件
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-orange-200 bg-orange-50/70 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-orange-700">
            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.5} />
            为什么卡住了？
          </div>
          <div className="space-y-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-orange-900">
            {blockerReason}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            下一步找谁补？
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-md ring-4 ring-orange-100">
                <span className="text-lg font-bold">{contactInfo.nextContact.charAt(0)}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{contactInfo.nextContact}</span>
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-600">
                    <Briefcase className="h-2.5 w-2.5" strokeWidth={2.5} />
                    {contactInfo.nextContactRole}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[12px] text-slate-500">
                  <User className="h-3 w-3" strokeWidth={2} />
                  <span>负责模型坐标复核及修正出图</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleCall}
              className="inline-flex h-11 flex-none items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Phone className="h-4 w-4" strokeWidth={2.2} />
              一键拨号
              <span className="ml-0.5 font-mono text-[11px] opacity-90">{contactInfo.nextContactPhone}</span>
            </button>
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-slate-500">
            说明：点击「标记为待补件」后，该条交底将自动归类到月底复核的「待补件」栏位，补件完成后可再次进入详情页重新发起确认流程。
          </p>
        </div>
      </div>
    </Modal>
  );
}
