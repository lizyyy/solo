import { useState } from 'react';
import { PathWaypoint, PathSegment, ValidationResult, SavedPlan, YardConfig } from '../types';
import { formatDistance } from '../utils/geometry';

interface SidebarProps {
  waypoints: PathWaypoint[];
  segments: PathSegment[];
  validation: ValidationResult | null;
  savedPlans: SavedPlan[];
  yardConfig: YardConfig;
  onDeleteWaypoint: (id: string) => void;
  onLoadPlan: (plan: SavedPlan) => void;
  onDeletePlan: (id: string) => void;
}

type TabType = 'path' | 'validation' | 'history' | 'zones';

export const Sidebar = ({
  waypoints,
  segments,
  validation,
  savedPlans,
  yardConfig,
  onDeleteWaypoint,
  onLoadPlan,
  onDeletePlan
}: SidebarProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('path');

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'path', label: '路径', icon: '🛤️' },
    { key: 'validation', label: '验证', icon: '✅' },
    { key: 'history', label: '历史', icon: '📁' },
    { key: 'zones', label: '区域', icon: '🗺️' }
  ];

  return (
    <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col h-full">
      <div className="flex border-b border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-2 py-2 text-xs transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-700'
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'path' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-2">航点列表</h3>
              {waypoints.length === 0 ? (
                <p className="text-gray-500 text-xs">点击场景绘制路径...</p>
              ) : (
                <div className="space-y-1">
                  {waypoints.map((wp, idx) => (
                    <div
                      key={wp.id}
                      className="bg-gray-700 rounded p-2 text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span className={`font-semibold ${
                          wp.type === 'start' ? 'text-green-400' :
                          wp.type === 'end' ? 'text-orange-400' : 'text-blue-400'
                        }`}>
                          {idx + 1}. {wp.type === 'start' ? '起点' : wp.type === 'end' ? '终点' : '途经点'}
                        </span>
                        <button
                          onClick={() => onDeleteWaypoint(wp.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="text-gray-400 mt-1">
                        X: {wp.position.x.toFixed(2)} | 
                        Y: {wp.position.y.toFixed(2)} | 
                        Z: {wp.position.z.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {segments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-2">路径分段</h3>
                <div className="space-y-1">
                  {segments.map((seg, idx) => (
                    <div
                      key={seg.id}
                      className="bg-gray-700 rounded p-2 text-xs flex justify-between items-center"
                    >
                      <span className="text-gray-300">
                        {idx + 1}. 段 {idx + 1}
                      </span>
                      <span className="text-blue-400 font-mono">
                        {formatDistance(seg.distance)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'validation' && (
          <div className="space-y-4">
            {!validation ? (
              <p className="text-gray-500 text-xs">绘制路径后进行验证...</p>
            ) : (
              <>
                <div className={`p-3 rounded-lg text-center font-bold ${
                  validation.isValid ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                }`}>
                  {validation.isValid ? '✅ 验证通过' : '❌ 验证失败'}
                </div>

                {validation.errors.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-red-400 mb-2">
                      错误 ({validation.errors.filter(e => e.severity === 'error').length})
                    </h3>
                    <div className="space-y-2">
                      {validation.errors.map(error => (
                        <div
                          key={error.id}
                          className={`p-2 rounded text-xs ${
                            error.severity === 'error' 
                              ? 'bg-red-900/50 border border-red-700' 
                              : 'bg-yellow-900/50 border border-yellow-700'
                          }`}
                        >
                          <div className="font-semibold text-red-300">
                            [{error.type}]
                          </div>
                          <div className="text-gray-300 mt-1">{error.message}</div>
                          {error.position && (
                            <div className="text-gray-500 mt-1 text-xs">
                              位置: ({error.position.x.toFixed(2)}, {error.position.y.toFixed(2)}, {error.position.z.toFixed(2)})
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {validation.warnings.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-yellow-400 mb-2">
                      警告 ({validation.warnings.length})
                    </h3>
                    <div className="space-y-2">
                      {validation.warnings.map(warning => (
                        <div
                          key={warning.id}
                          className="p-2 rounded text-xs bg-yellow-900/30 border border-yellow-700"
                        >
                          <div className="font-semibold text-yellow-300">
                            [{warning.type}]
                          </div>
                          <div className="text-gray-300 mt-1">{warning.message}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            {savedPlans.length === 0 ? (
              <p className="text-gray-500 text-xs">暂无保存的方案</p>
            ) : (
              savedPlans.map(plan => (
                <div
                  key={plan.id}
                  className="bg-gray-700 rounded p-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">
                        {plan.name}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(plan.createdAt).toLocaleString('zh-CN')}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        航点: {plan.pathPlan.waypoints.length} | 
                        距离: {formatDistance(plan.pathPlan.totalDistance)}
                      </div>
                      <div className={`text-xs mt-1 ${
                        plan.validation.isValid ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {plan.validation.isValid ? '✅ 有效' : '❌ 无效'}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => onLoadPlan(plan)}
                        className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                      >
                        加载
                      </button>
                      <button
                        onClick={() => onDeletePlan(plan.id)}
                        className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'zones' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-2">货位信息</h3>
              <div className="text-xs text-gray-400 mb-2">
                总数: {yardConfig.slots.length} | 
                占用: {yardConfig.slots.filter(s => s.occupied).length} | 
                空闲: {yardConfig.slots.filter(s => !s.occupied).length}
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {yardConfig.slots.map(slot => (
                  <div
                    key={slot.id}
                    className={`p-2 rounded text-xs ${
                      slot.occupied ? 'bg-orange-900/30' : 'bg-green-900/30'
                    }`}
                  >
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-300">{slot.name}</span>
                      <span className={slot.occupied ? 'text-orange-400' : 'text-green-400'}>
                        {slot.occupied ? '占用' : '空闲'}
                      </span>
                    </div>
                    {slot.cargo && (
                      <div className="text-gray-500 mt-1">
                        货物: {slot.cargo.name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {yardConfig.forbiddenZones.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-red-400 mb-2">禁行区域</h3>
                <div className="space-y-1">
                  {yardConfig.forbiddenZones.map(zone => (
                    <div
                      key={zone.id}
                      className="p-2 rounded text-xs bg-red-900/30 border border-red-700"
                    >
                      <div className="font-semibold text-red-300">{zone.name}</div>
                      <div className="text-gray-400 mt-1">原因: {zone.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
