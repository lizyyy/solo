import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useCarbonStore } from '@/store/useCarbonStore';
import TraceableNumber from '@/components/TraceableNumber';
import AnomalyBanner from '@/components/AnomalyBanner';

export default function QuotaAggregation() {
  const { quotaDetail, loading, fetchQuotaDetail, fetchAnomalies } = useCarbonStore();

  useEffect(() => {
    fetchQuotaDetail();
    fetchAnomalies();
  }, [fetchQuotaDetail, fetchAnomalies]);

  if (loading.quota) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-forest-green border-t-transparent" />
      </div>
    );
  }

  if (!quotaDetail) {
    return <div className="flex h-96 items-center justify-center text-cool-gray">暂无数据</div>;
  }

  return (
    <div>
      <AnomalyBanner />
      <h2 className="mb-6 font-serif text-2xl text-forest-green">配额归集</h2>

      <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-serif text-lg text-forest-green">排放数据表</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-cool-gray">
                <th className="pb-3 pr-4 font-medium">设施</th>
                <th className="pb-3 pr-4 font-medium">排放量</th>
                <th className="pb-3 pr-4 font-medium">单位</th>
                <th className="pb-3 pr-4 font-medium">来源文件</th>
                <th className="pb-3 pr-4 font-medium">导入时间</th>
                <th className="pb-3 font-medium">单位状态</th>
              </tr>
            </thead>
            <tbody>
              {quotaDetail.emissions.map((row, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-3 pr-4 font-medium text-gray-800">{row.facility}</td>
                  <td className="py-3 pr-4">
                    <TraceableNumber value={row.emission} targetType="emission" targetId={row.facility} />
                  </td>
                  <td className="py-3 pr-4 text-cool-gray">{row.unit}</td>
                  <td className="py-3 pr-4 text-xs text-cool-gray">{row.sourceFile}</td>
                  <td className="py-3 pr-4 text-xs text-cool-gray">{row.importTime}</td>
                  <td className="py-3">
                    {row.unitStatus === 'warning' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-accent-600">
                        <AlertTriangle className="h-3 w-3" />
                        非标
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
                        正常
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-serif text-lg text-forest-green">配额账户表</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-cool-gray">
                <th className="pb-3 pr-4 font-medium">账户编号</th>
                <th className="pb-3 pr-4 font-medium">配额量</th>
                <th className="pb-3 pr-4 font-medium">来源文件</th>
                <th className="pb-3 font-medium">导入时间</th>
              </tr>
            </thead>
            <tbody>
              {quotaDetail.accounts.map((row, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-3 pr-4 font-medium text-gray-800">{row.accountNo}</td>
                  <td className="py-3 pr-4">
                    <TraceableNumber value={row.quota} targetType="account" targetId={row.accountNo} suffix="tCO₂" />
                  </td>
                  <td className="py-3 pr-4 text-xs text-cool-gray">{row.sourceFile}</td>
                  <td className="py-3 text-xs text-cool-gray">{row.importTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h3 className="mb-6 font-serif text-lg text-forest-green">缺口计算结果</h3>
        <div className="flex items-center justify-center gap-4 text-lg">
          <div className="rounded-lg border border-forest-green-100 bg-forest-green-50 px-6 py-4 text-center">
            <p className="mb-1 text-xs text-cool-gray">总排放量</p>
            <p className="font-serif text-2xl font-bold text-forest-green">
              <TraceableNumber value={quotaDetail.totalEmission} targetType="calc" targetId="totalEmission" suffix="tCO₂" />
            </p>
          </div>
          <span className="text-2xl text-cool-gray">−</span>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-6 py-4 text-center">
            <p className="mb-1 text-xs text-cool-gray">总配额</p>
            <p className="font-serif text-2xl font-bold text-emerald-600">
              <TraceableNumber value={quotaDetail.totalAllowance} targetType="calc" targetId="totalAllowance" suffix="tCO₂" />
            </p>
          </div>
          <span className="text-2xl text-cool-gray">=</span>
          <div className="rounded-lg border border-red-100 bg-red-50 px-6 py-4 text-center">
            <p className="mb-1 text-xs text-cool-gray">缺口</p>
            <p className="font-serif text-2xl font-bold text-warm-red">
              <TraceableNumber value={quotaDetail.gap} targetType="calc" targetId="gap" suffix="tCO₂" />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
