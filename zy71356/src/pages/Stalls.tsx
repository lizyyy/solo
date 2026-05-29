import { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Zap,
  DoorOpen,
  X,
  Grid3X3,
} from 'lucide-react';
import { useMarketStore } from '@/store/useMarketStore';
import { Stall } from '@shared/types';
import SuccessToast from '@/components/SuccessToast';

export default function Stalls() {
  const { stalls, createStall, updateStall, deleteStall } = useMarketStore();
  const [showModal, setShowModal] = useState(false);
  const [editingStall, setEditingStall] = useState<Stall | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    row: 0,
    col: 0,
    maxPower: 500,
    isEntrance: false,
    width: 1,
    height: 1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStall) {
        await updateStall(editingStall.id, formData);
        setSuccessMsg(`摊位「${formData.name}」已更新`);
      } else {
        await createStall(formData);
        setSuccessMsg(`摊位「${formData.name}」已创建`);
      }
      setShowModal(false);
      resetForm();
    } catch (e: any) {
      // Error handled by store
    }
  };

  const handleEdit = (stall: Stall) => {
    setEditingStall(stall);
    setFormData({
      name: stall.name,
      row: stall.row,
      col: stall.col,
      maxPower: stall.maxPower,
      isEntrance: stall.isEntrance,
      width: stall.width,
      height: stall.height,
    });
    setShowModal(true);
  };

  const handleDelete = async (stall: Stall) => {
    if (confirm(`确定要删除摊位「${stall.name}」吗？`)) {
      await deleteStall(stall.id);
      setSuccessMsg(`摊位「${stall.name}」已删除`);
    }
  };

  const resetForm = () => {
    setEditingStall(null);
    setFormData({
      name: '',
      row: 0,
      col: 0,
      maxPower: 500,
      isEntrance: false,
      width: 1,
      height: 1,
    });
  };

  const maxRow = Math.max(...stalls.map((s) => s.row), 0);
  const maxCol = Math.max(...stalls.map((s) => s.col), 0);

  const getStallAtPosition = (row: number, col: number) =>
    stalls.find((s) => s.row === row && s.col === col);

  return (
    <div className="p-8">
      {successMsg && (
        <SuccessToast message={successMsg} onClose={() => setSuccessMsg(null)} />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">摊位配置</h1>
          <p className="text-slate-500 mt-1">管理摊位布局、用电容量和人流入口</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus size={18} />
          添加摊位
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Grid3X3 size={18} className="text-teal-600" />
              摊位布局预览
            </h3>

            <div className="overflow-auto">
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${maxCol + 1}, minmax(100px, 1fr))`,
                }}
              >
                {Array.from({ length: maxRow + 1 }).map((_, row) =>
                  Array.from({ length: maxCol + 1 }).map((_, col) => {
                    const stall = getStallAtPosition(row, col);
                    return (
                      <div
                        key={`${row}-${col}`}
                        className={`min-h-[80px] rounded-lg border-2 p-2 transition-all ${
                          stall
                            ? stall.isEntrance
                              ? 'border-teal-400 bg-teal-50'
                              : 'border-slate-200 bg-slate-50 hover:border-teal-300 hover:bg-teal-50 cursor-pointer'
                            : 'border-dashed border-slate-200 bg-slate-50/50'
                        }`}
                        onClick={() => stall && handleEdit(stall)}
                      >
                        {stall ? (
                          <div className="text-center">
                            <div className="font-medium text-slate-800 text-sm">
                              {stall.name}
                            </div>
                            <div className="flex items-center justify-center gap-1 mt-1 text-xs text-slate-500">
                              <Zap size={12} className="text-amber-500" />
                              {stall.maxPower}W
                            </div>
                            {stall.isEntrance && (
                              <div className="flex items-center justify-center gap-1 mt-1 text-xs text-teal-600">
                                <DoorOpen size={12} />
                                入口
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-slate-300 text-xs">
                            空
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex items-center gap-6 mt-4 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-2 border-teal-400 bg-teal-50" />
                <span>入口摊位</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-2 border-slate-200 bg-slate-50" />
                <span>普通摊位</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-2 border-dashed border-slate-200 bg-slate-50/50" />
                <span>空位</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">摊位列表</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {stalls
              .sort((a, b) => a.row * 100 + a.col - (b.row * 100 + b.col))
              .map((stall) => (
                <div
                  key={stall.id}
                  className="p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-slate-800">
                        {stall.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 space-y-1">
                        <div>位置：第 {stall.row + 1} 行，第 {stall.col + 1} 列</div>
                        <div className="flex items-center gap-2">
                          <Zap size={12} className="text-amber-500" />
                          最大供电 {stall.maxPower}W
                        </div>
                        {stall.isEntrance && (
                          <div className="flex items-center gap-1 text-teal-600">
                            <DoorOpen size={12} />
                            靠近人流入口
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(stall)}
                        className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(stall)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-800">
                {editingStall ? '编辑摊位' : '添加摊位'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  摊位名称 *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="例如：A01"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    行号 *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.row}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        row: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    列号 *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.col}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        col: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  最大供电 (W) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.maxPower}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxPower: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  建议：普通摊位 500W，高功率摊位 1500-2000W
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isEntrance"
                  checked={formData.isEntrance}
                  onChange={(e) =>
                    setFormData({ ...formData, isEntrance: e.target.checked })
                  }
                  className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                />
                <label
                  htmlFor="isEntrance"
                  className="text-sm font-medium text-slate-700"
                >
                  <div className="flex items-center gap-2">
                    <DoorOpen size={16} className="text-teal-600" />
                    靠近人流入口
                  </div>
                </label>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  {editingStall ? '保存修改' : '确认添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
