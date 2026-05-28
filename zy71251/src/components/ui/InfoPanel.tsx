import { X, Package, Thermometer, Droplets, Clock, User, AlertTriangle, MapPin, Archive, PenLine, RotateCcw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useState } from 'react';
import useStore from '../../store/useStore';
import type { ArtBox } from '../../types';

const getConditionText = (condition: string) => {
  const map: Record<string, string> = {
    excellent: '完好',
    good: '良好',
    fair: '一般',
    needs_repair: '需修复'
  };
  return map[condition] || condition;
};

const getTypeText = (type: string) => {
  const map: Record<string, string> = {
    oil: '油画',
    chinese: '国画',
    sculpture: '雕塑',
    photography: '摄影',
    mixed: '综合材料'
  };
  return map[type] || type;
};

const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    occupied: '已占用',
    empty: '空置',
    reserved: '已预约',
    maintenance: '维护中'
  };
  return map[status] || status;
};

const getZoneText = (zone: string) => {
  const map: Record<string, string> = {
    normal: '普通区域',
    constant_temp: '恒温区域',
    valuables: '贵重品区'
  };
  return map[zone] || zone;
};

const formatValue = (value: number) => {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(1)}万`;
  }
  return `¥${value.toLocaleString()}`;
};

export default function InfoPanel() {
  const { selectedLocation, setSelectedLocation, assignBoxToLocation, revokeBoxFromLocation, addOperationLog } = useStore();
  const [showSupplementForm, setShowSupplementForm] = useState(false);
  const [supplementRemark, setSupplementRemark] = useState('');
  const [operator, setOperator] = useState('张管理员');

  const handleRevoke = () => {
    if (!selectedLocation) return;
    if (confirm(`确定要从库位 ${selectedLocation.code} 撤回箱子吗？`)) {
      revokeBoxFromLocation(selectedLocation.id, operator, supplementRemark || '撤回库位分配');
      setShowSupplementForm(false);
      setSupplementRemark('');
    }
  };

  const handleSupplementSubmit = () => {
    if (!selectedLocation || !supplementRemark.trim()) return;
    
    if (!selectedLocation.box) {
      const newBox: ArtBox = {
        id: `BX-SUP-${Date.now()}`,
        code: `BX-${String(2024500 + Math.floor(Math.random() * 1000))}`,
        locationId: selectedLocation.id,
        artworks: [
          {
            id: `ART-SUP-${Date.now()}`,
            name: '补录作品',
            artist: '待确认',
            type: 'mixed',
            year: new Date().getFullYear(),
            size: '待测量',
            condition: 'good',
            value: 0,
            accessionNumber: `SUP-${Date.now()}`
          }
        ],
        inDate: new Date().toISOString().split('T')[0],
        handler: operator,
        notes: supplementRemark,
        status: 'in_stock',
        material: 'wood',
        weight: 10
      };
      assignBoxToLocation(selectedLocation.id, newBox, operator);
    } else {
      addOperationLog('补录登记', operator, `库位 ${selectedLocation.code}: ${supplementRemark}`);
    }
    
    setShowSupplementForm(false);
    setSupplementRemark('');
  };

  if (!selectedLocation) {
    return (
      <div className="w-80 bg-slate-900/90 backdrop-blur-md border-l border-slate-700/50 h-full flex items-center justify-center">
        <div className="text-center text-slate-500">
          <MapPin size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">点击库位查看详情</p>
        </div>
      </div>
    );
  }

  const chartData = selectedLocation.sensor?.history?.slice(-12).map(h => ({
    time: new Date(h.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    温度: h.temp,
    湿度: h.humidity
  })) || [];

  return (
    <div className="w-80 bg-slate-900/90 backdrop-blur-md border-l border-slate-700/50 h-full flex flex-col">
      <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white font-mono">{selectedLocation.code}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded ${
              selectedLocation.status === 'occupied' ? 'bg-green-900/50 text-green-400' :
              selectedLocation.status === 'empty' ? 'bg-slate-700 text-slate-400' :
              selectedLocation.status === 'reserved' ? 'bg-blue-900/50 text-blue-400' :
              'bg-yellow-900/50 text-yellow-400'
            }`}>
              {getStatusText(selectedLocation.status)}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              selectedLocation.zone === 'valuables' ? 'bg-yellow-900/50 text-yellow-400' :
              selectedLocation.zone === 'constant_temp' ? 'bg-purple-900/50 text-purple-400' :
              'bg-slate-700 text-slate-400'
            }`}>
              {getZoneText(selectedLocation.zone)}
            </span>
          </div>
        </div>
        <button
          onClick={() => setSelectedLocation(null)}
          className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedLocation.sensor && (
          <div className="p-4 border-b border-slate-700/50">
            <h3 className="text-sm font-medium text-slate-300 mb-3">环境监测</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Thermometer size={14} />
                  温度
                </div>
                <div className={`text-2xl font-mono font-semibold ${
                  selectedLocation.sensor.temperature > 25 ? 'text-red-400' :
                  selectedLocation.sensor.temperature < 18 ? 'text-blue-400' :
                  'text-green-400'
                }`}>
                  {selectedLocation.sensor.temperature}°C
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Droplets size={14} />
                  湿度
                </div>
                <div className={`text-2xl font-mono font-semibold ${
                  selectedLocation.sensor.humidity > 60 ? 'text-red-400' :
                  selectedLocation.sensor.humidity < 40 ? 'text-blue-400' :
                  'text-green-400'
                }`}>
                  {selectedLocation.sensor.humidity}%
                </div>
              </div>
            </div>
            
            {selectedLocation.sensor.alerts.length > 0 && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 text-red-400 text-sm font-medium mb-2">
                  <AlertTriangle size={16} />
                  环境告警
                </div>
                <div className="space-y-1">
                  {selectedLocation.sensor.alerts.map((alert, i) => (
                    <div key={i} className="text-xs text-red-300 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${alert.level === 'critical' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                      {alert.type === 'temp_high' ? '温度过高' :
                       alert.type === 'temp_low' ? '温度过低' :
                       alert.type === 'humid_high' ? '湿度过高' : '湿度过低'}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {chartData.length > 0 && (
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#e2e8f0' }}
                    />
                    <Line type="monotone" dataKey="温度" stroke="#ef4444" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="湿度" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {selectedLocation.box && (
          <div className="p-4 border-b border-slate-700/50">
            <div className="flex items-center gap-2 mb-3">
              <Package size={16} className="text-amber-400" />
              <h3 className="text-sm font-medium text-slate-300">作品箱信息</h3>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-mono font-medium">{selectedLocation.box.code}</span>
                <span className="text-xs text-slate-500">{selectedLocation.box.material === 'wood' ? '木箱' : selectedLocation.box.material === 'metal' ? '金属箱' : '定制箱'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-slate-500">入库日期</div>
                <div className="text-slate-300 text-right">{selectedLocation.box.inDate}</div>
                <div className="text-slate-500">管理员</div>
                <div className="text-slate-300 text-right">{selectedLocation.box.handler}</div>
                <div className="text-slate-500">重量</div>
                <div className="text-slate-300 text-right">{selectedLocation.box.weight} kg</div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs text-slate-400 font-medium">箱内作品 ({selectedLocation.box.artworks.length})</h4>
              {selectedLocation.box.artworks.map((artwork, i) => (
                <div key={i} className="bg-slate-800/30 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-white font-medium text-sm">{artwork.name}</div>
                      <div className="text-slate-400 text-xs">{artwork.artist} · {artwork.year}</div>
                    </div>
                    <span className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded">
                      {getTypeText(artwork.type)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-slate-500">尺寸</div>
                      <div className="text-slate-300">{artwork.size}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">品相</div>
                      <div className="text-slate-300">{getConditionText(artwork.condition)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">估值</div>
                      <div className="text-amber-400">{formatValue(artwork.value)}</div>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-700/50 text-xs text-slate-500 font-mono">
                    登记号: {artwork.accessionNumber}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!selectedLocation.box && (
          <div className="p-4 border-b border-slate-700/50">
            <div className="bg-slate-800/30 rounded-lg p-4 text-center mb-3">
              <Archive size={32} className="mx-auto mb-2 text-slate-600" />
              <p className="text-slate-500 text-sm">该库位当前为空</p>
            </div>
            <button
              onClick={() => setShowSupplementForm(true)}
              className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <PenLine size={14} />
              补录箱子
            </button>
          </div>
        )}

        {selectedLocation.box && (
          <div className="p-4 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRevoke()}
                className="flex-1 py-2 px-3 bg-red-600/80 hover:bg-red-500 text-white rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <RotateCcw size={14} />
                撤回分配
              </button>
              <button
                onClick={() => setShowSupplementForm(true)}
                className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <PenLine size={14} />
                补录登记
              </button>
            </div>
          </div>
        )}

        {showSupplementForm && (
          <div className="p-4 border-b border-slate-700/50 bg-slate-800/30">
            <h4 className="text-sm font-medium text-slate-300 mb-3">
              {selectedLocation.box ? '补录登记信息' : '补录箱子分配'}
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">操作人</label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option>张管理员</option>
                  <option>李典藏</option>
                  <option>王组长</option>
                  <option>陈助理</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">补录原因 / 说明</label>
                <textarea
                  value={supplementRemark}
                  onChange={(e) => setSupplementRemark(e.target.value)}
                  placeholder="请输入补录原因，例如：补录2024-01-15入库记录"
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSupplementForm(false)}
                  className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSupplementSubmit}
                  disabled={!supplementRemark.trim()}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm transition-colors"
                >
                  确认提交
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-700/50">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock size={12} />
          <span>最后更新: {new Date().toLocaleString('zh-CN')}</span>
        </div>
      </div>
    </div>
  );
}
