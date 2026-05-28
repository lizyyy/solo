import React, { useState } from 'react';
import { Compass, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useSolarStore } from '../../store/useSolarStore';

export const AngleResult: React.FC = () => {
  const { results, params, useCustomAngle } = useSolarStore();
  const [showReason, setShowReason] = useState(false);

  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl shadow-lg p-5 text-white">
      <div className="flex items-center gap-2 mb-4">
        <Compass className="w-6 h-6" />
        <h3 className="font-semibold text-lg">倾角优化结果</h3>
      </div>

      <div className="text-center mb-4">
        <div className="text-5xl font-bold mb-1">{results.optimalAngle}°</div>
        <div className="text-blue-200 text-sm">
          {useCustomAngle ? '自定义倾角' : '推荐最佳倾角'}
        </div>
      </div>

      <div className="bg-white/10 rounded-lg p-3 mb-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-blue-200">当前屋顶坡度</span>
          <span className="font-medium">{params.roofAngle}°</span>
        </div>
        {Math.abs(results.optimalAngle - params.roofAngle) > 5 && (
          <div className="mt-2 text-xs text-amber-300">
            ⚠️ 推荐倾角与屋顶坡度差异较大，建议评估安装成本
          </div>
        )}
      </div>

      <button
        onClick={() => setShowReason(!showReason)}
        className="w-full flex items-center justify-between gap-2 bg-white/10 hover:bg-white/20 rounded-lg p-3 transition-colors text-sm"
      >
        <span className="flex items-center gap-2">
          <Info className="w-4 h-4" />
          为什么这么算？
        </span>
        {showReason ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {showReason && (
        <div className="mt-3 bg-white/10 rounded-lg p-3 text-sm">
          <div className="text-blue-100 leading-relaxed">
            {results.optimalAngleReason || '正在计算...'}
          </div>
          <div className="mt-2 pt-2 border-t border-white/20 text-xs text-blue-200">
            <div>计算依据：经验公式法</div>
            <div>适用范围：北半球并网光伏系统</div>
            <div>精度说明：±2°范围内可接受</div>
          </div>
        </div>
      )}
    </div>
  );
};
