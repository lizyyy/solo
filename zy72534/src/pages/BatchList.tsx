import { Link } from 'react-router-dom';
import { Eye, FileText } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { useAppStore } from '../store/useAppStore';
import { formatDate } from '../utils/formatters';

export default function BatchList() {
  const { batches, samples } = useAppStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">批次列表</h1>
        <p className="text-stone-500 mt-1">所有导入的灰度批次</p>
      </div>

      <div className="space-y-4">
        {batches.map((batch) => {
          const batchSamples = samples.filter(s => s.batchId === batch.id);
          return (
            <div key={batch.id} className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-stone-800 text-lg">{batch.name}</h3>
                  <p className="text-sm text-stone-500 mt-1">
                    导入时间：{formatDate(batch.importTime)} · 模型版本：{batch.modelVersion}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-stone-800">{batch.totalSamples}</p>
                    <p className="text-xs text-stone-500">样本数</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${batch.anomalyCount > 0 ? 'text-amber-600' : 'text-stone-400'}`}>
                      {batch.anomalyCount}
                    </p>
                    <p className="text-xs text-stone-500">异常</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-stone-100 pt-4">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-stone-100">
                        <th className="text-left py-2 px-3 text-xs font-medium text-stone-500">样本编号</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-stone-500">模型版本</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-stone-500">状态</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-stone-500">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchSamples.map((sample) => (
                        <tr
                          key={sample.id}
                          className={`border-b border-stone-50 transition-colors ${
                            sample.isAnomaly ? 'bg-amber-50/40' : 'hover:bg-stone-50'
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              {sample.isAnomaly && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              )}
                              <span className="font-medium text-sm text-stone-800">{sample.sampleNo}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-stone-600">
                            {sample.versions.map(v => v.modelVersion).join(' → ')}
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusBadge status={sample.status} isAnomaly={sample.isAnomaly} />
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-3">
                              <Link
                                to={`/sample/${sample.id}`}
                                className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                详情
                              </Link>
                              <Link
                                to={`/review/${sample.id}`}
                                className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-700"
                              >
                                <FileText className="w-3.5 h-3.5" />
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
        })}
      </div>
    </div>
  );
}
