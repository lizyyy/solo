import { useState } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { formatScientific } from '../utils/calculator';

export function FaradayPanel() {
  const [showDetails, setShowDetails] = useState(false);
  const { currentResult, params, selectedObject } = useSimulationStore((state) => ({
    currentResult: state.currentResult,
    params: state.session.params,
    selectedObject: state.selectedObject,
  }));

  return (
    <div className="bg-white rounded-lg card-shadow p-5 h-full overflow-y-auto">
      <h2 className="font-serif-sc text-lg font-semibold text-slate-800 mb-4 pb-3 border-b border-slate-200">
        法拉第电磁感应定律
      </h2>

      <div className="bg-primary-50 rounded-lg p-4 mb-4">
        <div className="text-center font-mono text-2xl text-primary-800 mb-2">
          ε = -N · dΦ/dt
        </div>
        <div className="text-xs text-center text-primary-600">
          感应电动势 = -匝数 × 磁通量变化率
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-medium text-slate-600 mb-2 flex items-center justify-between">
          <span>原始输入参数</span>
          <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">原始数据</span>
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-slate-50 rounded p-2">
            <div className="text-xs text-slate-500">线圈匝数 N</div>
            <div className="font-mono text-slate-800">{params.turns}</div>
          </div>
          <div className="bg-slate-50 rounded p-2">
            <div className="text-xs text-slate-500">磁场强度 B</div>
            <div className="font-mono text-slate-800">{params.fieldStrength} T</div>
          </div>
          <div className="bg-slate-50 rounded p-2">
            <div className="text-xs text-slate-500">运动速度 v</div>
            <div className="font-mono text-slate-800">{params.velocity} m/s</div>
          </div>
          <div className="bg-slate-50 rounded p-2">
            <div className="text-xs text-slate-500">线圈面积 A</div>
            <div className="font-mono text-slate-800">{params.area} m²</div>
          </div>
        </div>
      </div>

      {currentResult && (
        <>
          <div className="mb-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full text-sm font-medium text-slate-600 mb-2 flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                计算过程
                <span className="text-xs bg-amber-100 px-2 py-0.5 rounded text-amber-700">处理中</span>
              </span>
              <span className="text-xs text-primary-600">
                {showDetails ? '收起详情 ▲' : '展开详情 ▼'}
              </span>
            </button>
            
            {showDetails && (
              <div className="bg-amber-50 rounded-lg p-3 text-sm space-y-2">
                <div>
                  <span className="text-slate-600">① 最大磁通量 Φ_max = B·A:</span>
                  <span className="font-mono ml-2">
                    {formatScientific(currentResult.intermediate.maxFlux)} Wb
                  </span>
                </div>
                <div>
                  <span className="text-slate-600">② 磁通量变化率 dΦ/dt:</span>
                  <span className="font-mono ml-2">
                    {formatScientific(currentResult.intermediate.dFlux_dt)} Wb/s
                  </span>
                </div>
                <div>
                  <span className="text-slate-600">③ 感应电动势 ε = -N·dΦ/dt:</span>
                </div>
                <div className="pl-4 border-l-2 border-amber-300">
                  <div>ε_max = {formatScientific(currentResult.result.maxVoltage)} V</div>
                  <div>ε_min = {formatScientific(currentResult.result.minVoltage)} V</div>
                </div>
              </div>
            )}
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-medium text-slate-600 mb-2 flex items-center justify-between">
              <span>计算结果</span>
              <span className="text-xs bg-success-500 text-white px-2 py-0.5 rounded">结果</span>
            </h3>
            <div className="bg-success-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-xs text-slate-500 mb-1">峰值电压</div>
                  <div className="font-mono text-xl text-success-700">
                    {formatScientific(Math.abs(currentResult.result.maxVoltage))}
                  </div>
                  <div className="text-xs text-slate-500">V</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">采样点数</div>
                  <div className="font-mono text-xl text-success-700">
                    {currentResult.result.voltage.length}
                  </div>
                  <div className="text-xs text-slate-500">点</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedObject && (
        <div className="mt-4 p-3 bg-primary-50 rounded-lg border border-primary-200">
          <div className="text-sm font-medium text-primary-700 mb-2">
            {selectedObject === 'coil' ? '🔷 已选中: 线圈' : '🧲 已选中: 磁铁'}
          </div>
          {selectedObject === 'coil' && (
            <div className="text-xs text-slate-600 space-y-1">
              <div>匝数: {params.turns}</div>
              <div>面积: {params.area} m²</div>
            </div>
          )}
          {selectedObject === 'magnet' && (
            <div className="text-xs text-slate-600 space-y-1">
              <div>磁场强度: {params.fieldStrength} T</div>
              <div>运动速度: {params.velocity} m/s</div>
              <div>方向: {params.direction === 1 ? '正向' : '反向'}</div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-slate-200">
        <div className="text-xs text-slate-400">
          公式: ε = -N · d(B·A·cosθ)/dt
        </div>
      </div>
    </div>
  );
}
