import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { familyApi } from '../services/api';
import { Family } from '../types';

const Families = () => {
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    familyId: '',
    name: '',
    members: 1,
    address: '',
    phone: '',
  });

  useEffect(() => {
    loadFamilies();
  }, [filter]);

  const loadFamilies = async () => {
    try {
      const res = await familyApi.getAll(filter || undefined);
      setFamilies(res.data);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    if (confirm('确认审核通过此家庭？')) {
      await familyApi.approve(id, '志愿者');
      loadFamilies();
    }
  };

  const handleReject = async (id: number) => {
    if (confirm('确认拒绝此家庭？')) {
      await familyApi.reject(id, '志愿者');
      loadFamilies();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await familyApi.create(formData);
      setShowForm(false);
      setFormData({ familyId: '', name: '', members: 1, address: '', phone: '' });
      loadFamilies();
    } catch (error: any) {
      alert(error.response?.data?.error || '创建失败');
    }
  };

  const getStatusClass = (status: string) => {
    const classes: Record<string, string> = {
      approved: 'status-approved',
      pending: 'status-pending',
      rejected: 'status-rejected',
    };
    return classes[status] || '';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      approved: '已审核',
      pending: '待审核',
      rejected: '已拒绝',
    };
    return texts[status] || status;
  };

  if (loading) {
    return <div className="text-center py-12">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">家庭管理</h1>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary"
        >
          + 添加家庭
        </button>
      </div>

      <div className="flex gap-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input w-40"
        >
          <option value="">全部状态</option>
          <option value="pending">待审核</option>
          <option value="approved">已审核</option>
          <option value="rejected">已拒绝</option>
        </select>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">添加家庭</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">家庭编号</label>
                <input
                  type="text"
                  required
                  value={formData.familyId}
                  onChange={(e) => setFormData({ ...formData, familyId: e.target.value })}
                  className="input"
                  placeholder="如：F001"
                />
              </div>
              <div>
                <label className="label">家庭名称</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="如：张三家庭"
                />
              </div>
              <div>
                <label className="label">家庭成员数</label>
                <input
                  type="number"
                  min="1"
                  value={formData.members}
                  onChange={(e) => setFormData({ ...formData, members: parseInt(e.target.value) || 1 })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">联系电话</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">居住地址</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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
                <th className="text-left py-3 px-4 font-medium text-gray-600">家庭编号</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">名称</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">人数</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">电话</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">地址</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">状态</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {families.map((family) => (
                <tr key={family.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-sm">{family.familyId}</td>
                  <td className="py-3 px-4">{family.name}</td>
                  <td className="py-3 px-4">{family.members}人</td>
                  <td className="py-3 px-4">{family.phone}</td>
                  <td className="py-3 px-4 text-sm text-gray-500">{family.address}</td>
                  <td className="py-3 px-4">
                    <span className={`status-badge ${getStatusClass(family.status)}`}>
                      {getStatusText(family.status)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <Link
                        to={`/families/${family.id}/history`}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        领取历史
                      </Link>
                      {family.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(family.id)}
                            className="text-green-600 hover:text-green-800 text-sm"
                          >
                            通过
                          </button>
                          <button
                            onClick={() => handleReject(family.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            拒绝
                          </button>
                        </>
                      )}
                    </div>
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

export default Families;
