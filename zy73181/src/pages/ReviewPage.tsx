import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Scale, Settings2 } from 'lucide-react';
import ReviewDetailModal from '@/components/ReviewDetailModal';
import StatCard from '@/components/StatCard';
import { useAppStore } from '@/store/useAppStore';
import { difficultyLabel, constraintTypeLabel, reviewStatusLabel } from '@/services/filterService';

export default function ReviewPage() {
  const navigate = useNavigate();
  const {
    problems,
    reviewParamsA,
    reviewParamsB,
    reviewResultsA,
    reviewResultsB,
    activeParamsGroup,
    setActiveParamsGroup,
    grayReleaseNotes,
    setGrayReleaseNote,
    updateReviewParams,
    selectProblem,
    selectedProblemId,
    runReview,
    runAllReviews,
    getStatistics,
    getReviewResult,
  } = useAppStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const statistics = getStatistics();
  const results = activeParamsGroup === 'A' ? reviewResultsA : reviewResultsB;

  const selectedProblem = useMemo(
    () => problems.find((p) => p.id === selectedId) || null,
    [problems, selectedId]
  );

  const handleRunSingle = (id: string) => {
    runReview(id, activeParamsGroup);
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
          <div>
            <h1 className="font-display text-2xl font-bold text-academic-800">边界复核工作台</h1>
            <p className="text-sm text-academic-500 mt-0.5">
              两组参数对照 · 中间计算过程透明化 · 单位问题独立标记
            </p>
          </div>
        </div>
      </header>

      <main className="p-8">
        <div className="grid grid-cols-5 gap-4 mb-6">
          <StatCard label="总数" value={statistics.total} variant="total" delay={1} />
          <StatCard label="正常" value={statistics.normal} total={statistics.total} variant="normal" delay={2} />
          <StatCard label="异常" value={statistics.abnormal} total={statistics.total} variant="abnormal" delay={3} />
          <StatCard label="单位问题" value={statistics.unitIssue} total={statistics.total} variant="unit" delay={4} />
          <StatCard label="待复核" value={statistics.pending} total={statistics.total} variant="pending" delay={5} />
        </div>

        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="col-span-1">
            <div className="card-academic p-5 animate-fade-in stagger-1">
              <div className="flex items-center gap-2 mb-4">
                <Settings2 className="w-4 h-4 text-academic-500" />
                <h3 className="font-display font-semibold text-academic-800">参数组选择</h3>
              </div>
              <div className="space-y-3">
                {(['A', 'B'] as const).map((g) => {
                  const params = g === 'A' ? reviewParamsA : reviewParamsB;
                  const isActive = activeParamsGroup === g;
                  return (
                    <button
                      key={g}
                      onClick={() => setActiveParamsGroup(g)}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        isActive
                          ? 'border-academic-600 bg-academic-50 shadow-academic'
                          : 'border-academic-100 hover:border-academic-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-bold ${
                          isActive ? 'text-academic-700' : 'text-academic-500'
                        }`}>
                          {g}组参数
                        </span>
                        {isActive && (
                          <span className="text-[10px] bg-academic-600 text-white px-2 py-0.5 rounded-full">
                            当前
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-academic-600">
                        <span>容差: <b>{params.tolerance * 100}%</b></span>
                        <span>系数: <b>{params.boundaryMultiplier}</b></span>
                        <span>单位: <b>{params.unitSystem === 'metric' ? '公制' : '英制'}</b></span>
                        <span>严格: <b>{params.strictMode ? '是' : '否'}</b></span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => runAllReviews(activeParamsGroup)}
                className="w-full btn-primary mt-4 flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                运行{activeParamsGroup}组全部复核
              </button>
            </div>

            <div className="card-academic p-5 mt-4 animate-fade-in stagger-2">
              <div className="flex items-center gap-2 mb-3">
                <Scale className="w-4 h-4 text-amber-500" />
                <h3 className="font-display font-semibold text-academic-800">单位校验说明</h3>
              </div>
              <ul className="space-y-2 text-xs text-academic-600">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-unit mt-1.5" />
                  <span>单位缺失：紫色标记，不混入正常结果统计</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-abnormal mt-1.5" />
                  <span>单位不匹配：无法换算的单位组合</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-normal mt-1.5" />
                  <span>单位换算：中间计算过程透明展示换算系数</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="col-span-2">
            <div className="card-academic overflow-hidden animate-fade-in stagger-3">
              <div className="px-5 py-4 border-b border-academic-100">
                <h3 className="font-display font-semibold text-academic-800">
                  题目列表 · {activeParamsGroup}组复核结果
                </h3>
                <p className="text-xs text-academic-500 mt-0.5">
                  点击任意题目查看详细复核过程，含两组参数对照
                </p>
              </div>
              <div className="overflow-y-auto max-h-[600px] scrollbar-thin">
                <table className="w-full text-sm">
                  <thead className="bg-academic-50 sticky top-0 z-10">
                    <tr className="text-left text-xs text-academic-600 font-semibold">
                      <th className="px-4 py-3">编号</th>
                      <th className="px-4 py-3">题干</th>
                      <th className="px-4 py-3 w-20">难度</th>
                      <th className="px-4 py-3 w-20">状态</th>
                      <th className="px-4 py-3 w-16">偏差</th>
                      <th className="px-4 py-3 w-20 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {problems.map((p, idx) => {
                      const r = results.find((x) => x.problemId === p.id);
                      return (
                        <tr
                          key={p.id}
                          className={`border-b border-academic-50 hover:bg-academic-50/50 transition-colors ${
                            p.hasUnitIssue ? 'bg-status-unit/5' :
                            p.reviewStatus === 'abnormal' ? 'bg-status-abnormal/5' :
                            p.isRemarkSupplementary ? 'bg-amber-50/60' : ''
                          }`}
                          style={{ animationDelay: `${idx * 15}ms` }}
                        >
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-academic-700">{p.id}</td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-academic-800 text-sm">{p.title}</p>
                              <p className="text-[11px] text-academic-500 mt-0.5">
                                {constraintTypeLabel(p.constraintType)}
                                {p.isRemarkSupplementary && (
                                  <span className="ml-2 text-amber-600 font-medium">· 含后补备注</span>
                                )}
                                {p.hasUnitIssue && (
                                  <span className="ml-2 text-status-unit font-medium">· 单位缺失</span>
                                )}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`tag-${p.difficulty === 'easy' ? 'easy' : p.difficulty === 'medium' ? 'medium' : p.difficulty === 'hard' ? 'hard' : 'expert'}`}>
                              {difficultyLabel(p.difficulty)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {r ? (
                              r.status === 'normal' ? <span className="tag-normal">正常</span> :
                              r.status === 'abnormal' ? <span className="tag-abnormal">异常</span> :
                              r.status === 'unit_issue' ? <span className="tag-unit">单位问题</span> :
                              <span className="tag-pending">跳过</span>
                            ) : (
                              <span className="tag-pending">{reviewStatusLabel(p.reviewStatus)}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs tabular-nums">
                            {r && r.status !== 'unit_issue' ? (
                              <span className={r.deviation > 0.05 ? 'text-status-abnormal font-semibold' : 'text-academic-700'}>
                                {(r.deviation * 100).toFixed(2)}%
                              </span>
                            ) : (
                              <span className="text-academic-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right space-x-1">
                            <button
                              onClick={() => handleRunSingle(p.id)}
                              className="p-1.5 text-academic-500 hover:text-academic-700 hover:bg-academic-100 rounded transition-colors"
                              title="运行复核"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setSelectedId(p.id)}
                              className="btn-primary text-xs px-3 py-1"
                            >
                              查看
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>

      {selectedProblem && (
        <ReviewDetailModal
          problem={selectedProblem}
          paramsA={reviewParamsA}
          paramsB={reviewParamsB}
          grayNote={grayReleaseNotes[selectedProblem.id]}
          onClose={() => { setSelectedId(null); selectProblem(null); }}
          onUpdateParams={updateReviewParams}
          onGrayNoteChange={(note) => setGrayReleaseNote(selectedProblem.id, note)}
        />
      )}
    </div>
  );
}
