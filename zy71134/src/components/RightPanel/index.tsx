import React from 'react';
import { Info, Power, Clock, AlertTriangle, MapPin, ChevronRight, List } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

interface RightPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({ isOpen, onToggle }) => {
  const {
    selectedValveId,
    valves,
    wards,
    operationLogs,
    toggleValve,
    toggleShowAffectedArea,
    showAffectedArea,
  } = useAppStore();

  const selectedValve = valves.find((v) => v.id === selectedValveId);
  const affectedWards = selectedValve
    ? wards.filter((w) => selectedValve.affectedWards.includes(w.id))
    : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal':
        return 'bg-green-100 text-green-700';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-700';
      case 'fault':
        return 'bg-red-100 text-red-700';
      case 'expired':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'normal':
        return '正常';
      case 'maintenance':
        return '检修中';
      case 'fault':
        return '故障';
      case 'expired':
        return '检修过期';
      default:
        return '未知';
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`absolute right-0 top-0 h-full bg-white shadow-lg z-10 transition-all duration-300 flex ${
        isOpen ? 'w-72' : 'w-0'
      }`}
    >
      <button
        onClick={onToggle}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full bg-white shadow-lg rounded-l-lg p-2 hover:bg-gray-50 transition-colors z-20"
      >
        <ChevronRight
          size={20}
          className={`text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <div className={`flex-1 overflow-y-auto ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Info size={20} className="text-blue-600" />
            信息面板
          </h2>
        </div>

        {selectedValve ? (
          <div className="p-4">
            <div className="bg-blue-50 rounded-xl p-4 mb-4">
              <h3 className="font-bold text-gray-800 text-lg mb-2">
                {selectedValve.name}
              </h3>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                    selectedValve.status
                  )}`}
                >
                  {getStatusLabel(selectedValve.status)}
                </span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedValve.isOpen
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {selectedValve.isOpen ? '开启' : '关闭'}
                </span>
              </div>
              <p className="text-sm text-gray-600">{selectedValve.description}</p>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-3 text-sm">
                <MapPin size={16} className="text-gray-400" />
                <span className="text-gray-600">位置：</span>
                <span className="text-gray-800 font-medium">
                  {selectedValve.position.x.toFixed(1)}, {selectedValve.position.y.toFixed(1)}, {selectedValve.position.z.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock size={16} className="text-gray-400" />
                <span className="text-gray-600">检修日期：</span>
                <span className="text-gray-800 font-medium">
                  {selectedValve.maintenanceDate || '-'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <AlertTriangle size={16} className="text-gray-400" />
                <span className="text-gray-600">到期日期：</span>
                <span className={`font-medium ${
                  selectedValve.status === 'expired' ? 'text-red-600' : 'text-gray-800'
                }`}>
                  {selectedValve.expiryDate || '-'}
                </span>
              </div>
            </div>

            <button
              onClick={() => toggleValve(selectedValve.id)}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${
                selectedValve.isOpen
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              <Power size={18} />
              {selectedValve.isOpen ? '关闭阀门' : '开启阀门'}
            </button>

            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-700 text-sm">影响病区</h4>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAffectedArea}
                    onChange={toggleShowAffectedArea}
                    className="w-3 h-3"
                  />
                  高亮显示
                </label>
              </div>
              <div className="space-y-2">
                {affectedWards.map((ward) => (
                  <div
                    key={ward.id}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ backgroundColor: ward.color + '20' }}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: ward.color }}
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {ward.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Info size={28} className="text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">点击场景中的阀门查看详情</p>
            <p className="text-gray-400 text-xs mt-2">双击阀门可切换开关状态</p>
          </div>
        )}

        <div className="border-t border-gray-100 p-4">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <List size={16} />
            操作日志
          </h3>
          {operationLogs.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {operationLogs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="p-2 bg-gray-50 rounded-lg text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-700">
                      {log.valveName}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs ${
                        log.action === 'open'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {log.action === 'open' ? '开启' : '关闭'}
                    </span>
                  </div>
                  <div className="text-gray-400">
                    {formatTime(log.timestamp)} · {log.user}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-xs text-center py-4">暂无操作记录</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RightPanel;
