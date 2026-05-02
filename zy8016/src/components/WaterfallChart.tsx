import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { 
  ParsedRequest, 
  ResourceType,
} from '@/types';
import { formatBytes, formatMilliseconds } from '@/utils/harParser';
import { Eye, Filter, X } from 'lucide-react';
import { clsx } from 'clsx';

interface WaterfallChartProps {
  requests: ParsedRequest[];
  onRequestSelect?: (request: ParsedRequest) => void;
  selectedRequest?: ParsedRequest | null;
  domContentLoaded?: number;
  onLoad?: number;
}

const resourceTypeColors: Record<ResourceType, string> = {
  document: '#3b82f6',
  stylesheet: '#8b5cf6',
  script: '#ec4899',
  image: '#10b981',
  font: '#f59e0b',
  media: '#ef4444',
  xhr: '#6366f1',
  fetch: '#14b8a6',
  websocket: '#84cc16',
  other: '#6b7280',
};

const phaseColors: Record<string, string> = {
  blocked: '#9ca3af',
  dns: '#8b5cf6',
  connect: '#f59e0b',
  ssl: '#ec4899',
  send: '#3b82f6',
  wait: '#10b981',
  receive: '#ef4444',
};

const phaseNames: Record<string, string> = {
  blocked: '阻塞',
  dns: 'DNS',
  connect: '连接',
  ssl: 'SSL',
  send: '发送',
  wait: '等待',
  receive: '接收',
};

const resourceTypeNames: Record<ResourceType, string> = {
  document: '文档',
  stylesheet: '样式表',
  script: '脚本',
  image: '图片',
  font: '字体',
  media: '媒体',
  xhr: 'XHR',
  fetch: 'Fetch',
  websocket: 'WebSocket',
  other: '其他',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length > 0) {
    const request = payload[0]?.payload?.request as ParsedRequest;
    if (!request) return null;

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-md">
        <div className="font-semibold text-gray-800 mb-2 truncate">
          {request.method} {request.url}
        </div>
        <div className="text-sm text-gray-600 space-y-1">
          <div>状态: <span className={request.status >= 200 && request.status < 300 ? 'text-green-600' : 'text-red-600'}>{request.status}</span></div>
          <div>类型: <span className="text-blue-600">{resourceTypeNames[request.resourceType]}</span></div>
          <div>大小: {formatBytes(request.transferSize)}</div>
          <div>总时间: {formatMilliseconds(request.totalTime)}</div>
          <div>协议: {request.protocol} {request.isHttp2 ? '(HTTP/2)' : ''}</div>
          {request.isFromCache && <div className="text-green-600">✓ 来自缓存</div>}
          {request.isThirdParty && <div className="text-orange-600">✓ 第三方资源</div>}
        </div>
      </div>
    );
  }
  return null;
};

