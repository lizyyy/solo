import { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { LeaveRequest, Member } from '../types';
import { getDateString } from '../utils/core';

const statusLabels: Record<LeaveRequest['status'], string> = {
  pending: '待审批',
  approved: '已批准',
  rejected: '已拒绝',
  needs_more_info: '需补充材料',
};

const statusColors: Record<LeaveRequest['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  needs_more_info: 'bg-orange-100 text-orange-800',
};

interface LeaveRequestFormProps {
  onSubmit: (data: Omit<LeaveRequest, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => void;
  members: Member[];
  initialData?: LeaveRequest;
  onCancel?: () => void;
}

function LeaveRequestForm({ onSubmit, members, initialData, onCancel }: LeaveRequestFormProps) {
  const [memberId, setMemberId] = useState(initialData?.memberId || '');
  const [startDate, setStartDate] = useState(initialData?.startDate || getDateString());
  const [endDate, setEndDate] = useState(initialData?.endDate || getDateString());
  const [reason, setReason] = useState(initialData?.reason || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      memberId,
      requestDate: getDateString(),
      startDate,
      endDate,
      reason,
      status: initialData?.status || 'pending',
      rejectionReason: initialData?.rejectionReason,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <div>
        <label className="block text-sm font-medium text-gray-700">成员</label>
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
          required
          disabled={!!initialData}
        >
          <option value="">请选择成员</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">开始日期</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">结束日期</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">请假原因</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
          rows={3}
          required
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          {initialData ? '重新提交' : '提交申请'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            取消
          </button>
        )}
      </div>
    </form>
  );
}

export function LeaveRequestList() {
  const { state, dispatch } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const getMemberName = (id: string) => state.members.find((m) => m.id === id)?.name || id;

  const handleAddLeave = (data: Omit<LeaveRequest, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => {
    dispatch({ type: 'ADD_LEAVE_REQUEST', payload: data });
    setShowForm(false);
  };

  const handleResubmit = (data: Omit<LeaveRequest, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => {
    if (editingId) {
      dispatch({
        type: 'RESUBMIT_LEAVE_REQUEST',
        payload: {
          id: editingId,
          updates: data,
        },
      });
      setEditingId(null);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">请假归集</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          新增请假
        </button>
      </div>

      {showForm && (
        <div className="mb-6">
          <LeaveRequestForm
            onSubmit={handleAddLeave}
            members={state.members}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <div className="space-y-4">
        {state.leaveRequests.map((leave) => (
          <div
            key={leave.id}
            className={`p-4 border rounded-lg ${leave.status === 'needs_more_info' ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800">{getMemberName(leave.memberId)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[leave.status]}`}>
                    {statusLabels[leave.status]}
                  </span>
                  <span className="text-xs text-gray-500">版本 {leave.version}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  日期: {leave.startDate} ~ {leave.endDate}
                </p>
                <p className="text-sm text-gray-600">原因: {leave.reason}</p>
                {leave.rejectionReason && (
                  <p className="text-sm text-orange-600 mt-1">
                    备注: {leave.rejectionReason}
                  </p>
                )}
              </div>

              {leave.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => dispatch({ type: 'APPROVE_LEAVE_REQUEST', payload: leave.id })}
                    className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                  >
                    批准
                  </button>
                  <button
                    onClick={() => setRejectingId(leave.id)}
                    className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                  >
                    拒绝
                  </button>
                  <button
                    onClick={() => dispatch({ type: 'REQUEST_MORE_INFO', payload: { id: leave.id, reason: '请补充请假证明材料' } })}
                    className="px-3 py-1 bg-orange-500 text-white text-sm rounded hover:bg-orange-600"
                  >
                    需补充
                  </button>
                </div>
              )}

              {leave.status === 'needs_more_info' && editingId !== leave.id && (
                <button
                  onClick={() => setEditingId(leave.id)}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                >
                  补充材料
                </button>
              )}
            </div>

            {editingId === leave.id && (
              <div className="mt-4">
                <LeaveRequestForm
                  onSubmit={handleResubmit}
                  members={state.members}
                  initialData={leave}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            )}

            {rejectingId === leave.id && (
              <div className="mt-4 p-4 bg-red-50 rounded">
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="请输入拒绝原因"
                  className="w-full p-2 border rounded mb-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      dispatch({
                        type: 'REJECT_LEAVE_REQUEST',
                        payload: { id: leave.id, reason: rejectReason },
                      });
                      setRejectingId(null);
                      setRejectReason('');
                    }}
                    className="px-3 py-1 bg-red-500 text-white text-sm rounded"
                  >
                    确认拒绝
                  </button>
                  <button
                    onClick={() => {
                      setRejectingId(null);
                      setRejectReason('');
                    }}
                    className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
