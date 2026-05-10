import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, formatDateTime, formatDuration } from '../api';
import { RiderDetails, Checkpoint, ApprovalComment, STATUS_LABELS } from '../types';

interface Props {
  onRefresh: () => void;
}

export default function RiderDetail({ onRefresh }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [details, setDetails] = useState<RiderDetails | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [approvals, setApprovals] = useState<ApprovalComment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [d, cps] = await Promise.all([
        api.getRiderDetails(id),
        api.getCheckpoints()
      ]);
      setDetails(d);
      setCheckpoints(cps);
      
      const approvalsData = await api.getApprovals(undefined, id);
      setApprovals(approvalsData);
    } catch (e: any) {
      alert('加载失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  if (loading) {
    return <div className="bg-white rounded-lg shadow p-8 text-center">加载中...</div>;
  }

  if (!details) {
    return <div className="bg-white rounded-lg shadow p-8 text-center">骑手不存在</div>;
  }

  const { rider, equipmentChecks, checkins, supplies, dropouts, finishRecords } = details;

  const checkedCpNames = checkins.map(ci => {
    const cp = checkpoints.find(c => c.id === ci.checkpointId);
    return { checkpoint: cp, checkin: ci };
  }).filter(x => x.checkpoint).sort((a, b) => a.checkpoint!.orderIndex - b.checkpoint!.orderIndex);

  const missedCps = checkpoints.filter(cp => !checkins.some(ci => ci.checkpointId === cp.id));

  const hasCourseSupply = supplies.some(s => s.supplyType === 'course');
  const hasFinishSupply = supplies.some(s => s.supplyType === 'finish');

  const finishRecord = finishRecords[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="px-4 py-2 border rounded hover:bg-gray-100">
          ← 返回
        </button>
        <h1 className="text-2xl font-bold text-gray-800">
          #{rider.bibNumber} {rider.name}
          <span className={`ml-3 px-3 py-1 rounded-full text-sm font-medium bg-status-${rider.status} status-${rider.status}`}>
            {STATUS_LABELS[rider.status]}
          </span>
        </h1>
        <button onClick={loadData} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ml-auto">
          🔄 刷新
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">基本信息</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">号码布</span>
                <span className="font-mono font-bold">#{rider.bibNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">姓名</span>
                <span className="font-medium">{rider.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">电话</span>
                <span>{rider.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">车队</span>
                <span>{rider.team || '-'}</span>
              </div>
              {rider.emergencyContact && (
                <div className="flex justify-between">
                  <span className="text-gray-600">紧急联系人</span>
                  <span>{rider.emergencyContact}</span>
                </div>
              )}
              {rider.emergencyPhone && (
                <div className="flex justify-between">
                  <span className="text-gray-600">紧急电话</span>
                  <span>{rider.emergencyPhone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">报名时间</span>
                <span className="text-sm">{formatDateTime(rider.registeredAt)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">补给领取</h2>
            <div className="space-y-3">
              <div className={`p-3 rounded ${hasCourseSupply ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className="flex justify-between">
                  <span>途中补给</span>
                  <span className={hasCourseSupply ? 'text-green-600 font-medium' : 'text-gray-400'}>
                    {hasCourseSupply ? '✅ 已领取' : '❌ 未领取'}
                  </span>
                </div>
                {hasCourseSupply && (
                  <div className="text-sm text-gray-500 mt-1">
                    {formatDateTime(supplies.find(s => s.supplyType === 'course')!.collectedAt)}
                  </div>
                )}
              </div>
              <div className={`p-3 rounded ${hasFinishSupply ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className="flex justify-between">
                  <span>完赛补给</span>
                  <span className={hasFinishSupply ? 'text-green-600 font-medium' : 'text-gray-400'}>
                    {hasFinishSupply ? '✅ 已领取' : '❌ 未领取'}
                  </span>
                </div>
                {hasFinishSupply && (
                  <div className="text-sm text-gray-500 mt-1">
                    {formatDateTime(supplies.find(s => s.supplyType === 'finish')!.collectedAt)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {equipmentChecks.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">装备检查记录</h2>
              {equipmentChecks.map(eq => (
                <div key={eq.id} className={`p-4 rounded-lg mb-4 ${eq.overallResult === 'passed' ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`font-medium ${eq.overallResult === 'passed' ? 'text-green-700' : 'text-red-700'}`}>
                      {eq.overallResult === 'passed' ? '✅ 通过' : '❌ 未通过'}
                    </span>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">检查人: {eq.checkerName}</div>
                      <div className="text-xs text-gray-400">{formatDateTime(eq.checkedAt)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {eq.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className={`${
                          item.status === 'ok' ? 'text-green-600' : 
                          item.status === 'missing' ? 'text-red-600' : 'text-yellow-600'
                        }`}>
                          {item.status === 'ok' ? '✅' : item.status === 'missing' ? '❌' : '⚠️'}
                        </span>
                        <span>{item.name}</span>
                        {item.notes && <span className="text-gray-500">({item.notes})</span>}
                      </div>
                    ))}
                  </div>
                  {eq.comments && (
                    <div className="text-sm text-gray-600">备注: {eq.comments}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">签到进度</h2>
            <div className="space-y-3">
              {checkpoints.map(cp => {
                const checked = checkedCpNames.find(x => x.checkpoint?.id === cp.id);
                return (
                  <div key={cp.id} className={`p-3 rounded flex items-center ${checked ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <span className="mr-3 text-xl">
                      {checked ? '✅' : missedCps.some(m => m.id === cp.id) ? '❌' : '⏳'}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium">
                        {cp.isStart ? '🏁 ' : cp.isFinish ? '🏆 ' : '📍 '}
                        {cp.name}
                      </div>
                      <div className="text-sm text-gray-500">{cp.location}</div>
                    </div>
                    {checked?.checkin && (
                      <div className="text-right">
                        <div className="text-sm">{formatDateTime(checked.checkin.checkedInAt)}</div>
                        <div className="text-xs text-gray-400">{checked.checkin.checkedBy}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {dropouts.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
              <h2 className="text-lg font-semibold mb-4 text-orange-700">🏥 退赛记录</h2>
              {dropouts.map(d => {
                const cp = checkpoints.find(c => c.id === d.checkpointId);
                return (
                  <div key={d.id} className="p-4 bg-orange-50 rounded">
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">原因: {d.reason}</span>
                      <span className="text-sm text-gray-600">{formatDateTime(d.droppedAt)}</span>
                    </div>
                    {cp && <div className="text-sm">退赛地点: {cp.name}</div>}
                    {d.comments && <div className="text-sm text-gray-600">详情: {d.comments}</div>}
                    <div className="text-xs text-gray-400 mt-1">登记人: {d.recordedBy}</div>
                  </div>
                );
              })}
            </div>
          )}

          {finishRecord && (
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
              <h2 className="text-lg font-semibold mb-4 text-purple-700">🏆 完赛记录</h2>
              <div className="p-4 bg-purple-50 rounded">
                <div className="flex justify-between">
                  <span>完赛时间</span>
                  <span>{formatDateTime(finishRecord.finishedAt)}</span>
                </div>
                {finishRecord.totalTime !== undefined && (
                  <div className="flex justify-between mt-2">
                    <span>总用时</span>
                    <span className="font-bold">{formatDuration(finishRecord.totalTime)}</span>
                  </div>
                )}
                <div className="text-sm text-gray-500 mt-2">记录人: {finishRecord.recordedBy}</div>
              </div>
            </div>
          )}

          {approvals.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">📋 审批/确认意见（用于复盘）</h2>
              <div className="space-y-3">
                {approvals.map(a => (
                  <div key={a.id} className={`p-4 rounded-lg border-l-4 ${
                    a.decision === 'approved' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-medium">{a.action}</span>
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                          a.decision === 'approved' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                        }`}>
                          {a.decision === 'approved' ? '通过' : '拒绝'}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">{a.madeBy}</div>
                        <div className="text-xs text-gray-400">{formatDateTime(a.madeAt)}</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-700">{a.comments}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
