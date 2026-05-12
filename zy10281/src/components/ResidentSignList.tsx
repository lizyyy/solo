import React, { useState } from 'react';
import type { Resident, SignRecord, SignStatus, BuildingVersion } from '../types';
import { ElevatorSignStore } from '../store';

interface ResidentSignListProps {
  buildingId: string;
  residents: Resident[];
  currentVersion: BuildingVersion;
  onSign: (residentId: string, status: SignStatus, objectionReason?: string) => void;
  onWithdraw: (recordId: string) => void;
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
}) => {
  const [filter, setFilter] = useState<'all' | SignStatus>('all');
  const [selectedResident, setSelectedResident] = useState<string | null>(null);
  const [showSignModal, setShowSignModal] = useState(false);
  const [signStatus, setSignStatus] = useState<SignStatus>('agree');
  const [objectionReason, setObjectionReason] = useState('');

  const getResidentLatestSign = (residentId: string): SignRecord | undefined => {
    return ElevatorSignStore.getResidentLatestSign(residentId, buildingId);
  };

  const filteredResidents = residents.filter(resident => {
    if (filter === 'all') return true;
    const sign = getResidentLatestSign(resident.id);
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
              const sign = getResidentLatestSign(resident.id);
              const status = sign?.status || 'pending';
              const config = statusConfig[status];

              return (
                <tr key={resident.id} className="border-b border-gray-100 hover:bg-gray-50">
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
                      {sign?.isWithdrawnButCounted && ' (仍计入)'}
                      {sign?.isDuplicate && ' (重复)'}
                    </span>
                    {sign?.objectionReason && (
                      <div className="mt-1 text-xs text-orange-600">
                        异议: {sign.objectionReason}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {sign ? (
                      <span className="text-xs text-gray-500">
                        v{sign.versionId === currentVersion.id ? currentVersion.versionNumber : '?'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
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
                      签字
                    </button>
                    {sign && sign.status !== 'withdrawn' && (
                      <button
                        onClick={() => onWithdraw(sign.id)}
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
    </div>
  );
};
