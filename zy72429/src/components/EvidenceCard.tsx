import { ChevronRight, MapPin, AlertTriangle, CheckCircle, Clock, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { EvidencePack, EvidenceStatus } from '../types';
import { cn } from '../lib/utils';

interface EvidenceCardProps {
  evidence: EvidencePack;
}

const statusConfig: Record<EvidenceStatus, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: '待处理', color: 'text-gray-600', bg: 'bg-gray-100', icon: Clock },
  processing: { label: '处理中', color: 'text-sky-600', bg: 'bg-sky-100', icon: Clock },
  manager_review: { label: '待店长复核', color: 'text-amber-600', bg: 'bg-amber-100', icon: Store },
  completed: { label: '已完成', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle },
};

const sceneLabels = {
  smooth: { label: '顺利记录', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  missing_city: { label: '授权地区缺城市', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  old_caliber: { label: '旧口径补录', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
};

export function EvidenceCard({ evidence }: EvidenceCardProps) {
  const navigate = useNavigate();
  const status = statusConfig[evidence.status];
  const StatusIcon = status.icon;
  const scene = sceneLabels[evidence.sceneType];

  return (
    <div
      onClick={() => navigate(`/evidence/${evidence.id}`)}
      className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-800 group-hover:text-slate-700 transition-colors mb-2">
            {evidence.title}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                status.bg,
                status.color
              )}
            >
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border',
                scene.bg,
                scene.color
              )}
            >
              {scene.label}
            </span>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0 mt-1" />
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4" />
          <span>{evidence.authorizedCities.join('、')}</span>
          {evidence.missingCity && (
            <span className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              缺{evidence.missingCity}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
        <span>创建于 {evidence.createdAt}</span>
        <span>第 {evidence.currentStep} / 3 步</span>
      </div>
    </div>
  );
}
