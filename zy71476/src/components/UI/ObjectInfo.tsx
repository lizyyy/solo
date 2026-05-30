import React from 'react';
import { useExperimentStore } from '../../store/useExperimentStore';
import { getObjectInfo } from '../../utils/physics';
import { X, Triangle, Box } from 'lucide-react';
import { STATUS_TEXT, STATUS_COLOR } from '../../types';

const ObjectInfo: React.FC = () => {
  const { selectedObject, setSelectedObject, params, threshold } = useExperimentStore();

  if (!selectedObject) return null;

  const info = getObjectInfo(selectedObject, params);
  const Icon = selectedObject === 'plane' ? Triangle : Box;
  const iconColor = selectedObject === 'plane' ? 'text-primary-400' : 'text-blue-400';

  if (selectedObject === 'block') {
    info.properties['状态'] = STATUS_TEXT[threshold.status];
  }

  return (
    <div className="absolute bottom-4 left-4 z-20 w-80 max-w-[90vw]">
      <div className="glass rounded-xl p-5 shadow-xl animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-dark-700/50 flex items-center justify-center ${iconColor}`}>
              <Icon size={24} />
            </div>
            <div>
              <h4 className="title-font font-semibold text-lg text-dark-100">{info.name}</h4>
              <p className="text-xs text-dark-400">点击查看对象属性</p>
            </div>
          </div>
          <button
            onClick={() => setSelectedObject(null)}
            className="p-1 rounded-lg hover:bg-dark-700/50 text-dark-400 hover:text-dark-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-dark-300 mb-4 leading-relaxed">
          {info.description}
        </p>

        <div className="space-y-2">
          {Object.entries(info.properties).map(([key, value]) => {
            const isStatus = key === '状态';
            const statusValue = value as keyof typeof STATUS_TEXT;
            const statusColor = isStatus ? STATUS_COLOR[statusValue] : null;

            return (
              <div
                key={key}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-dark-800/50"
              >
                <span className="text-dark-400 text-sm">{key}</span>
                <span
                  className={`value-display font-semibold text-sm ${
                    isStatus ? '' : 'text-dark-200'
                  }`}
                  style={statusColor ? { color: statusColor } : {}}
                >
                  {value}
                </span>
              </div>
            );
          })}
        </div>

        {selectedObject === 'plane' && (
          <div className="mt-4 p-3 rounded-lg bg-primary-500/10 border border-primary-500/20">
            <p className="text-xs text-primary-300">
              💡 提示：调节斜面角度是影响物块是否滑动的最直观方式。当前角度 {params.angle}°，
              {params.angle > threshold.criticalAngle ? '已超过' : params.angle < threshold.criticalAngle ? '小于' : '等于'}
              临界角度 {threshold.criticalAngle}°。
            </p>
          </div>
        )}

        {selectedObject === 'block' && (
          <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-blue-300">
              💡 提示：物块质量 {params.mass}kg 影响受力大小，但不影响临界角度。
              无论质量多大，只要角度相同、摩擦系数相同，是否滑动的判定结果是一样的！
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ObjectInfo;
