import { useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { usePendulumStore } from '@/store/usePendulumStore';
import { hasErrors, hasWarnings, hasConflicts } from '@/utils/validation';
import type { FlagType } from '@/types';

const flagColors: Record<FlagType, string> = {
  error: 'text-red-400 bg-red-500/10',
  warning: 'text-amber-400 bg-amber-500/10',
  info: 'text-blue-400 bg-blue-500/10',
  conflict: 'text-purple-400 bg-purple-500/10',
};

const flagIcons: Record<FlagType, React.ReactNode> = {
  error: <AlertCircle className="w-3 h-3" />,
  warning: <AlertTriangle className="w-3 h-3" />,
  info: <Info className="w-3 h-3" />,
  conflict: <AlertTriangle className="w-3 h-3" />,
};

export default function DataInput() {
  const {
    data,
    addData,
    updateData,
    removeData,
    toggleExclude,
    clearAllData,
    studentName,
    experimentDate,
    setStudentName,
    setExperimentDate,
  } = usePendulumStore();

  const [newData, setNewData] = useState({
    length: 1.0,
    period: 2.0,
    measurements: 10,
    angle: 10,
    notes: '',
  });

  const handleAdd = () => {
    addData({
      ...newData,
      studentName,
    });
  };

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-700/50">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">实验数据输入</h2>
        {data.length > 0 && (
          <button
            onClick={clearAllData}
            className="text-sm text-slate-400 hover:text-red-400 transition-colors"
          >
            清空全部
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm text-slate-400 mb-1">学生姓名</label>
          <input
            type="text"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="请输入姓名"
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">实验日期</label>
          <input
            type="date"
            value={experimentDate}
            onChange={(e) => setExperimentDate(e.target.value)}
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">摆长 (m)</label>
          <input
            type="number"
            step="0.01"
            value={newData.length}
            onChange={(e) => setNewData({ ...newData, length: parseFloat(e.target.value) || 0 })}
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">周期 (s)</label>
          <input
            type="number"
            step="0.01"
            value={newData.period}
            onChange={(e) => setNewData({ ...newData, period: parseFloat(e.target.value) || 0 })}
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">测量次数</label>
          <input
            type="number"
            min="1"
            value={newData.measurements}
            onChange={(e) => setNewData({ ...newData, measurements: parseInt(e.target.value) || 1 })}
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">摆角 (°)</label>
          <input
            type="number"
            step="1"
            value={newData.angle}
            onChange={(e) => setNewData({ ...newData, angle: parseFloat(e.target.value) || 0 })}
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={handleAdd}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            添加
          </button>
        </div>
      </div>

      <div className="mb-2">
        <label className="block text-xs text-slate-400 mb-1">备注</label>
        <input
          type="text"
          value={newData.notes}
          onChange={(e) => setNewData({ ...newData, notes: e.target.value })}
          placeholder="可选：记录实验条件等信息"
          className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {data.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left">
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">摆长 (m)</th>
                <th className="pb-2 font-medium">周期 (s)</th>
                <th className="pb-2 font-medium">次数</th>
                <th className="pb-2 font-medium">摆角 (°)</th>
                <th className="pb-2 font-medium">备注</th>
                <th className="pb-2 font-medium">状态</th>
                <th className="pb-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, index) => (
                <tr
                  key={d.id}
                  className={`border-t border-slate-700/50 transition-opacity ${
                    d.excluded ? 'opacity-40' : ''
                  } ${hasErrors(d) ? 'bg-red-500/10' : ''}`}
                >
                  <td className="py-3 text-slate-500">{index + 1}</td>
                  <td className="py-3">
                    <input
                      type="number"
                      step="0.01"
                      value={d.length}
                      onChange={(e) =>
                        updateData(d.id, { length: parseFloat(e.target.value) || 0 })
                      }
                      className="w-20 bg-transparent border-b border-slate-600 focus:border-blue-500 text-white outline-none"
                    />
                  </td>
                  <td className="py-3">
                    <input
                      type="number"
                      step="0.01"
                      value={d.period}
                      onChange={(e) =>
                        updateData(d.id, { period: parseFloat(e.target.value) || 0 })
                      }
                      className="w-20 bg-transparent border-b border-slate-600 focus:border-blue-500 text-white outline-none"
                    />
                  </td>
                  <td className="py-3">
                    <input
                      type="number"
                      min="1"
                      value={d.measurements}
                      onChange={(e) =>
                        updateData(d.id, { measurements: parseInt(e.target.value) || 1 })
                      }
                      className="w-16 bg-transparent border-b border-slate-600 focus:border-blue-500 text-white outline-none"
                    />
                  </td>
                  <td className="py-3">
                    <input
                      type="number"
                      step="1"
                      value={d.angle}
                      onChange={(e) =>
                        updateData(d.id, { angle: parseFloat(e.target.value) || 0 })
                      }
                      className="w-14 bg-transparent border-b border-slate-600 focus:border-blue-500 text-white outline-none"
                    />
                  </td>
                  <td className="py-3">
                    <input
                      type="text"
                      value={d.notes}
                      onChange={(e) => updateData(d.id, { notes: e.target.value })}
                      className="w-24 bg-transparent border-b border-slate-600 focus:border-blue-500 text-white outline-none text-xs"
                    />
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {d.flags.slice(0, 2).map((flag, i) => (
                        <span
                          key={i}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${flagColors[flag.type]}`}
                          title={flag.message}
                        >
                          {flagIcons[flag.type]}
                        </span>
                      ))}
                      {d.flags.length > 2 && (
                        <span className="text-xs text-slate-500">+{d.flags.length - 2}</span>
                      )}
                      {(hasErrors(d) || hasWarnings(d) || hasConflicts(d)) && d.flags.length === 0 && (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleExclude(d.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          d.excluded
                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            : 'hover:bg-slate-700 text-slate-400'
                        }`}
                        title={d.excluded ? '恢复数据' : '排除数据'}
                      >
                        {d.excluded ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => removeData(d.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                        title="删除数据"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <div className="text-4xl mb-2">📊</div>
          <p>暂无数据，请在上方输入实验数据</p>
          <p className="text-xs mt-1">或使用右侧"演示样例"加载预设数据</p>
        </div>
      )}
    </div>
  );
}
