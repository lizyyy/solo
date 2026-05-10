import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Rider, STATUS_LABELS, RiderStatus } from '../types';

interface Props {
  onRefresh: () => void;
}

export default function Riders({ onRefresh }: Props) {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const [newRider, setNewRider] = useState({
    name: '',
    phone: '',
    bibNumber: '',
    team: '',
    emergencyContact: '',
    emergencyPhone: ''
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status');
    if (statusParam) setFilterStatus(statusParam);
  }, [location]);

  const loadRiders = async () => {
    setLoading(true);
    try {
      const data = await api.getRiders(filterStatus || undefined);
      setRiders(data);
    } catch (e: any) {
      alert('加载失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRiders();
  }, [filterStatus]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.registerRider({
        name: newRider.name,
        phone: newRider.phone,
        bibNumber: parseInt(newRider.bibNumber),
        team: newRider.team || undefined,
        emergencyContact: newRider.emergencyContact || undefined,
        emergencyPhone: newRider.emergencyPhone || undefined
      });
      setShowRegister(false);
      setNewRider({ name: '', phone: '', bibNumber: '', team: '', emergencyContact: '', emergencyPhone: '' });
      loadRiders();
      onRefresh();
      alert('报名成功');
    } catch (e: any) {
      alert('报名失败: ' + e.message);
    }
  };

  const filtered = riders.filter(r => 
    r.name.includes(search) || 
    r.bibNumber.toString().includes(search) ||
    (r.team && r.team.includes(search))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">报名列表</h1>
        <button 
          onClick={() => setShowRegister(true)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          ➕ 新增报名
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-gray-600">状态筛选:</label>
            <select 
              value={filterStatus} 
              onChange={e => {
                setFilterStatus(e.target.value);
                if (e.target.value) {
                  navigate(`/riders?status=${e.target.value}`);
                } else {
                  navigate('/riders');
                }
              }}
              className="border rounded px-3 py-2"
            >
              <option value="">全部</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <input 
            type="text" 
            placeholder="搜索姓名、号码布、车队..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border rounded px-3 py-2 flex-1 min-w-64"
          />
          <button onClick={loadRiders} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            🔄 刷新
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">加载中...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">号码布</th>
                <th className="px-4 py-3 text-left">姓名</th>
                <th className="px-4 py-3 text-left">电话</th>
                <th className="px-4 py-3 text-left">车队</th>
                <th className="px-4 py-3 text-left">状态</th>
                <th className="px-4 py-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(rider => (
                <tr key={rider.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold">#{rider.bibNumber}</td>
                  <td className="px-4 py-3 font-medium">{rider.name}</td>
                  <td className="px-4 py-3">{rider.phone}</td>
                  <td className="px-4 py-3">{rider.team || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium bg-status-${rider.status} status-${rider.status}`}>
                      {STATUS_LABELS[rider.status as RiderStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/riders/${rider.id}`} className="text-blue-600 hover:underline">
                      详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-gray-500">暂无数据</div>
          )}
        </div>
      )}

      {showRegister && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">新增骑手报名</h2>
              <button onClick={() => setShowRegister(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
            </div>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">号码布 *</label>
                  <input 
                    type="number" 
                    required
                    value={newRider.bibNumber}
                    onChange={e => setNewRider({...newRider, bibNumber: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">姓名 *</label>
                  <input 
                    type="text" 
                    required
                    value={newRider.name}
                    onChange={e => setNewRider({...newRider, name: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">电话 *</label>
                  <input 
                    type="tel" 
                    required
                    value={newRider.phone}
                    onChange={e => setNewRider({...newRider, phone: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">车队</label>
                  <input 
                    type="text" 
                    value={newRider.team}
                    onChange={e => setNewRider({...newRider, team: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">紧急联系人</label>
                  <input 
                    type="text" 
                    value={newRider.emergencyContact}
                    onChange={e => setNewRider({...newRider, emergencyContact: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">紧急联系电话</label>
                  <input 
                    type="tel" 
                    value={newRider.emergencyPhone}
                    onChange={e => setNewRider({...newRider, emergencyPhone: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowRegister(false)} className="px-4 py-2 border rounded hover:bg-gray-100">取消</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">确认报名</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
