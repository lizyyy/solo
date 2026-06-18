import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, FileText, ArrowRight } from 'lucide-react';
import { useReportStore } from '@/store/useReportStore';
import MaterialCard from '@/components/MaterialCard';
import AnomalyCard from '@/components/AnomalyCard';

export default function Dashboard() {
  const navigate = useNavigate();
  const { report } = useReportStore();

  const handleMaterialClick = () => {
    navigate('/trace');
  };

  const handleAnomalyClick = (type: string) => {
    navigate('/trace', { state: { activeTab: type } });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          近岸水质报告汇总
        </h1>
        <p className="text-slate-500 text-sm">
          查看报告数据来源、异常记录及追溯分析
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-sky-600" />
              <h2 className="text-lg font-semibold text-slate-800">
                {report.reportNo}
              </h2>
              <span className="px-2 py-0.5 bg-sky-50 text-sky-700 text-xs font-medium rounded">
                最新版本
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span>{report.stationName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>
                  {report.dateRange.start} ~ {report.dateRange.end}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 p-4 bg-sky-50/50 rounded-lg border border-sky-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">结论摘要</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            {report.conclusion}
          </p>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">材料入口</h2>
          <span className="text-xs text-slate-400">点击查看数据来源详情</span>
        </div>
        <div className="grid grid-cols-3 gap-5">
          {report.materials.map((material) => (
            <MaterialCard
              key={material.type}
              material={material}
              onClick={handleMaterialClick}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">异常统计</h2>
          <button
            onClick={() => navigate('/trace')}
            className="text-sm text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1 transition-colors"
          >
            查看全部
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-5">
          {report.anomalies.map((anomaly) => (
            <AnomalyCard
              key={anomaly.type}
              type={anomaly.type}
              count={anomaly.count}
              description={anomaly.description}
              onClick={() => handleAnomalyClick(anomaly.type)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
