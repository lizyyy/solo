import type { AbnormalAlert } from '@/types';
import { SEVERITY_LABEL, STATUS_LABEL } from '@/types';
import { severityColor, statusColor, timeAgo } from '@/utils/format';
import { useAppStore } from '@/store/appStore';
import { Clock, StickyNote, Image, Pill, User } from 'lucide-react';
import MiniWeightChart from './MiniWeightChart';

interface Props {
  alert: AbnormalAlert;
  selected: boolean;
}

export default function AlertCard({ alert, selected }: Props) {
  const select = useAppStore((s) => s.selectAlert);
  const markRead = useAppStore((s) => s.markRead);
  const pet = alert.pet!;
  const sev = severityColor(alert.severity);
  const st = statusColor(alert.currentStatus);
  const lastTimeline = alert.timeline?.[alert.timeline.length - 1];
  const photoCount = alert.timeline?.reduce((n, t) => n + (t.photos?.length ?? 0), 0) ?? 0;
  const noteCount = alert.notes?.length ?? 0;
  const hasMedChange = !!alert.timeline?.find((t) => t.medication);

  return (
    <button
      onClick={() => {
        select(alert.id);
        if (!alert.isRead) markRead(alert.id);
      }}
      className={`card text-left w-full p-4 transition-all duration-200 hover:shadow-panel hover:-translate-y-0.5 animate-fade-in ${
        selected
          ? 'ring-2 ring-brand-400 ring-offset-2 shadow-panel'
          : 'ring-0 hover:ring-1 hover:ring-brand-200'
      } ${!alert.isRead ? 'border-l-4 border-l-danger' : ''}`}
      style={{ animationDelay: '0ms' }}
    >
      <div className="flex gap-3 items-start">
        <div className="relative shrink-0">
          <img
            src={pet.avatarUrl}
            alt={pet.name}
            className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-card"
          />
          {!alert.isRead && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-danger danger-dot" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-serif text-lg font-semibold text-slate-800 truncate">
              {pet.name}
              <span className="ml-1.5 text-xs text-slate-400 font-sans font-normal">
                {pet.species} · {pet.breed}
              </span>
            </h3>
            <span className={`chip ${sev.bg} ${sev.text} border ${sev.border} shrink-0`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sev.dot} ${alert.severity === 'severe' ? 'animate-pulse-soft' : ''}`} />
              {SEVERITY_LABEL[alert.severity]}
            </span>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-baseline gap-1">
              <span className="text-xs text-slate-500">减重</span>
              <span className="font-bold text-rose-600 text-lg font-serif">
                {alert.weightLossPct.toFixed(1)}%
              </span>
            </div>
            <div className={`chip ${st.bg} ${st.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
              {STATUS_LABEL[alert.currentStatus]}
            </div>
            <div className="chip bg-white text-slate-600 border border-slate-200 flex items-center gap-1">
              <User size={10} className="text-slate-400" />
              {alert.assignedTo}
            </div>
          </div>

          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1">
              <User size={10} />
              {pet.ownerName}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={10} />
              提醒于 {timeAgo(alert.alertDate)}
            </span>
            {noteCount > 0 && (
              <span className="flex items-center gap-1 text-sky-600">
                <StickyNote size={10} /> 备注 {noteCount}
              </span>
            )}
            {photoCount > 0 && (
              <span className="flex items-center gap-1 text-teal-600">
                <Image size={10} /> 疫苗照 {photoCount}
              </span>
            )}
            {hasMedChange && (
              <span className="flex items-center gap-1 text-amber-600">
                <Pill size={10} /> 用药调整
              </span>
            )}
          </div>
        </div>
      </div>

      {alert.weightRecords && alert.weightRecords.length >= 3 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <MiniWeightChart records={alert.weightRecords} width={420} height={64} />
        </div>
      )}

      {lastTimeline && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-xs flex items-start gap-2">
          <span className="text-slate-400 shrink-0 mt-0.5">最新:</span>
          <p className="text-slate-600 line-clamp-2 flex-1">
            <span className="text-slate-400 mr-1">{timeAgo(lastTimeline.createdAt)} ·</span>
            {lastTimeline.content}
          </p>
        </div>
      )}
    </button>
  );
}
