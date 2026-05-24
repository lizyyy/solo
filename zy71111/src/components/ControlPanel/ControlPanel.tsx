
import { Upload, ListFilter } from 'lucide-react';
import { FilterPanel } from './FilterPanel';
import { AnnotationList } from './AnnotationList';
import { useInspectionStore } from '../../store/useInspectionStore';

const EMPTY_ARRAY: never[] = [];

export function ControlPanel() {
  const loadSampleData = useInspectionStore((state) => state.loadSampleData);
  const inspectionData = useInspectionStore((state) => state.inspectionData);
  const filterLevel = useInspectionStore((state) => state.filterLevel);
  const filterStatus = useInspectionStore((state) => state.filterStatus);
  const timeRange = useInspectionStore((state) => state.timeRange);

  const annotations = inspectionData?.annotations || EMPTY_ARRAY;
  const filteredAnnotations = annotations.filter(
    (ann) =>
      filterLevel.includes(ann.crackLevel) &&
      filterStatus.includes(ann.recheckStatus) &&
      ann.timestamp >= timeRange[0] &&
      ann.timestamp <= timeRange[1]
  );

  return (
    <div className="absolute left-4 top-20 bottom-24 w-72 bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-700/50">
        <h2 className="text-lg font-semibold text-white mb-3">巡检标注</h2>
        {!inspectionData ? (
          <button
            onClick={loadSampleData}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Upload size={16} />
            导入样例数据
          </button>
        ) : (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">叶片编号</span>
            <span className="text-cyan-400 font-mono">{inspectionData.bladeId}</span>
          </div>
        )}
      </div>

      {inspectionData && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ListFilter size={16} className="text-slate-400" />
                <span className="text-sm font-medium text-slate-300">筛选条件</span>
              </div>
              <FilterPanel />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-300">标注列表</span>
                <span className="text-xs text-slate-500">
                  共 {filteredAnnotations.length} 条
                </span>
              </div>
              <AnnotationList />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
