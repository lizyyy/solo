import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getDateString } from '../utils/core';
import { VOICE_PART_LABELS } from '../types';

const severityColors: Record<string, string> = {
  high: 'bg-red-100 border-red-300 text-red-800',
  medium: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  low: 'bg-blue-100 border-blue-300 text-blue-800',
};

const severityLabels: Record<string, string> = {
  high: '严重',
  medium: '中等',
  low: '轻微',
};

const conflictTypeLabels: Record<string, string> = {
  duplicate_substitute: '替补重复',
  voice_imbalance: '声部失衡',
  position_conflict: '站位冲突',
  no_leader: '缺少声部长',
};

export function StandingManager() {
  const { state, dispatch, getConflicts } = useApp();
  const [selectedDate, setSelectedDate] = useState(getDateString());
  const [versionName, setVersionName] = useState('');

  const getMemberName = (id: string) => state.members.find((m) => m.id === id)?.name || id;
  const getMember = (id: string) => state.members.find((m) => m.id === id);

  const activeVersion = state.standingVersions.find((v) => v.isActive);
  const conflicts = getConflicts();

  const positionMap = new Map(
    activeVersion?.positions.map((p) => [`${p.position.row}-${p.position.col}`, p.memberId]) || []
  );

  const handleCreateVersion = () => {
    if (!versionName.trim()) return;
    dispatch({
      type: 'CREATE_STANDING_VERSION',
      payload: { name: versionName, date: selectedDate },
    });
    setVersionName('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">站位版本管理</h2>
          <div className="flex items-center gap-4">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="p-2 border rounded-md"
            />
            <input
              type="text"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="版本名称"
              className="p-2 border rounded-md"
            />
            <button
              onClick={handleCreateVersion}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              生成站位
            </button>
          </div>
        </div>

        {state.standingVersions.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {state.standingVersions.map((version) => (
              <button
                key={version.id}
                onClick={() => dispatch({ type: 'SET_ACTIVE_STANDING_VERSION', payload: version.id })}
                className={`px-4 py-2 rounded-md text-sm ${
                  version.isActive
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {version.name}
                {version.conflicts.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-500 text-white rounded-full text-xs">
                    {version.conflicts.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {!activeVersion ? (
          <p className="text-gray-500 text-center py-8">
            请输入版本名称并点击"生成站位"按钮创建站位版本
          </p>
        ) : (
          <div>
            <div className="mb-4 text-sm text-gray-600">
              版本: {activeVersion.name} · 创建时间: {new Date(activeVersion.createdAt).toLocaleString()}
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(8, 1fr)` }}>
              {Array.from({ length: 32 }, (_, i) => {
                const row = Math.floor(i / 8);
                const col = i % 8;
                const memberId = positionMap.get(`${row}-${col}`);
                const member = memberId ? getMember(memberId) : null;
                const isSubstitute = state.substituteRecommendations.some(
                  (r) => r.substituteId === memberId && r.status === 'selected'
                );

                return (
                  <div
                    key={i}
                    className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center text-xs p-1 ${
                      member
                        ? member.isSectionLeader
                          ? 'bg-purple-100 border-purple-400'
                          : isSubstitute
                          ? 'bg-green-100 border-green-400'
                          : 'bg-gray-100 border-gray-300'
                        : 'bg-gray-50 border-gray-200 border-dashed'
                    }`}
                  >
                    {member && (
                      <>
                        <span className="font-medium truncate w-full text-center">{member.name}</span>
                        <span className="text-gray-500 text-[10px]">
                          {VOICE_PART_LABELS[member.voicePart]}
                        </span>
                        {member.isSectionLeader && (
                          <span className="text-purple-600 text-[10px]">声部长</span>
                        )}
                        {isSubstitute && <span className="text-green-600 text-[10px]">替补</span>}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-100 border border-purple-400 rounded"></div>
                <span>声部长</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border border-green-400 rounded"></div>
                <span>替补成员</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
                <span>普通成员</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">冲突检测与解释</h2>
        {conflicts.length === 0 ? (
          <div className="text-center py-8 text-green-600">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>暂无检测到冲突</p>
          </div>
        ) : (
          <div className="space-y-4">
            {conflicts.map((conflict) => (
              <div
                key={conflict.id}
                className={`p-4 rounded-lg border ${severityColors[conflict.severity]}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{conflictTypeLabels[conflict.type]}</span>
                      <span className="px-2 py-0.5 rounded text-xs bg-white bg-opacity-50">
                        {severityLabels[conflict.severity]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{conflict.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="text-sm font-medium">影响人员:</span>
                      {conflict.affectedItems.map((itemId) => (
                        <span
                          key={itemId}
                          className="px-2 py-0.5 bg-white bg-opacity-50 rounded text-sm"
                        >
                          {getMemberName(itemId)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
