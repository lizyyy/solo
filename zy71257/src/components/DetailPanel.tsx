import { useAppStore } from '../store/appStore';
import { ANOMALY_LABELS, FIELD_LABELS } from '../data/mockData';
import { FieldType, DataStatus } from '../types';
import { PermissionManager } from '../utils/permission';

export default function DetailPanel() {
  const {
    selectedFlightId,
    getFlightById,
    getRouteById,
    getAircraftById,
    permission,
    permissionManager,
    updateFlightFieldStatus,
    hoveredFlightId,
  } = useAppStore();

  const displayFlightId = selectedFlightId || hoveredFlightId;
  const flight = displayFlightId ? getFlightById(displayFlightId) : null;
  const route = flight ? getRouteById(flight.routeId) : undefined;
  const aircraft = flight ? getAircraftById(flight.aircraftId) : undefined;

  if (!flight || !route || !aircraft) {
    return (
      <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg p-4 text-white h-full">
        <h2 className="text-lg font-semibold mb-4">数据明细</h2>
        <div className="text-slate-400 text-sm space-y-2">
          <p>点击3D空间中的柱状图查看详细数据</p>
          <div className="mt-4 p-3 bg-slate-700/50 rounded">
            <p className="text-xs text-slate-400">提示：</p>
            <ul className="text-xs mt-2 space-y-1 list-disc list-inside">
              <li>鼠标悬停可预览数据</li>
              <li>点击选中后可编辑字段状态</li>
              <li>紫色标记为临时数据需要确认</li>
              <li>橙色边框标注存在异常</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const pm = permissionManager as PermissionManager;

  const handleFieldStatusChange = (field: FieldType, status: DataStatus) => {
    if (!permission.canEdit) return;
    updateFlightFieldStatus(flight.id, field, status);
  };

  const renderFieldStatus = (field: FieldType, value: string | number | null, maskField?: string) => {
    const status = flight.fieldStatuses[field];
    const displayValue = maskField ? pm.maskValue(maskField, value) : value;
    
    return (
      <div className="flex items-center justify-between py-1">
        <span className="text-slate-400 text-sm">{FIELD_LABELS[field]}</span>
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-mono">
            {displayValue ?? '-'}
          </span>
          {permission.canEdit && (
            <select
              value={status}
              onChange={(e) => handleFieldStatusChange(field, e.target.value as DataStatus)}
              className={`text-xs px-2 py-0.5 rounded border-none cursor-pointer ${
                status === 'confirmed' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-purple-600 text-white'
              }`}
              title="修改字段确认状态"
            >
              <option value="confirmed">已确认</option>
              <option value="tentative">临时</option>
            </select>
          )}
        </div>
      </div>
    );
  };

  const maskedRegistration = pm.maskValue('registration', aircraft.registration);
  const maskedPassengerCount = pm.maskValue('passengerCount', flight.passengerCount);

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg p-4 text-white h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">数据明细</h2>
        <span className={`text-xs px-2 py-1 rounded ${
          flight.status === 'confirmed' 
            ? 'bg-blue-600 text-white' 
            : 'bg-purple-600 text-white'
        }`}>
          {flight.status === 'confirmed' ? '已确认' : '临时备注'}
        </span>
      </div>

      <div className="space-y-4">
        <div className="p-3 bg-slate-700/50 rounded space-y-2">
          <h3 className="text-sm font-medium text-slate-300">航线信息</h3>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">航线</span>
              <span className="text-white text-sm font-medium">
                {route.origin} → {route.destination}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">距离</span>
              <span className="text-white text-sm">{route.distance.toLocaleString()} km</span>
            </div>
            {renderFieldStatus('route', route.id)}
          </div>
        </div>

        <div className="p-3 bg-slate-700/50 rounded space-y-2">
          <h3 className="text-sm font-medium text-slate-300">机型信息</h3>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">机型</span>
              <span className="text-white text-sm">{aircraft.model}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">注册号</span>
              <span className="text-white text-sm font-mono">{maskedRegistration}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">座位数</span>
              <span className="text-white text-sm">{aircraft.seatCount}</span>
            </div>
            {renderFieldStatus('aircraftType', aircraft.id)}
          </div>
        </div>

        <div className="p-3 bg-slate-700/50 rounded space-y-2">
          <h3 className="text-sm font-medium text-slate-300">运营数据</h3>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">日期</span>
              <span className="text-white text-sm">{flight.date}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">载客率</span>
              <span className={`text-sm font-medium ${
                flight.loadFactor === null ? 'text-amber-400' : 
                flight.loadFactor < 65 ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {flight.loadFactor !== null ? `${flight.loadFactor}%` : '缺失'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">旅客人数</span>
              <span className="text-white text-sm">{maskedPassengerCount}</span>
            </div>
            {renderFieldStatus('loadFactor', flight.loadFactor !== null ? `${flight.loadFactor}%` : null)}
          </div>
        </div>

        <div className="p-3 bg-slate-700/50 rounded space-y-2">
          <h3 className="text-sm font-medium text-slate-300">碳排放数据</h3>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">燃油消耗</span>
              <span className="text-white text-sm">{flight.fuelConsumption.toLocaleString()} kg</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">碳排因子</span>
              <span className="text-white text-sm">{flight.carbonFactor} kgCO₂/kg</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-600">
              <span className="text-slate-300 text-sm font-medium">碳排放量</span>
              <span className={`text-lg font-bold ${
                flight.carbonEmission > 50000 ? 'text-red-400' :
                flight.carbonEmission > 20000 ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {flight.carbonEmission.toLocaleString()} kgCO₂
              </span>
            </div>
            {renderFieldStatus('fuelConsumption', `${flight.fuelConsumption} kg`, 'fuelConsumption')}
            {renderFieldStatus('carbonFactor', flight.carbonFactor)}
          </div>
        </div>

        {flight.anomalies.length > 0 && (
          <div className="p-3 bg-amber-900/30 border border-amber-700/50 rounded space-y-2">
            <h3 className="text-sm font-medium text-amber-300">异常检测</h3>
            <div className="space-y-1">
              {flight.anomalies.map(anomaly => (
                <div key={anomaly} className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                  <span className="text-amber-200 text-sm">{ANOMALY_LABELS[anomaly]}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-amber-400/70 mt-2">
              * 回归测试样例，确认修改后不会重新漏掉
            </p>
          </div>
        )}

        {flight.remarks && (
          <div className="p-3 bg-slate-700/50 rounded">
            <h3 className="text-sm font-medium text-slate-300 mb-1">备注</h3>
            <p className="text-slate-400 text-sm">{flight.remarks}</p>
          </div>
        )}

        {renderFieldStatus('operationReport', flight.id)}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700">
        <p className="text-xs text-slate-500">
          {selectedFlightId ? '已选中 - 可修改字段状态' : hoveredFlightId ? '预览中 - 点击选中' : ''}
        </p>
      </div>
    </div>
  );
}
