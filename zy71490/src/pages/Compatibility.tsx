import { useState } from 'react';
import { useStore } from '@/store';
import { Monitor, Plus, AlertTriangle, CheckCircle, XCircle, ChevronRight, Search, X } from 'lucide-react';
import type { KeyboardModel, Preset } from '@/types';

export default function Compatibility() {
  const { presets, models, compatibilityResults, addModel, selectedModelId, setSelectedModel } = useStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newModel, setNewModel] = useState({ brand: '', model: '', firmwareVersion: '' });
  const [searchText, setSearchText] = useState('');
  const [selectedCell, setSelectedCell] = useState<{ presetId: string; modelId: string } | null>(null);

  const activePresets = presets.filter(p => !p.isArchived);
  const filteredModels = models.filter(m => 
    searchText === '' || 
    `${m.brand} ${m.model}`.toLowerCase().includes(searchText.toLowerCase())
  );

  const getCompatibilityStatus = (presetId: string, modelId: string) => {
    const result = compatibilityResults.find(
      r => r.presetId === presetId && r.modelId === modelId
    );
    if (!result) return 'untested';
    return result.status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compatible': return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
      case 'incompatible': return 'bg-red-500/20 border-red-500/40 text-red-400 cursor-pointer hover:bg-red-500/30';
      case 'polarity_warning': return 'bg-amber-500/20 border-amber-500/40 text-amber-400';
      case 'override_pending': return 'bg-purple-500/20 border-purple-500/40 text-purple-400';
      default: return 'bg-[#2A2A3E] border-[#3A3A5E] text-[#6A6A8A]';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compatible': return <CheckCircle size={16} />;
      case 'incompatible': return <XCircle size={16} />;
      case 'polarity_warning': return <AlertTriangle size={16} />;
      case 'override_pending': return <AlertTriangle size={16} />;
      default: return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'compatible': return '兼容';
      case 'incompatible': return '不兼容';
      case 'polarity_warning': return '极性警告';
      case 'override_pending': return '覆盖待确认';
      default: return '未测';
    }
  };

  const getCompatibleCount = (model: KeyboardModel) => {
    return activePresets.filter(p => {
      const status = getCompatibilityStatus(p.id, model.id);
      return status === 'compatible' || status === 'untested';
    }).length;
  };

  const handleAddModel = () => {
    if (newModel.brand && newModel.model) {
      addModel(newModel);
      setNewModel({ brand: '', model: '', firmwareVersion: '' });
      setShowAddModal(false);
    }
  };

  const getCellDescription = (presetId: string, modelId: string) => {
    const result = compatibilityResults.find(
      r => r.presetId === presetId && r.modelId === modelId
    );
    return result?.description || '';
  };

  const getAffectedItems = (presetId: string, modelId: string) => {
    const result = compatibilityResults.find(
      r => r.presetId === presetId && r.modelId === modelId
    );
    return result?.affectedItems || [];
  };

  return (
    <div className="p-6 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Monitor className="text-amber-500" size={28} />
          <h1 className="text-2xl font-bold text-[#FAF5EF]">型号兼容</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6A6A8A]" />
            <input
              type="text"
              placeholder="搜索型号..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-10 pr-4 py-2 bg-[#1A1A2E] border border-[#2A2A3E] rounded-lg text-sm text-[#FAF5EF] focus:outline-none focus:border-amber-500/50 w-48"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-[#0E0E1A] rounded-lg font-medium hover:bg-amber-400 transition-colors"
          >
            <Plus size={18} />
            添加型号
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {filteredModels.map(model => {
          const compatibleCount = getCompatibleCount(model);
          const hasIssues = compatibleCount < activePresets.length;
          return (
            <div
              key={model.id}
              onClick={() => setSelectedModel(selectedModelId === model.id ? null : model.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer hover:-translate-y-0.5 ${
                selectedModelId === model.id
                  ? 'bg-[#252540] border-amber-500/50'
                  : 'bg-[#1A1A2E] border-[#2A2A3E] hover:border-[#3A3A5E]'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-sm font-semibold text-[#FAF5EF]">{model.brand}</div>
                  <div className="text-lg font-bold text-[#FAF5EF]">{model.model}</div>
                </div>
                <div className={`w-3 h-3 rounded-full ${hasIssues ? 'bg-red-500' : 'bg-emerald-500'}`} />
              </div>
              <div className="text-xs text-[#6A6A8A] mb-3">固件 v{model.firmwareVersion}</div>
              <div className="flex items-center gap-1 text-sm">
                <span className={hasIssues ? 'text-amber-400' : 'text-emerald-400'}>
                  {compatibleCount}
                </span>
                <span className="text-[#6A6A8A]">/ {activePresets.length} 兼容</span>
              </div>
            </div>
          );
        })}
      </div>

      {selectedCell && (
        <div className="mb-6 p-5 rounded-xl bg-[#1A1A2E] border border-[#2A2A3E]">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-red-400" size={24} />
              <div>
                <h3 className="text-lg font-semibold text-[#FAF5EF]">不兼容详情</h3>
                <p className="text-sm text-[#8A8AA0]">以下是具体的兼容性问题说明</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedCell(null)}
              className="p-2 hover:bg-[#2A2A3E] rounded-lg text-[#8A8AA0] hover:text-[#FAF5EF] transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <div className="bg-[#0E0E1A] rounded-lg p-4 mb-4">
            <p className="text-[#FAF5EF]">{getCellDescription(selectedCell.presetId, selectedCell.modelId)}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-[#6A6A8A] mb-2">受影响预设</div>
              <div className="space-y-1">
                {getAffectedItems(selectedCell.presetId, selectedCell.modelId).map((id, i) => {
                  const preset = presets.find(p => p.id === id);
                  return preset ? (
                    <div key={i} className="text-sm text-[#FAF5EF] bg-[#0E0E1A] px-3 py-1.5 rounded">
                      {preset.name} v{preset.version}
                    </div>
                  ) : null;
                })}
              </div>
            </div>
            <div>
              <div className="text-sm text-[#6A8AA0] mb-2">建议处理</div>
              <div className="text-sm text-[#8A8AA0] space-y-1">
                <p>• 考虑使用兼容的替代预设</p>
                <p>• 或归档不兼容的预设</p>
                <p>• 如必须使用，请手动测试验证</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-[#12121E] sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 bg-[#12121E] z-20 px-4 py-3 text-left text-xs font-medium text-[#6A6A8A] uppercase tracking-wider">
                  预设 / 型号
                </th>
                {filteredModels.map(model => (
                  <th key={model.id} className="px-4 py-3 text-left text-xs font-medium text-[#6A6A8A] uppercase tracking-wider min-w-[140px]">
                    <div>{model.brand}</div>
                    <div className="font-semibold text-[#8A8AA0]">{model.model}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A3E]">
              {activePresets.map(preset => (
                <tr key={preset.id} className="hover:bg-[#252540]/30">
                  <td className="sticky left-0 bg-[#1A1A2E] hover:bg-[#252540]/30 z-10 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <div>
                        <div className="font-medium text-[#FAF5EF]">{preset.name}</div>
                        <div className="text-xs text-[#6A6A8A]">v{preset.version}</div>
                      </div>
                    </div>
                  </td>
                  {filteredModels.map(model => {
                    const status = getCompatibilityStatus(preset.id, model.id);
                    return (
                      <td
                        key={model.id}
                        className="px-4 py-3"
                      >
                        <div
                          onClick={() => {
                            if (status === 'incompatible') {
                              setSelectedCell({ presetId: preset.id, modelId: model.id });
                            }
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${getStatusColor(status)}`}
                        >
                          {getStatusIcon(status)}
                          <span>{getStatusText(status)}</span>
                          {status === 'incompatible' && (
                            <ChevronRight size={12} className="ml-1" />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500/40" />
          <span className="text-[#8A8AA0]">兼容</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/40" />
          <span className="text-[#8A8AA0]">不兼容（点击查看详情）</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-amber-500/20 border border-amber-500/40" />
          <span className="text-[#8A8AA0]">极性警告</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-purple-500/20 border border-purple-500/40" />
          <span className="text-[#8A8AA0]">覆盖待确认</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[#2A2A3E] border border-[#3A3A5E]" />
          <span className="text-[#8A8AA0]">未测试</span>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#1A1A2E] rounded-xl border border-[#2A2A3E] p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[#FAF5EF]">添加键盘型号</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-[#2A2A3E] rounded-lg text-[#8A8AA0] hover:text-[#FAF5EF]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#8A8AA0] mb-1">品牌</label>
                <input
                  type="text"
                  value={newModel.brand}
                  onChange={(e) => setNewModel({ ...newModel, brand: e.target.value })}
                  placeholder="例如: Nord, Korg, Yamaha"
                  className="w-full px-4 py-2.5 bg-[#0E0E1A] border border-[#2A2A3E] rounded-lg text-[#FAF5EF] focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8A8AA0] mb-1">型号</label>
                <input
                  type="text"
                  value={newModel.model}
                  onChange={(e) => setNewModel({ ...newModel, model: e.target.value })}
                  placeholder="例如: Stage 3, Kronos"
                  className="w-full px-4 py-2.5 bg-[#0E0E1A] border border-[#2A2A3E] rounded-lg text-[#FAF5EF] focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8A8AA0] mb-1">固件版本</label>
                <input
                  type="text"
                  value={newModel.firmwareVersion}
                  onChange={(e) => setNewModel({ ...newModel, firmwareVersion: e.target.value })}
                  placeholder="例如: 2.14, 3.1.2"
                  className="w-full px-4 py-2.5 bg-[#0E0E1A] border border-[#2A2A3E] rounded-lg text-[#FAF5EF] focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2.5 bg-[#2A2A3E] text-[#FAF5EF] rounded-lg font-medium hover:bg-[#3A3A5E] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddModel}
                className="flex-1 px-4 py-2.5 bg-amber-500 text-[#0E0E1A] rounded-lg font-medium hover:bg-amber-400 transition-colors"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
