import { Settings, Plane, Wind, Package, Battery, MapPin, Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { DRONE_MODELS } from '@/types';

export default function ParamsConfig() {
  const droneParams = useAppStore((state) => state.droneParams);
  const windData = useAppStore((state) => state.windData);
  const payloadData = useAppStore((state) => state.payloadData);
  const batteryStatus = useAppStore((state) => state.batteryStatus);
  const waypoints = useAppStore((state) => state.waypoints);
  const conservativeFactor = useAppStore((state) => state.conservativeFactor);
  const safetyMargin = useAppStore((state) => state.safetyMargin);

  const setDroneParams = useAppStore((state) => state.setDroneParams);
  const setWindData = useAppStore((state) => state.setWindData);
  const setPayloadData = useAppStore((state) => state.setPayloadData);
  const setBatteryStatus = useAppStore((state) => state.setBatteryStatus);
  const setConservativeFactor = useAppStore((state) => state.setConservativeFactor);
  const setSafetyMargin = useAppStore((state) => state.setSafetyMargin);
  const addWaypoint = useAppStore((state) => state.addWaypoint);
  const removeWaypoint = useAppStore((state) => state.removeWaypoint);
  const setWaypoints = useAppStore((state) => state.setWaypoints);

  const handleDroneModelChange = (modelId: string) => {
    const model = DRONE_MODELS.find((m) => m.id === modelId);
    if (model) {
      setDroneParams(model);
    }
  };

  const handleWaypointChange = (id: string, field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setWaypoints(
      waypoints.map((wp) =>
        wp.id === id ? { ...wp, [field]: numValue } : wp
      )
    );
  };

  const handleAddWaypoint = () => {
    const newWaypoint = {
      id: `wp-${Date.now()}`,
      lat: 31.2304,
      lng: 121.4737,
      altitude: 100,
      speed: 12,
      stayTime: 0,
    };
    addWaypoint(newWaypoint);
  };

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Plane className="w-5 h-5 text-aviation-400" />
          无人机参数
        </h3>
        <div className="space-y-4">
          <div>
            <label className="label-text">无人机型号</label>
            <select
              value={droneParams.id}
              onChange={(e) => handleDroneModelChange(e.target.value)}
              className="input-field"
            >
              {DRONE_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.model}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-text">最大起飞重量 (g)</label>
              <input
                type="number"
                value={droneParams.maxTakeoffWeight}
                onChange={(e) => setDroneParams({ maxTakeoffWeight: parseFloat(e.target.value) || 0 })}
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="label-text">空机重量 (g)</label>
              <input
                type="number"
                value={droneParams.emptyWeight}
                onChange={(e) => setDroneParams({ emptyWeight: parseFloat(e.target.value) || 0 })}
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="label-text">电池容量 (mAh)</label>
              <input
                type="number"
                value={droneParams.batteryCapacity}
                onChange={(e) => setDroneParams({ batteryCapacity: parseFloat(e.target.value) || 0 })}
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="label-text">电池电压 (V)</label>
              <input
                type="number"
                step="0.1"
                value={droneParams.batteryVoltage}
                onChange={(e) => setDroneParams({ batteryVoltage: parseFloat(e.target.value) || 0 })}
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="label-text">标称续航 (min)</label>
              <input
                type="number"
                value={droneParams.maxFlightTime}
                onChange={(e) => setDroneParams({ maxFlightTime: parseFloat(e.target.value) || 0 })}
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="label-text">巡航速度 (m/s)</label>
              <input
                type="number"
                value={droneParams.cruiseSpeed}
                onChange={(e) => setDroneParams({ cruiseSpeed: parseFloat(e.target.value) || 0 })}
                className="input-field font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Wind className="w-5 h-5 text-aviation-400" />
          风速与环境
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-text">风速 (m/s)</label>
            <input
              type="number"
              step="0.1"
              value={windData.speed}
              onChange={(e) => setWindData({ speed: parseFloat(e.target.value) || 0 })}
              className="input-field font-mono"
            />
          </div>
          <div>
            <label className="label-text">风向 (°)</label>
            <input
              type="number"
              min="0"
              max="360"
              value={windData.direction}
              onChange={(e) => setWindData({ direction: parseFloat(e.target.value) || 0 })}
              className="input-field font-mono"
            />
          </div>
          <div>
            <label className="label-text">飞行航向 (°)</label>
            <input
              type="number"
              min="0"
              max="360"
              value={windData.flightDirection}
              onChange={(e) => setWindData({ flightDirection: parseFloat(e.target.value) || 0 })}
              className="input-field font-mono"
            />
          </div>
          <div>
            <label className="label-text">海拔高度 (m)</label>
            <input
              type="number"
              value={windData.altitude}
              onChange={(e) => setWindData({ altitude: parseFloat(e.target.value) || 0 })}
              className="input-field font-mono"
            />
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-aviation-400" />
          载重配置
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-text">相机重量 (g)</label>
            <input
              type="number"
              value={payloadData.cameraWeight}
              onChange={(e) => setPayloadData({ cameraWeight: parseFloat(e.target.value) || 0 })}
              className="input-field font-mono"
            />
          </div>
          <div>
            <label className="label-text">电池重量 (g)</label>
            <input
              type="number"
              value={payloadData.batteryWeight}
              onChange={(e) => setPayloadData({ batteryWeight: parseFloat(e.target.value) || 0 })}
              className="input-field font-mono"
            />
          </div>
          <div>
            <label className="label-text">附件重量 (g)</label>
            <input
              type="number"
              value={payloadData.accessoriesWeight}
              onChange={(e) => setPayloadData({ accessoriesWeight: parseFloat(e.target.value) || 0 })}
              className="input-field font-mono"
            />
          </div>
          <div>
            <label className="label-text">总载重 (g)</label>
            <input
              type="number"
              value={payloadData.totalWeight}
              className="input-field font-mono bg-slate-700/50"
              readOnly
            />
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Battery className="w-5 h-5 text-aviation-400" />
          电池状态
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-text">当前电量 (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={batteryStatus.currentCapacity}
              onChange={(e) => setBatteryStatus({ currentCapacity: parseFloat(e.target.value) || 0 })}
              className="input-field font-mono"
            />
          </div>
          <div>
            <label className="label-text">循环次数</label>
            <input
              type="number"
              value={batteryStatus.cycleCount}
              onChange={(e) => setBatteryStatus({ cycleCount: parseFloat(e.target.value) || 0 })}
              className="input-field font-mono"
            />
          </div>
          <div>
            <label className="label-text">温度 (°C)</label>
            <input
              type="number"
              value={batteryStatus.temperature}
              onChange={(e) => setBatteryStatus({ temperature: parseFloat(e.target.value) || 0 })}
              className="input-field font-mono"
            />
          </div>
          <div>
            <label className="label-text">健康度 (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={batteryStatus.health}
              onChange={(e) => setBatteryStatus({ health: parseFloat(e.target.value) || 0 })}
              className="input-field font-mono"
            />
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-aviation-400" />
          航线航点 ({waypoints.length})
        </h3>
        <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-thin">
          {waypoints.map((wp, index) => (
            <div
              key={wp.id}
              className="p-3 bg-slate-700/50 rounded-lg border border-slate-600"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-300">
                  航点 {index + 1}
                </span>
                <button
                  onClick={() => removeWaypoint(wp.id)}
                  className="p-1 hover:bg-danger-500/20 rounded text-danger-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-slate-400">纬度</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={wp.lat}
                    onChange={(e) => handleWaypointChange(wp.id, 'lat', e.target.value)}
                    className="input-field text-xs py-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">经度</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={wp.lng}
                    onChange={(e) => handleWaypointChange(wp.id, 'lng', e.target.value)}
                    className="input-field text-xs py-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">高度 (m)</label>
                  <input
                    type="number"
                    value={wp.altitude}
                    onChange={(e) => handleWaypointChange(wp.id, 'altitude', e.target.value)}
                    className="input-field text-xs py-1 font-mono"
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={handleAddWaypoint}
            className="w-full py-2 border border-dashed border-slate-600 rounded-lg text-slate-400 hover:border-aviation-400 hover:text-aviation-400 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加航点
          </button>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-aviation-400" />
          保守估算设置
        </h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <label className="label-text mb-0">保守系数</label>
              <span className="text-sm font-mono text-aviation-300">
                {conservativeFactor.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="2"
              step="0.05"
              value={conservativeFactor}
              onChange={(e) => setConservativeFactor(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-aviation-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              越高越保守，建议任务前设置为 1.15-1.25
            </p>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="label-text mb-0">安全电量余量 (%)</label>
              <span className="text-sm font-mono text-aviation-300">
                {safetyMargin}%
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="30"
              step="1"
              value={safetyMargin}
              onChange={(e) => setSafetyMargin(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-aviation-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              返航后预留的安全电量，建议 15-20%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
