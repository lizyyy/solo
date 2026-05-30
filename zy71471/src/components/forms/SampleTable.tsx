import { useState } from 'react';
import { Plus, Trash2, Upload, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import type { SamplePoint } from '@/types';
import { cn } from '@/lib/utils';

interface SampleTableProps {
  points: SamplePoint[];
  onUpdate: (id: string, updates: Partial<SamplePoint>) => void;
  onDelete: (id: string) => void;
  onAdd: (points: Omit<SamplePoint, 'id' | 'batchId' | 'sequence'>[]) => void;
}

const inputClass = 'w-24 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none';
const btnClass = 'p-1.5 rounded transition-colors';

export const SampleTable = ({ points, onUpdate, onDelete, onAdd }: SampleTableProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ time: '', voltage: '' });
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const sortedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
  const totalCount = sortedPoints.length;
  const outlierCount = sortedPoints.filter((p) => p.isOutlier).length;

  const handleEdit = (point: SamplePoint) => {
    setEditingId(point.id);
    setEditValues({ time: String(point.time), voltage: String(point.voltage) });
  };

  const handleSave = (id: string) => {
    const time = parseFloat(editValues.time);
    const voltage = parseFloat(editValues.voltage);
    if (!isNaN(time) && !isNaN(voltage)) {
      onUpdate(id, { time, voltage, isOutlier: false, outlierReason: null });
    }
    setEditingId(null);
  };

  const handleAdd = () => {
    const lastPoint = sortedPoints[sortedPoints.length - 1];
    const newTime = lastPoint ? lastPoint.time + 1 : 0;
    onAdd([{ time: newTime, voltage: 0, isOutlier: false, outlierReason: null, residual: null }]);
  };

  const handleImport = () => {
    try {
      const newPoints = importText.trim().split('\n')
        .map((line) => {
          const [t, v] = line.split(/[,\t\s]+/);
          const time = parseFloat(t?.trim());
          const voltage = parseFloat(v?.trim());
          return (!isNaN(time) && !isNaN(voltage))
            ? { time, voltage, isOutlier: false, outlierReason: null, residual: null }
            : null;
        })
        .filter((p): p is Omit<SamplePoint, 'id' | 'batchId' | 'sequence'> => p !== null);

      if (newPoints.length > 0) {
        onAdd(newPoints);
        setImportText('');
        setShowImport(false);
      }
    } catch (error) {
      console.error('导入失败:', error);
    }
  };

  const StatusBadge = ({ point }: { point: SamplePoint }) => {
    if (point.isOutlier) {
      return (
        <div className="group relative">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <XCircle className="w-3 h-3" />异常
          </span>
          {point.outlierReason && (
            <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {point.outlierReason}
            </div>
          )}
        </div>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        <CheckCircle className="w-3 h-3" />正常
      </span>
    );
  };

  const renderInput = (id: string, field: 'time' | 'voltage') => (
    <input
      type="number"
      value={editValues[field]}
      onChange={(e) => setEditValues({ ...editValues, [field]: e.target.value })}
      className={inputClass}
      step="any"
    />
  );

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">采样数据</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600 dark:text-slate-400">
              总数: <span className="font-medium text-slate-800 dark:text-slate-200">{totalCount}</span>
            </span>
            <span className="text-slate-600 dark:text-slate-400">
              异常: <span className={cn('font-medium', outlierCount > 0 ? 'text-red-500' : 'text-emerald-500')}>{outlierCount}</span>
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImport(!showImport)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Upload className="w-4 h-4" />批量导入
            </button>
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />新增行
            </button>
          </div>
        </div>
      </div>

      {showImport && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-3 animate-slideDown">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <AlertCircle className="w-4 h-4" />
            <span>粘贴CSV格式数据，支持逗号、制表符或空格分隔，每行格式：时间,电压</span>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="0,5.0&#10;1,3.03&#10;2,1.84&#10;3,1.12"
            className="w-full h-32 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowImport(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >取消</button>
            <button
              onClick={handleImport}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >导入</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">序号</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">时间</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">电压 (V)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">残差</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">状态</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {sortedPoints.map((point, index) => (
              <tr
                key={point.id}
                className={cn(
                  'transition-colors duration-200',
                  point.isOutlier
                    ? 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                )}
              >
                <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{index + 1}</td>
                <td className="px-4 py-3">{editingId === point.id ? renderInput(point.id, 'time') : <span className="text-sm text-slate-900 dark:text-slate-100">{point.time}</span>}</td>
                <td className="px-4 py-3">{editingId === point.id ? renderInput(point.id, 'voltage') : <span className="text-sm text-slate-900 dark:text-slate-100">{point.voltage.toFixed(3)}</span>}</td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 font-mono">{point.residual !== null ? point.residual.toFixed(4) : '-'}</td>
                <td className="px-4 py-3"><StatusBadge point={point} /></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    {editingId === point.id ? (
                      <>
                        <button onClick={() => handleSave(point.id)} className={cn(btnClass, 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20')}><CheckCircle className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className={cn(btnClass, 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700')}><XCircle className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEdit(point)} className={cn(btnClass, 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20')}><Plus className="w-4 h-4 rotate-45" /></button>
                        <button onClick={() => onDelete(point.id)} className={cn(btnClass, 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20')}><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedPoints.length === 0 && (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>暂无采样数据</p>
          <p className="text-sm mt-1">点击"新增行"或"批量导入"添加数据</p>
        </div>
      )}
    </div>
  );
};
