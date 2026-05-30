import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getDateString } from '../utils/core';
import { VOICE_PART_LABELS } from '../types';

export function SubstituteRecommendations() {
  const { state, dispatch } = useApp();
  const [selectedDate, setSelectedDate] = useState(getDateString());

  const getMemberName = (id: string) => state.members.find((m) => m.id === id)?.name || id;
  const getMember = (id: string) => state.members.find((m) => m.id === id);

  const approvedLeaves = state.leaveRequests.filter(
    (lr) => lr.status === 'approved' && selectedDate >= lr.startDate && selectedDate <= lr.endDate
  );

  const hasRecommendations = state.substituteRecommendations.length > 0;

  const recommendationsByLeave = approvedLeaves.map((leave) => ({
    leave,
    recommendations: state.substituteRecommendations.filter((r) => r.leaveRequestId === leave.id),
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">替补推荐</h2>
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="p-2 border rounded-md"
          />
          <button
            onClick={() => dispatch({ type: 'GENERATE_SUBSTITUTE_RECOMMENDATIONS', payload: selectedDate })}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            生成推荐
          </button>
        </div>
      </div>

      {approvedLeaves.length === 0 ? (
        <p className="text-gray-500 text-center py-8">所选日期暂无已批准的请假申请</p>
      ) : !hasRecommendations ? (
        <p className="text-gray-500 text-center py-8">点击"生成推荐"按钮获取替补推荐</p>
      ) : (
        <div className="space-y-6">
          {recommendationsByLeave.map(({ leave, recommendations }) => {
            const absentMember = getMember(leave.memberId);
            const selectedRec = recommendations.find((r) => r.status === 'selected');

            return (
              <div key={leave.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <span className="font-medium text-gray-800">
                      请假: {getMemberName(leave.memberId)}
                    </span>
                    {absentMember && (
                      <span className="ml-2 text-sm text-gray-500">
                        ({VOICE_PART_LABELS[absentMember.voicePart]}
                        {absentMember.isSectionLeader && ' · 声部长'})
                      </span>
                    )}
                  </div>
                  {selectedRec && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                      已选定: {getMemberName(selectedRec.substituteId)}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {recommendations.map((rec) => {
                    const substitute = getMember(rec.substituteId);
                    if (!substitute) return null;

                    return (
                      <div
                        key={rec.id}
                        className={`p-3 rounded-lg border ${
                          rec.status === 'selected'
                            ? 'border-green-500 bg-green-50'
                            : rec.status === 'rejected'
                            ? 'border-gray-300 bg-gray-50 opacity-50'
                            : 'border-gray-200 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{substitute.name}</span>
                              <span className="text-sm text-gray-500">
                                {VOICE_PART_LABELS[substitute.voicePart]}
                              </span>
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                                匹配度: {rec.score}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {rec.reasons.map((reason, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded"
                                >
                                  {reason}
                                </span>
                              ))}
                            </div>
                          </div>

                          {rec.status === 'pending' && (
                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={() => dispatch({ type: 'SELECT_SUBSTITUTE', payload: rec.id })}
                                className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                              >
                                选定
                              </button>
                              <button
                                onClick={() => dispatch({ type: 'REJECT_SUBSTITUTE', payload: rec.id })}
                                className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                              >
                                拒绝
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
