import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Download, CheckCircle2, AlertTriangle, FileWarning, Clock, FileText } from 'lucide-react';
import ExportModal from '@/components/ExportModal';
import { useAppStore } from '@/store/useAppStore';
import { generateFilterSummary, findProblematicRows, reviewStatusLabel, difficultyLabel, constraintTypeLabel } from '@/services/filterService';
import { exportToCSV, exportToExcel } from '@/services/exportService';

export default function ExportPage() {
  const navigate = useNavigate();
  const {
    problems,
    reviewResultsA,
    reviewResultsB,
    activeParamsGroup,
    setActiveParamsGroup,
    filterCriteria,
    getFilteredProblems,
  } = useAppStore();

  const [showModal, setShowModal] = useState(false);

  const filteredProblems = useMemo(() => getFilteredProblems(), [getFilteredProblems]);
  const results = activeParamsGroup === 'A' ? reviewResultsA : reviewResultsB;
  const filterSummary = generateFilterSummary(filterCriteria);
  const problematicRows = findProblematicRows(filteredProblems, results);

  const stats = useMemo(() => {
    return {
      total: filteredProblems.length,
      normal: filteredProblems.filter((p) => p.reviewStatus === 'normal').length,
      abnormal: filteredProblems.filter((p) => p.reviewStatus === 'abnormal').length,
      unitIssue: filteredProblems.filter((p) => p.hasUnitIssue).length,
      pending: filteredProblems.filter((p) => p.reviewStatus === 'pending').length,
    };
  }, [filteredProblems]);

  const handleExportCSV = () => {
    exportToCSV({
      problems: filteredProblems,
      reviewResults: results,
      filterCriteria,
      groupId: activeParamsGroup,
    });
  };

  const handleExportExcel = () => {
    exportToExcel({
      problems: filteredProblems,
      reviewResults: results,
      filterCriteria,
      groupId: activeParamsGroup,
    });
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-academic-100 px-8 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-academic-50 rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-academic-500" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-academic-800 flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-amber-500" />
              导出报告中心
            </h1>
            <p className="text-sm text-academic-500 mt-0.5">
              导出数据与屏幕数字完全一致 · 附筛选口径说明 · 问题行定位标记
            </p>
          </div>
        </div>
      </header>

      <main className="p-8 max-w-5xl mx-auto">
        <div className="card-academic p-6 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-semibold text-lg text-academic-800">报告摘要预览</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-academic-500">参数组：</span>
              <div className="flex rounded-md overflow-hidden border border-academic-200">
                <button
                  onClick={() => setActiveParamsGroup('A')}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    activeParamsGroup === 'A'
                      ? 'bg-academic-600 text-white'
                      : 'bg-white text-academic-600 hover:bg-academic-50'
                  }`}
                >
                  A组
                </button>
                <button
                  onClick={() => setActiveParamsGroup('B')}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    activeParamsGroup === 'B'
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-academic-600 hover:bg-academic-50'
                  }`}
                >
                  B组
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-4 mb-5">
            <SummaryStat icon={FileSpreadsheet} label="总数" value={stats.total} tone="academic" />
            <SummaryStat icon={CheckCircle2} label="正常" value={stats.normal} tone="normal" />
            <SummaryStat icon={AlertTriangle} label="异常" value={stats.abnormal} tone="abnormal" />
            <SummaryStat icon={FileWarning} label="单位问题" value={stats.unitIssue} tone="unit" />
            <SummaryStat icon={Clock} label="待复核" value={stats.pending} tone="pending" />
          </div>

          <div className="bg-academic-50 rounded-lg p-4 mb-5">
            <div className="flex items-start gap-2 mb-2">
              <FileText className="w-4 h-4 text-academic-500 mt-0.5" />
              <p className="text-xs font-semibold text-academic-700">筛选口径（将附在导出文件中）</p>
            </div>
            <p className="font-mono text-sm text-academic-800 bg-white px-3 py-2 rounded border border-academic-100">
              {filterSummary}
            </p>
          </div>

          {problematicRows.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-status-abnormal" />
                <p className="text-xs font-semibold text-status-abnormal">
                  问题行定位（按偏差降序，报告中标注哪一行拖偏了整体结果）
                </p>
              </div>
              <div className="space-y-2">
                {problematicRows.map((row) => (
                  <div
                    key={row.problemId}
                    className="flex items-center justify-between py-2.5 px-4 bg-status-abnormal/5 rounded-lg border border-status-abnormal/20"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-status-abnormal bg-status-abnormal/10 px-2.5 py-1 rounded">
                        行 #{row.rowNumber}
                      </span>
                      <span className="font-mono text-xs text-academic-500">{row.problemId}</span>
                      <span className="text-sm text-academic-700">{row.title}</span>
                    </div>
                    <span className="font-mono text-sm text-status-abnormal font-bold">
                      偏差 {(row.deviation * 100).toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.unitIssue > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <FileWarning className="w-4 h-4 text-status-unit" />
                <p className="text-xs font-semibold text-status-unit">
                  单位缺失记录（导出时独立展示，不混入正常结果）
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {filteredProblems
                  .filter((p) => p.hasUnitIssue)
                  .map((p) => (
                    <span
                      key={p.id}
                      className="font-mono text-xs text-status-unit bg-status-unit/10 border border-status-unit/30 px-2.5 py-1 rounded"
                    >
                      {p.id} · 行 #{p.originalRow} · {p.title.slice(0, 15)}...
                    </span>
                  ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-academic-100">
            <p className="text-xs font-semibold text-academic-700 mb-3">选择导出格式</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-4 p-5 border-2 border-academic-100 rounded-xl hover:border-green-400 hover:bg-green-50/50 transition-all group"
              >
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <FileText className="w-6 h-6 text-green-700" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-academic-800">CSV 格式</p>
                  <p className="text-xs text-academic-500 mt-0.5">通用纯文本格式，兼容 Excel/Numbers 等所有工具</p>
                </div>
                <Download className="w-5 h-5 text-academic-400 group-hover:text-green-600 transition-colors" />
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-4 p-5 border-2 border-academic-100 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
              >
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <FileSpreadsheet className="w-6 h-6 text-blue-700" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-academic-800">Excel (xlsx) 格式</p>
                  <p className="text-xs text-academic-500 mt-0.5">多 Sheet：报告摘要 / 题目明细 / 单位问题</p>
                </div>
                <Download className="w-5 h-5 text-academic-400 group-hover:text-blue-600 transition-colors" />
              </button>
            </div>
          </div>
        </div>

        <div className="card-academic p-6 animate-fade-in stagger-2">
          <h2 className="font-display font-semibold text-lg text-academic-800 mb-4">数据预览（前 5 条）</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-academic-600 font-semibold bg-academic-50">
                  <th className="px-4 py-2.5">编号</th>
                  <th className="px-4 py-2.5">行号</th>
                  <th className="px-4 py-2.5">题干</th>
                  <th className="px-4 py-2.5">约束类型</th>
                  <th className="px-4 py-2.5">难度</th>
                  <th className="px-4 py-2.5 text-right">边界值</th>
                  <th className="px-4 py-2.5">单位</th>
                  <th className="px-4 py-2.5">状态</th>
                  <th className="px-4 py-2.5 text-right">偏差</th>
                </tr>
              </thead>
              <tbody>
                {filteredProblems.slice(0, 5).map((p) => {
                  const r = results.find((x) => x.problemId === p.id);
                  return (
                    <tr key={p.id} className="border-b border-academic-50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-academic-700">{p.id}</td>
                      <td className="px-4 py-3 text-xs text-academic-500">{p.originalRow}</td>
                      <td className="px-4 py-3 text-academic-800 max-w-[200px] truncate">{p.title}</td>
                      <td className="px-4 py-3 text-xs text-academic-600">{constraintTypeLabel(p.constraintType)}</td>
                      <td className="px-4 py-3">{difficultyLabel(p.difficulty)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-academic-800">
                        {p.boundaryValue ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {p.boundaryUnit ? (
                          <span className="font-mono text-xs text-academic-700">{p.boundaryUnit}</span>
                        ) : (
                          <span className="text-xs text-status-unit font-semibold">缺失</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`tag-${
                          p.reviewStatus === 'normal' ? 'normal' :
                          p.reviewStatus === 'abnormal' ? 'abnormal' :
                          p.reviewStatus === 'unit_issue' ? 'unit' : 'pending'
                        }`}>
                          {reviewStatusLabel(p.reviewStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                        {r && r.status !== 'unit_issue' ? (
                          <span className={r.deviation > 0.05 ? 'text-status-abnormal font-semibold' : 'text-academic-700'}>
                            {(r.deviation * 100).toFixed(2)}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-academic-500 mt-3 text-center">
            ... 还有 {Math.max(0, filteredProblems.length - 5)} 条数据将被完整导出
          </p>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setShowModal(true)}
            className="btn-gold px-6 py-2.5 text-sm flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            打开完整导出预览
          </button>
        </div>
      </main>

      {showModal && (
        <ExportModal
          problems={filteredProblems}
          reviewResults={results}
          filterCriteria={filterCriteria}
          activeGroup={activeParamsGroup}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

function SummaryStat({
  icon: Icon, label, value, tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone: 'academic' | 'normal' | 'abnormal' | 'unit' | 'pending';
}) {
  const toneClasses: Record<string, string> = {
    academic: 'text-academic-600 bg-academic-50',
    normal: 'text-status-normal bg-status-normal/10',
    abnormal: 'text-status-abnormal bg-status-abnormal/10',
    unit: 'text-status-unit bg-status-unit/10',
    pending: 'text-status-pending bg-status-pending/10',
  };

  return (
    <div className={`${toneClasses[tone]} rounded-lg p-4 text-center`}>
      <Icon className="w-5 h-5 mx-auto mb-2 opacity-70" />
      <p className="text-2xl font-display font-bold tabular-nums">{value}</p>
      <p className="text-xs mt-0.5">{label}</p>
    </div>
  );
}
