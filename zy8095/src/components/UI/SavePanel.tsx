import type { StowageState } from '@/types';
import { exportLoadPlan, saveToLocalStorage } from '@/store/stowageStore';

interface SavePanelProps {
  state: StowageState;
}

export function SavePanel({ state }: SavePanelProps) {
  const handleSave = () => {
    saveToLocalStorage(state);
    alert('配载方案已保存到本地存储');
  };

  const handleExport = () => {
    const report = exportLoadPlan(state);
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'load_plan_report.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadSample = () => {
    const sampleState: StowageState = {
      bays: [
        { id: 'bay-1', name: 'A1', position: { x: -8, y: 0, z: -5 }, dimensions: { width: 6, height: 4, depth: 8 }, maxWeight: 200, isDeck: false },
        { id: 'bay-2', name: 'A2', position: { x: -8, y: 0, z: 5 }, dimensions: { width: 6, height: 4, depth: 8 }, maxWeight: 200, isDeck: false },
        { id: 'bay-3', name: 'B1', position: { x: 8, y: 0, z: -5 }, dimensions: { width: 6, height: 4, depth: 8 }, maxWeight: 200, isDeck: false },
        { id: 'bay-4', name: 'B2', position: { x: 8, y: 0, z: 5 }, dimensions: { width: 6, height: 4, depth: 8 }, maxWeight: 200, isDeck: false },
        { id: 'bay-5', name: 'D1', position: { x: -4, y: 4, z: -3 }, dimensions: { width: 4, height: 3, depth: 6 }, maxWeight: 150, isDeck: true },
        { id: 'bay-6', name: 'D2', position: { x: 4, y: 4, z: -3 }, dimensions: { width: 4, height: 3, depth: 6 }, maxWeight: 150, isDeck: true },
      ],
      cargoItems: [
        { id: 'c1', containerNo: 'CSLU1234567', weight: 25, category: 'general', isDangerous: false, length: 12, width: 2.4, height: 2.6 },
        { id: 'c2', containerNo: 'CSLU1234568', weight: 30, category: 'refrigerated', isDangerous: false, length: 12, width: 2.4, height: 2.6 },
        { id: 'c3', containerNo: 'CSLU1234569', weight: null, category: 'heavy', isDangerous: false, length: 12, width: 2.4, height: 2.6 },
        { id: 'c4', containerNo: 'DGXU9999991', weight: 15, category: 'dangerous', isDangerous: true, dangerousClass: 'Class3', length: 6, width: 2.4, height: 2.6 },
        { id: 'c5', containerNo: 'DGXU9999992', weight: 18, category: 'dangerous', isDangerous: true, dangerousClass: 'Class8', length: 6, width: 2.4, height: 2.6 },
        { id: 'c6', containerNo: 'CSLU1234570', weight: 22, category: 'general', isDangerous: false, length: 12, width: 2.4, height: 2.6 },
      ],
      placements: [
        { cargoId: 'c1', bayId: 'bay-1', position: { x: 0, y: 1.3, z: 0 } },
        { cargoId: 'c2', bayId: 'bay-3', position: { x: 0, y: 1.3, z: 0 } },
        { cargoId: 'c4', bayId: 'bay-5', position: { x: 0, y: 1.5, z: 0 } },
      ],
      rules: {
        maxTotalWeight: 1000,
        maxDeckWeight: 300,
        maxCargoHoldWeight: 700,
        balanceLimits: {
          maxPortStarboardDifference: 100,
          maxForeAftDifference: 80,
        },
        dangerousGoods: {
          isolationDistance: 5,
          incompatibleClasses: {
            'Class3': ['Class8'],
            'Class8': ['Class3'],
          },
        },
      },
    };

    saveToLocalStorage(sampleState);
    window.location.reload();
  };

  return (
    <div className="save-panel">
      <button className="btn btn-primary" onClick={handleExport}>
        导出报告
      </button>
      <button className="btn btn-secondary" onClick={handleSave}>
        保存方案
      </button>
      <button className="btn btn-outline" onClick={handleLoadSample}>
        加载示例数据
      </button>
    </div>
  );
}