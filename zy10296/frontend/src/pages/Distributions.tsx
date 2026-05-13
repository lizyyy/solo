import { useEffect, useState } from 'react';
import { distributionApi, familyApi, batchApi } from '../services/api';
import { Distribution, Family, Batch } from '../types';

const Distributions = () => {
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [needReview, setNeedReview] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    familyId: 0,
    batchId: 0,
    quantity: 1,
    isProxy: false,
    proxyName: '',
    proxyIdCard: '',
    proxyProof: false,
  });

  useEffect(() => {
    loadData();
  }, [filter, needReview]);

  const loadData = async () => {
    try {
      const [distRes, famRes, batRes] = await Promise.all([
        distributionApi.getAll({ 
          status: filter || undefined, 
          needReview,
        }),
        familyApi.getAll('approved'),
        batchApi.getAll()
      ]);
      setDistributions(distRes.data);
      setFamilies(famRes.data);
      setBatches(batRes.data.filter((b: Batch) => b.status === 'active'));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    if (confirm('确认审核通过并发放物资？')) {
      await distributionApi.approve(id, '志愿者');
      loadData();
    }
  };

  const handleReject = async (id: number) => {
    if (confirm('确认拒绝此发放申请？')) {
      await distributionApi.reject(id, '志愿者');
      loadData();
    }
  };

  const handleReturn = async (id: number) => {
    const reason = prompt('请输入退回原因：');
    if (reason) {
      await distributionApi.return(id, 1, reason, '志愿者');
      loadData();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await distributionApi.create({
        ...formData,
        operator: '志愿者'
      });
      if (res.data.blocked) {
        alert(`发放被拦截：${res.data.error}`);
      } else {
        alert('发放登记成功！');
      }
      setShowForm(false);
      setFormData({
        familyId: 0, batchId: 0, quantity: 1,
        isProxy: false, proxyName: '', proxyIdCard: '', proxyProof: false
      });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || '创建失败');
    }
  };

  const getStatusClass = (status: string) => {
    const classes: Record<string, string> = {
      distributed: 'status-distributed',
      pending: 'status-pending',
      blocked: 'status-blocked',
      returned: 'status-returned',
    };
    return classes[status] || '';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      distributed: '已发放',
      pending: '待审核',
      blocked: '已拦截',
      returned: '已退回',
    };
    return texts[status] || status;
  };

  if (loading) {
    return <div className="text-center py-12">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">发放登记</h1>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary"
        >
          + 新发放
        </button>
      </div>

      <div className="flex gap-4 flex-wrap">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input w-40"
        >
          <option value="">全部状态</option>
          <option value="pending">待审核</option>
          <option value="distributed">已发放</option>
          <option value="blocked">已拦截</option>
          <option value="returned">已退回</option>
        </select>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={needReview}
            onChange={(e) => setNeedReview(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">只看需要人工复核的记录</span>
        </label>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">物资发放登记</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">选择家庭</label>
                <select
                  required
                  value={formData.familyId}
                  onChange={(e) => setFormData({ ...formData, familyId: parseInt(e.target.value) })}
                  className="input"
                >
                  <option value={0}>请选择家庭（仅显示已审核通过的）</option>
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>{f.familyId} - {f.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">选择批次</label>
                <select
                  required
                  value={formData.batchId}
                  onChange={(e) => setFormData({ ...formData, batchId: parseInt(e.target.value) })}
                  className="input"
                >
                  <option value={0}>请选择发放批次</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>{b.code} - {b.name} ({b.cycleDays}天周期)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">发放数量</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  className="input"
                />
              </div>

              <div className="border-t pt-4">
                <label className="flex items-center gap-2 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={formData.isProxy}
                    onChange={(e) => setFormData({ ...formData, isProxy: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span>代领（非本人领取）</span>
                </label>

                {formData.isProxy && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="label">代领人姓名</label>
                      <input
                        type="text"
                        required
                        value={formData.proxyName}
                        onChange={(e) => setFormData({ ...formData, proxyName: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">代领人身份证号</label>
                      <input
                        type="text"
                        required
                        value={formData.proxyIdCard}
                        onChange={(e) => setFormData({ ...formData, proxyIdCard: e.target.value })}
                        className="input"
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.proxyProof}
                        onChange={(e) => setFormData({ ...formData, proxyProof: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">已核验代领人身份证明（如未核验将需要人工复核）</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  提交登记
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
                <th className="text-left py-3 px-4 font-medium text-gray-600">发放编号</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">家庭</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">物资</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">数量</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">类型</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">状态</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">拦截原因</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {distributions.map((d) => (
                <tr key={d.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-sm">{d.distributionNo}</td>
                  <td className="py-3 px-4">{d.familyName}</td>
                  <td className="py-3 px-4">{d.materialName}</td>
                  <td className="py-3 px-4">{d.quantity}</td>
                  <td className="py-3 px-4">
                    {d.isProxy ? (
                      <span className="text-orange-600 text-sm">代领: {d.proxyName}</span>
                    ) : (
                      <span className="text-green-600 text-sm">本人领取</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`status-badge ${getStatusClass(d.status)}`}>
                      {getStatusText(d.status)}
                    </span>
                    {d.needReview && (
                      <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                        需复核
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-red-500 max-w-xs truncate">
                    {d.blockReason || '-'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2 flex-wrap">
                      {d.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(d.id)}
                            className="text-green-600 hover:text-green-800 text-sm"
                          >
                            审核发放
                          </button>
                          <button
                            onClick={() => handleReject(d.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            拒绝
                          </button>
                        </>
                      )}
                      {d.status === 'distributed' && (
                        <button
                          onClick={() => handleReturn(d.id)}
                          className="text-orange-600 hover:text-orange-800 text-sm"
                        >
                          退回
                        </button>
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

export default Distributions;
