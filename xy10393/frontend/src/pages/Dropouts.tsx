import { useState, useEffect } from 'react';
import { api, formatDateTime } from '../api';
import { Rider, Checkpoint, Dropout, STATUS_LABELS } from '../types';
import { Link } from 'react-router-dom';

interface Props {
  onRefresh: () => void;
}

export default function Dropouts({ onRefresh }: Props) {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [dropouts, setDropouts] = useState<Dropout[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [searchBib, setSearchBib] = useState('');
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [selectedCp, setSelectedCp] = useState('');
  const [reason, setReason] = useState('');
  const [comments, setComments] = useState('');
  const [recordedBy, setRecordedBy] = useState('');
  const [approvalComments, setApprovalComments] = useState('');

  const loadData = async () => {
    const [r, cps, d] = await Promise.all([
      api.getRiders(),
      api.getCheckpoints(),
      api.getDropouts()
    ]);
    setRiders(r);
    setCheckpoints(cps);
    setDropouts(d);
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
    if (!selectedRider || !reason || !recordedBy) {
      alert('请填写必要信息');
      return;
    }

    if (selectedRider.status === 'dropped_out') {
      alert('该骑手已退赛');
      return;
    }

    if (selectedRider.status === 'finished') {
      alert('该骑手已完赛，无法退赛');
      return;
    }

    try {
      const result = await api.recordDropout({
        riderId: selectedRider.id,
        checkpointId: selectedCp || undefined,
        reason,
        comments: comments || undefined,
        recordedBy
      });

      if (approvalComments) {
        await api.addApproval({
          relatedType: 'dropout',
          relatedId: result.id,
          action: '退赛登记确认',
          decision: 'approved',
          comments: approvalComments,
          madeBy: recordedBy
        });
      }

      setShowForm(false);
      setSelectedRider(null);
      setSearchBib('');
      setSelectedCp('');
      setReason('');
      setComments('');
      setRecordedBy('');
      setApprovalComments('');
      loadData();
      onRefresh();
      alert('退赛登记成功');
    } catch (e: any) {
      alert('提交失败: ' + e.message);
    }
  };

  const inProgress = riders.filter(r => r.status === 'in_progress');

  const dropoutWithDetails = dropouts.map(d => ({
    dropout: d,
    rider: riders.find(r => r.id === d.riderId),
    checkpoint: d.checkpointId ? checkpoints.find(c => c.id === d.checkpointId) : undefined
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">退赛登记</h1>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
          ➕ 登记退赛
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-blue-600">比赛中</div>
          <div className="text-2xl font-bold">{inProgress.length}</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="text-sm text-orange-600">已退赛</div>
          <div className="text-2xl font-bold">{dropouts.length}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">📋 退赛记录</h2>
        {dropoutWithDetails.length === 0 ? (
          <div className="text-gray-500 text-center py-8">暂无退赛记录</div>
        ) : (
          <div className="space-y-3">
            {dropoutWithDetails.map(({ dropout, rider, checkpoint }) => (
              <div key={dropout.id} className="p-4 bg-orange-50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    {rider && (
                      <div className="font-bold">
                        #{rider.bibNumber} {rider.name}
                        {rider.team && <span className="text-gray-600 font-normal ml-2">({rider.team})</span>}
                      </div>
                    )}
                    <div className="text-sm mt-1">
                      <span className="font-medium">原因:</span> {dropout.reason}
                    </div>
                    {checkpoint && (
                      <div className="text-sm text-gray-600">
                        退赛地点: {checkpoint.name}
                      </div>
                    )}
                    {dropout.comments && (
                      <div className="text-sm text-gray-600 mt-1">
                        备注: {dropout.comments}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">{formatDateTime(dropout.droppedAt)}</div>
                    <div className="text-xs text-gray-400">登记人: {dropout.recordedBy}</div>
                    {rider && <Link to={`/riders/${rider.id}`} className="text-blue-600 text-sm hover:underline">查看详情</Link>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">登记退赛</h2>
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
                <div className="p-3 bg-orange-50 rounded">
                  <div className="font-bold">#{selectedRider.bibNumber} {selectedRider.name}</div>
                  {selectedRider.team && <div className="text-sm text-gray-600">{selectedRider.team}</div>}
                  <div className="text-sm mt-1">
                    当前状态: <span className={`status-${selectedRider.status}`}>{(STATUS_LABELS as any)[selectedRider.status]}</span>
                  </div>
                  {(selectedRider.status === 'dropped_out' || selectedRider.status === 'finished') && (
                    <div className="text-red-600 text-sm mt-2">⚠️ 该骑手无法登记退赛</div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">退赛地点（可选）</label>
                <select 
                  value={selectedCp}
                  onChange={e => setSelectedCp(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">未指定地点</option>
                  {checkpoints.map(cp => (
                    <option key={cp.id} value={cp.id}>{cp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">退赛原因 *</label>
                <select 
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">请选择原因</option>
                  <option value="身体不适">身体不适</option>
                  <option value="车辆故障">车辆故障</option>
                  <option value="事故受伤">事故受伤</option>
                  <option value="体力不支">体力不支</option>
                  <option value="天气原因">天气原因</option>
                  <option value="其他">其他</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">详细说明</label>
                <textarea 
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  rows={3}
                  className="w-full border rounded px-3 py-2"
                  placeholder="详细说明退赛情况..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">确认意见（保存到报告）</label>
                <textarea 
                  value={approvalComments}
                  onChange={e => setApprovalComments(e.target.value)}
                  rows={2}
                  className="w-full border rounded px-3 py-2"
                  placeholder="确认退赛的处理意见（可选）"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">登记人 *</label>
                <input 
                  type="text" 
                  value={recordedBy}
                  onChange={e => setRecordedBy(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="请输入您的姓名"
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
                  disabled={!selectedRider || !reason || !recordedBy}
                  className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  确认退赛
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
