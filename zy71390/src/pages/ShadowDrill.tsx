import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Target, Users, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { useStore } from '@/store';
import DrillConfigForm from '@/components/DrillConfigForm';
import HitResultCard from '@/components/HitResultCard';
import AnomalyAlert from '@/components/AnomalyAlert';
import type { DrillConfig, DrillReport, HitResult } from '../../shared/types';

export default function ShadowDrill() {
  const navigate = useNavigate();
  const runDrill = useStore((state) => state.runDrill);
  const loading = useStore((state) => state.loading.runDrill);
  const error = useStore((state) => state.error);

  const [drillResult, setDrillResult] = useState<DrillReport | null>(null);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleRunDrill = async (config: DrillConfig) => {
    const result = await runDrill(config);
    if (result) {
      setDrillResult(result);
    }
  };

  const sortedHitResults = useMemo(() => {
    if (!drillResult) return [];
    return [...drillResult.hitResults].sort((a: HitResult, b: HitResult) => {
      const tierOrder: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 };
      return tierOrder[a.customerTier] - tierOrder[b.customerTier];
    });
  }, [drillResult]);

  const handleGenerateReport = () => {
    if (drillResult) {
      navigate(`/reports/${drillResult.id}`);
    }
  };

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!drillResult && (
        <DrillConfigForm onSubmit={handleRunDrill} rules={rules} loading={loading} />
      )}

      {loading && (
        <div className="card p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <h3 className="text-xl font-semibold text-white">演练进行中</h3>
            <p className="text-slate-400">正在分析请求数据，请稍候...</p>
          </div>
        </div>
      )}

      {drillResult && !loading && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">演练结果</h2>
            <button
              onClick={handleGenerateReport}
              className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              查看完整报告
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-info/20 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-info" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">总请求数</p>
                  <p className="text-2xl font-bold text-white">
                    {drillResult.totalRequests.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-warning/20 flex items-center justify-center">
                  <Target className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">命中数</p>
                  <p className="text-2xl font-bold text-white">
                    {drillResult.hitCount.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">
                    命中率: {((drillResult.hitCount / drillResult.totalRequests) * 100).toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-danger/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-danger" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">拦截客户数</p>
                  <p className="text-2xl font-bold text-white">
                    {drillResult.blockedCustomers.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {drillResult.anomalies.length > 0 && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <h3 className="text-lg font-semibold text-white">
                  异常检测 ({drillResult.anomalies.length})
                </h3>
              </div>
              <div className="space-y-3">
                {drillResult.anomalies.map((anomaly) => (
                  <AnomalyAlert
                    key={anomaly.id}
                    anomaly={anomaly}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              命中结果 ({sortedHitResults.length})
            </h3>
            <p className="text-sm text-slate-400 mb-4">按客户优先级排序</p>
            {sortedHitResults.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
                <p className="text-slate-400">本次演练没有命中任何规则</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {sortedHitResults.map((hit) => (
                  <HitResultCard key={hit.id} hit={hit} />
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => setDrillResult(null)}
              className="px-6 py-2.5 rounded-lg bg-dark-200 text-white hover:bg-dark-300 transition-colors"
            >
              新建演练
            </button>
            <button
              onClick={handleGenerateReport}
              className="px-6 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              生成报告
            </button>
          </div>
        </>
      )}
    </div>
  );
}
