'use client';

import { useEffect, useState } from 'react';
import { Crew } from '@/types';
import { store } from '@/lib/store';

export default function CrewsPage() {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCrew, setEditingCrew] = useState<Crew | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    company: '',
    notes: '',
  });

  useEffect(() => {
    refreshCrews();
  }, []);

  const refreshCrews = () => {
    setCrews([...store.getCrews()]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCrew) {
      store.updateCrew(editingCrew.id, formData);
    } else {
      store.addCrew(formData);
    }
    refreshCrews();
    closeModal();
  };

  const openModal = (crew?: Crew) => {
    if (crew) {
      setEditingCrew(crew);
      setFormData({
        name: crew.name,
        contactPerson: crew.contactPerson,
        phone: crew.phone,
        email: crew.email,
        company: crew.company || '',
        notes: crew.notes || '',
      });
    } else {
      setEditingCrew(null);
      setFormData({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        company: '',
        notes: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCrew(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个拍摄组吗？')) {
      store.deleteCrew(id);
      refreshCrews();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">👥 拍摄组管理</h1>
        <button
          onClick={() => openModal()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          ➕ 添加拍摄组
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {crews.map((crew) => (
          <div key={crew.id} className="bg-white rounded-xl shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-2xl text-white">🎬</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openModal(crew)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(crew.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>
            
            <h3 className="font-semibold text-lg text-gray-900 mb-1">{crew.name}</h3>
            {crew.company && (
              <p className="text-sm text-gray-500 mb-3">{crew.company}</p>
            )}
            
            <div className="space-y-2 mt-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">👤</span>
                <span className="text-gray-700">{crew.contactPerson}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">📞</span>
                <span className="text-gray-700">{crew.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">📧</span>
                <span className="text-gray-700">{crew.email}</span>
              </div>
            </div>

            {crew.notes && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">{crew.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingCrew ? '编辑拍摄组' : '添加拍摄组'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">团队名称 *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="输入团队名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">联系人 *</label>
                <input
                  type="text"
                  required
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="联系人姓名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">联系电话 *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="联系电话"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱 *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="电子邮箱"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">所属公司</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="公司名称（可选）"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder="备注信息（可选）"
                />
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
                  {editingCrew ? '保存修改' : '添加拍摄组'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
