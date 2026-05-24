import { AlertTriangle, XCircle, ChevronDown, ChevronLeft, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSceneStore } from '../../store/useSceneStore';

export default function CollisionPanel() {
  const { collisionWarnings, rightPanelOpen, toggleRightPanel, lights } = useSceneStore();

  const dangerCount = collisionWarnings.filter((w) => w.severity === 'danger').length;
  const warningCount = collisionWarnings.filter((w) => w.severity === 'warning').length;
  const enabledLights = lights.filter((l) => l.enabled).length;

  if (!rightPanelOpen) {
    return (
      <button
        className="collapse-btn right-0"
        onClick={toggleRightPanel}
      >
        <ChevronDown size={16} style={{ transform: 'rotate(90deg)' }} />
      </button>
    );
  }

  return (
    <motion.div
      initial={{ width: 280 }}
      animate={{ width: 280 }}
      className="h-full glass-panel border-l border-white/5 flex flex-col relative"
    >
      <button
        className="collapse-btn -left-5"
        onClick={toggleRightPanel}
      >
        <ChevronDown size={16} style={{ transform: 'rotate(-90deg)' }} />
      </button>

      <div className="p-3 border-b border-white/5">
        <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-stage-orange" />
          碰撞检测
        </h2>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-stage-gray-light rounded-md p-2 text-center">
            <div className={`text-xl font-bold ${
              dangerCount > 0 ? 'text-stage-red' : 'text-gray-500'
            }`}>
              {dangerCount}
            </div>
            <div className="text-xs text-gray-500">严重</div>
          </div>
          <div className="bg-stage-gray-light rounded-md p-2 text-center">
            <div className={`text-xl font-bold ${
              warningCount > 0 ? 'text-stage-orange' : 'text-gray-500'
            }`}>
              {warningCount}
            </div>
            <div className="text-xs text-gray-500">警告</div>
          </div>
          <div className="bg-stage-gray-light rounded-md p-2 text-center">
            <div className="text-xl font-bold text-stage-blue">
              {enabledLights}
            </div>
            <div className="text-xs text-gray-500">启用</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {collisionWarnings.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-stage-green/10 flex items-center justify-center">
              <Info size={24} className="text-stage-green" />
            </div>
            <div className="text-stage-green text-sm font-medium">
              一切正常
            </div>
            <div className="text-gray-500 text-xs mt-1">
              未检测到光束碰撞
            </div>
          </div>
        ) : (
          collisionWarnings.map((warning) => (
            <div
              key={warning.id}
              className={`warning-card ${warning.severity} slide-in`}
            >
              <div className="flex items-start gap-2">
                {warning.severity === 'danger' ? (
                  <XCircle size={16} className="text-stage-red flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={16} className="text-stage-orange flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">
                    {warning.lightName}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {warning.message}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    区域: {warning.zoneName}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-white/5">
        <div className="text-xs text-gray-500 mb-2">禁区说明</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded bg-stage-red/30 border border-stage-red" />
            <span className="text-gray-400">字幕屏区域 - 严禁遮挡</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded bg-stage-orange/30 border border-stage-orange" />
            <span className="text-gray-400">观众区域 - 避免直射</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
