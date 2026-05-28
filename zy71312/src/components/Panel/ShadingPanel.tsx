import React, { useState } from 'react';
import { CloudOff, Plus, Trash2, AlertTriangle, Info, Lightbulb } from 'lucide-react';
import { useSolarStore } from '../../store/useSolarStore';
import { suggestShadingMitigation, getShadingImpactLevel } from '../../engine/shadingCalc';

export const ShadingPanel: React.FC = () => {
  const {
    params,
    results,
    warnings,
    addShadingPeriod,
    removeShadingPeriod,
    updateShadingPeriod,
  } = useSolarStore();

  const [newStartHour, setNewStartHour] = useState(9);
  const [newEndHour, setNewEndHour] = useState(11);
  const [newDescription, setNewDescription] = useState('');

  const impactLevel = getShadingImpactLevel(results.shadingLoss);
  const suggestions = suggestShadingMitigation(params.shadingPeriods);

  const handleAdd = () => {
    if (newStartHour < newEndHour) {
      addShadingPeriod({
        startHour: newStartHour,
        endHour: newEndHour,
        description: newDescription || '遮挡时段',
      });
      setNewDescription('');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <CloudOff className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-800">遮挡设置</h3>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">当前遮挡损失</span>
            <span
              className="text-lg font-bold"
              style={{ color: impactLevel.color }}
            >
              {results.shadingLoss}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${Math.min(results.shadingLoss, 100)}%`,
                backgroundColor: impactLevel.color,
              }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">{impactLevel.label}</div>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">开始时间</label>
            <select
              value={newStartHour}
              onChange={(e) => setNewStartHour(parseInt(e.target.value))}
              className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {i}:00
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">结束时间</label>
            <select
              value={newEndHour}
              onChange={(e) => setNewEndHour(parseInt(e.target.value))}
              className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {i}:00
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAdd}
            disabled={newStartHour >= newEndHour}
            className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <input
          type="text"
          placeholder="遮挡原因（可选，如：左侧高楼、前方树木）"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />

        {warnings.shadingWarning && (
          <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-start gap-1">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{warnings.shadingWarning}</span>
          </div>
        )}

        <div className="space-y-2 max-h-40 overflow-y-auto">
          {params.shadingPeriods.length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-sm">
              暂无遮挡时段设置
            </div>
          ) : (
            params.shadingPeriods.map((period) => (
              <div
                key={period.id}
                className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-800">
                    {period.startHour}:00 - {period.endHour}:00
                  </div>
                  <div className="text-xs text-gray-500">{period.description}</div>
                </div>
                <button
                  onClick={() => removeShadingPeriod(period.id)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {results.shadingLossReason && (
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700">
                <div className="font-medium mb-1">遮挡计算说明</div>
                {results.shadingLossReason}
              </div>
            </div>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-green-700">
                <div className="font-medium mb-1">优化建议</div>
                <ul className="list-disc list-inside space-y-1">
                  {suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
