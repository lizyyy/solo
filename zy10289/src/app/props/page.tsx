'use client';

import { useEffect, useState } from 'react';
import { Prop } from '@/types';
import { store } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';

export default function PropsPage() {
  const [props, setProps] = useState<Prop[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingProp, setEditingProp] = useState<Prop | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    quantity: 1,
    availableQuantity: 1,
    dailyRate: 0,
    depositAmount: 0,
    status: 'available' as Prop['status'],
    tags: [] as string[],
  });

  useEffect(() => {
    refreshProps();
  }, []);

  const refreshProps = () => {
    setProps([...store.getProps()]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProp) {
      store.updateProp(editingProp.id, formData);
    } else {
      store.addProp(formData);
    }
    refreshProps();
    closeModal();
  };

  const openModal = (prop?: Prop) => {
    if (prop) {
      setEditingProp(prop);
      setFormData({
        name: prop.name,
        category: prop.category,
        description: prop.description,
        quantity: prop.quantity,
        availableQuantity: prop.availableQuantity,
        dailyRate: prop.dailyRate,
        depositAmount: prop.depositAmount,
        status: prop.status,
        tags: prop.tags,
      });
    } else {
      setEditingProp(null);
      setFormData({
        name: '',
        category: '',
        description: '',
        quantity: 1,
        availableQuantity: 1,
        dailyRate: 0,
        depositAmount: 0,
        status: 'available',
        tags: [],
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProp(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个道具吗？')) {
      store.deleteProp(id);
      refreshProps();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">🎬 道具管理</h1>
        <button
          onClick={() => openModal()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          ➕ 添加道具
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {props.map((prop) => (
          <div key={prop.id} className="bg-white rounded-xl shadow overflow-hidden">
            <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <span className="text-6xl">🎭</span>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg text-gray-900">{prop.name}</h3>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {prop.category}
                </span>
              </div>
              <p className="text-gray-500 text-sm mb-4 line-clamp-2">{prop.description}</p>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">日租金</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(prop.dailyRate)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">押金</span>
                  <span className="font-semibold text-orange-600">{formatCurrency(prop.depositAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">库存</span>
                  <span className="font-semibold text-green-600">{prop.availableQuantity}/{prop.quantity}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-4">
                {prop.tags.map((tag, i) => (
                  <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openModal(prop)}
                  className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(prop.id)}
                  className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingProp ? '编辑道具' : '添加道具'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">道具名称</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="输入道具名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                <input
                  type="text"
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="如：家具、灯具、背景"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="详细描述道具特点"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">总数量</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">可用数量</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.availableQuantity}
                    onChange={(e) => setFormData({ ...formData, availableQuantity: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">日租金 (¥)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.dailyRate}
                    onChange={(e) => setFormData({ ...formData, dailyRate: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">押金 (¥)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.depositAmount}
                    onChange={(e) => setFormData({ ...formData, depositAmount: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  {editingProp ? '保存修改' : '添加道具'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
