import { useEffect, useState } from 'react';
import { materialApi } from '../services/api';
import { Material } from '../types';

const Materials = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    unit: '',
    description: '',
  });

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      const res = await materialApi.getAll();
      setMaterials(res.data);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await materialApi.create(formData);
      setShowForm(false);
      setFormData({ code: '', name: '', unit: '', description: '' });
      loadMaterials();
    } catch (error: any) {
      alert(error.response?.data?.error || '创建失败');
    }
  };

  if (loading) {
    return <div className="text-center py-12">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">物资管理</h1>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary"
        >
          + 添加物资
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">添加物资</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">物资编码</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="input"
                  placeholder="如：M001"
                />
              </div>
              <div>
                <label className="label">物资名称</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="如：大米"
                />
              </div>
              <div>
                <label className="label">计量单位</label>
                <input
                  type="text"
                  required
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="input"
                  placeholder="如：袋、桶"
                />
              </div>
              <div>
                <label className="label">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="物资描述信息"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn btn-secondary flex-1"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium text-gray-600">编码</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">名称</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">单位</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">描述</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((material) => (
                <tr key={material.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-sm">{material.code}</td>
                  <td className="py-3 px-4">{material.name}</td>
                  <td className="py-3 px-4">{material.unit}</td>
                  <td className="py-3 px-4 text-sm text-gray-500">{material.description || '-'}</td>
                  <td className="py-3 px-4 text-sm text-gray-500">
                    {new Date(material.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Materials;
