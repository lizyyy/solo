import { motion } from 'framer-motion';
import { useSceneStore } from '../../store/useSceneStore';
import { getSeverityColor, getSeverityLabel, getRiskTypeLabel } from '../../utils/riskDetection';

const RightPanel = () => {
  const { risks, rightPanelOpen, buildings, dangerZones } = useSceneStore();

  if (!rightPanelOpen) return null;

  const criticalCount = risks.filter(r => r.severity === 'critical').length;
  const highCount = risks.filter(r => r.severity === 'high').length;
  const hasCriticalRisk = criticalCount > 0;

  return (
    <motion.div
      initial={{ x: 320 }}
      animate={{ x: 0 }}
      exit={{ x: 320 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute right-0 top-14 bottom-20 w-72 max-w-[calc(100vw-2rem)] z-10 glass-panel m-2 rounded-lg overflow-hidden"
    >
      <div className="h-full overflow-y-auto">
        <div className="p-4">
          <h2 className={`font-bold text-lg mb-4 flex items-center gap-2 ${hasCriticalRisk ? 'text-danger animate-pulse-danger' : 'text-white'}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            风险检测
            {risks.length > 0 && (
              <span className={`ml-auto px-2 py-0.5 rounded text-xs font-bold ${hasCriticalRisk ? 'bg-danger text-white' : 'bg-warning text-dark-100'}`}>
                {risks.length}
              </span>
            )}
          </h2>

          <div className="grid grid-cols-4 gap-2 mb-6">
            <div className="bg-dark-200 rounded-lg p-2 text-center">
              <div className="text-danger font-bold text-lg">{criticalCount}</div>
              <div className="text-gray-400 text-xs">严重</div>
            </div>
            <div className="bg-dark-200 rounded-lg p-2 text-center">
              <div className="text-orange-500 font-bold text-lg">{highCount}</div>
              <div className="text-gray-400 text-xs">高</div>
            </div>
            <div className="bg-dark-200 rounded-lg p-2 text-center">
              <div className="text-warning font-bold text-lg">{risks.filter(r => r.severity === 'medium').length}</div>
              <div className="text-gray-400 text-xs">中</div>
            </div>
            <div className="bg-dark-200 rounded-lg p-2 text-center">
              <div className="text-success font-bold text-lg">{risks.filter(r => r.severity === 'low').length}</div>
              <div className="text-gray-400 text-xs">低</div>
            </div>
          </div>

          {risks.length === 0 ? (
            <div className="bg-success/10 border border-success/30 rounded-lg p-4 text-center">
              <svg className="w-12 h-12 text-success mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-success font-medium">当前无风险</p>
              <p className="text-gray-400 text-sm mt-1">吊装作业条件良好</p>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {risks.slice().reverse().map((risk, index) => (
                <motion.div
                  key={risk.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-dark-200 rounded-lg p-3 border-l-4"
                  style={{ borderLeftColor: getSeverityColor(risk.severity) }}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-white text-sm font-medium">{getRiskTypeLabel(risk.type)}</span>
                    <span
                      className="px-2 py-0.5 rounded text-xs font-bold"
                      style={{ backgroundColor: getSeverityColor(risk.severity) + '30', color: getSeverityColor(risk.severity) }}
                    >
                      {getSeverityLabel(risk.severity)}
                    </span>
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed">{risk.message}</p>
                </motion.div>
              ))}
            </div>
          )}

          <div className="border-t border-dark-300 pt-4">
            <h3 className="text-gray-400 text-sm font-medium mb-3">场景概览</h3>
            
            <div className="space-y-3">
              <div className="bg-dark-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="text-white text-sm">楼体: {buildings.length} 栋</span>
                </div>
                <div className="text-xs text-gray-400 space-y-1">
                  {buildings.map(b => (
                    <div key={b.id} className="flex justify-between">
                      <span>{b.name}</span>
                      <span>{b.dimensions.height}m 高</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-dark-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-white text-sm">警戒区: {dangerZones.length} 个</span>
                </div>
                <div className="text-xs text-gray-400 space-y-1">
                  {dangerZones.map(z => (
                    <div key={z.id} className="flex justify-between items-center">
                      <span>{z.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        z.type === 'restricted' ? 'bg-danger/30 text-danger' :
                        z.type === 'warning' ? 'bg-warning/30 text-warning' : 'bg-success/30 text-success'
                      }`}>
                        {z.type === 'restricted' ? '禁区' : z.type === 'warning' ? '警示' : '安全'}
                        {z.occupied && ' (占用)'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default RightPanel;
