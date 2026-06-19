import type { FilterCriteria } from '../types';

interface Props {
  filterCriterias: FilterCriteria[];
  activeFilterId: string;
  onFilterChange: (id: string) => void;
  onExport: () => void;
  exportsCount: number;
}

export default function TopBar({ filterCriterias, activeFilterId, onFilterChange, onExport, exportsCount }: Props) {
  const active = filterCriterias.find(f => f.id === activeFilterId);
  return (
    <header className="bg-white border-b border-slate-200 shadow-sm">
      <div className="px-6 py-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3 mr-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xl shadow-md">
            📐
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">曲线拟合边界复核</h1>
            <p className="text-xs text-slate-500">Curve Fitting Boundary Review · 老叶工作台交接版</p>
          </div>
        </div>

        <div className="flex-1 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">筛选口径：</span>
            <select
              value={activeFilterId}
              onChange={(e) => onFilterChange(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:outline-none"
            >
              {filterCriterias.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name}（{f.createdBy}）
                </option>
              ))}
            </select>
          </div>

          {active && (
            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span className="tag tag-gray">拟合度: {active.fittingDegree === 1 ? '线性' : `${active.fittingDegree}次多项式`}</span>
              <span className="tag tag-gray">边界最少样本: {active.boundarySampleMinCount}</span>
              <span className="tag tag-gray">阈值: {active.boundaryThreshold}</span>
              <span className="tag tag-gray">{active.excludeOutliers ? '排除离群' : '保留离群'}</span>
              <span className="tag tag-blue">材料: {active.materialIds.length}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">已导出 {exportsCount} 份</span>
          <button
            onClick={onExport}
            className="btn-primary flex items-center gap-2 shadow-sm"
          >
            <span>📤</span>
            <span>导出报告（绑定屏幕快照）</span>
          </button>
        </div>
      </div>
    </header>
  );
}
