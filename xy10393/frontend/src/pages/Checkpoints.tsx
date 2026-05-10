import { useState, useEffect } from 'react';
import { api, formatDateTime } from '../api';
import { Checkpoint, Checkin, Rider, STATUS_LABELS } from '../types';
import { Link } from 'react-router-dom';

interface Props {
  onRefresh: () => void;
}

export default function Checkpoints({ onRefresh }: Props) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [selectedCp, setSelectedCp] = useState<string | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [allRiders, setAllRiders] = useState<Rider[]>([]);
  const [showCheckin, setShowCheckin] = useState(false);
  const [searchBib, setSearchBib] = useState('');
  const [foundRider, setFoundRider] = useState<Rider | null>(null);
  const [checkerName, setCheckerName] = useState('');

  const loadData = async () => {
    const [cps, riders] = await Promise.all([
      api.getCheckpoints(),
      api.getRiders()
    ]);
    setCheckpoints(cps);
    setAllRiders(riders);
    if (cps.length > 0 && !selectedCp) {
      setSelectedCp(cps[0].id);
    }
  };

  const loadCheckins = async () => {
    if (!selectedCp) return;
    const data = await api.getCheckins(selectedCp);
    setCheckins(data);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadCheckins();
  }, [selectedCp]);

  const selectedCheckpoint = checkpoints.find(c => c.id === selectedCp);
  const checkedRiderIds = new Set(checkins.map(c => c.riderId));
  const checkedRiders = checkins.map(c => ({
    checkin: c,
    rider: allRiders.find(r => r.id === c.riderId)
  })).filter(x => x.rider);

  const handleSearch = async () => {
    if (!searchBib) return;
    try {
      const rider = await api.getRiderByBib(parseInt(searchBib));
      setFoundRider(rider);
    } catch (e: any) {
      alert(e.message);
      setFoundRider(null);
    }
  };

  const handleCheckin = async () => {
    if (!foundRider || !selectedCp || !checkerName) {
      alert('请选择骑手和签到点，并输入签到员姓名');
      return;
    }

    if (checkedRiderIds.has(foundRider.id)) {
      alert('该骑手已在此签到点签到');
      return;
    }

    try {
      await api.recordCheckin({
        riderId: foundRider.id,
        checkpointId: selectedCp,
        checkedBy: checkerName
      });
      setShowCheckin(false);
      setFoundRider(null);
      setSearchBib('');
      loadCheckins();
      onRefresh();
      alert('签到成功');
    } catch (e: any) {
      alert('签到失败: ' + e.message);
    }
  };

  const pendingRiders = allRiders.filter(r => 
    (r.status === 'in_progress' || r.status === 'equipment_passed') && 
    !checkedRiderIds.has(r.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">签到点看板</h1>
        <button onClick={() => setShowCheckin(true)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          ➕ 快速签到
        </button>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {checkpoints.map(cp => (
          <button
            key={cp.id}
            onClick={() => setSelectedCp(cp.id)}
            className={`p-4 rounded-lg text-left transition-all ${
              selectedCp === cp.id 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'bg-white shadow hover:shadow-md'
            }`}
          >
            <div className="font-medium">
              {cp.isStart ? '🏁' : cp.isFinish ? '🏆' : '📍'} {cp.name}
            </div>
            <div className={`text-sm ${selectedCp === cp.id ? 'text-blue-100' : 'text-gray-500'}`}>
              已签到: {checkpoints.find(c => c.id === cp.id) ? checkins.filter(ci => ci.checkpointId === cp.id).length : 0} 人
            </div>
          </button>
        ))}
      </div>

      {selectedCheckpoint && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">
              {selectedCheckpoint.isStart ? '🏁 ' : selectedCheckpoint.isFinish ? '🏆 ' : '📍 '}
              {selectedCheckpoint.name} - 已签到 ({checkins.length}人)
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {checkedRiders.map(({ checkin, rider }) => (
                <div key={checkin.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <Link to={`/riders/${rider!.id}`} className="hover:underline">
                    <span className="font-bold">#{rider!.bibNumber}</span> {rider!.name}
                    {rider!.team && <span className="text-gray-500 text-sm ml-2">({rider!.team})</span>}
                  </Link>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">{formatDateTime(checkin.checkedInAt)}</div>
                    <div className="text-xs text-gray-400">{checkin.checkedBy}</div>
                  </div>
                </div>
              ))}
              {checkins.length === 0 && (
                <div className="text-gray-500 text-center py-8">暂无签到记录</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">📋 待签到 ({pendingRiders.length}人)</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {pendingRiders.map(rider => (
                <div key={rider.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded">
                  <div>
                    <span className="font-bold">#{rider.bibNumber}</span> {rider.name}
                    {rider.team && <span className="text-gray-500 text-sm ml-2">({rider.team})</span>}
                  </div>
                  <span className={`text-sm px-2 py-1 rounded bg-status-${rider.status} status-${rider.status}`}>
                    {(STATUS_LABELS as any)[rider.status]}
                  </span>
                </div>
              ))}
              {pendingRiders.length === 0 && (
                <div className="text-gray-500 text-center py-8">无待签到骑手</div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCheckin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">快速签到</h2>
              <button onClick={() => { setShowCheckin(false); setFoundRider(null); setSearchBib(''); }} 
                className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">选择签到点</label>
                <select 
                  value={selectedCp || ''}
                  onChange={e => setSelectedCp(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  {checkpoints.map(cp => (
                    <option key={cp.id} value={cp.id}>{cp.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">号码布搜索</label>
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
              {foundRider && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="font-bold text-lg">#{foundRider.bibNumber} {foundRider.name}</div>
                  {foundRider.team && <div className="text-sm text-gray-600">{foundRider.team}</div>}
                  <div className="text-sm mt-1">
                    当前状态: <span className={`status-${foundRider.status}`}>{(STATUS_LABELS as any)[foundRider.status]}</span>
                  </div>
                  {checkedRiderIds.has(foundRider.id) && (
                    <div className="text-red-600 text-sm mt-2">⚠️ 该骑手已在此签到点签到</div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">签到员姓名</label>
                <input 
                  type="text" 
                  value={checkerName}
                  onChange={e => setCheckerName(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="请输入您的姓名"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => { setShowCheckin(false); setFoundRider(null); setSearchBib(''); }} 
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                >
                  取消
                </button>
                <button 
                  onClick={handleCheckin} 
                  disabled={!foundRider || !checkerName}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  确认签到
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
