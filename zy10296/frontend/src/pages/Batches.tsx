import { useEffect, useState } from 'react';
import { batchApi, materialApi } from '../services/api';
import { Batch, Material } from '../types';

const Batches = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    materialId: 0,
    quantity: 0,
    cycleDays: 30,
    startTime: '',
    endTime: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [batchesRes, materialsRes] = await Promise.all([
        batchApi.getAll(),
        materialApi.getAll()
      ]);
      setBatches(batchesRes.data);
      setMaterials(materialsRes.data);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async (id: number) => {
    if (confirm('确认关闭此批次？关闭后将无法进行新的发放登记')) {
      await batchApi.close(id);
      loadData();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await batchApi.create(formData);
      setShowForm(false);
      setFormData({
        code: '', name: '', materialId: 0, quantity: 0,
        cycleDays: 30, startTime: '', endTime: ''
      });
      loadData();
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
        <h1 className="text-2xl font-bold text-gray-800">批次管理</h1>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary"
        >
          + 创建批次
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">创建发放批次</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">批次编号</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="input"
                  placeholder="如：B001"
                />
              </div>
              <div>
                <label className="label">批次名称</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="如：2024年春季发放"
                />
              </div>
              <div>
                <label className="label">物资类型</label>
                <select
                  required
                  value={formData.materialId}
                  onChange={(e) => setFormData({ ...formData, materialId: parseInt(e.target.value) })}
                  className="input"
                >
                  <option value={0}>请选择物资</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">总数量</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">领取周期（天）</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.cycleDays}
                  onChange={(e) => setFormData({ ...formData, cycleDays: parseInt(e.target.value) || 30 })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">开始时间</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">结束时间</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="input"
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
                <th className="text-left py-3 px-4 font-medium text-gray-600">批次编号</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">名称</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">物资</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">总数量</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">周期</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">时间</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">状态</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-sm">{batch.code}</td>
                  <td className="py-3 px-4">{batch.name}</td>
                  <td className="py-3 px-4">{batch.materialName}</td>
                  <td className="py-3 px-4">{batch.quantity} {batch.materialUnit}</td>
                  <td className="py-3 px-4">{batch.cycleDays}天</td>
                  <td className="py-3 px-4 text-sm text-gray-500">
                    {new Date(batch.startTime).toLocaleDateString()} - 
                    {new Date(batch.endTime).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`status-badge ${batch.status === 'active' ? 'status-approved' : 'status-rejected'}`}>
                      {batch.status === 'active' ? '进行中' : '已关闭'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {batch.status === 'active' && (
                      <button
                        onClick={() => handleClose(batch.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        关闭
                      </button>
                    )}
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

export default Batches;
