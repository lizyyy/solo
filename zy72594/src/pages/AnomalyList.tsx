import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import { useReportStore } from '../store/useReportStore';
import { AnomalyCard } from '../components/anomaly/AnomalyCard';

export function AnomalyList() {
  const { id } = useParams<{ id: string }>();
  const { getAnomaliesByReportId, getNegativeSamplesByBucketId, getReportById } = useReportStore();

  const report = getReportById(id!);
  const anomalies = getAnomaliesByReportId(id!);
  const samples = report ? getNegativeSamplesByBucketId(report.bucketId) : [];

  const getSampleContent = (sampleId: string) => {
    return samples.find(s => s.id === sampleId)?.content || '未知样本';
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link to={`/report/${id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3">
          <ArrowLeft size={14} />
          返回报告详情
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-serif">异常样本分析</h1>
            <p className="text-sm text-slate-500 mt-1">共 {anomalies.length} 条异常样本，包含详细原因说明与责任分工</p>
          </div>
        </div>
      </div>

      <div className="mb-6 p-4 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-3">
        <Info size={20} className="text-sky-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-sky-800">异常样本说明</p>
          <p className="text-sm text-sky-700">
            每条异常样本均标注了：为什么被留下、还缺什么材料、下一步该找实验平台负责人还是找推荐策略老唐。
            时间窗穿越导致的效果虚高问题，系统会自动留给实验平台负责人复核，不会自动归为正常。
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {anomalies.map((anomaly) => (
          <AnomalyCard
            key={anomaly.id}
            anomaly={anomaly}
            sampleContent={getSampleContent(anomaly.sampleId)}
          />
        ))}
      </div>

      {anomalies.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-500">暂无异常样本</p>
        </div>
      )}
    </div>
  );
}
