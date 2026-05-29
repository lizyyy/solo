import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useRecordStore } from '@/store/useRecordStore';
import { useEstimationStore } from '@/store/useEstimationStore';
import { ComparePanel } from '@/components/compare/ComparePanel';
import { DiffHeatmap } from '@/components/compare/DiffHeatmap';
import { getRecord } from '@/utils/storage';
import type { EstimationRecord } from '@/types';
import { useState } from 'react';

export default function ComparePage() {
  const navigate = useNavigate();
  const { comparisonScenarios, removeFromComparison, clearComparison, records, loadRecords } = useRecordStore();
  const { result } = useEstimationStore();
  const [scenarioRecords, setScenarioRecords] = useState<Map<string, EstimationRecord>>(new Map());
  const [showHeatmap, setShowHeatmap] = useState(false);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    const fetchRecords = async () => {
      const newMap = new Map<string, EstimationRecord>();
      for (const scenario of comparisonScenarios) {
        const record = await getRecord(scenario.recordId);
        if (record) {
          newMap.set(scenario.id, record);
        }
      }
      setScenarioRecords(newMap);
    };
    fetchRecords();
  }, [comparisonScenarios]);

  const addCurrentResult = () => {
    if (!result) return;
    // 保存当前结果然后添加到对比
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-ocean-700/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-display font-bold gradient-text mb-2">
              情景对比
            </h2>
            <p className="text-gray-400 text-sm">
              最多支持4个情景并排对比，直观展示参数差异对发电量的影响
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {result && comparisonScenarios.length < 4 && (
            <button
              onClick={addCurrentResult}
              className="btn-secondary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              添加当前计算结果
            </button>
          )}
          {comparisonScenarios.length > 0 && (
            <button
              onClick={clearComparison}
              className="btn-secondary text-alert-400 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              清空对比
            </button>
          )}
        </div>
      </div>

      {comparisonScenarios.length > 0 && (
        <div className="mb-6 flex items-center gap-4">
          <div className="flex items-center gap-2">
            {comparisonScenarios.map((scenario, index) => (
              <div
                key={scenario.id}
                className="flex items-center gap-2 px-3 py-2 bg-ocean-700/50 rounded-lg border border-ocean-500/20"
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: scenario.color }}
                />
                <span className="text-sm text-gray-300">{scenario.label}</span>
                <button
                  onClick={() => removeFromComparison(scenario.id)}
                  className="text-gray-500 hover:text-alert-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          
          {comparisonScenarios.length >= 2 && (
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className="btn-secondary text-sm"
            >
              {showHeatmap ? '隐藏热力图' : '显示差异热力图'}
            </button>
          )}
        </div>
      )}

      {showHeatmap && comparisonScenarios.length >= 2 && (
        <div className="mb-8">
          <DiffHeatmap />
        </div>
      )}

      <ComparePanel />
    </div>
  );
}
