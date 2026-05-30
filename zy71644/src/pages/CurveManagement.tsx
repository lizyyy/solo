import { useState } from 'react';
import { useAppStore } from '@/store';
import ReactECharts from 'echarts-for-react';
import { Decimal } from 'decimal.js';
import type { CurvePoint, InterpolationMethod } from '@/types';

export default function CurveManagement() {
  const { curves, addCurve, updateCurve, deleteCurve, selectCurve, selectedCurveId } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [editingCurve, setEditingCurve] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    valueDate: new Date().toISOString().split('T')[0],
    interpolationMethod: 'LINEAR' as InterpolationMethod,
    pointsText: '',
  });

  const selectedCurve = curves.find((c) => c.id === selectedCurveId);

  const parsePoints = (text: string): CurvePoint[] => {
    const lines = text.trim().split('\n');
    return lines
      .map((line) => {
        const parts = line.split(/[,，\s]+/);
        if (parts.length >= 2) {
          const term = new Decimal(parts[0].trim());
          const rate = new Decimal(parts[1].trim()).div(100);
          return { term, rate };
        }
        return null;
      })
      .filter((p): p is CurvePoint => p !== null);
  };

  const handleSubmit = () => {
    const points = parsePoints(formData.pointsText);
    
    if (editingCurve) {
      updateCurve(editingCurve, {
        name: formData.name,
        valueDate: formData.valueDate,
        interpolationMethod: formData.interpolationMethod,
        points,
      });
    } else {
      addCurve({
        name: formData.name,
        valueDate: formData.valueDate,
        interpolationMethod: formData.interpolationMethod,
        points,
      });
    }
    
    setShowForm(false);
    setEditingCurve(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      valueDate: new Date().toISOString().split('T')[0],
      interpolationMethod: 'LINEAR',
      pointsText: '',
    });
  };

  const handleEdit = (curve: typeof curves[0]) => {
    const pointsText = curve.points
      .map((p) => `${p.term.toString()}, ${p.rate.mul(100).toFixed(4)}`)
      .join('\n');
    
    setFormData({
      name: curve.name,
      valueDate: curve.valueDate,
      interpolationMethod: curve.interpolationMethod,
      pointsText,
    });
    setEditingCurve(curve.id);
    setShowForm(true);
  };

  const chartOption = selectedCurve ? {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const data = params[0];
        return `期限: ${data.value[0]}年<br/>收益率: ${(data.value[1] * 100).toFixed(4)}%`;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      name: '期限(年)',
      nameLocation: 'middle',
      nameGap: 25,
    },
    yAxis: {
      type: 'value',
      name: '收益率',
      nameLocation: 'middle',
      nameGap: 35,
      axisLabel: {
        formatter: (value: number) => `${(value * 100).toFixed(2)}%`,
      },
    },
    series: [
      {
        type: 'line',
        smooth: selectedCurve.interpolationMethod !== 'LINEAR',
        symbol: 'circle',
        symbolSize: 8,
        data: selectedCurve.points
          .sort((a, b) => a.term.sub(b.term).toNumber())
          .map((p) => [p.term.toNumber(), p.rate.toNumber()]),
        lineStyle: {
          color: '#1e3a5f',
          width: 2,
        },
        itemStyle: {
          color: '#c9a227',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(30, 58, 95, 0.3)' },
              { offset: 1, color: 'rgba(30, 58, 95, 0.05)' },
            ],
          },
        },
      },
    ],
  } : {};

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-xl font-bold text-navy-800">收益率曲线管理</h1>
          <p className="mt-1 text-navy-500 text-sm">管理收益率曲线，配置插值方法</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingCurve(null);
            resetForm();
          }}
          className="btn-primary"
        >
          + 新增曲线
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-serif font-semibold text-navy-800">
              {editingCurve ? '编辑曲线' : '新增曲线'}
            </h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-navy-600 mb-1">曲线名称</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                    placeholder="如：中债国债收益率曲线"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-navy-600 mb-1">估值日</label>
                    <input
                      type="date"
                      value={formData.valueDate}
                      onChange={(e) => setFormData({ ...formData, valueDate: e.target.value })}
                      className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-navy-600 mb-1">插值方法</label>
                    <select
                      value={formData.interpolationMethod}
                      onChange={(e) => setFormData({ ...formData, interpolationMethod: e.target.value as InterpolationMethod })}
                      className="w-full px-3 py-2 border border-navy-200 rounded text-sm"
                    >
                      <option value="LINEAR">线性插值</option>
                      <option value="CUBIC_SPLINE">三次样条插值</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-navy-600 mb-1">
                  收益率曲线点 (期限(年), 收益率(%))
                </label>
                <textarea
                  value={formData.pointsText}
                  onChange={(e) => setFormData({ ...formData, pointsText: e.target.value })}
                  className="w-full px-3 py-2 border border-navy-200 rounded text-sm font-mono"
                  rows={8}
                  placeholder={`0.25, 2.10\n0.5, 2.35\n1, 2.50\n2, 2.65\n3, 2.75\n5, 2.85\n7, 2.95\n10, 3.05`}
                />
                <p className="mt-1 text-xs text-navy-400">
                  每行一个点，用逗号或空格分隔期限和收益率
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingCurve(null);
                  resetForm();
                }}
                className="btn-secondary"
              >
                取消
              </button>
              <button onClick={handleSubmit} className="btn-primary">
                {editingCurve ? '保存修改' : '创建曲线'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="font-serif font-semibold text-navy-800">曲线列表</h3>
          </div>
          <div className="card-body p-0">
            {curves.length === 0 ? (
              <div className="py-8 text-center text-navy-400 text-sm">
                暂无曲线数据
              </div>
            ) : (
              <div className="divide-y divide-navy-100">
                {curves.map((curve) => (
                  <div
                    key={curve.id}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedCurveId === curve.id ? 'bg-gold-50' : 'hover:bg-navy-50'
                    }`}
                    onClick={() => selectCurve(selectedCurveId === curve.id ? null : curve.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-navy-700 text-sm">{curve.name}</p>
                        <p className="text-xs text-navy-500 mt-1">
                          {curve.valueDate} · {curve.points.length}个点 · v{curve.version}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(curve);
                          }}
                          className="text-xs text-navy-500 hover:text-navy-700"
                        >
                          编辑
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCurve(curve.id);
                          }}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card col-span-2">
          <div className="card-header">
            <h3 className="font-serif font-semibold text-navy-800">
              {selectedCurve ? selectedCurve.name : '选择曲线查看详情'}
            </h3>
          </div>
          <div className="card-body">
            {selectedCurve ? (
              <div className="space-y-4">
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-navy-500">估值日:</span>
                    <span className="ml-2 text-navy-700">{selectedCurve.valueDate}</span>
                  </div>
                  <div>
                    <span className="text-navy-500">插值方法:</span>
                    <span className="ml-2 text-navy-700">
                      {selectedCurve.interpolationMethod === 'LINEAR' ? '线性插值' : '三次样条插值'}
                    </span>
                  </div>
                  <div>
                    <span className="text-navy-500">数据点:</span>
                    <span className="ml-2 text-navy-700">{selectedCurve.points.length}个</span>
                  </div>
                </div>
                <div className="h-64">
                  <ReactECharts 
                    option={chartOption} 
                    style={{ height: '100%', width: '100%' }}
                    opts={{ renderer: 'svg' }}
                  />
                </div>
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-navy-700 mb-2">原始数据点</h4>
                  <div className="max-h-40 overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-navy-200">
                          <th className="text-left py-2 text-navy-600">期限(年)</th>
                          <th className="text-left py-2 text-navy-600">收益率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCurve.points
                          .sort((a, b) => a.term.sub(b.term).toNumber())
                          .map((p, i) => (
                            <tr key={i} className="border-b border-navy-100">
                              <td className="py-1">{p.term.toFixed(2)}</td>
                              <td className="py-1">{p.rate.mul(100).toFixed(4)}%</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-navy-400 text-sm">
                请从左侧选择一条收益率曲线
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
