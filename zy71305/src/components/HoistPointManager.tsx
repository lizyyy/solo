import React, { useState } from 'react';
import { Plus, Trash2, MapPin } from 'lucide-react';
import { useHoistStore } from '../store/useHoistStore';
import { HoistPoint } from '../types';

export function HoistPointManager() {
  const { points, addPoint, updatePoint, removePoint } = useHoistStore();
  const [newPoint, setNewPoint] = useState<Partial<HoistPoint>>({
    name: '',
    x: 0,
    y: 0,
    z: 8,
    angle: 60,
    assignedEquipment: [],
  });

  const handleAdd = () => {
    if (!newPoint.name?.trim()) return;
    addPoint({
      name: newPoint.name.trim(),
      x: newPoint.x ?? 0,
      y: newPoint.y ?? 0,
      z: newPoint.z ?? 8,
      angle: newPoint.angle ?? 60,
      assignedEquipment: [],
    });
    setNewPoint({ name: '', x: 0, y: 0, z: 8, angle: 60, assignedEquipment: [] });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">吊点管理</h3>
        <span className="text-sm text-slate-400 ml-auto">
          共 {points.length} 个吊点
        </span>
      </div>

      <div className="grid grid-cols-6 gap-2 mb-4 text-sm text-slate-400 px-2">
        <span className="col-span-1">名称</span>
        <span>X(m)</span>
        <span>Y(m)</span>
        <span>高度(m)</span>
        <span>角度(°)</span>
        <span>操作</span>
      </div>

      <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
        {points.map((point) => (
          <div key={point.id} className="grid grid-cols-6 gap-2 items-center">
            <input
              type="text"
              value={point.name}
              onChange={(e) => updatePoint(point.id, { name: e.target.value })}
              className="col-span-1 bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-blue-500 focus:outline-none"
            />
            <input
              type="number"
              step="0.1"
              value={point.x}
              onChange={(e) => updatePoint(point.id, { x: parseFloat(e.target.value) || 0 })}
              className="bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-blue-500 focus:outline-none"
            />
            <input
              type="number"
              step="0.1"
              value={point.y}
              onChange={(e) => updatePoint(point.id, { y: parseFloat(e.target.value) || 0 })}
              className="bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-blue-500 focus:outline-none"
            />
            <input
              type="number"
              step="0.1"
              value={point.z}
              onChange={(e) => updatePoint(point.id, { z: parseFloat(e.target.value) || 0 })}
              className="bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-blue-500 focus:outline-none"
            />
            <input
              type="number"
              min="15"
              max="90"
              value={point.angle ?? ''}
              onChange={(e) =>
                updatePoint(point.id, {
                  angle: e.target.value === '' ? null : parseFloat(e.target.value),
                })
              }
              className={`bg-slate-700 text-white px-2 py-1 rounded text-sm border focus:outline-none ${
                point.angle === null || point.angle < 15 || point.angle > 90
                  ? 'border-red-500'
                  : 'border-slate-600 focus:border-blue-500'
              }`}
              placeholder="角度"
            />
            <button
              onClick={() => removePoint(point.id)}
              className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-700 pt-4">
        <div className="grid grid-cols-6 gap-2 items-center">
          <input
            type="text"
            placeholder="吊点名称"
            value={newPoint.name}
            onChange={(e) => setNewPoint({ ...newPoint, name: e.target.value })}
            onKeyDown={handleKeyDown}
            className="col-span-1 bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-blue-500 focus:outline-none placeholder-slate-500"
          />
          <input
            type="number"
            step="0.1"
            placeholder="X"
            value={newPoint.x}
            onChange={(e) => setNewPoint({ ...newPoint, x: parseFloat(e.target.value) || 0 })}
            onKeyDown={handleKeyDown}
            className="bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-blue-500 focus:outline-none placeholder-slate-500"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Y"
            value={newPoint.y}
            onChange={(e) => setNewPoint({ ...newPoint, y: parseFloat(e.target.value) || 0 })}
            onKeyDown={handleKeyDown}
            className="bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-blue-500 focus:outline-none placeholder-slate-500"
          />
          <input
            type="number"
            step="0.1"
            placeholder="高度"
            value={newPoint.z}
            onChange={(e) => setNewPoint({ ...newPoint, z: parseFloat(e.target.value) || 0 })}
            onKeyDown={handleKeyDown}
            className="bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-blue-500 focus:outline-none placeholder-slate-500"
          />
          <input
            type="number"
            min="15"
            max="90"
            placeholder="角度"
            value={newPoint.angle ?? ''}
            onChange={(e) =>
              setNewPoint({
                ...newPoint,
                angle: e.target.value === '' ? null : parseFloat(e.target.value),
              })
            }
            onKeyDown={handleKeyDown}
            className="bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-blue-500 focus:outline-none placeholder-slate-500"
          />
          <button
            onClick={handleAdd}
            disabled={!newPoint.name?.trim()}
            className="flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-3 py-1 rounded text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加
          </button>
        </div>
      </div>

      {points.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>暂无吊点，请添加吊点开始计算</p>
        </div>
      )}
    </div>
  );
}
