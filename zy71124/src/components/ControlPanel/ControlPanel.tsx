import { useState } from 'react';
import { Bus, Search, Filter, Upload, RotateCcw, ChevronDown, GripVertical, Clock } from 'lucide-react';
import { useScheduleStore } from '../../store/useScheduleStore';
import { sampleData } from '../../data/samples';
import { ConflictDetector } from '../../engine/ConflictDetector';

export default function ControlPanel() {
  const { 
    buses, 
    selectedBusId, 
    selectBus, 
    filterStatus, 
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    loadSample,
    importData,
    reset,
    updateBusDepartureTime,
    conflicts,
    isPlaying,
  } = useScheduleStore();

  const [isExpanded, setIsExpanded] = useState(true);
  const [draggedBusId, setDraggedBusId] = useState<string | null>(null);
  const [dragOverBusId, setDragOverBusId] = useState<string | null>(null);

  const filteredBuses = buses.filter(bus => {
    const matchesStatus = filterStatus === 'all' || bus.status === filterStatus;
    const matchesSearch = bus.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          bus.route.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  }).sort((a, b) => a.departureTime - b.departureTime);

  const handleDragStart = (e: React.DragEvent, busId: string) => {
    setDraggedBusId(busId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, busId: string) => {
    e.preventDefault();
    setDragOverBusId(busId);
  };

  const handleDrop = (e: React.DragEvent, targetBusId: string) => {
    e.preventDefault();
    if (draggedBusId && draggedBusId !== targetBusId) {
      const draggedBus = buses.find(b => b.id === draggedBusId);
      const targetBus = buses.find(b => b.id === targetBusId);
      if (draggedBus && targetBus) {
        updateBusDepartureTime(draggedBusId, targetBus.departureTime);
      }
    }
    setDraggedBusId(null);
    setDragOverBusId(null);
  };

  const handleDragEnd = () => {
    setDraggedBusId(null);
    setDragOverBusId(null);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      parked: 'bg-gray-500',
      boarding: 'bg-blue-500',
      departing: 'bg-orange-500',
      departed: 'bg-green-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      parked: '待命',
      boarding: '上车中',
      departing: '发车中',
      departed: '已发车',
    };
    return labels[status] || status;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const hasConflict = (busId: string) => {
    return conflicts.some(c => c.involvedBuses.includes(busId) && !c.resolved);
  };

  return (
    <div className={`h-full bg-gray-900/95 backdrop-blur-sm border-r border-gray-700 flex flex-col transition-all duration-300 ${isExpanded ? 'w-72' : 'w-12'}`}>
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        {isExpanded && (
          <div className="flex items-center gap-2">
            <Bus className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-white">调度控制</span>
          </div>
        )}
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
        >
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
        </button>
      </div>

      {isExpanded && (
        <>
          <div className="p-3 border-b border-gray-700 space-y-2">
            <div className="text-xs text-gray-400 mb-2">场景样例</div>
            <select 
              onChange={(e) => loadSample(parseInt(e.target.value))}
              className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
              disabled={isPlaying}
            >
              {sampleData.map((sample, index) => (
                <option key={index} value={index}>{sample.name}</option>
              ))}
            </select>
            
            <div className="flex gap-2">
              <button 
                onClick={reset}
                className="flex-1 flex items-center justify-center gap-1 bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 px-3 rounded transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                重置
              </button>
              <label className="flex-1 flex items-center justify-center gap-1 bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 px-3 rounded cursor-pointer transition-colors">
                <Upload className="w-3 h-3" />
                导入
                <input 
                  type="file" 
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        try {
                          const data = JSON.parse(event.target?.result as string);
                          if (data.buses || data.queues || data.parkingSpots) {
                            importData(data);
                          } else if (data.busSchedule) {
                            alert('请使用调度系统导出的原始数据文件');
                          } else {
                            alert('无效的调度数据格式');
                          }
                        } catch (err) {
                          console.error('Import error:', err);
                          alert('导入失败，请检查文件格式');
                        }
                      };
                      reader.readAsText(file);
                    }
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          <div className="p-3 border-b border-gray-700 space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索车辆..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800 text-white text-sm rounded pl-8 pr-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            
            <div className="flex items-center gap-1">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="flex-1 bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">全部状态</option>
                <option value="parked">待命</option>
                <option value="boarding">上车中</option>
                <option value="departing">发车中</option>
                <option value="departed">已发车</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="text-xs text-gray-400 mb-2 flex items-center justify-between">
              <span>车辆列表 ({filteredBuses.length})</span>
              <span className="text-gray-500">拖拽调整发车顺序</span>
            </div>
            
            <div className="space-y-2">
              {filteredBuses.map((bus) => (
                <div
                  key={bus.id}
                  draggable={!isPlaying}
                  onDragStart={(e) => handleDragStart(e, bus.id)}
                  onDragOver={(e) => handleDragOver(e, bus.id)}
                  onDrop={(e) => handleDrop(e, bus.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => selectBus(bus.id === selectedBusId ? null : bus.id)}
                  className={`
                    relative p-3 rounded-lg border cursor-pointer transition-all
                    ${selectedBusId === bus.id 
                      ? 'bg-blue-900/50 border-blue-500' 
                      : hasConflict(bus.id)
                        ? 'bg-red-900/30 border-red-500/50 hover:bg-red-900/50'
                        : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                    }
                    ${dragOverBusId === bus.id ? 'border-dashed border-blue-400 bg-blue-900/30' : ''}
                    ${draggedBusId === bus.id ? 'opacity-50' : ''}
                  `}
                >
                  <div className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4 text-gray-500" />
                  </div>
                  
                  <div className="ml-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: bus.color }}
                        />
                        <span className="font-medium text-white text-sm">{bus.number}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs text-white ${getStatusColor(bus.status)}`}>
                        {getStatusLabel(bus.status)}
                      </span>
                    </div>
                    
                    <div className="text-xs text-gray-400 mb-2">{bus.route}</div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>{formatTime(bus.departureTime)}</span>
                      </div>
                      <div className="text-gray-400">
                        {bus.currentStudents}/{bus.capacity} 人
                      </div>
                    </div>

                    {hasConflict(bus.id) && (
                      <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        {conflicts
                          .filter(c => c.involvedBuses.includes(bus.id) && !c.resolved)
                          .map(c => ConflictDetector.getInstance().getConflictTypeLabel(c.type))
                          .join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
