import { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Zap,
  Phone,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { useMarketStore } from '@/store/useMarketStore';
import {
  Vendor,
  Category,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  ImportError,
} from '@shared/types';
import SuccessToast from '@/components/SuccessToast';

export default function Vendors() {
  const { vendors, createVendor, updateVendor, deleteVendor, loadVendors } =
    useMarketStore();
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    category: 'ceramic' as Category,
    powerRequirement: 0,
    contact: '',
    note: '',
  });

  const filteredVendors = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.contact.includes(searchTerm)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingVendor) {
        await updateVendor(editingVendor.id, formData);
        setSuccessMsg(`摊主「${formData.name}」已更新`);
      } else {
        await createVendor(formData);
        setSuccessMsg(`摊主「${formData.name}」已创建`);
      }
      setShowModal(false);
      resetForm();
    } catch (e: any) {
      // Error handled by store
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      category: vendor.category,
      powerRequirement: vendor.powerRequirement,
      contact: vendor.contact,
      note: vendor.note || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (vendor: Vendor) => {
    if (confirm(`确定要删除摊主「${vendor.name}」吗？`)) {
      await deleteVendor(vendor.id);
      setSuccessMsg(`摊主「${vendor.name}」已删除`);
    }
  };

  const resetForm = () => {
    setEditingVendor(null);
    setFormData({
      name: '',
      category: 'ceramic',
      powerRequirement: 0,
      contact: '',
      note: '',
    });
  };

  const handleBulkImport = async () => {
    try {
      const data = JSON.parse(importText);
      const result = await fetch('/api/vendors/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, source: '批量导入' }),
      }).then((r) => r.json());

      if (result.errors && result.errors.length > 0) {
        setImportErrors(result.errors);
      }
      if (result.success > 0) {
        setSuccessMsg(`成功导入 ${result.success} 位摊主`);
        await loadVendors();
      }
      setShowImportModal(false);
      setImportText('');
    } catch (e: any) {
      alert('导入格式错误，请检查JSON格式');
    }
  };

  return (
    <div className="p-8">
      {successMsg && (
        <SuccessToast message={successMsg} onClose={() => setSuccessMsg(null)} />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">摊主管理</h1>
          <p className="text-slate-500 mt-1">管理所有摊主信息和用电需求</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <Upload size={18} />
            批量导入
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus size={18} />
            添加摊主
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="搜索摊主名称或联系方式..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  摊主名称
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  品类
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  用电需求
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  联系方式
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  备注
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  数据来源
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-medium text-slate-800">
                      {vendor.name}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${CATEGORY_COLORS[vendor.category]}`}
                    >
                      {CATEGORY_LABELS[vendor.category]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-amber-500" />
                      <span className="text-slate-700">
                        {vendor.powerRequirement}W
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone size={14} />
                      {vendor.contact}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                    {vendor.note || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-slate-400">
                      {vendor.source || '手动录入'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(vendor)}
                        className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(vendor)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredVendors.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            暂无摊主数据
          </div>
        )}
      </div>

      {importErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
          <h3 className="font-medium text-red-800 mb-3">
            导入失败记录（{importErrors.length} 条）
          </h3>
          <div className="space-y-2">
            {importErrors.map((err, i) => (
              <div
                key={i}
                className="flex items-start gap-4 bg-white rounded-lg p-3 text-sm"
              >
                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-mono text-xs">
                  第 {err.row} 行
                </span>
                <div className="flex-1">
                  <span className="text-slate-700">{err.message}</span>
                  {err.value && (
                    <span className="text-slate-400 ml-2">
                      （值：{err.value}）
                    </span>
                  )}
                </div>
                <span className="text-slate-400 text-xs">
                  来源：{err.source}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setImportErrors([])}
            className="mt-3 text-sm text-red-600 hover:text-red-700"
          >
            清除错误记录
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-800">
                {editingVendor ? '编辑摊主' : '添加摊主'}
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
                  摊主名称 *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="请输入摊主名称"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  品类 *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category: e.target.value as Category,
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  用电需求 (W) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.powerRequirement}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      powerRequirement: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  联系方式
                </label>
                <input
                  type="text"
                  value={formData.contact}
                  onChange={(e) =>
                    setFormData({ ...formData, contact: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="手机号或其他联系方式"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  备注
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) =>
                    setFormData({ ...formData, note: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
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
                  {editingVendor ? '保存修改' : '确认添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-800">批量导入摊主</h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportText('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-slate-500 mb-2">
                请粘贴 JSON 格式的摊主数据数组，例如：
              </p>
              <pre className="bg-slate-50 p-3 rounded-lg text-xs text-slate-600 overflow-x-auto">
{`[
  { "name": "青瓷坊", "category": "ceramic", "powerRequirement": 800, "contact": "13800138000" },
  { "name": "墨香版画社", "category": "print", "powerRequirement": 300, "contact": "13800138001" }
]`}
              </pre>
            </div>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={10}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-sm resize-none"
              placeholder='[{"name": "...", "category": "ceramic", "powerRequirement": 500, "contact": "..."}]'
            />

            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportText('');
                }}
                className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleBulkImport}
                disabled={!importText.trim()}
                className="flex-1 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                开始导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
