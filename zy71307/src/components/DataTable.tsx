import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Upload, Download, Eye, EyeOff } from 'lucide-react';
import type { DataPoint, AnomalyPoint, ThrustUnit } from '@/types';
import { AnomalyBadge } from './AnomalyBadge';
import { thrustUnitLabels } from '@/utils/units';

interface DataTableProps {
  dataPoints: DataPoint[];
  anomalies: AnomalyPoint[];
  onAddPoint: (point: Omit<DataPoint, 'id'>) => void;
  onUpdatePoint: (id: string, updates: Partial<DataPoint>) => void;
  onDeletePoint: (id: string) => void;
  onToggleExclude: (id: string) => void;
  onBulkImport: (points: Omit<DataPoint, 'id'>[]) => void;
}

const unitOptions: ThrustUnit[] = ['g', 'kg', 'N', 'lbf'];

export const DataTable: React.FC<DataTableProps> = ({
  dataPoints,
  anomalies,
  onAddPoint,
  onUpdatePoint,
  onDeletePoint,
  onToggleExclude,
  onBulkImport,
}) => {
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const anomalyMap = new Map(anomalies.map(a => [a.dataPointId, a]));

  const sortedPoints = [...dataPoints].sort((a, b) => {
    if (a.propellerDiameter !== b.propellerDiameter) {
      return a.propellerDiameter - b.propellerDiameter;
    }
    return a.rpm - b.rpm;
  });

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleCellClick = (point: DataPoint, field: string, value: string | number) => {
    setEditingCell({ id: point.id, field });
    setEditValue(String(value));
  };

  const handleCellBlur = () => {
    if (editingCell) {
      const { id, field } = editingCell;
      let parsedValue: string | number = editValue;

      if (field !== 'thrustUnit' && field !== 'notes') {
        parsedValue = parseFloat(editValue) || 0;
      }

      onUpdatePoint(id, { [field]: parsedValue });
      setEditingCell(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const handleAddRow = () => {
    const lastPoint = sortedPoints[sortedPoints.length - 1];
    onAddPoint({
      timestamp: Date.now(),
      rpm: lastPoint ? lastPoint.rpm + 500 : 1000,
      voltage: lastPoint?.voltage || 11.1,
      current: lastPoint?.current || 1.5,
      propellerDiameter: lastPoint?.propellerDiameter || 10,
      thrust: 0,
      thrustUnit: lastPoint?.thrustUnit || 'N',
      isExcluded: false,
      notes: '',
    });
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    const points: Omit<DataPoint, 'id'>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < 6) continue;

      const getValue = (name: string) => {
        const idx = headers.indexOf(name);
        return idx >= 0 ? values[idx] : '';
      };

      points.push({
        timestamp: Date.now() + i * 60000,
        rpm: parseFloat(getValue('rpm') || getValue('转速')) || 0,
        voltage: parseFloat(getValue('voltage') || getValue('电压')) || 0,
        current: parseFloat(getValue('current') || getValue('电流')) || 0,
        propellerDiameter: parseFloat(getValue('diameter') || getValue('桨径') || getValue('propellerdiameter')) || 10,
        thrust: parseFloat(getValue('thrust') || getValue('推力')) || 0,
        thrustUnit: (getValue('unit') || getValue('单位') || getValue('thrustunit') || 'N') as ThrustUnit,
        isExcluded: false,
        notes: getValue('notes') || getValue('备注') || '',
      });
    }

    if (points.length > 0) {
      onBulkImport(points);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExportCSV = () => {
    const headers = ['转速(RPM)', '电压(V)', '电流(A)', '桨径(inch)', '推力', '推力单位', '是否排除', '备注'];
    const rows = sortedPoints.map(p => [
      p.rpm,
      p.voltage,
      p.current,
      p.propellerDiameter,
      p.thrust,
      p.thrustUnit,
      p.isExcluded ? '是' : '否',
      `"${p.notes}"`,
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `实验数据_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const renderCell = (point: DataPoint, field: keyof DataPoint, displayValue?: string) => {
    const isEditing = editingCell?.id === point.id && editingCell?.field === field;
    const value = point[field];
    const anomaly = anomalyMap.get(point.id);

    const cellClasses = `px-3 py-2 border-r border-industrial-700 font-mono text-sm ${
      point.isExcluded ? 'text-gray-600 line-through' : 'text-gray-200'
    } ${anomaly && field !== 'notes' ? 'bg-alert-orange/5' : ''}`;

    if (isEditing) {
      if (field === 'thrustUnit') {
        return (
          <td className={cellClasses}>
            <select
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleCellBlur}
              autoFocus
              className="w-full bg-industrial-800 border border-tech-500 rounded px-2 py-1 text-sm"
            >
              {unitOptions.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </td>
        );
      }

      return (
        <td className={cellClasses}>
          <input
            ref={inputRef}
            type={field === 'notes' ? 'text' : 'number'}
            step={field === 'voltage' || field === 'current' || field === 'thrust' ? '0.001' : '1'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCellBlur}
            onKeyDown={handleKeyDown}
            className="w-full bg-industrial-800 border border-tech-500 rounded px-2 py-1 text-sm"
          />
        </td>
      );
    }

    return (
      <td
        className={`${cellClasses} cursor-pointer hover:bg-industrial-700/50`}
        onClick={() => handleCellClick(point, field, value as string | number)}
      >
        {displayValue ?? value}
        {field === 'thrust' && (
          <span className="text-gray-500 text-xs ml-1">{point.thrustUnit}</span>
        )}
      </td>
    );
  };

  return (
    <div className="bg-industrial-800 border border-industrial-700 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-industrial-700">
        <div className="flex items-center gap-4">
          <h3 className="font-display text-sm font-semibold text-gray-100">实验数据</h3>
          <span className="text-xs text-gray-500 font-mono">
            共 {dataPoints.length} 条 · {anomalies.length} 条异常
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-industrial-600 rounded text-xs text-gray-300 hover:bg-industrial-700 transition-colors"
          >
            <Upload size={14} />
            导入CSV
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-industrial-600 rounded text-xs text-gray-300 hover:bg-industrial-700 transition-colors"
          >
            <Download size={14} />
            导出CSV
          </button>
          <button
            onClick={handleAddRow}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-tech-500 hover:bg-tech-400 rounded text-xs text-white transition-colors"
          >
            <Plus size={14} />
            添加行
          </button>
        </div>
      </div>

      <div className="overflow-auto max-h-[600px]">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-industrial-900 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-mono text-gray-400 border-r border-b border-industrial-700 w-12">#</th>
              <th className="px-3 py-2 text-left text-xs font-mono text-gray-400 border-r border-b border-industrial-700">转速 (RPM)</th>
              <th className="px-3 py-2 text-left text-xs font-mono text-gray-400 border-r border-b border-industrial-700">电压 (V)</th>
              <th className="px-3 py-2 text-left text-xs font-mono text-gray-400 border-r border-b border-industrial-700">电流 (A)</th>
              <th className="px-3 py-2 text-left text-xs font-mono text-gray-400 border-r border-b border-industrial-700">桨径 (inch)</th>
              <th className="px-3 py-2 text-left text-xs font-mono text-gray-400 border-r border-b border-industrial-700">推力</th>
              <th className="px-3 py-2 text-left text-xs font-mono text-gray-400 border-r border-b border-industrial-700 w-20">单位</th>
              <th className="px-3 py-2 text-left text-xs font-mono text-gray-400 border-r border-b border-industrial-700">异常</th>
              <th className="px-3 py-2 text-left text-xs font-mono text-gray-400 border-r border-b border-industrial-700">备注</th>
              <th className="px-3 py-2 text-center text-xs font-mono text-gray-400 border-b border-industrial-700 w-24">操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedPoints.map((point, index) => {
              const anomaly = anomalyMap.get(point.id);
              return (
                <tr
                  key={point.id}
                  className={`border-b border-industrial-700/50 ${
                    point.isExcluded ? 'bg-gray-800/30 opacity-60' : ''
                  } ${anomaly ? 'border-l-2 border-l-alert-orange' : ''}`}
                >
                  <td className="px-3 py-2 border-r border-industrial-700 text-xs text-gray-500 font-mono">
                    {index + 1}
                  </td>
                  {renderCell(point, 'rpm')}
                  {renderCell(point, 'voltage')}
                  {renderCell(point, 'current')}
                  {renderCell(point, 'propellerDiameter')}
                  {renderCell(point, 'thrust')}
                  {renderCell(point, 'thrustUnit', thrustUnitLabels[point.thrustUnit as ThrustUnit])}
                  <td className="px-3 py-2 border-r border-industrial-700">
                    {anomaly && (
                      <AnomalyBadge
                        type={anomaly.type}
                        severity={anomaly.severity}
                        showLabel={false}
                        size="sm"
                      />
                    )}
                  </td>
                  {renderCell(point, 'notes')}
                  <td className="px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onToggleExclude(point.id)}
                        className={`p-1.5 rounded transition-colors ${
                          point.isExcluded
                            ? 'bg-alert-orange/20 text-alert-orange'
                            : 'text-gray-400 hover:bg-industrial-700 hover:text-gray-200'
                        }`}
                        title={point.isExcluded ? '恢复数据点' : '排除数据点'}
                      >
                        {point.isExcluded ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => onDeletePoint(point.id)}
                        className="p-1.5 rounded text-gray-400 hover:bg-industrial-700 hover:text-alert-red transition-colors"
                        title="删除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {sortedPoints.length === 0 && (
          <div className="py-16 text-center text-gray-500">
            <p className="text-sm">暂无数据</p>
            <p className="text-xs mt-1">点击"添加行"或"导入CSV"开始录入数据</p>
          </div>
        )}
      </div>
    </div>
  );
};
