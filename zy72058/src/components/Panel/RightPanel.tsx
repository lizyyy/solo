import { AlertTriangle, Clock, FileText, MapPin, Save, X, Edit3 } from 'lucide-react';
import { useStore, useSelectedComponent } from '@/store/useStore';
import { SOURCE_TYPE_LABELS, STATUS_LABELS, COORDINATE_COLORS } from '@/types';
import { useState } from 'react';

function formatDate(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RightPanel() {
  const component = useSelectedComponent();
  const { updateComponent, toggleAnomaly, setSelectedComponent } = useStore();
  const [isEditingRemark, setIsEditingRemark] = useState(false);
  const [remarkValue, setRemarkValue] = useState('');

  if (!component) {
    return (
      <div className="w-80 h-full bg-slate-900 border-l border-slate-700 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">点击左侧构件查看详情</p>
          <p className="text-xs mt-1">或在3D场景中点击构件点</p>
        </div>
      </div>
    );
  }

  const startEditRemark = () => {
    setRemarkValue(component.remark);
    setIsEditingRemark(true);
  };

  const saveRemark = () => {
    updateComponent(component.id, { remark: remarkValue });
    setIsEditingRemark(false);
  };

  const hasValidCoords = component.x !== null && component.y !== null && component.z !== null;

  return (
    <div className="w-80 h-full bg-slate-900 border-l border-slate-700 flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">{component.name}</h3>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-slate-500">{component.id}</span>
              {component.isAnomaly && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-red-900/50 text-red-400 rounded text-xs">
                  <AlertTriangle className="w-3 h-3" />
                  异常
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setSelectedComponent(null)}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="p-3 bg-slate-800 rounded-lg">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            空间坐标
          </h4>
          {hasValidCoords ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-slate-700/50 rounded">
                <div className="text-xs text-slate-500">X</div>
                <div className="text-white font-mono text-sm">{component.x?.toFixed(2)}</div>
              </div>
              <div className="text-center p-2 bg-slate-700/50 rounded">
                <div className="text-xs text-slate-500">Y</div>
                <div className="text-white font-mono text-sm">{component.y?.toFixed(2)}</div>
              </div>
              <div className="text-center p-2 bg-slate-700/50 rounded">
                <div className="text-xs text-slate-500">Z</div>
                <div className="text-white font-mono text-sm">{component.z?.toFixed(2)}</div>
              </div>
            </div>
          ) : (
            <div className="text-center p-3 bg-yellow-900/30 border border-yellow-700/50 rounded">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
              <span className="text-yellow-400 text-sm">坐标缺失</span>
            </div>
          )}
          <div className="mt-3 flex items-center gap-2">
            <span
              className="px-2 py-1 rounded text-xs font-medium"
              style={{
                backgroundColor: `${COORDINATE_COLORS[component.coordinateSystem] || COORDINATE_COLORS['默认']}20`,
                color: COORDINATE_COLORS[component.coordinateSystem] || COORDINATE_COLORS['默认'],
                border: `1px solid ${COORDINATE_COLORS[component.coordinateSystem] || COORDINATE_COLORS['默认']}40`,
              }}
            >
              {component.coordinateSystem}
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-800 rounded-lg">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            数据来源
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">来源类型</span>
              <span className="text-white text-sm">{SOURCE_TYPE_LABELS[component.sourceType]}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">来源文件</span>
              <span className="text-white text-sm font-mono text-right max-w-[150px] truncate" title={component.source}>
                {component.source}
              </span>
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-800 rounded-lg">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            状态标记
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">数据状态</span>
              <span className={`px-2 py-0.5 rounded text-xs ${
                component.status === 'normal' ? 'bg-green-900/50 text-green-400' :
                component.status === 'empty' ? 'bg-yellow-900/50 text-yellow-400' :
                component.status === 'duplicate' ? 'bg-orange-900/50 text-orange-400' :
                'bg-blue-900/50 text-blue-400'
              }`}>
                {STATUS_LABELS[component.status]}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">异常标记</span>
              <button
                onClick={() => toggleAnomaly(component.id)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  component.isAnomaly
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {component.isAnomaly ? '已标记异常' : '标记为异常'}
              </button>
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-800 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              备注说明
            </h4>
            {!isEditingRemark && (
              <button
                onClick={startEditRemark}
                className="p-1 text-slate-400 hover:text-amber-400 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
          </div>
          {isEditingRemark ? (
            <div className="space-y-2">
              <textarea
                value={remarkValue}
                onChange={(e) => setRemarkValue(e.target.value)}
                placeholder="添加备注说明..."
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditingRemark(false)}
                  className="px-3 py-1 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={saveRemark}
                  className="px-3 py-1 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 transition-colors flex items-center gap-1"
                >
                  <Save className="w-3 h-3" />
                  保存
                </button>
              </div>
            </div>
          ) : (
            <p className="text-slate-300 text-sm whitespace-pre-wrap">
              {component.remark || <span className="text-slate-500">暂无备注</span>}
            </p>
          )}
        </div>

        {Object.keys(component.metadata).length > 0 && (
          <div className="p-3 bg-slate-800 rounded-lg">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              元数据
            </h4>
            <div className="space-y-2">
              {Object.entries(component.metadata).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">{key}</span>
                  <span className="text-white text-sm">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-3 bg-slate-800 rounded-lg">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            <Clock className="w-3 h-3 inline mr-1" />
            时间记录
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">创建时间</span>
              <span className="text-slate-300 text-xs">{formatDate(component.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">更新时间</span>
              <span className="text-slate-300 text-xs">{formatDate(component.updatedAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
