import React from 'react';
import { Info, Power, Clock, AlertTriangle, MapPin, ChevronLeft, List, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useScreenSize } from '@/hooks/useScreenSize';

interface RightPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({ isOpen, onToggle }) => {
  const { isMobile, isTablet } = useScreenSize();
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

  const panelWidth = isMobile ? 'w-full' : isTablet ? 'w-64' : 'w-72';
  const maxHeight = isMobile ? 'max-h-[70vh]' : '';

  return (
    <>
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onToggle}
        />
      )}

      <div
        className={`absolute right-0 top-0 h-full bg-white shadow-lg z-50 transition-all duration-300 flex flex-col ${
          isMobile ? 'fixed' : ''
        } ${panelWidth} ${maxHeight} ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {isMobile && (
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Info size={18} className="text-blue-600" />
              信息面板
            </h2>
            <button
              onClick={onToggle}
              className="p-1.5 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        )}

        <button
          onClick={onToggle}
          className={`absolute top-1/2 -translate-y-1/2 bg-white shadow-lg p-2 hover:bg-gray-50 transition-colors z-40 ${
            isOpen
              ? 'right-[288px] rounded-l-lg'
              : 'right-0 rounded-l-lg'
          } ${isTablet ? 'right-[256px]' : ''} ${isMobile ? 'hidden' : ''}`}
          style={{ right: isOpen ? (isTablet ? '256px' : '288px') : '0' }}
        >
          <ChevronLeft
            size={20}
            className={`text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <div className={`flex-1 overflow-y-auto ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {!isMobile && (
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Info size={20} className="text-blue-600" />
                信息面板
              </h2>
            </div>
          )}

          {selectedValve ? (
            <div className={`p-${isMobile ? '3' : '4'}`}>
              <div className="bg-blue-50 rounded-xl p-3 mb-3">
                <h3 className="font-bold text-gray-800 text-base mb-2">
                  {selectedValve.name}
                </h3>
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                      selectedValve.status
                    )}`}
                  >
                    {getStatusLabel(selectedValve.status)}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      selectedValve.isOpen
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {selectedValve.isOpen ? '开启' : '关闭'}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{selectedValve.description}</p>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 text-xs">
                  <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600">位置：</span>
                  <span className="text-gray-800 font-medium">
                    {selectedValve.position.x.toFixed(1)}, {selectedValve.position.y.toFixed(1)}, {selectedValve.position.z.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Clock size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600">检修：</span>
                  <span className="text-gray-800 font-medium">
                    {selectedValve.maintenanceDate || '-'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <AlertTriangle size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600">到期：</span>
                  <span className={`font-medium ${
                    selectedValve.status === 'expired' ? 'text-red-600' : 'text-gray-800'
                  }`}>
                    {selectedValve.expiryDate || '-'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => toggleValve(selectedValve.id)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium transition-all text-sm ${
                  selectedValve.isOpen
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                <Power size={16} />
                {selectedValve.isOpen ? '关闭阀门' : '开启阀门'}
              </button>

              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-700 text-xs">影响病区</h4>
                  <label className="flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAffectedArea}
                      onChange={toggleShowAffectedArea}
                      className="w-3 h-3"
                    />
                    高亮
                  </label>
                </div>
                <div className="space-y-1.5">
                  {affectedWards.map((ward) => (
                    <div
                      key={ward.id}
                      className="flex items-center gap-2 p-2 rounded-lg"
                      style={{ backgroundColor: ward.color + '20' }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: ward.color }}
                      />
                      <span className="text-xs font-medium text-gray-700 truncate">
                        {ward.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className={`p-${isMobile ? '6' : '8'} text-center`}>
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Info size={22} className="text-gray-400" />
              </div>
              <p className="text-gray-500 text-xs">点击场景中的阀门查看详情</p>
              <p className="text-gray-400 text-xs mt-1">双击阀门可切换开关状态</p>
            </div>
          )}

          <div className={`border-t border-gray-100 p-${isMobile ? '3' : '4'}`}>
            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-xs">
              <List size={14} />
              操作日志
            </h3>
            {operationLogs.length > 0 ? (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {operationLogs.slice(0, isMobile ? 5 : 10).map((log) => (
                  <div
                    key={log.id}
                    className="p-2 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-medium text-gray-700 text-xs truncate max-w-[120px]">
                        {log.valveName}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs flex-shrink-0 ${
                          log.action === 'open'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {log.action === 'open' ? '开' : '关'}
                      </span>
                    </div>
                    <div className="text-gray-400 text-xs">
                      {formatTime(log.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-xs text-center py-3">暂无操作记录</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default RightPanel;
