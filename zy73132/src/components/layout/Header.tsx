import React from 'react';
import { Waves, Filter, AlertTriangle, FileText, CheckCircle, Clock, XCircle } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { getStatusLabel } from '../../utils/helpers';
import type { ReviewStatus } from '../../types';

const statusOptions: { value: ReviewStatus | 'all'; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'all', label: '全部', icon: Filter, color: 'border-ocean-400 text-ocean-400' },
  { value: 'confirmed', label: '已确认', icon: CheckCircle, color: 'border-[#2D6A4F] text-[#52b788]' },
  { value: 'pending', label: '待补件', icon: Clock, color: 'border-[#FFB627] text-[#FFB627]' },
  { value: 'returned', label: '退回', icon: XCircle, color: 'border-[#C92A2A] text-[#fa5252]' },
];

const Header: React.FC = () => {
  const { stations, selectedStationId, setSelectedStation, statusFilter, setStatusFilter, toggleReport, records, selectedStationId: sid } = useAppStore();
  const stationRecords = records.filter(r => r.stationId === sid);
  const anomalyCount = stationRecords.filter(r => r.isAnomaly).length;

  return (
    <header className="h-16 flex items-center justify-between px-6 glass-panel border-b border-ocean-400/20 relative z-10">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-ocean-400 to-ocean-500 flex items-center justify-center shadow-lg shadow-ocean-400/30">
            <Waves className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-ocean-400 glow-text tracking-wide">
              潮汐能站时序回放
            </h1>
            <p className="text-xs text-slate-400 font-mono">Tidal Station Playback System</p>
          </div>
        </div>

        <div className="h-8 w-px bg-ocean-400/20 mx-2" />

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 mr-1">站点:</label>
          <select
            value={selectedStationId}
            onChange={(e) => setSelectedStation(e.target.value)}
            className="bg-deep-sea-800 border border-ocean-400/30 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-ocean-400 focus:ring-1 focus:ring-ocean-400/30 transition-all"
          >
            {stations.map(st => (
              <option key={st.id} value={st.id}>
                {st.name} {st.hasAnomaly ? '⚠️' : ''}
              </option>
            ))}
          </select>
          {anomalyCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded bg-anomaly-500/20 border border-anomaly-500/40 text-anomaly-400 text-xs">
              <AlertTriangle className="w-3 h-3" />
              {anomalyCount} 异常
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5 bg-deep-sea-800/60 rounded-lg p-1 border border-ocean-400/10">
          {statusOptions.map(opt => {
            const Icon = opt.icon;
            const isActive = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all duration-200 ${
                  isActive
                    ? `bg-deep-sea-700 border ${opt.color}`
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {opt.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => toggleReport(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-ocean-500 to-ocean-400 hover:from-ocean-400 hover:to-ocean-300 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-lg shadow-ocean-500/20 hover:shadow-ocean-400/40"
        >
          <FileText className="w-4 h-4" />
          导出报告
        </button>
      </div>
    </header>
  );
};

export default Header;
