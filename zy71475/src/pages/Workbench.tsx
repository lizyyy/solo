import ParameterPanel from '@/components/ParameterPanel';
import FrequencyChart from '@/components/FrequencyChart';
import { useGuitarStore } from '@/store/useStore';
import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';

export default function Workbench() {
  const { records } = useGuitarStore();

  const comparableRecords = records.filter((r) => r.peaks.length > 0).slice(-5);

  return (
    <div className="flex h-full">
      <aside className="w-[360px] shrink-0 overflow-y-auto border-r border-stone-200 bg-[#FFFDF8] p-4">
        <ParameterPanel />
      </aside>
      <section className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-stone-800">频率对比</h2>
            <p className="text-sm text-stone-500">
              {comparableRecords.length > 0
                ? `当前显示 ${comparableRecords.length} 条有频率数据的记录`
                : '请先输入参数并计算，频率对比图将在此显示'}
            </p>
          </div>
          <Link
            to="/records"
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            查看全部记录
          </Link>
        </div>
        <FrequencyChart records={comparableRecords} />

        {comparableRecords.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-stone-700">最近频率数据</h3>
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-stone-500">记录名</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-stone-500">木材</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-stone-500">Helmholtz (Hz)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-stone-500">面板 n=1 (Hz)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-stone-500">面板 n=2 (Hz)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-stone-500">重叠</th>
                  </tr>
                </thead>
                <tbody>
                  {comparableRecords.map((r) => {
                    const helmholtz = r.peaks.find((p) => p.modeLabel === 'Helmholtz 共振');
                    const n1 = r.peaks.find((p) => p.modeLabel === '面板模态 n=1');
                    const n2 = r.peaks.find((p) => p.modeLabel === '面板模态 n=2');
                    const hasOverlap = r.peaks.some((p) => p.isOverlapping);
                    return (
                      <tr key={r.id} className="border-b border-stone-50 last:border-0">
                        <td className="px-4 py-2 text-stone-700">{r.name}</td>
                        <td className="px-4 py-2 text-stone-500">{r.parameters.wood.name}</td>
                        <td className="px-4 py-2 font-mono text-stone-700">{helmholtz?.frequency || '-'}</td>
                        <td className="px-4 py-2 font-mono text-stone-700">{n1?.frequency || '-'}</td>
                        <td className="px-4 py-2 font-mono text-stone-700">{n2?.frequency || '-'}</td>
                        <td className="px-4 py-2">
                          {hasOverlap ? (
                            <span className="text-orange-600">⚠ 有</span>
                          ) : (
                            <span className="text-emerald-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
