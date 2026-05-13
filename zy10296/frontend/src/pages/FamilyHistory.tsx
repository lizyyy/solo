import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { distributionApi, familyApi } from '../services/api';
import { Family, Distribution } from '../types';

const FamilyHistory = () => {
  const { id } = useParams<{ id: string }>();
  const [family, setFamily] = useState<Family | null>(null);
  const [history, setHistory] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [familyRes, historyRes] = await Promise.all([
        familyApi.getById(parseInt(id!)),
        distributionApi.getByFamilyId(parseInt(id!))
      ]);
      setFamily(familyRes.data);
      setHistory(historyRes.data);
    } finally {
      setLoading(false);
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
      <div className="flex items-center gap-4">
        <Link to="/families" className="text-blue-600 hover:text-blue-800">
          ← 返回家庭列表
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">家庭领取历史</h1>
      </div>

      {family && (
        <div className="card">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">家庭编号</p>
              <p className="font-mono font-semibold">{family.familyId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">家庭名称</p>
              <p className="font-semibold">{family.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">家庭成员</p>
              <p className="font-semibold">{family.members}人</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">审核状态</p>
              <span className={`status-badge ${family.status === 'approved' ? 'status-approved' : family.status === 'pending' ? 'status-pending' : 'status-rejected'}`}>
                {family.status === 'approved' ? '已通过' : family.status === 'pending' ? '待审核' : '已拒绝'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">领取记录</h2>
        {history.length === 0 ? (
          <p className="text-gray-500 text-center py-8">暂无领取记录</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">发放编号</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">物资</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">批次</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">数量</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">类型</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">状态</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">时间</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-sm">{item.distributionNo}</td>
                    <td className="py-3 px-4">{item.materialName}</td>
                    <td className="py-3 px-4">{item.batchName}</td>
                    <td className="py-3 px-4">{item.quantity}</td>
                    <td className="py-3 px-4">
                      {item.isProxy ? (
                        <span className="text-orange-600 text-sm">代领: {item.proxyName}</span>
                      ) : (
                        <span className="text-green-600 text-sm">本人领取</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`status-badge ${getStatusClass(item.status)}`}>
                        {getStatusText(item.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FamilyHistory;
