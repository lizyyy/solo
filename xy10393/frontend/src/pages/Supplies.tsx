import { useState, useEffect } from 'react';
import { api, formatDateTime } from '../api';
import { Rider, Checkpoint, Supply, STATUS_LABELS } from '../types';
import { Link } from 'react-router-dom';

interface Props {
  onRefresh: () => void;
}

export default function Supplies({ onRefresh }: Props) {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [activeTab, setActiveTab] = useState<'course' | 'finish'>('course');
  const [showForm, setShowForm] = useState(false);
  const [searchBib, setSearchBib] = useState('');
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [supplyType, setSupplyType] = useState<'course' | 'finish'>('course');
  const [selectedCp, setSelectedCp] = useState('');
  const [collectedBy, setCollectedBy] = useState('');

  const loadData = async () => {
    const [r, cps, s] = await Promise.all([
      api.getRiders(),
      api.getCheckpoints(),
      api.getSupplies()
    ]);
    setRiders(r);
    setCheckpoints(cps);
    setSupplies(s);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = async () => {
    if (!searchBib) return;
    try {
      const rider = await api.getRiderByBib(parseInt(searchBib));
      setSelectedRider(rider);
    } catch (e: any) {
      alert(e.message);
      setSelectedRider(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedRider || !collectedBy) {
      alert('请填写必要信息');
      return;
    }

    const hasCollected = supplies.some(s => s.riderId === selectedRider.id && s.supplyType === supplyType);
    if (hasCollected) {
      alert('该骑手已领取该类补给');
      return;
    }

    if (supplyType === 'finish') {
      if (selectedRider.status === 'dropped_out') {
        alert('退赛骑手不能领取完赛补给');
        return;
      }
      if (selectedRider.status !== 'finished') {
        alert('未完赛骑手不能领取完赛补给');
        return;
      }
    }

    try {
      await api.recordSupply({
        riderId: selectedRider.id,
        supplyType,
        checkpointId: selectedCp || undefined,
        collectedBy
      });
      setShowForm(false);
      setSelectedRider(null);
      setSearchBib('');
      setSelectedCp('');
      setCollectedBy('');
      loadData();
      onRefresh();
      alert('补给发放成功');
    } catch (e: any) {
      alert('发放失败: ' + e.message);
    }
  };

  const courseSupplies = supplies.filter(s => s.supplyType === 'course');
  const finishSupplies = supplies.filter(s => s.supplyType === 'finish');

  const currentSupplies = activeTab === 'course' ? courseSupplies : finishSupplies;

  const suppliesWithDetails = currentSupplies.map(s => ({
    supply: s,
    rider: riders.find(r => r.id === s.riderId),
    checkpoint: s.checkpointId ? checkpoints.find(c => c.id === s.checkpointId) : undefined
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">补给状态</h1>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
          ➕ 发放补给
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="text-sm text-orange-600">途中补给已发放</div>
          <div className="text-2xl font-bold">{courseSupplies.length}</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-sm text-purple-600">完赛补给已发放</div>
          <div className="text-2xl font-bold">{finishSupplies.length}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="flex border-b">
          <button 
            onClick={() => setActiveTab('course')}
            className={`px-6 py-3 font-medium ${activeTab === 'course' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-gray-500'}`}
          >
            途中补给 ({courseSupplies.length})
          </button>
          <button 
            onClick={() => setActiveTab('finish')}
            className={`px-6 py-3 font-medium ${activeTab === 'finish' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500'}`}
          >
            完赛补给 ({finishSupplies.length})
          </button>
        </div>

        <div className="p-6">
          {suppliesWithDetails.length === 0 ? (
            <div className="text-gray-500 text-center py-8">暂无发放记录</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">号码布</th>
                    <th className="px-4 py-3 text-left">姓名</th>
                    <th className="px-4 py-3 text-left">车队</th>
                    <th className="px-4 py-3 text-left">领取地点</th>
                    <th className="px-4 py-3 text-left">领取时间</th>
                    <th className="px-4 py-3 text-left">发放人</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {suppliesWithDetails.map(({ supply, rider, checkpoint }) => (
                    <tr key={supply.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-bold">
                        {rider ? `#${rider.bibNumber}` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {rider ? (
                          <Link to={`/riders/${rider.id}`} className="hover:underline">
                            {rider.name}
                          </Link>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">{rider?.team || '-'}</td>
                      <td className="px-4 py-3">{checkpoint?.name || '-'}</td>
                      <td className="px-4 py-3">{formatDateTime(supply.collectedAt)}</td>
                      <td className="px-4 py-3">{supply.collectedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">发放补给</h2>
              <button onClick={() => { setShowForm(false); setSelectedRider(null); }} 
                className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">搜索骑手（号码布）</label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    value={searchBib}
                    onChange={e => setSearchBib(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    className="flex-1 border rounded px-3 py-2"
                    placeholder="输入号码布编号"
                  />
                  <button onClick={handleSearch} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">搜索</button>
                </div>
              </div>

              {selectedRider && (
                <div className={`p-3 rounded ${
                  supplyType === 'finish' && selectedRider.status !== 'finished'
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-green-50'
                }`}>
                  <div className="font-bold">#{selectedRider.bibNumber} {selectedRider.name}</div>
                  {selectedRider.team && <div className="text-sm text-gray-600">{selectedRider.team}</div>}
                  <div className="text-sm mt-1">
                    当前状态: <span className={`status-${selectedRider.status}`}>{(STATUS_LABELS as any)[selectedRider.status]}</span>
                  </div>
                  {supplyType === 'finish' && selectedRider.status === 'dropped_out' && (
                    <div className="text-red-600 text-sm mt-2">⚠️ 退赛骑手不能领取完赛补给</div>
                  )}
                  {supplyType === 'finish' && selectedRider.status !== 'finished' && selectedRider.status !== 'dropped_out' && (
                    <div className="text-red-600 text-sm mt-2">⚠️ 未完赛骑手不能领取完赛补给</div>
                  )}
                  {supplies.some(s => s.riderId === selectedRider.id && s.supplyType === supplyType) && (
                    <div className="text-yellow-600 text-sm mt-2">⚠️ 已领取该类补给</div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">补给类型</label>
                <select 
                  value={supplyType}
                  onChange={e => setSupplyType(e.target.value as 'course' | 'finish')}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="course">途中补给</option>
                  <option value="finish">完赛补给</option>
                </select>
              </div>

              {supplyType === 'course' && (
                <div>
                  <label className="block text-sm font-medium mb-1">领取签到点（可选）</label>
                  <select 
                    value={selectedCp}
                    onChange={e => setSelectedCp(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">未指定</option>
                    {checkpoints.filter(c => !c.isFinish).map(cp => (
                      <option key={cp.id} value={cp.id}>{cp.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">发放人 *</label>
                <input 
                  type="text" 
                  value={collectedBy}
                  onChange={e => setCollectedBy(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="请输入发放人姓名"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => { setShowForm(false); setSelectedRider(null); }} 
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                >
                  取消
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={!selectedRider || !collectedBy}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  确认发放
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
