import { useAppStore } from '../store/appStore';
import { ANOMALY_LABELS } from '../data/mockData';
import { AnomalyType } from '../types';

export default function StatusBar() {
  const {
    getFilteredData,
    isRotating,
    toggleRotation,
    permission,
    updatePermission,
    permissionManager,
  } = useAppStore();

  const filteredData = getFilteredData();
  
  const totalEmission = filteredData.reduce((sum, f) => sum + f.carbonEmission, 0);
  const avgLoadFactor = filteredData.filter(f => f.loadFactor !== null).reduce((sum, f) => sum + (f.loadFactor || 0), 0) / 
    Math.max(1, filteredData.filter(f => f.loadFactor !== null).length);
  const confirmedCount = filteredData.filter(f => f.status === 'confirmed').length;
  const tentativeCount = filteredData.filter(f => f.status === 'tentative').length;
  
  const anomalyCounts = filteredData.reduce((acc, f) => {
    f.anomalies.forEach(a => {
      acc[a] = (acc[a] || 0) + 1;
    });
    return acc;
  }, {} as Record<AnomalyType, number>);

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg p-4 text-white">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-xs text-slate-400">筛选后数据</p>
            <p className="text-xl font-bold text-white">{filteredData.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400">总碳排放</p>
            <p className="text-xl font-bold text-amber-400">
              {(totalEmission / 1000).toFixed(1)} tCO₂
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400">平均载客率</p>
            <p className={`text-xl font-bold ${
              avgLoadFactor < 65 ? 'text-red-400' : avgLoadFactor < 75 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {avgLoadFactor.toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400">已确认/临时</p>
            <p className="text-xl font-bold">
              <span className="text-blue-400">{confirmedCount}</span>
              <span className="text-slate-500">/</span>
              <span className="text-purple-400">{tentativeCount}</span>
            </p>
          </div>
        </div>

        <div className="h-8 w-px bg-slate-700"></div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">异常:</span>
          {(Object.keys(anomalyCounts) as AnomalyType[]).map(anomaly => (
            <div 
              key={anomaly}
              className="flex items-center gap-1 px-2 py-1 bg-amber-900/50 border border-amber-700/50 rounded text-xs"
            >
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
              <span>{ANOMALY_LABELS[anomaly]}</span>
              <span className="text-amber-300 font-bold">{anomalyCounts[anomaly]}</span>
            </div>
          ))}
          {Object.keys(anomalyCounts).length === 0 && (
            <span className="text-xs text-slate-500">无异常</span>
          )}
        </div>

        <div className="flex-1"></div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleRotation}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              isRotating 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            }`}
          >
            {isRotating ? '⏸ 暂停旋转' : '▶ 自动旋转'}
          </button>

          <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
            <span className="text-xs text-slate-400">权限模拟:</span>
            <select
              value={permission.role}
              onChange={(e) => {
                const role = e.target.value as 'admin' | 'analyst' | 'viewer';
                updatePermission({
                  role,
                  canViewSensitive: role === 'admin',
                  canExport: role !== 'viewer',
                  canEdit: role === 'admin',
                });
                permissionManager.logAction('change_role', { field: 'role', newValue: role });
              }}
              className="px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
            >
              <option value="admin">管理员 (全权限)</option>
              <option value="analyst">分析师 (无敏感)</option>
              <option value="viewer">查看者 (只读)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
