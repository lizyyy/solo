import { useState } from 'react';
import { Plus, Edit2, Trash2, Search, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { usePigmentStore } from '../store/usePigmentStore';
import { ANOMALY_LABELS, STATUS_LABELS, Pigment } from '../types';

export function DataManagement() {
  const { pigments, addPigment, updatePigment, deletePigment, revalidateAnomalies, initStore } = usePigmentStore();
  const [searchText, setSearchText] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPigment, setEditingPigment] = useState<Pigment | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    colorHex: '#3b82f6',
    transparency: 0.5,
    lightfastness: 5,
    cost: 100,
    formula: [{ componentName: '', ratio: 0 }],
    notes: '',
  });

  useState(() => {
    initStore();
  });

  const filteredPigments = pigments.filter(p =>
    p.name.toLowerCase().includes(searchText.toLowerCase()) ||
    p.code.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pigmentData = {
      ...formData,
      formula: formData.formula.filter(f => f.componentName && f.ratio > 0),
    };
    
    if (editingPigment) {
      updatePigment(editingPigment.id, pigmentData);
    } else {
      addPigment(pigmentData as never);
    }
    
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      colorHex: '#3b82f6',
      transparency: 0.5,
      lightfastness: 5,
      cost: 100,
      formula: [{ componentName: '', ratio: 0 }],
      notes: '',
    });
    setShowForm(false);
    setEditingPigment(null);
  };

  const handleEdit = (pigment: Pigment) => {
    setEditingPigment(pigment);
    setFormData({
      name: pigment.name,
      code: pigment.code,
      colorHex: pigment.colorHex,
      transparency: pigment.transparency,
      lightfastness: pigment.lightfastness || 5,
      cost: pigment.cost,
      formula: pigment.formula.length > 0 ? pigment.formula : [{ componentName: '', ratio: 0 }],
      notes: pigment.notes || '',
    });
    setShowForm(true);
  };

  const addFormulaRow = () => {
    setFormData(prev => ({
      ...prev,
      formula: [...prev.formula, { componentName: '', ratio: 0 }],
    }));
  };

  const updateFormulaRow = (index: number, field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      formula: prev.formula.map((f, i) => 
        i === index ? { ...f, [field]: value } : f
      ),
    }));
  };

  const removeFormulaRow = (index: number) => {
    setFormData(prev => ({
      ...prev,
      formula: prev.formula.filter((_, i) => i !== index),
    }));
  };

  const statusIcons = {
    processed: <CheckCircle className="w-4 h-4 text-emerald-500" />,
    pending: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    rejected: <XCircle className="w-4 h-4 text-red-500" />,
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <Navbar />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">数据管理</h1>
              <p className="text-slate-400">管理所有色料配方数据</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={revalidateAnomalies}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                重新校验
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加色料
              </button>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索色料名称或编号..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">色料</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">状态</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">透明度</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">耐光等级</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">成本</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">异常</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredPigments.map((pigment) => (
                    <tr key={pigment.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg border border-slate-600"
                            style={{ backgroundColor: pigment.colorHex }}
                          />
                          <div>
                            <div className="font-medium text-white">{pigment.name}</div>
                            <div className="text-sm text-slate-400">{pigment.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {statusIcons[pigment.status]}
                          <span className="text-sm text-slate-300">{STATUS_LABELS[pigment.status]}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {(pigment.transparency * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {pigment.lightfastness ?? '未测'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        ¥{pigment.cost}
                      </td>
                      <td className="px-4 py-3">
                        {pigment.anomalies.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {pigment.anomalies.map((a) => (
                              <span
                                key={a}
                                className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-md"
                              >
                                {ANOMALY_LABELS[a]}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(pigment)}
                            className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4 text-slate-400" />
                          </button>
                          <button
                            onClick={() => deletePigment(pigment.id)}
                            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-semibold text-white">
                {editingPigment ? '编辑色料' : '添加新色料'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">色料名称</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="如：钛白 PW6"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">色料编号</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="如：PW-001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">颜色</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.colorHex}
                      onChange={(e) => setFormData(prev => ({ ...prev, colorHex: e.target.value }))}
                      className="w-12 h-10 rounded-lg border border-slate-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.colorHex}
                      onChange={(e) => setFormData(prev => ({ ...prev, colorHex: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">透明度</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={formData.transparency}
                    onChange={(e) => setFormData(prev => ({ ...prev, transparency: parseFloat(e.target.value) }))}
                    className="w-full mt-2"
                  />
                  <div className="text-sm text-slate-400 text-center">{(formData.transparency * 100).toFixed(0)}%</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">耐光等级</label>
                  <select
                    value={formData.lightfastness}
                    onChange={(e) => setFormData(prev => ({ ...prev, lightfastness: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="0">未测</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                      <option key={n} value={n}>等级 {n}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">成本 (元/kg)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.cost}
                  onChange={(e) => setFormData(prev => ({ ...prev, cost: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-300">配方成分</label>
                  <button
                    type="button"
                    onClick={addFormulaRow}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    + 添加成分
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.formula.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="成分名称"
                        value={item.componentName}
                        onChange={(e) => updateFormulaRow(index, 'componentName', e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="number"
                        placeholder="比例%"
                        min="0"
                        max="100"
                        value={item.ratio || ''}
                        onChange={(e) => updateFormulaRow(index, 'ratio', parseFloat(e.target.value) || 0)}
                        className="w-24 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-slate-400">%</span>
                      {formData.formula.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFormulaRow(index)}
                          className="p-2 hover:bg-red-500/20 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">备注</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="添加备注信息..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                >
                  {editingPigment ? '保存修改' : '添加色料'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
