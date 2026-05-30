import { useValuationStore } from '../../store/useValuationStore';
import { ANOMALY_LABELS, type AnomalyType } from '../../types';
import { ANOMALY_RULES } from '../../utils/anomalyDetector';
import { AlertTriangle, XCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

export function AnomalySummary() {
  const navigate = useNavigate();
  const { valuations, setFilters } = useValuationStore(useShallow((state) => ({
    valuations: state.valuations,
    setFilters: state.setFilters,
  })));
  
  const anomalyCounts = new Map<AnomalyType, number>();
  
  valuations.forEach(v => {
    v.anomalies.forEach(a => {
      anomalyCounts.set(a, (anomalyCounts.get(a) || 0) + 1);
    });
  });
  
  const anomalyList = Array.from(anomalyCounts.entries()).sort((a, b) => b[1] - a[1]);
  
  const handleClick = (type: AnomalyType) => {
    setFilters({
      statuses: [],
      hasAnomaly: true,
      fundIds: [],
    });
    navigate('/records');
  };
  
  if (anomalyList.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 opacity-0 animate-fade-in-up animate-delay-250 [animation-fill-mode:forwards]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-100">
            <AlertTriangle className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-semibold text-slate-800">异常检测</h3>
            <p className="text-sm text-emerald-600 font-medium">所有记录均通过检测，无异常</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 opacity-0 animate-fade-in-up animate-delay-250 [animation-fill-mode:forwards]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-semibold text-slate-800">异常检测摘要</h3>
            <p className="text-xs text-slate-500 mt-0.5">共检测到 {anomalyList.reduce((sum, [, count]) => sum + count, 0)} 条异常记录</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/records')}
          className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-medium transition-colors"
        >
          查看全部 <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {anomalyList.map(([type, count]) => {
          const severity = ANOMALY_RULES[type]?.severity || 'warning';
          const isError = severity === 'error';
          const Icon = isError ? XCircle : AlertTriangle;
          
          return (
            <button
              key={type}
              onClick={() => handleClick(type)}
              className={`flex items-center gap-2 p-3 rounded-lg border transition-all hover:shadow-md btn-click ${
                isError 
                  ? 'bg-rose-50 border-rose-200 hover:bg-rose-100' 
                  : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isError ? 'text-rose-500' : 'text-amber-500'}`} />
              <div className="flex-1 text-left min-w-0">
                <p className={`text-xs font-medium truncate ${isError ? 'text-rose-700' : 'text-amber-700'}`}>
                  {ANOMALY_LABELS[type]}
                </p>
                <p className={`font-mono text-lg font-bold ${isError ? 'text-rose-600' : 'text-amber-600'}`}>
                  {count}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
