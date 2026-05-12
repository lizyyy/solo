import React, { useState } from 'react';
import type { Resident, SignRecord, SignStatus, BuildingVersion } from '../types';
import { ElevatorSignStore } from '../store';

interface ResidentSignListProps {
  buildingId: string;
  residents: Resident[];
  currentVersion: BuildingVersion;
  onSign: (residentId: string, status: SignStatus, objectionReason?: string) => void;
  onWithdraw: (recordId: string, stillCounted?: boolean) => void;
  onUpdateObjection: (recordId: string, status: 'processing' | 'resolved' | 'rejected') => void;
}

const statusConfig: Record<SignStatus, { label: string; color: string; bg: string }> = {
  agree: { label: '同意', color: 'text-green-600', bg: 'bg-green-100' },
  disagree: { label: '不同意', color: 'text-red-600', bg: 'bg-red-100' },
  pending: { label: '未签字', color: 'text-gray-600', bg: 'bg-gray-100' },
  withdrawn: { label: '已撤回', color: 'text-orange-600', bg: 'bg-orange-100' },
};

export const ResidentSignList: React.FC<ResidentSignListProps> = ({
  buildingId,
  residents,
  currentVersion,
  onSign,
  onWithdraw,
  onUpdateObjection,
}) => {
  const [filter, setFilter] = useState<'all' | SignStatus>('all');
  const [selectedResident, setSelectedResident] = useState<string | null>(null);
  const [withdrawingSign, setWithdrawingSign] = useState<{ id: string; name: string } | null>(null);
  const [handlingObjection, setHandlingObjection] = useState<{ id: string; name: string; reason: string } | null>(null);
  const [showSignModal, setShowSignModal] = useState(false);
  const [signStatus, setSignStatus] = useState<SignStatus>('agree');
  const [objectionReason, setObjectionReason] = useState('');

  const getResidentSignInCurrentVersion = (residentId: string): SignRecord | undefined => {
    const allRecords = ElevatorSignStore.getSignRecords(buildingId, currentVersion.id);
    return allRecords.find(r => r.residentId === residentId);
  };

  const getResidentLatestSignAnyVersion = (residentId: string): SignRecord | undefined => {
    return ElevatorSignStore.getResidentLatestSign(residentId, buildingId);
  };

  const filteredResidents = residents.filter(resident => {
    if (filter === 'all') return true;
    const sign = getResidentSignInCurrentVersion(resident.id);
    if (filter === 'pending') return !sign;
    return sign?.status === filter;
  });

  const handleSign = () => {
    if (selectedResident) {
      onSign(selectedResident, signStatus, objectionReason || undefined);
      setShowSignModal(false);
      setSelectedResident(null);
      setObjectionReason('');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">住户签字管理</h2>
        <div className="flex items-center gap-2">
          <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as 'all' | SignStatus)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
            <option value="all">全部</option>
            <option value="agree">同意</option>
            <option value="disagree">不同意</option>
            <option value="pending">未签字</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">房间号</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">住户</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">面积</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">状态</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">版本</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredResidents.map(resident => {
              const currentSign = getResidentSignInCurrentVersion(resident.id);
              const oldSign = !currentSign ? getResidentLatestSignAnyVersion(resident.id) : undefined;
              const status = currentSign?.status || 'pending';
              const config = statusConfig[status];
              const hasOldVersionSign = !!oldSign && !currentSign;

              return (
                <tr key={resident.id} className={`border-b border-gray-100 hover:bg-gray-50 ${hasOldVersionSign ? 'bg-yellow-50' : ''}`}>
                  <td className="py-3 px-4">
                    <span className="font-medium">{resident.unit} {resident.roomNumber}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <div className="font-medium text-gray-800">{resident.name}</div>
                      <div className="text-xs text-gray-500">{resident.phone}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{resident.area} ㎡</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${config.bg} ${config.color}`}>
                      {config.label}
                      {currentSign?.isWithdrawnButCounted && ' (仍计入)'}
                      {currentSign?.isDuplicate && ' (重复)'}
                    </span>
                    {hasOldVersionSign && (
                      <div className="mt-1 text-xs text-yellow-600 font-medium">
                        ⚠️ 旧版本已签字，新版本待重签
                      </div>
                    )}
                    {currentSign?.objectionReason && (
                      <div className="mt-1">
                        <div className="text-xs text-orange-600">
                          异议: {currentSign.objectionReason}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            currentSign.objectionStatus === 'pending' ? 'bg-red-100 text-red-700' :
                            currentSign.objectionStatus === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                            currentSign.objectionStatus === 'resolved' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {currentSign.objectionStatus === 'pending' ? '待处理' :
                             currentSign.objectionStatus === 'processing' ? '处理中' :
                             currentSign.objectionStatus === 'resolved' ? '已解决' : '已驳回'}
                          </span>
                          {currentSign.objectionStatus !== 'resolved' && (
                            <button
                              onClick={() => setHandlingObjection({
                                id: currentSign.id,
                                name: resident.name,
                                reason: currentSign.objectionReason || ''
                              })}
                              className="text-xs text-blue-500 hover:text-blue-700"
                            >
                              处理
                            </button>
                          )}
                        </div>
                        {currentSign.objectionHandler && (
                          <div className="text-xs text-gray-500 mt-1">
                            处理人: {currentSign.objectionHandler}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {currentSign ? (
                      <span className="text-xs text-green-600 font-medium">
                        v{currentVersion.versionNumber}
                      </span>
                    ) : hasOldVersionSign ? (
                      <span className="text-xs text-yellow-600">
                        旧版已签
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">未签字</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => {
                        setSelectedResident(resident.id);
                        setShowSignModal(true);
                      }}
                      className="text-blue-500 hover:text-blue-700 text-sm mr-3"
                    >
                      {hasOldVersionSign ? '重签' : '签字'}
                    </button>
                    {currentSign && currentSign.status !== 'withdrawn' && (
                      <button
                        onClick={() => setWithdrawingSign({ id: currentSign.id, name: resident.name })}
                        className="text-orange-500 hover:text-orange-700 text-sm"
                      >
                        撤回
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showSignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">签字确认</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">签字状态</label>
                <select
                  value={signStatus}
                  onChange={(e) => setSignStatus(e.target.value as SignStatus)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                >
                  <option value="agree">同意</option>
                  <option value="disagree">不同意</option>
                </select>
              </div>

              {signStatus === 'disagree' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">异议原因</label>
                  <textarea
                    value={objectionReason}
                    onChange={(e) => setObjectionReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    rows={3}
                    placeholder="请输入异议原因..."
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSignModal(false);
                  setSelectedResident(null);
                }}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSign}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                确认签字
              </button>
            </div>
          </div>
        </div>
      )}

      {withdrawingSign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-2">撤回签字确认</h3>
            <p className="text-sm text-gray-600 mb-4">
              正在撤回 <span className="font-medium">{withdrawingSign.name}</span> 的签字
            </p>
            
            <div className="space-y-3 mb-6">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="withdrawType"
                    value="normal"
                    defaultChecked
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-sm">普通撤回</div>
                    <div className="text-xs text-gray-500">撤回后不计入同意数，需重新签字</div>
                  </div>
                </label>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="withdrawType"
                    value="stillCounted"
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-sm text-yellow-800">撤回但仍计入</div>
                    <div className="text-xs text-yellow-600">
                      特殊场景：住户已签字确认，撤回仅用于记录变更，同意继续计入统计
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setWithdrawingSign(null)}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => {
                  const checked = document.querySelector(
                    'input[name="withdrawType"]:checked'
                  ) as HTMLInputElement | null;
                  const stillCounted = checked?.value === 'stillCounted';
                  onWithdraw(withdrawingSign.id, stillCounted);
                  setWithdrawingSign(null);
                }}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                确认撤回
              </button>
            </div>
          </div>
        </div>
      )}

      {handlingObjection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-2">处理异议</h3>
            <div className="mb-4 p-3 bg-orange-50 rounded-lg">
              <div className="text-sm font-medium text-orange-800">
                {handlingObjection.name} 的异议
              </div>
              <div className="text-sm text-orange-700 mt-1">
                {handlingObjection.reason}
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => {
                  onUpdateObjection(handlingObjection.id, 'processing');
                  setHandlingObjection(null);
                }}
                className="w-full px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 text-sm text-left"
              >
                标记为处理中 - 正在与住户沟通，尚未解决
              </button>
              <button
                onClick={() => {
                  onUpdateObjection(handlingObjection.id, 'resolved');
                  setHandlingObjection(null);
                }}
                className="w-full px-4 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 text-sm text-left"
              >
                标记为已解决 - 异议已得到妥善处理
              </button>
              <button
                onClick={() => {
                  onUpdateObjection(handlingObjection.id, 'rejected');
                  setHandlingObjection(null);
                }}
                className="w-full px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-sm text-left"
              >
                标记为已驳回 - 异议不成立，不予采纳
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setHandlingObjection(null)}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
