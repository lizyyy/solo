import { useState, useMemo } from 'react';
import { Download, FileText, FileJson } from 'lucide-react';
import { usePropStore } from '@/store';
import { generateCSVReport, generateJSONReport, downloadFile, statusLabel, entryTypeLabel } from '@/utils/report';

const statusColors: Record<string, string> = {
  borrowed: '#d4a843',
  returned: '#22c55e',
  on_stage: '#3b82f6',
  pending_review: '#f97316',
};

function fmt(iso: string) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString();
}

export default function Report() {
  const { borrowRecords, damageRecords, anomalies, props } = usePropStore();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const getPropName = (propId: string) => props.find((p) => p.id === propId)?.name || propId;
  const getPropCode = (propId: string) => props.find((p) => p.id === propId)?.code || '-';

  const unresolvedAnomalyIds = useMemo(
    () => new Set(anomalies.filter((a) => !a.resolved).map((a) => a.borrowRecordId)),
    [anomalies]
  );

  const stats = useMemo(() => {
    const total = borrowRecords.length;
    const normal = borrowRecords.filter(
      (r) =>
        ['borrowed', 'returned', 'on_stage'].includes(r.status) &&
        !unresolvedAnomalyIds.has(r.id)
    ).length;
    const anomaly = borrowRecords.filter((r) => unresolvedAnomalyIds.has(r.id)).length;
    const pendingReview = borrowRecords.filter((r) => r.status === 'pending_review').length;
    return { total, normal, anomaly, pendingReview };
  }, [borrowRecords, unresolvedAnomalyIds]);

  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = { borrowed: 0, returned: 0, on_stage: 0, pending_review: 0 };
    borrowRecords.forEach((r) => {
      if (counts[r.status] !== undefined) counts[r.status]++;
    });
    return counts;
  }, [borrowRecords]);

  const sceneDistribution = useMemo(() => {
    const map = new Map<string, number>();
    borrowRecords.forEach((r) => {
      map.set(r.sceneNumber, (map.get(r.sceneNumber) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'zh'));
  }, [borrowRecords]);

  const getRecordDamages = (recordId: string) =>
    damageRecords.filter((d) => d.borrowRecordId === recordId);

  const getRecordAnomalies = (recordId: string) =>
    anomalies.filter((a) => a.borrowRecordId === recordId && !a.resolved);

  const getConclusion = (record: (typeof borrowRecords)[number]) => {
    if (record.status === 'pending_review') return '待复核';
    if (unresolvedAnomalyIds.has(record.id)) return '异常';
    return '正常';
  };

  const filteredRecords = useMemo(() => {
    return borrowRecords.filter((r) => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        const propName = getPropName(r.propId).toLowerCase();
        const propCode = getPropCode(r.propId).toLowerCase();
        return (
          propName.includes(q) ||
          propCode.includes(q) ||
          r.sceneNumber.toLowerCase().includes(q) ||
          r.borrower.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [borrowRecords, filterStatus, search]);

  const handleExportCSV = () => {
    const content = generateCSVReport(props, borrowRecords, damageRecords, anomalies);
    const filename = `剧场道具报告_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadFile(content, filename, 'text/csv');
  };

  const handleExportJSON = () => {
    const content = generateJSONReport(props, borrowRecords, damageRecords, anomalies);
    const filename = `剧场道具报告_${new Date().toISOString().slice(0, 10)}.json`;
    downloadFile(content, filename, 'application/json');
  };

  const totalForBar = Object.values(statusDistribution).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-gray-200 p-6 space-y-8">
      <h1 className="text-2xl font-bold text-white">库存报告</h1>

      {/* Summary Statistics */}
      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-300">概览统计</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="总记录数" value={stats.total} color="#d4a843" />
          <StatCard label="正常" value={stats.normal} color="#22c55e" />
          <StatCard label="异常" value={stats.anomaly} color="#ef4444" />
          <StatCard label="待复核" value={stats.pendingReview} color="#f97316" />
        </div>

        {/* Status Distribution Bar */}
        <div className="bg-[#1e1e32] rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-400">状态分布</h3>
          <div className="flex h-8 rounded overflow-hidden">
            {Object.entries(statusDistribution).map(([status, count]) => {
              if (count === 0) return null;
              const pct = (count / totalForBar) * 100;
              return (
                <div
                  key={status}
                  className="flex items-center justify-center text-xs font-medium text-white whitespace-nowrap"
                  style={{ width: `${pct}%`, backgroundColor: statusColors[status] }}
                  title={`${statusLabel(status)}: ${count}`}
                >
                  {pct > 8 ? `${statusLabel(status)} ${count}` : count}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-400">
            {Object.entries(statusDistribution).map(([status, count]) => (
              <span key={status} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: statusColors[status] }}
                />
                {statusLabel(status)}: {count}
              </span>
            ))}
          </div>
        </div>

        {/* Scene Distribution */}
        <div className="bg-[#1e1e32] rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-400">场次分布</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 text-gray-400 font-medium">场次</th>
                <th className="text-right py-2 text-gray-400 font-medium">记录数</th>
              </tr>
            </thead>
            <tbody>
              {sceneDistribution.map(([scene, count]) => (
                <tr key={scene} className="border-b border-gray-800">
                  <td className="py-2">{scene}</td>
                  <td className="py-2 text-right">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detail Table */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-300">详细记录</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="搜索道具名称、编号、场次、借用人…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-[#1e1e32] border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#d4a843]"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#1e1e32] border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#d4a843]"
          >
            <option value="all">全部状态</option>
            <option value="borrowed">借出</option>
            <option value="returned">已返库</option>
            <option value="on_stage">舞台上</option>
            <option value="pending_review">待复核</option>
          </select>
        </div>

        <div className="overflow-x-auto bg-[#1e1e32] rounded-lg">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-left py-3 px-3 font-medium">道具名称</th>
                <th className="text-left py-3 px-3 font-medium">编号</th>
                <th className="text-left py-3 px-3 font-medium">场次</th>
                <th className="text-left py-3 px-3 font-medium">借用人</th>
                <th className="text-left py-3 px-3 font-medium">借出时间</th>
                <th className="text-left py-3 px-3 font-medium">预计返库</th>
                <th className="text-left py-3 px-3 font-medium">实际返库</th>
                <th className="text-left py-3 px-3 font-medium">状态</th>
                <th className="text-left py-3 px-3 font-medium">录入类型</th>
                <th className="text-left py-3 px-3 font-medium">原始借出时间</th>
                <th className="text-left py-3 px-3 font-medium">原始返库时间</th>
                <th className="text-left py-3 px-3 font-medium">损伤</th>
                <th className="text-left py-3 px-3 font-medium">异常</th>
                <th className="text-left py-3 px-3 font-medium">结论</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => {
                const dmg = getRecordDamages(r.id);
                const anom = getRecordAnomalies(r.id);
                const conclusion = getConclusion(r);
                const isWithdrawn = r.isWithdrawn;
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-gray-800 hover:bg-[#2a2a44] ${
                      isWithdrawn ? 'opacity-40 line-through' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3">{getPropName(r.propId)}</td>
                    <td className="py-2.5 px-3">{getPropCode(r.propId)}</td>
                    <td className="py-2.5 px-3">{r.sceneNumber}</td>
                    <td className="py-2.5 px-3">{r.borrower}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{fmt(r.borrowTime)}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{fmt(r.expectedReturnTime)}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{fmt(r.actualReturnTime)}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: statusColors[r.status] + '33', color: statusColors[r.status] }}
                      >
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">{entryTypeLabel(r.entryType)}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {r.originalBorrowTime ? fmt(r.originalBorrowTime) : '-'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {r.originalReturnTime ? fmt(r.originalReturnTime) : '-'}
                    </td>
                    <td className="py-2.5 px-3 max-w-[150px]">
                      {dmg.length > 0 ? (
                        <span className="text-red-400 text-xs">
                          {dmg.map((d) => d.description).join('; ')}
                        </span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 max-w-[200px]">
                      {anom.length > 0 ? (
                        <span className="text-orange-400 text-xs">
                          {anom.map((a) => a.message).join('; ')}
                        </span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-xs font-medium ${
                          conclusion === '正常'
                            ? 'text-green-400'
                            : conclusion === '异常'
                              ? 'text-red-400'
                              : 'text-orange-400'
                        }`}
                      >
                        {conclusion}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={14} className="py-8 text-center text-gray-500">
                    暂无匹配记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Export Section */}
      <section className="bg-[#1e1e32] rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-300">导出报告</h2>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-[#d4a843] hover:bg-[#c49a38] text-black font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            <Download size={18} />
            <FileText size={18} />
            导出 CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 bg-[#d4a843] hover:bg-[#c49a38] text-black font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            <Download size={18} />
            <FileJson size={18} />
            导出 JSON
          </button>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[#1e1e32] rounded-lg p-4 space-y-1">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
