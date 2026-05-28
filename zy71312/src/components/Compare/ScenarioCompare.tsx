import React, { useState } from 'react';
import { Save, Trash2, Download, FileText, Plus, X } from 'lucide-react';
import { useSolarStore } from '../../store/useSolarStore';

export const ScenarioCompare: React.FC = () => {
  const { scenarios, saveScenario, loadScenario, deleteScenario, results, params } =
    useSolarStore();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [scenarioName, setScenarioName] = useState('');

  const handleSave = () => {
    if (scenarioName.trim()) {
      saveScenario(scenarioName.trim());
      setScenarioName('');
      setShowSaveDialog(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-800">情景对比</h3>
        </div>
        <button
          onClick={() => setShowSaveDialog(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          保存方案
        </button>
      </div>

      {showSaveDialog && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="方案名称"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <button
              onClick={handleSave}
              className="px-3 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-3 py-2 bg-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {scenarios.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">暂无保存的方案</p>
          <p className="text-xs">保存不同参数方案进行对比分析</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className="p-3 border rounded-lg hover:border-blue-300 transition-colors cursor-pointer"
              onClick={() => loadScenario(scenario.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-800">{scenario.name}</div>
                  <div className="text-xs text-gray-500">
                    {scenario.params.city} · {scenario.results.optimalAngle}° ·{' '}
                    {scenario.results.annualEnergy.toLocaleString()}kWh
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-600">
                      ¥{scenario.results.annualProfit.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {scenario.results.paybackYears}年回本
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteScenario(scenario.id);
                    }}
                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {scenarios.length >= 2 && (
        <div className="mt-4 pt-4 border-t">
          <div className="text-sm font-medium text-gray-700 mb-2">方案对比</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left py-1">方案</th>
                  <th className="text-center py-1">倾角</th>
                  <th className="text-center py-1">年发电</th>
                  <th className="text-center py-1">年收益</th>
                  <th className="text-center py-1">回收期</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="py-1 font-medium text-gray-700">{s.name}</td>
                    <td className="text-center py-1">{s.results.optimalAngle}°</td>
                    <td className="text-center py-1">
                      {(s.results.annualEnergy / 1000).toFixed(1)}M
                    </td>
                    <td className="text-center py-1 text-green-600">
                      ¥{(s.results.annualProfit / 1000).toFixed(0)}k
                    </td>
                    <td className="text-center py-1">{s.results.paybackYears}年</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
