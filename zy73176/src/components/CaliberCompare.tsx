import { useState } from 'react';
import type { CaliberVersion } from '../types';
import { CaliberComparator, type ChangeDetail } from '../utils/caliberComparator';

interface CaliberCompareProps {
  versions: CaliberVersion[];
  activeVersion: CaliberVersion;
  onSelectVersion: (versionId: string) => void;
}

export function CaliberCompare({ versions, activeVersion, onSelectVersion }: CaliberCompareProps) {
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const v1 = versions.find((v) => v.id === compareWith);
  const comparison = v1 ? CaliberComparator.compare(v1, activeVersion) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">口径版本管理</h2>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {showHistory ? '隐藏历史' : '查看历史版本'}
        </button>
      </div>

      <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-xs font-medium bg-green-500 text-white rounded">
                当前使用
              </span>
              <span className="font-semibold text-gray-800">
                v{activeVersion.version} - {activeVersion.name}
              </span>
            </div>
            <p className="text-sm text-gray-600">{activeVersion.description}</p>
            <p className="text-xs text-gray-500 mt-1">
              发布时间：{new Date(activeVersion.createdAt).toLocaleString('zh-CN')}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 bg-white rounded-lg">
            <div className="text-gray-500">公式</div>
            <div className="font-semibold text-blue-600">{activeVersion.formulas.length} 个</div>
          </div>
          <div className="p-2 bg-white rounded-lg">
            <div className="text-gray-500">单位</div>
            <div className="font-semibold text-green-600">{activeVersion.units.length} 个</div>
          </div>
          <div className="p-2 bg-white rounded-lg">
            <div className="text-gray-500">阈值</div>
            <div className="font-semibold text-orange-600">{activeVersion.thresholds.length} 个</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">与历史版本对比：</span>
        <select
          value={compareWith || ''}
          onChange={(e) => setCompareWith(e.target.value || null)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          <option value="">-- 选择对比版本 --</option>
          {versions
            .filter((v) => v.id !== activeVersion.id)
            .map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version} - {v.name}
              </option>
            ))}
        </select>
      </div>

      {comparison && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-800">
                版本对比：v{comparison.version1} → v{comparison.version2}
              </h3>
              <div className="flex items-center gap-2">
                {comparison.summary.backwardCompatible ? (
                  <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">
                    ✓ 向后兼容
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700">
                    ⚠ 不兼容变更
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {CaliberComparator.generateChangeSummary(comparison.changes)}
            </p>
          </div>

          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {comparison.changes.map((change, idx) => (
              <ChangeRow key={idx} change={change} />
            ))}
          </div>
        </div>
      )}

      {showHistory && (
        <div className="space-y-2">
          <h3 className="font-medium text-gray-700">历史版本</h3>
          {versions
            .filter((v) => v.id !== activeVersion.id)
            .map((version) => (
              <div
                key={version.id}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-800">
                    v{version.version} - {version.name}
                  </span>
                  <button
                    onClick={() => onSelectVersion(version.id)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    切换到此版本
                  </button>
                </div>
                <p className="text-sm text-gray-600">{version.description}</p>
                <div className="mt-2 text-xs text-gray-500 whitespace-pre-line">
                  <span className="font-medium">变更日志：</span>
                  {version.changeLog}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function ChangeRow({ change }: { change: ChangeDetail }) {
  const impactBadge = CaliberComparator.getChangeImpactBadge(change.impact);
  
  const typeConfig = {
    added: { label: '新增', icon: '➕', class: 'text-green-600 bg-green-50' },
    removed: { label: '删除', icon: '➖', class: 'text-red-600 bg-red-50' },
    modified: { label: '修改', icon: '✏️', class: 'text-yellow-600 bg-yellow-50' }
  };

  const type = typeConfig[change.type];

  return (
    <div className="px-4 py-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        <span className={`px-2 py-0.5 text-xs rounded ${type.class} font-medium`}>
          {type.icon} {type.label}
        </span>
        <span className={`px-2 py-0.5 text-xs rounded border ${impactBadge.class}`}>
          {impactBadge.label}
        </span>
      </div>
      <p className="mt-2 text-sm text-gray-800">{change.description}</p>
      {change.type === 'modified' && (
        <div className="mt-2 flex items-start gap-2 text-xs">
          <div className="flex-1 p-2 bg-red-50 rounded text-red-700 font-mono">
            <span className="text-red-500 font-medium">原值：</span>
            {change.oldValue}
          </div>
          <div className="flex-1 p-2 bg-green-50 rounded text-green-700 font-mono">
            <span className="text-green-500 font-medium">新值：</span>
            {change.newValue}
          </div>
        </div>
      )}
      {change.type !== 'modified' && (
        <p className="mt-1 text-xs text-gray-500 font-mono">
          {change.type === 'added' ? `新值：${change.newValue}` : `原值：${change.oldValue}`}
        </p>
      )}
    </div>
  );
}
