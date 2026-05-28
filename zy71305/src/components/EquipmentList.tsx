import React, { useState } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import { useHoistStore } from '../store/useHoistStore';
import { Equipment, EQUIPMENT_TYPE_LABELS } from '../types';

export function EquipmentList() {
  const { equipment, addEquipment, updateEquipment, removeEquipment, points } =
    useHoistStore();
  const [newEquipment, setNewEquipment] = useState<Partial<Equipment>>({
    name: '',
    type: 'light',
    weight: 0,
    quantity: 1,
    assignedPointId: null,
  });

  const totalWeight = equipment.reduce(
    (sum, e) => sum + e.weight * e.quantity,
    0
  );

  const handleAdd = () => {
    if (!newEquipment.name?.trim()) return;
    addEquipment({
      name: newEquipment.name.trim(),
      type: newEquipment.type as Equipment['type'],
      weight: newEquipment.weight ?? 0,
      quantity: newEquipment.quantity ?? 1,
      assignedPointId: newEquipment.assignedPointId ?? null,
    });
    setNewEquipment({
      name: '',
      type: 'light',
      weight: 0,
      quantity: 1,
      assignedPointId: null,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  const getTypeColor = (type: Equipment['type']) => {
    switch (type) {
      case 'light':
        return 'text-amber-400 bg-amber-500/20';
      case 'speaker':
        return 'text-blue-400 bg-blue-500/20';
      case 'safetyRope':
        return 'text-green-400 bg-green-500/20';
      default:
        return 'text-slate-400 bg-slate-500/20';
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <Package className="w-5 h-5 text-amber-400" />
        <h3 className="text-lg font-semibold text-white">设备清单</h3>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="text-slate-400">
            共 {equipment.reduce((sum, e) => sum + e.quantity, 0)} 台
          </span>
          <span className="text-amber-400 font-mono">
            {totalWeight.toFixed(1)} kg
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-4 text-sm text-slate-400 px-2">
        <span className="col-span-1">名称</span>
        <span>类型</span>
        <span>单重(kg)</span>
        <span>数量</span>
        <span>小计(kg)</span>
        <span>分配吊点</span>
        <span>操作</span>
      </div>

      <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
        {equipment.map((eq) => (
          <div key={eq.id} className="grid grid-cols-7 gap-2 items-center">
            <input
              type="text"
              value={eq.name}
              onChange={(e) => updateEquipment(eq.id, { name: e.target.value })}
              className="col-span-1 bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-blue-500 focus:outline-none"
            />
            <select
              value={eq.type}
              onChange={(e) =>
                updateEquipment(eq.id, {
                  type: e.target.value as Equipment['type'],
                })
              }
              className={`px-2 py-1 rounded text-sm font-medium border border-slate-600 focus:outline-none ${getTypeColor(eq.type)}`}
            >
              {Object.entries(EQUIPMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.1"
              min="0"
              value={eq.weight}
              onChange={(e) =>
                updateEquipment(eq.id, { weight: parseFloat(e.target.value) || 0 })
              }
              className="bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-blue-500 focus:outline-none"
            />
            <input
              type="number"
              min="1"
              value={eq.quantity}
              onChange={(e) =>
                updateEquipment(eq.id, {
                  quantity: parseInt(e.target.value) || 1,
                })
              }
              className="bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-blue-500 focus:outline-none"
            />
            <span className="text-white text-sm font-mono text-center">
              {(eq.weight * eq.quantity).toFixed(1)}
            </span>
            <select
              value={eq.assignedPointId ?? ''}
              onChange={(e) =>
                updateEquipment(eq.id, {
                  assignedPointId: e.target.value || null,
                })
              }
              className={`bg-slate-700 px-2 py-1 rounded text-sm border focus:outline-none ${
                !eq.assignedPointId
                  ? 'border-yellow-500 text-yellow-400'
                  : 'border-slate-600 text-white focus:border-blue-500'
              }`}
            >
              <option value="">未分配</option>
              {points.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => removeEquipment(eq.id)}
              className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-700 pt-4">
        <div className="grid grid-cols-7 gap-2 items-center">
          <input
            type="text"
            placeholder="设备名称"
            value={newEquipment.name}
            onChange={(e) => setNewEquipment({ ...newEquipment, name: e.target.value })}
            onKeyDown={handleKeyDown}
            className="col-span-1 bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-blue-500 focus:outline-none placeholder-slate-500"
          />
          <select
            value={newEquipment.type}
            onChange={(e) =>
              setNewEquipment({
                ...newEquipment,
                type: e.target.value as Equipment['type'],
              })
            }
            className="bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-blue-500 focus:outline-none"
          >
            {Object.entries(EQUIPMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="单重"
            value={newEquipment.weight || ''}
            onChange={(e) =>
              setNewEquipment({
                ...newEquipment,
                weight: parseFloat(e.target.value) || 0,
              })
            }
            onKeyDown={handleKeyDown}
            className="bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-blue-500 focus:outline-none placeholder-slate-500"
          />
          <input
            type="number"
            min="1"
            placeholder="数量"
            value={newEquipment.quantity || ''}
            onChange={(e) =>
              setNewEquipment({
                ...newEquipment,
                quantity: parseInt(e.target.value) || 1,
              })
            }
            onKeyDown={handleKeyDown}
            className="bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-blue-500 focus:outline-none placeholder-slate-500"
          />
          <span className="text-slate-500 text-sm font-mono text-center">
            -
          </span>
          <select
            value={newEquipment.assignedPointId ?? ''}
            onChange={(e) =>
              setNewEquipment({
                ...newEquipment,
                assignedPointId: e.target.value || null,
              })
            }
            className="bg-slate-700 text-white px-2 py-1 rounded text-sm border border-slate-600 focus:border-blue-500 focus:outline-none"
          >
            <option value="">未分配</option>
            {points.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!newEquipment.name?.trim()}
            className="flex items-center justify-center gap-1 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-3 py-1 rounded text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加
          </button>
        </div>
      </div>

      {equipment.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>暂无设备，请添加灯具、音箱等设备</p>
        </div>
      )}
    </div>
  );
}
