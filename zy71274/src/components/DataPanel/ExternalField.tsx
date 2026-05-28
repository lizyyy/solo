import { useAppStore } from '@/store/appStore';
import { Zap, Magnet } from 'lucide-react';
import { cn } from '@/utils/cn';

export function ExternalField() {
  const { externalField, updateExternalField } = useAppStore();

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        {externalField.field_type === 'electric' ? (
          <Zap size={16} className="text-yellow-400" />
        ) : (
          <Magnet size={16} className="text-blue-400" />
        )}
        外场参数
      </h3>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">场类型</label>
          <div className="flex gap-2">
            <button
              onClick={() => updateExternalField({ field_type: 'electric' })}
              className={cn(
                "flex-1 px-3 py-2 rounded text-xs transition-colors flex items-center justify-center gap-1",
                externalField.field_type === 'electric'
                  ? "bg-yellow-600 text-white"
                  : "bg-slate-700 hover:bg-slate-600"
              )}
            >
              <Zap size={12} />
              电场
            </button>
            <button
              onClick={() => updateExternalField({ field_type: 'magnetic' })}
              className={cn(
                "flex-1 px-3 py-2 rounded text-xs transition-colors flex items-center justify-center gap-1",
                externalField.field_type === 'magnetic'
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 hover:bg-slate-600"
              )}
            >
              <Magnet size={12} />
              磁场
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">
            场强: {externalField.strength.toFixed(2)} T
          </label>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={externalField.strength}
            onChange={(e) => updateExternalField({ strength: parseFloat(e.target.value) })}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>0</span>
            <span>5</span>
            <span>10 T</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">场方向 (X, Y, Z)</label>
          <div className="flex gap-2">
            {['X', 'Y', 'Z'].map((axis, index) => (
              <div key={axis} className="flex-1">
                <div className="text-xs text-slate-500 mb-1">{axis}</div>
                <input
                  type="number"
                  min="-1"
                  max="1"
                  step="0.1"
                  value={externalField.direction[index]}
                  onChange={(e) => {
                    const newDir = [...externalField.direction] as [number, number, number];
                    newDir[index] = parseFloat(e.target.value) || 0;
                    updateExternalField({ direction: newDir });
                  }}
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-center"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="p-2 bg-slate-900/50 rounded text-xs text-slate-400">
          <div className="font-medium text-slate-300 mb-1">效应描述:</div>
          {externalField.strength === 0 ? (
            <p>无外场时显示正常光谱线</p>
          ) : externalField.field_type === 'magnetic' ? (
            <p>塞曼效应: 光谱线在磁场中分裂为多条</p>
          ) : (
            <p>斯塔克效应: 光谱线在电场中发生位移</p>
          )}
        </div>
      </div>
    </div>
  );
}
