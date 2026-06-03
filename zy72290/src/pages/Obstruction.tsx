import { Eye, CheckCircle2, AlertTriangle, RefreshCw, Play, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

const statusBadge = {
  normal: { label: '✓ 正常', className: 'bg-emerald-100 text-emerald-700' },
  pending_review: { label: '⚠ 待复核', className: 'bg-amber-100 text-amber-700' },
  supplemented: { label: '↻ 已补录', className: 'bg-sky-100 text-sky-700' },
};

export default function Obstruction() {
  const navigate = useNavigate();
  const {
    pointRecords,
    obstructionPoints,
    calculateObstructionPoints,
    selectedRecordId,
    setStep,
  } = useAppStore();

  useEffect(() => {
    if (selectedRecordId) {
      setStep(3);
    }
  }, [selectedRecordId, setStep]);

  useEffect(() => {
    if (obstructionPoints.length === 0) {
      calculateObstructionPoints();
    }
  }, [obstructionPoints.length, calculateObstructionPoints]);

  const getObstructionsByRecord = (recordId: string) => {
    return obstructionPoints.filter(o => o.recordId === recordId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">遮挡点清单</h2>
        <p className="text-slate-500 mt-1">第三步：根据安全半径和坐标数据计算遮挡点，查看处理结果</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-700 mb-4">三种场景处理结果对比</h3>
        <div className="grid grid-cols-3 gap-6">
          {pointRecords.map((record) => {
            const obstructions = getObstructionsByRecord(record.id);
            const obstructedCount = obstructions.filter(o => o.isObstructed).length;
            return (
              <div
                key={record.id}
                className={cn(
                  'rounded-xl p-5 border',
                  record.status === 'normal' && 'bg-emerald-50 border-emerald-200',
                  record.status === 'pending_review' && 'bg-amber-50 border-amber-200',
                  record.status === 'supplemented' && 'bg-sky-50 border-sky-200'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {record.status === 'normal' && <CheckCircle2 className="text-emerald-500" size={18} />}
                    {record.status === 'pending_review' && <AlertTriangle className="text-amber-500" size={18} />}
                    {record.status === 'supplemented' && <RefreshCw className="text-sky-500" size={18} />}
                    <span className="font-semibold text-slate-800">{record.pointCode}</span>
                  </div>
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', statusBadge[record.status].className)}>
                    {statusBadge[record.status].label}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-3">
                  {record.scenarioType === 'smooth' && '顺利通过：数据完整，所有坐标有效'}
                  {record.scenarioType === 'missing_row' && '待复核：照片有点位但坐标表缺一行，不归正常'}
                  {record.scenarioType === 'old_calibration' && '已补录：从坐标原点说明补录旧口径数据'}
                </p>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200/50">
                  <div>
                    <p className="text-xs text-slate-500">坐标行数</p>
                    <p className="text-lg font-bold text-slate-700">{record.coordinateRowCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">遮挡点数</p>
                    <p className={cn(
                      'text-lg font-bold',
                      obstructedCount > 0 ? 'text-red-600' : 'text-emerald-600'
                    )}>{obstructedCount}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="text-slate-600" size={20} />
            <h3 className="text-base font-semibold text-slate-800">遮挡点计算结果</h3>
          </div>
          <button
            onClick={calculateObstructionPoints}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 transition-colors"
          >
            <Play size={14} /> 重新计算
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">点位编号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">序号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">距原点距离 (m)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">是否遮挡</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">处理状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {obstructionPoints.map((point) => (
                <tr key={point.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {point.pointCode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    第 {point.rowIndex} 行
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {point.distance}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {point.isObstructed ? (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                        是（在安全半径内）
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                        否（超出安全半径）
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn('px-2 py-1 text-xs font-medium rounded-full', statusBadge[point.status].className)}>
                      {statusBadge[point.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-6 text-white">
        <h3 className="text-base font-semibold mb-4">结果说明</h3>
        <div className="grid grid-cols-3 gap-6 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="text-emerald-400" size={16} />
              <span className="font-medium text-emerald-400">正常通过</span>
            </div>
            <p className="text-slate-300">数据完整，照片点位与坐标表行数一致，遮挡点计算顺利完成。</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="text-amber-400" size={16} />
              <span className="font-medium text-amber-400">待安全员复核</span>
            </div>
            <p className="text-slate-300">照片有点位但坐标表缺一行，系统自动标记，不归正常，等待安全员确认。</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="text-sky-400" size={16} />
              <span className="font-medium text-sky-400">已补录</span>
            </div>
            <p className="text-slate-300">从坐标原点说明中找到旧口径基准，补录缺失数据后重新计算遮挡点。</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => navigate('/history')}
          className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
        >
          <History size={18} /> 查看历史记录
        </button>
      </div>
    </div>
  );
}
