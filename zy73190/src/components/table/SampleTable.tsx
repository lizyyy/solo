import { useMemo } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { SampleRow } from './SampleRow';
import { downloadCSV } from '@/utils/exporter';
import { recalculateAllSamples } from '@/utils/calculator';

export function SampleTable() {
  const paramVersions = useAppStore((state) => state.paramVersions);
  const currentParamVersionId = useAppStore((state) => state.currentParamVersionId);
  const allSamples = useAppStore((state) => state.samples);
  const notes = useAppStore((state) => state.notes);
  const filters = useAppStore((state) => state.filters);
  const selectedSampleId = useAppStore((state) => state.selectedSampleId);
  const setSelectedSample = useAppStore((state) => state.setSelectedSample);

  const currentVersion = useMemo(
    () => paramVersions.find((v) => v.id === currentParamVersionId),
    [paramVersions, currentParamVersionId]
  );

  const filteredSamples = useMemo(() => {
    return allSamples.filter((sample) => {
      if (filters.status.length > 0 && !filters.status.includes(sample.status)) {
        return false;
      }
      if (
        filters.sampleCode &&
        !sample.sampleCode.toLowerCase().includes(filters.sampleCode.toLowerCase())
      ) {
        return false;
      }
      if (filters.dateRange) {
        const sampleDate = new Date(sample.createdAt);
        const startDate = new Date(filters.dateRange[0]);
        const endDate = new Date(filters.dateRange[1]);
        if (sampleDate < startDate || sampleDate > endDate) {
          return false;
        }
      }
      return true;
    });
  }, [allSamples, filters]);

  const handleExport = () => {
    if (!currentVersion) return;
    downloadCSV(filteredSamples, notes, currentVersion, filters);
  };

  const handleRecalculate = () => {
    if (!currentVersion) return;
    const recalculated = recalculateAllSamples(allSamples, currentVersion);
    useAppStore.setState({ samples: recalculated });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">批量验算结果</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            共 {filteredSamples.length} 条记录 · 点击行可展开详情
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRecalculate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw size={14} />
            重新验算
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Download size={14} />
            导出当前筛选结果
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
              <th className="whitespace-nowrap px-4 py-2.5 text-left">样本编号</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left">递推序列</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left">预期值</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left">计算值</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left">偏差</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left">状态</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left">重复关联</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left">更新时间</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-left">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSamples.length > 0 ? (
              filteredSamples.map((sample, index) => (
                <SampleRow
                  key={sample.id}
                  sample={sample}
                  index={index}
                  isSelected={selectedSampleId === sample.id}
                  onSelect={() => setSelectedSample(sample.id)}
                />
              ))
            ) : (
              <tr>
                <td colSpan={9} className="py-12 text-center text-sm text-slate-400">
                  当前筛选条件下无数据，请调整筛选条件
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            导出口径说明：导出文件包含当前筛选的 {filteredSamples.length} 条记录，含完整备注摘要、异常痕迹和计算口径
          </span>
          <span>文件名格式：数列递推验算_{currentVersion?.id || 'v1.1'}_YYYYMMDD.csv</span>
        </div>
      </div>
    </div>
  );
}