const RequestDetailPanel: React.FC<{ 
  request: ParsedRequest; 
  onClose: () => void 
}> = ({ request, onClose }) => {
  return (
    <div className="bg-white border-l border-gray-200 p-4 overflow-y-auto max-h-[600px] scrollbar-thin">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg text-gray-800">请求详情</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <X size={20} />
        </button>
      </div>
      
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm text-gray-500 mb-1">URL</div>
          <div className="text-sm font-mono break-all">{request.url}</div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-500">方法</div>
            <div className="font-semibold">{request.method}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-500">状态</div>
            <div className={clsx(
              "font-semibold",
              request.status >= 200 && request.status < 300 ? "text-green-600" :
              request.status >= 400 ? "text-red-600" : "text-yellow-600"
            )}>{request.status}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-500">协议</div>
            <div className="font-semibold">{request.protocol} {request.isHttp2 && '(HTTP/2)'}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-500">类型</div>
            <div className="font-semibold">{resourceTypeNames[request.resourceType]}</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-500">传输大小</div>
            <div className="font-semibold">{formatBytes(request.transferSize)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-500">响应大小</div>
            <div className="font-semibold">{formatBytes(request.responseSize)}</div>
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm text-gray-500 mb-2">时间分解</div>
          <div className="space-y-1">
            {Object.entries(phaseNames).map(([key, name]) => {
              const time = (request as any)[`${key}Time`];
              if (!time || time <= 0) return null;
              return (
                <div key={key} className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span 
                      className="w-3 h-3 rounded" 
                      style={{ backgroundColor: phaseColors[key] }}
                    />
                    {name}
                  </span>
                  <span className="font-mono">{formatMilliseconds(time)}</span>
                </div>
              );
            })}
            <div className="flex justify-between text-sm font-semibold pt-1 border-t border-gray-200">
              <span>总计</span>
              <span>{formatMilliseconds(request.totalTime)}</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          {request.isFromCache && (
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
              缓存命中
            </span>
          )}
          {request.isThirdParty && (
            <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
              第三方
            </span>
          )}
          {request.isDuplicate && (
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
              重复 ({request.duplicateCount}次)
            </span>
          )}
          {request.hasMissingTiming && (
            <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
              缺少Timing
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const WaterfallChart: React.FC<WaterfallChartProps> = ({
  requests,
  onRequestSelect,
  selectedRequest,
  domContentLoaded,
  onLoad,
}) => {
  const [filterTypes, setFilterTypes] = useState<Set<ResourceType>>(new Set());
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  
  const allResourceTypes = useMemo(() => {
    const types = new Set<ResourceType>();
    requests.forEach(req => types.add(req.resourceType));
    return Array.from(types);
  }, [requests]);
  
  const filteredRequests = useMemo(() => {
    if (filterTypes.size === 0) return requests;
    return requests.filter(req => filterTypes.has(req.resourceType));
  }, [requests, filterTypes]);

  const chartData = useMemo(() => {
    if (filteredRequests.length === 0) return [];
    
    const baseTime = Math.min(...filteredRequests.map(r => r.startTime));
    
    return filteredRequests.map((request, index) => {
      const phases = [
        { key: 'blocked', time: request.blockedTime },
        { key: 'dns', time: request.dnsTime },
        { key: 'connect', time: request.connectTime },
        { key: 'ssl', time: request.sslTime },
        { key: 'send', time: request.sendTime },
        { key: 'wait', time: request.waitTime },
        { key: 'receive', time: request.receiveTime },
      ].filter(p => p.time > 0);

      const stackedData: any = {
        index: request.index + 1,
        start: (request.startTime - baseTime) / 1000,
        request,
        resourceType: request.resourceType,
      };

      let accumulated = 0;
      phases.forEach(phase => {
        stackedData[phase.key] = phase.time;
        accumulated += phase.time;
      });

      return stackedData;
    });
  }, [filteredRequests]);

  const handleBarClick = (data: any) => {
    if (data.payload?.request && onRequestSelect) {
      onRequestSelect(data.payload.request);
    }
  };

  const toggleFilter = (type: ResourceType) => {
    setFilterTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setFilterTypes(new Set());
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">请求瀑布图</h3>
        <div className="flex items-center gap-2">
          {filterTypes.size > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <X size={14} />
              清除筛选 ({filterTypes.size})
            </button>
          )}
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="p-2 hover:bg-gray-100 rounded-lg flex items-center gap-1 text-sm"
          >
            <Filter size={16} />
            筛选
          </button>
        </div>
      </div>

      {showFilterPanel && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm font-medium text-gray-700 mb-2">资源类型筛选</div>
          <div className="flex flex-wrap gap-2">
            {allResourceTypes.map(type => (
              <button
                key={type}
                onClick={() => toggleFilter(type)}
                className={clsx(
                  "px-3 py-1 rounded-full text-sm flex items-center gap-1.5",
                  filterTypes.has(type) 
                    ? "bg-gray-800 text-white" 
                    : "bg-white border border-gray-300 text-gray-700 hover:border-gray-400"
                )}
              >
                <span 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: resourceTypeColors[type] }}
                />
                {resourceTypeNames[type]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4 flex-1">
        <div className="flex-1 min-h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              onClick={(data) => data && handleBarClick(data)}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              
              <XAxis 
                type="number" 
                domain={[0, 'dataMax']}
                tickFormatter={(value) => `${(value / 1000).toFixed(2)}s`}
              />
              
              <YAxis 
                type="category" 
                dataKey="index" 
                width={50}
                tick={{ fontSize: 12 }}
              />
              
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
              />
              
              <Legend 
                formatter={(value) => phaseNames[value as string] || value}
              />
              
              {domContentLoaded && domContentLoaded > 0 && (
                <ReferenceLine 
                  x={domContentLoaded} 
                  stroke="#3b82f6" 
                  strokeDasharray="3 3"
                  label={{ value: 'DCL', position: 'top', fill: '#3b82f6' }}
                />
              )}
              
              {onLoad && onLoad > 0 && (
                <ReferenceLine 
                  x={onLoad} 
                  stroke="#ef4444" 
                  strokeDasharray="3 3"
                  label={{ value: 'onLoad', position: 'top', fill: '#ef4444' }}
                />
              )}
              
              <Bar dataKey="blocked" stackId="a" fill={phaseColors.blocked} />
              <Bar dataKey="dns" stackId="a" fill={phaseColors.dns} />
              <Bar dataKey="connect" stackId="a" fill={phaseColors.connect} />
              <Bar dataKey="ssl" stackId="a" fill={phaseColors.ssl} />
              <Bar dataKey="send" stackId="a" fill={phaseColors.send} />
              <Bar dataKey="wait" stackId="a" fill={phaseColors.wait} />
              <Bar dataKey="receive" stackId="a" fill={phaseColors.receive} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {selectedRequest && (
          <RequestDetailPanel 
            request={selectedRequest} 
            onClose={() => onRequestSelect?.(null as any)} 
          />
        )}
      </div>
    </div>
  );
};

export default WaterfallChart;
