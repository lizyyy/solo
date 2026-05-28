import { useEffect, useMemo } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { FilterPanel } from '../components/layout/FilterPanel';
import { DetailPanel } from '../components/layout/DetailPanel';
import { FormulaCube } from '../components/3d/FormulaCube';
import { usePigmentStore } from '../store/usePigmentStore';
import { useFilterStore } from '../store/useFilterStore';
import { useSchemeStore } from '../store/useSchemeStore';

export function Workbench() {
  const { pigments, selectedPigmentId, selectPigment, getSelectedPigment, getSimilarPigments, initStore } = usePigmentStore();
  const { criteria } = useFilterStore();
  const { initStore: initSchemeStore } = useSchemeStore();

  useEffect(() => {
    initStore();
    initSchemeStore();
  }, [initStore, initSchemeStore]);

  const filteredPigments = useMemo(() => {
    return pigments.filter((p) => {
      if (criteria.searchText) {
        const searchLower = criteria.searchText.toLowerCase();
        if (!p.name.toLowerCase().includes(searchLower) && !p.code.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      if (criteria.status.length > 0 && !criteria.status.includes(p.status)) {
        return false;
      }

      if (criteria.anomalies.length > 0) {
        const hasAnomaly = criteria.anomalies.some((a) => p.anomalies.includes(a));
        if (!hasAnomaly) return false;
      }

      if (p.transparency < criteria.transparencyRange[0] || p.transparency > criteria.transparencyRange[1]) {
        return false;
      }

      const lightfastness = p.lightfastness ?? 0;
      if (lightfastness < criteria.lightfastnessRange[0] || lightfastness > criteria.lightfastnessRange[1]) {
        return false;
      }

      if (p.cost < criteria.costRange[0] || p.cost > criteria.costRange[1]) {
        return false;
      }

      return true;
    });
  }, [pigments, criteria]);

  const selectedPigment = getSelectedPigment();
  const similarPigments = selectedPigmentId ? getSimilarPigments(selectedPigmentId, 5) : [];

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <FilterPanel />
        <div className="flex-1 relative">
          <FormulaCube
            pigments={filteredPigments}
            selectedId={selectedPigmentId}
            onSelect={selectPigment}
          />
          
          <div className="absolute top-4 left-4 bg-slate-800/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-slate-700">
            <div className="text-sm text-slate-400">显示色料</div>
            <div className="text-xl font-bold text-white">
              {filteredPigments.length} <span className="text-sm text-slate-500">/ {pigments.length}</span>
            </div>
          </div>

          <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur-sm rounded-lg px-4 py-3 border border-slate-700">
            <div className="text-xs text-slate-400 mb-2">操作提示</div>
            <div className="text-xs text-slate-300 space-y-1">
              <div>🖱️ 拖拽旋转视角</div>
              <div>🔍 滚轮缩放</div>
              <div>📍 点击选中色料</div>
            </div>
          </div>
        </div>
        <DetailPanel
          pigment={selectedPigment}
          similarPigments={similarPigments}
          onClose={() => selectPigment(null)}
        />
      </div>
    </div>
  );
}
