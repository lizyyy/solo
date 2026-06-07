import { Link } from 'react-router-dom';
import { AlertTriangle, Eye, FileText, GitCompare } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { useAppStore } from '../store/useAppStore';

export default function AnomaliesPage() {
  const { getAnomalySamples, batches } = useAppStore();
  const anomalySamples = getAnomalySamples();

  const getBatchName = (batchId: string) => {
    return batches.find(b => b.id === batchId)?.name || batchId;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">异常概览</h1>
        <p className="text-stone-500 mt-1">所有"模型版本换了但样本编号没变"的样本</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-100">
          <p className="text-sm text-amber-700 font-medium">异常总数</p>
          <p className="text-3xl font-bold text-amber-900 mt-1">{anomalySamples.length}</p>
        </div>
        <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-xl p-5 border border-sky-100">
          <p className="text-sm text-sky-700 font-medium">待运营复核</p>
          <p className="text-3xl font-bold text-sky-900 mt-1">
            {anomalySamples.filter(s => s.status === 'pending_review').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-100">
          <p className="text-sm text-emerald-700 font-medium">已确认正常</p>
          <p className="text-3xl font-bold text-emerald-900 mt-1">
            {anomalySamples.filter(s => s.status === 'confirmed_normal').length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-stone-800">异常样本列表</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">样本编号</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">所属批次</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">版本变化</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">状态</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">留言</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-stone-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {anomalySamples.map((sample) => (
                <tr key={sample.id} className="border-b border-stone-50 hover:bg-amber-50/40 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-medium text-stone-800">{sample.sampleNo}</span>
                  </td>
                  <td className="py-3 px-4 text-sm text-stone-600">
                    {getBatchName(sample.batchId)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 text-sm">
                      <GitCompare className="w-4 h-4 text-amber-500" />
                      <span className="text-stone-600">
                        {sample.versions.map(v => v.modelVersion).join(' → ')}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={sample.status} isAnomaly={sample.isAnomaly} />
                  </td>
                  <td className="py-3 px-4 text-sm text-stone-500">
                    {sample.comments.length > 0 ? `${sample.comments.length} 条` : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/sample/${sample.id}`}
                        className="inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700 font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        详情
                      </Link>
                      <Link
                        to={`/review/${sample.id}`}
                        className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-stone-700"
                      >
                        <FileText className="w-4 h-4" />
                        复盘
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
