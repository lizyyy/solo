import { motion } from 'framer-motion';
import { useSceneStore } from '../../store/useSceneStore';
import { calculateMaxWeightForRadius } from '../../utils/cranePhysics';

const LeftPanel = () => {
  const {
    crane,
    liftObject,
    environment,
    setCraneAngle,
    setCraneRadius,
    setLiftWeight,
    setLiftProgress,
    setWindSpeed,
    leftPanelOpen,
  } = useSceneStore();

  const maxAllowedWeight = calculateMaxWeightForRadius(crane, crane.currentRadius);

  if (!leftPanelOpen) return null;

  return (
    <motion.div
      initial={{ x: -320 }}
      animate={{ x: 0 }}
      exit={{ x: -320 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute left-0 top-14 bottom-20 w-72 z-10 glass-panel m-2 rounded-lg overflow-hidden"
    >
      <div className="h-full overflow-y-auto">
        <div className="p-4">
          <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            参数控制
          </h2>

          <div className="mb-6">
            <h3 className="text-gray-400 text-sm font-medium mb-3">塔吊参数</h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-white text-sm">吊臂角度</label>
                  <span className="text-primary font-mono text-sm">{crane.currentAngle.toFixed(1)}°</span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={crane.currentAngle}
                  onChange={(e) => setCraneAngle(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>-180°</span>
                  <span>180°</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-white text-sm">作业半径</label>
                  <span className={`font-mono text-sm ${crane.currentRadius > crane.maxRadius ? 'text-danger' : 'text-primary'}`}>
                    {crane.currentRadius.toFixed(1)}m
                  </span>
                </div>
                <input
                  type="range"
                  min={crane.minRadius}
                  max={crane.maxRadius + 10}
                  step="0.5"
                  value={crane.currentRadius}
                  onChange={(e) => setCraneRadius(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>最小 {crane.minRadius}m</span>
                  <span className="text-danger">最大 {crane.maxRadius}m</span>
                </div>
              </div>

              <div className="bg-dark-200 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-2">塔吊信息</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">型号:</span>
                    <span className="text-white ml-1 font-mono text-xs">{crane.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">高度:</span>
                    <span className="text-white ml-1 font-mono">{crane.height}m</span>
                  </div>
                  <div>
                    <span className="text-gray-500">最大起重量:</span>
                    <span className="text-white ml-1 font-mono">{crane.maxWeight}t</span>
                  </div>
                  <div>
                    <span className="text-gray-500">最大半径:</span>
                    <span className="text-white ml-1 font-mono">{crane.maxRadius}m</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-gray-400 text-sm font-medium mb-3">吊装参数</h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-white text-sm">吊物重量</label>
                  <span className={`font-mono text-sm ${liftObject.weight > maxAllowedWeight ? 'text-danger animate-pulse-danger' : 'text-primary'}`}>
                    {liftObject.weight.toFixed(1)} 吨
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max={crane.maxWeight + 2}
                  step="0.5"
                  value={liftObject.weight}
                  onChange={(e) => setLiftWeight(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-500">0.5吨</span>
                  <span className={`${liftObject.weight > maxAllowedWeight ? 'text-danger' : 'text-success'}`}>
                    当前半径允许: {maxAllowedWeight.toFixed(1)}吨
                  </span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-white text-sm">吊装进度</label>
                  <span className="text-primary font-mono text-sm">{(liftObject.currentProgress * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={liftObject.currentProgress}
                  onChange={(e) => setLiftProgress(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>起点</span>
                  <span>终点</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-gray-400 text-sm font-medium mb-3">环境参数</h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-white text-sm">风速</label>
                  <span className={`font-mono text-sm ${environment.windSpeed > environment.maxAllowedWindSpeed ? 'text-danger animate-pulse-danger' : environment.windSpeed > environment.maxAllowedWindSpeed * 0.8 ? 'text-warning' : 'text-success'}`}>
                    {environment.windSpeed.toFixed(1)} m/s
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="0.5"
                  value={environment.windSpeed}
                  onChange={(e) => setWindSpeed(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>无风</span>
                  <span className="text-danger">安全值: {environment.maxAllowedWindSpeed}m/s</span>
                </div>
              </div>

              <div className="bg-dark-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-warning" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                    </svg>
                    <span className="text-white text-sm">
                      {environment.windSpeed <= 5 ? '适合吊装作业' :
                       environment.windSpeed <= 10 ? '注意作业安全' :
                       environment.windSpeed <= environment.maxAllowedWindSpeed ? '接近安全阈值' : '禁止吊装作业'}
                    </span>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${
                    environment.windSpeed <= 5 ? 'bg-success' :
                    environment.windSpeed <= 10 ? 'bg-warning' :
                    environment.windSpeed <= environment.maxAllowedWindSpeed ? 'bg-orange-500' : 'bg-danger animate-pulse-danger'
                  }`} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LeftPanel;
