import { useState } from 'react';
import { History, ArrowLeftRight, ChevronDown } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { cn } from '../utils/cn';

export default function HistoryCompare() {
  const { batches, results, records, thresholds, compareBatches } = useAppStore();
  
  const [batchIdA, setBatchIdA] = useState<string>('');
  const [batchIdB, setBatchIdB] = useState<string>('');
  const [showDropdownA, setShowDropdownA] = useState(false);
  const [showDropdownB, setShowDropdownB] = useState(false);

  const comparison = batchIdA && batchIdB ? compareBatches(batchIdA, batchIdB) : null;

  const getBatchThreshold = (batchId: string) => {
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return null;
    return thresholds.find(t => t.id === batch.thresholdVersionId);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'danger': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-amber-600 bg-amber-50 border-amber-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'danger': return '危险';
      case 'warning': return '预警';
      default: return '正常';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <History className="w-6 h-6 text-slate-700" />
        <h1 className="text-xl font-bold text-slate-800">历史批次对比</h1>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="relative">
          <label className="block text-sm font-medium text-slate-600 mb-2">选择批次 A</label>
          <button
            onClick={() => { setShowDropdownA(!showDropdownA); setShowDropdownB(false); }}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-left flex items-center justify-between hover:border-blue-400 transition-colors"
          >
            <span className={batchIdA ? 'text-slate-800' : 'text-slate-400'}>
              {batches.find(b => b.id === batchIdA)?.name || '请选择批次'}
            </span>
            <ChevronDown className={cn('w-5 h-5 transition-transform', showDropdownA && 'rotate-180')} />
          </button>
          {showDropdownA && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {batches.length === 0 ? (
                <div className="p-3 text-sm text-slate-500 text-center">暂无批次</div>
              ) : (
                batches.map(batch => (
                  <div
                    key={batch.id}
                    onClick={() => { setBatchIdA(batch.id); setShowDropdownA(false); }}
                    className={cn(
                      'px-4 py-2 cursor-pointer hover:bg-slate-50',
                      batch.id === batchIdA && 'bg-blue-50 text-blue-600'
                    )}
                  >
                    <div className="font-medium text-sm">{batch.name}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(batch.createdAt).toLocaleString('zh-CN')} · {batch.recordCount}条
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-slate-600 mb-2">选择批次 B</label>
          <button
            onClick={() => { setShowDropdownB(!showDropdownB); setShowDropdownA(false); }}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-left flex items-center justify-between hover:border-blue-400 transition-colors"
          >
            <span className={batchIdB ? 'text-slate-800' : 'text-slate-400'}>
              {batches.find(b => b.id === batchIdB)?.name || '请选择批次'}
            </span>
            <ChevronDown className={cn('w-5 h-5 transition-transform', showDropdownB && 'rotate-180')} />
          </button>
          {showDropdownB && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {batches.length === 0 ? (
                <div className="p-3 text-sm text-slate-500 text-center">暂无批次</div>
              ) : (
                batches.map(batch => (
                  <div
                    key={batch.id}
                    onClick={() => { setBatchIdB(batch.id); setShowDropdownB(false); }}
                    className={cn(
                      'px-4 py-2 cursor-pointer hover:bg-slate-50',
                      batch.id === batchIdB && 'bg-blue-50 text-blue-600'
                    )}
                  >
                    <div className="font-medium text-sm">{batch.name}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(batch.createdAt).toLocaleString('zh-CN')} · {batch.recordCount}条
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {comparison && comparison.batchA && comparison.batchB && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">批次 A · {comparison.batchA.name}</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p>创建时间：{new Date(comparison.batchA.createdAt).toLocaleString('zh-CN')}</p>
                <p>阈值版本：{getBatchThreshold(comparison.batchA.id)?.version}</p>
                <p>记录数量：{comparison.batchA.recordCount}条</p>
                <p>处理人：{comparison.batchA.createdBy}</p>
              </div>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <h3 className="font-semibold text-emerald-800 mb-2">批次 B · {comparison.batchB.name}</h3>
              <div className="text-sm text-emerald-700 space-y-1">
                <p>创建时间：{new Date(comparison.batchB.createdAt).toLocaleString('zh-CN')}</p>
                <p>阈值版本：{getBatchThreshold(comparison.batchB.id)?.version}</p>
                <p>记录数量：{comparison.batchB.recordCount}条</p>
                <p>处理人：{comparison.batchB.createdBy}</p>
              </div>
            </div>
          </div>

          {comparison.batchA.paramsSnapshot && comparison.batchB.paramsSnapshot && (
            <div className="p-4 bg-slate-50 rounded-lg">
              <h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4" />
                参数差异对比
              </h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">传热系数 k：</span>
                  <span className={comparison.batchA.paramsSnapshot.heatTransferCoeff !== comparison.batchB.paramsSnapshot.heatTransferCoeff ? 'text-amber-600 font-medium' : ''}>
                    {comparison.batchA.paramsSnapshot.heatTransferCoeff} → {comparison.batchB.paramsSnapshot.heatTransferCoeff}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">开门系数 f：</span>
                  <span className={comparison.batchA.paramsSnapshot.openingTimeFactor !== comparison.batchB.paramsSnapshot.openingTimeFactor ? 'text-amber-600 font-medium' : ''}>
                    {comparison.batchA.paramsSnapshot.openingTimeFactor} → {comparison.batchB.paramsSnapshot.openingTimeFactor}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">空气密度 ρ：</span>
                  <span className={comparison.batchA.paramsSnapshot.airDensity !== comparison.batchB.paramsSnapshot.airDensity ? 'text-amber-600 font-medium' : ''}>
                    {comparison.batchA.paramsSnapshot.airDensity} → {comparison.batchB.paramsSnapshot.airDensity}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
              <h4 className="font-medium text-slate-700">计算结果对比</h4>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">位置</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">批次 A 结果</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">批次 B 结果</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">差值</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">批次 A 等级</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">批次 B 等级</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {comparison.resultsA.map((resultA, idx) => {
                    const record = records.find(r => r.id === resultA.recordId);
                    const resultB = comparison.resultsB[idx];
                    const diff = resultB ? resultB.heatLossValue - resultA.heatLossValue : 0;
                    
                    return (
                      <tr key={resultA.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-800">{record?.location}</td>
                        <td className="px-4 py-2 text-slate-600 font-mono">
                          {resultA.heatLossValue} {resultA.unit}
                        </td>
                        <td className="px-4 py-2 text-slate-600 font-mono">
                          {resultB ? `${resultB.heatLossValue} ${resultB.unit}` : '—'}
                        </td>
                        <td className={cn(
                          'px-4 py-2 font-mono',
                          diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-slate-400'
                        )}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                        </td>
                        <td className="px-4 py-2">
                          <span className={cn('px-2 py-0.5 text-xs rounded-full border', getRiskColor(resultA.riskLevel))}>
                            {getRiskLabel(resultA.riskLevel)}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          {resultB && (
                            <span className={cn('px-2 py-0.5 text-xs rounded-full border', getRiskColor(resultB.riskLevel))}>
                              {getRiskLabel(resultB.riskLevel)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {batches.length === 0 && (
        <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-lg">
          <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">暂无历史批次</p>
          <p className="text-sm text-slate-400 mt-1">先在计算面板执行核算，生成批次后再进行对比</p>
        </div>
      )}
    </div>
  );
}
