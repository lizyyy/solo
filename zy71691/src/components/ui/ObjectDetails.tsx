import { Box, Package, Truck, Clock, Database, Layers, Weight, MapPin, Activity } from 'lucide-react';
import { useYardStore } from '@/store/useYardStore';
import { useState } from 'react';

interface ObjectDetailsProps {
  objectId: string;
  objectType: 'slot' | 'crane' | 'truck' | 'conflict';
}

export function ObjectDetails({ objectId, objectType }: ObjectDetailsProps) {
  const { containerSlots, cranes, trucks, conflicts } = useYardStore();
  const [showDataSource, setShowDataSource] = useState(false);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (objectType === 'slot') {
    const slot = containerSlots.find((s) => s.id === objectId);
    if (!slot) return null;

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
            <Box className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-white font-medium">箱位 {slot.bay}-{slot.row}-{slot.tier}</h3>
            <p className="text-xs text-slate-400">
              {slot.size === '40ft' ? '40英尺' : '20英尺'} ·{' '}
              {slot.status === 'occupied' ? '已占用' : slot.status === 'reserved' ? '已预留' : '空闲'}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">位置:</span>
            <span className="text-white">
              X: {slot.position.x.toFixed(1)}, Y: {slot.position.y.toFixed(1)}, Z: {slot.position.z.toFixed(1)}
            </span>
          </div>

          {slot.container && (
            <div className="bg-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300">集装箱信息</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">箱号</span>
                  <p className="text-white font-mono">{slot.container.number}</p>
                </div>
                <div>
                  <span className="text-slate-500">类型</span>
                  <p className="text-white">
                    {slot.container.type === 'dry'
                      ? '干货箱'
                      : slot.container.type === 'reefer'
                      ? '冷藏箱'
                      : '危险品箱'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">重量</span>
                  <p className="text-white">{slot.container.weight.toLocaleString()} kg</p>
                </div>
                <div>
                  <span className="text-slate-500">到港时间</span>
                  <p className="text-white">{formatDate(slot.container.arrivalTime)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">最后更新:</span>
            <span className="text-slate-300">{formatDate(slot.lastUpdated)}</span>
          </div>
        </div>

        <button
          onClick={() => setShowDataSource(!showDataSource)}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-400 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" />
            数据来源
          </span>
          <Layers className="w-3.5 h-3.5" />
        </button>

        {showDataSource && (
          <div className="bg-slate-800/50 rounded-lg p-3 space-y-1">
            <div className="text-xs text-slate-400">来源文件:</div>
            <div className="text-xs text-blue-400">{slot.dataSource}</div>
            <div className="text-xs text-slate-500 mt-2">
              * 数据来自箱位模型系统，每5分钟自动同步
            </div>
          </div>
        )}
      </div>
    );
  }

  if (objectType === 'crane') {
    const crane = cranes.find((c) => c.id === objectId);
    if (!crane) return null;

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <h3 className="text-white font-medium">{crane.name}</h3>
            <p className="text-xs">
              <span
                className={`px-1.5 py-0.5 rounded ${
                  crane.status === 'working'
                    ? 'bg-green-500/20 text-green-400'
                    : crane.status === 'maintenance'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}
              >
                {crane.status === 'working'
                  ? '作业中'
                  : crane.status === 'maintenance'
                  ? '维护中'
                  : '空闲'}
              </span>
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">位置:</span>
            <span className="text-white">
              X: {crane.position.x.toFixed(1)}, Y: {crane.position.y.toFixed(1)}, Z: {crane.position.z.toFixed(1)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Box className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">工作范围:</span>
            <span className="text-white">
              X: {crane.workingRange.minX} ~ {crane.workingRange.maxX}
            </span>
          </div>

          {crane.currentTask && (
            <div className="bg-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300">当前任务</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">任务类型</span>
                  <span className="text-white">
                    {crane.currentTask.type === 'load'
                      ? '装船'
                      : crane.currentTask.type === 'unload'
                      ? '卸船'
                      : '移箱'}
                  </span>
                </div>
                {crane.currentTask.containerNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">集装箱</span>
                    <span className="text-white font-mono">{crane.currentTask.containerNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">开始时间</span>
                  <span className="text-white">{formatDate(crane.currentTask.startTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">预计完成</span>
                  <span className="text-white">{formatDate(crane.currentTask.endTime)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">最后更新:</span>
          <span className="text-slate-300">{formatDate(crane.lastUpdated)}</span>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">数据来源:</div>
          <div className="text-xs text-blue-400">{crane.dataSource}</div>
        </div>
      </div>
    );
  }

  if (objectType === 'truck') {
    const truck = trucks.find((t) => t.id === objectId);
    if (!truck) return null;

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-600/20 flex items-center justify-center">
            <Truck className="w-5 h-5 text-cyan-500" />
          </div>
          <div>
            <h3 className="text-white font-medium">{truck.plateNumber}</h3>
            <p className="text-xs">
              <span
                className={`px-1.5 py-0.5 rounded ${
                  truck.status === 'moving'
                    ? 'bg-blue-500/20 text-blue-400'
                    : truck.status === 'loading'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : truck.status === 'unloading'
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}
              >
                {truck.status === 'moving'
                  ? '行驶中'
                  : truck.status === 'loading'
                  ? '装货中'
                  : truck.status === 'unloading'
                  ? '卸货中'
                  : '等待'}
              </span>
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">当前位置:</span>
            <span className="text-white">
              X: {truck.position.x.toFixed(1)}, Y: {truck.position.y.toFixed(1)}, Z: {truck.position.z.toFixed(1)}
            </span>
          </div>

          {truck.currentRoute && (
            <div className="bg-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300">当前路线</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">途经点</span>
                  <span className="text-white">{truck.currentRoute.waypoints.length} 个</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">出发时间</span>
                  <span className="text-white">{formatDate(truck.currentRoute.startTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">预计到达</span>
                  <span className="text-white">{formatDate(truck.currentRoute.endTime)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">最后更新:</span>
          <span className="text-slate-300">{formatDate(truck.lastUpdated)}</span>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">数据来源:</div>
          <div className="text-xs text-blue-400">{truck.dataSource}</div>
        </div>
      </div>
    );
  }

  if (objectType === 'conflict') {
    const conflict = conflicts.find((c) => c.id === objectId);
    if (!conflict) return null;

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              conflict.severity === 'critical' ? 'bg-red-600/20' : 'bg-orange-600/20'
            }`}
          >
            <Activity
              className={`w-5 h-5 ${conflict.severity === 'critical' ? 'text-red-500' : 'text-orange-500'}`}
            />
          </div>
          <div>
            <h3 className="text-white font-medium">{conflict.title}</h3>
            <p className="text-xs">
              <span
                className={`px-1.5 py-0.5 rounded ${
                  conflict.severity === 'critical'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-orange-500/20 text-orange-400'
                }`}
              >
                {conflict.severity === 'critical' ? '严重' : '警告'}
              </span>
            </p>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-sm text-slate-300">{conflict.description}</p>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-slate-400">受影响对象:</div>
          <div className="flex flex-wrap gap-1">
            {conflict.affectedObjectNames.map((name, index) => (
              <span key={index} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                {name}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-slate-400">数据来源:</div>
          <div className="flex flex-wrap gap-1">
            {conflict.dataSource.map((source, index) => (
              <span key={index} className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                {source}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">检测时间:</span>
          <span className="text-slate-300">{formatDate(conflict.timestamp)}</span>
        </div>
      </div>
    );
  }

  return null;
}
