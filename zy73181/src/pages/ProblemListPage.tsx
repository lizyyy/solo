import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, RefreshCw } from 'lucide-react';
import StatCard from '@/components/StatCard';
import FilterBar from '@/components/FilterBar';
import BoundaryChart from '@/components/BoundaryChart';
import ProblemTable from '@/components/ProblemTable';
import ReviewDetailModal from '@/components/ReviewDetailModal';
import ExportModal from '@/components/ExportModal';
import { useAppStore } from '@/store/useAppStore';

export default function ProblemListPage() {
  const navigate = useNavigate();
  const {
    filterCriteria,
    setFilterCriteria,
    selectedProblemId,
    selectProblem,
    highlightedRowId,
    highlightRow,
    activeParamsGroup,
    reviewParamsA,
    reviewParamsB,
    reviewResultsA,
    reviewResultsB,
    grayReleaseNotes,
    setGrayReleaseNote,
    updateReviewParams,
    runAllReviews,
    getFilteredProblems,
    getReviewResult,
    getStatistics,
  } = useAppStore();

  const [showExport, setShowExport] = useState(false);

  const filteredProblems = useMemo(() => getFilteredProblems(), [getFilteredProblems, filterCriteria]);
  const reviewResults = activeParamsGroup === 'A' ? reviewResultsA : reviewResultsB;
  const statistics = getStatistics();

  const selectedProblem = useMemo(
    () => filteredProblems.find((p) => p.id === selectedProblemId) || null,
    [filteredProblems, selectedProblemId]
  );

  const handleChartClick = (problemId: string) => {
    highlightRow(problemId);
  };

  const handleRunAll = () => {
    runAllReviews(activeParamsGroup);
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-academic-100 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-academic-800">题目清单总览</h1>
            <p className="text-sm text-academic-500 mt-0.5">
              约束规划边界复核 · 当前显示
              <span className="mx-1 font-semibold text-academic-700">{statistics.total}</span>
              条题目
              <span className="mx-1.5 text-academic-300">|</span>
              参数组：
              <span className={`ml-1 font-semibold ${
                activeParamsGroup === 'A' ? 'text-academic-700' : 'text-amber-600'
              }`}>
                {activeParamsGroup}组
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunAll}
              className="btn-secondary flex items-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              重新复核全部
            </button>
            <button
              onClick={() => setShowExport(true)}
              className="btn-gold flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              导出报告
            </button>
          </div>
        </div>
      </header>

      <main className="p-8">
        <div className="grid grid-cols-5 gap-4 mb-6">
          <StatCard
            label="题目总数"
            value={statistics.total}
            variant="total"
            delay={1}
          />
          <StatCard
            label="复核正常"
            value={statistics.normal}
            total={statistics.total}
            variant="normal"
            delay={2}
          />
          <StatCard
            label="边界异常"
            value={statistics.abnormal}
            total={statistics.total}
            variant="abnormal"
            delay={3}
          />
          <StatCard
            label="单位问题"
            value={statistics.unitIssue}
            total={statistics.total}
            variant="unit"
            delay={4}
          />
          <StatCard
            label="待复核"
            value={statistics.pending}
            total={statistics.total}
            variant="pending"
            delay={5}
          />
        </div>

        <FilterBar criteria={filterCriteria} onChange={setFilterCriteria} />

        <div className="grid grid-cols-2 gap-6 mb-6">
          <BoundaryChart
            problems={filteredProblems}
            reviewResults={reviewResults}
            onPointClick={handleChartClick}
          />
          <div className="card-academic p-5 animate-fade-in stagger-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-academic-800">复核操作</h3>
              <span className="text-[11px] text-academic-500">算法值班人面板</span>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-academic-50 rounded-lg">
                <p className="text-xs font-semibold text-academic-700 mb-2">当前参数组</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] text-academic-500">容差值</p>
                    <p className="font-mono font-semibold text-academic-800">
                      {(activeParamsGroup === 'A' ? reviewParamsA : reviewParamsB).tolerance * 100}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-academic-500">边界系数</p>
                    <p className="font-mono font-semibold text-academic-800">
                      {(activeParamsGroup === 'A' ? reviewParamsA : reviewParamsB).boundaryMultiplier}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-academic-500">严格模式</p>
                    <p className={`font-semibold ${
                      (activeParamsGroup === 'A' ? reviewParamsA : reviewParamsB).strictMode
                        ? 'text-status-abnormal' : 'text-academic-600'
                    }`}>
                      {(activeParamsGroup === 'A' ? reviewParamsA : reviewParamsB).strictMode ? '已启用' : '未启用'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-academic-500">单位制</p>
                    <p className="font-semibold text-academic-700">
                      {(activeParamsGroup === 'A' ? reviewParamsA : reviewParamsB).unitSystem === 'metric'
                        ? '公制' : '英制'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs font-semibold text-amber-800 mb-1.5">演示数据提示</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  本页包含"不太干净"的演示数据：
                  <span className="font-semibold"> P-005、P-008</span> 存在单位缺失，
                  <span className="font-semibold"> P-006、P-009</span> 带有后补备注。
                  这些脏数据已独立标记，不会混入正常结果统计。
                </p>
                <button
                  onClick={() => navigate('/demo')}
                  className="mt-2 text-xs text-amber-700 hover:text-amber-900 font-medium underline"
                >
                  查看完整演示数据集 →
                </button>
              </div>

              <div className="pt-3 border-t border-academic-100 grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate('/review')}
                  className="btn-primary text-xs text-center"
                >
                  进入复核详情
                </button>
                <button
                  onClick={() => setShowExport(true)}
                  className="btn-secondary text-xs text-center"
                >
                  导出当前视图
                </button>
              </div>
            </div>
          </div>
        </div>

        <ProblemTable
          problems={filteredProblems}
          reviewResults={reviewResults}
          highlightedRowId={highlightedRowId}
          onSelectProblem={selectProblem}
          onHighlightRow={highlightRow}
        />
      </main>

      {selectedProblem && (
        <ReviewDetailModal
          problem={selectedProblem}
          paramsA={reviewParamsA}
          paramsB={reviewParamsB}
          grayNote={grayReleaseNotes[selectedProblem.id]}
          onClose={() => selectProblem(null)}
          onUpdateParams={updateReviewParams}
          onGrayNoteChange={(note) => setGrayReleaseNote(selectedProblem.id, note)}
        />
      )}

      {showExport && (
        <ExportModal
          problems={filteredProblems}
          reviewResults={reviewResults}
          filterCriteria={filterCriteria}
          activeGroup={activeParamsGroup}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
