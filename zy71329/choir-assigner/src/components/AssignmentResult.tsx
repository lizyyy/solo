import { useState } from 'react';
import { BarChart3, Users, AlertTriangle, ChevronDown, ChevronUp, Star, Clock, Edit2 } from 'lucide-react';
import type { Assignment, ConflictItem, Member, VoicePart } from '../types';

interface AssignmentResultProps {
  assignments: Assignment[];
  globalConflicts: ConflictItem[];
  members: Member[];
  voiceParts: VoicePart[];
  statistics: {
    totalMembers: number;
    assignedMembers: number;
    partsDistribution: Record<string, number>;
    averageMatchScore: number;
    conflictCount: Record<string, number>;
  };
  songName?: string;
  onReassign: (memberId: string, newPartId: string) => void;
}

export function AssignmentResult({
  assignments,
  globalConflicts,
  members,
  voiceParts,
  statistics,
  songName,
  onReassign,
}: AssignmentResultProps) {
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<string | null>(null);

  const getConflictColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'warning':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getPartColor = (partId: string) => {
    const colors = [
      'from-rose-500 to-pink-500',
      'from-amber-500 to-orange-500',
      'from-emerald-500 to-teal-500',
      'from-blue-500 to-indigo-500',
    ];
    const index = voiceParts.findIndex(p => p.id === partId);
    return colors[index % colors.length];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">声部分配结果</h1>
              {songName && <p className="text-sm text-gray-500">{songName}</p>}
            </div>
            <div className="flex items-center gap-2">
              {globalConflicts.filter(c => c.severity === 'error').length > 0 && (
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {globalConflicts.filter(c => c.severity === 'error').length} 个错误
                </span>
              )}
              {globalConflicts.filter(c => c.severity === 'warning').length > 0 && (
                <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {globalConflicts.filter(c => c.severity === 'warning').length} 个警告
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
              <span className="text-gray-500 text-sm">总人数</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {statistics.assignedMembers} / {statistics.totalMembers}
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Star className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-gray-500 text-sm">平均匹配度</span>
            </div>
            <div className={`text-2xl font-bold ${getScoreColor(statistics.averageMatchScore)}`}>
              {Math.round(statistics.averageMatchScore)}%
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-gray-500 text-sm">声部数量</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {voiceParts.length}
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-gray-500 text-sm">异常数量</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {Object.values(statistics.conflictCount).reduce((a, b) => a + b, 0)}
            </div>
          </div>
        </div>

        {globalConflicts.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              全局异常
            </h2>
            <div className="space-y-2">
              {globalConflicts.map((conflict, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border ${getConflictColor(conflict.severity)}`}
                >
                  {conflict.message}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {voiceParts.map((part) => {
            const partAssignments = assignments.filter(a => a.partId === part.id);
            const avgScore = partAssignments.length > 0
              ? partAssignments.reduce((sum, a) => sum + a.matchScore, 0) / partAssignments.length
              : 0;
            
            return (
              <div key={part.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className={`bg-gradient-to-r ${getPartColor(part.id)} p-4 text-white`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{part.displayName}</h3>
                      <p className="text-white/80 text-sm">
                        {part.range.lowest} - {part.range.highest}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {partAssignments.length}
                        <span className="text-lg font-normal text-white/70"> / {part.idealMembers}</span>
                      </div>
                      <p className="text-white/80 text-sm">
                        平均匹配度 {Math.round(avgScore)}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all"
                      style={{ width: `${Math.min((partAssignments.length / part.maxMembers) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  {partAssignments.map((assignment) => {
                    const member = members.find(m => m.id === assignment.memberId);
                    const isExpanded = expandedMember === assignment.memberId;
                    const isEditing = editingMember === assignment.memberId;

                    return (
                      <div
                        key={assignment.memberId}
                        className="border border-gray-200 rounded-lg overflow-hidden"
                      >
                        <div
                          className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                          onClick={() => setExpandedMember(isExpanded ? null : assignment.memberId)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-medium">
                              {assignment.memberName[0]}
                            </div>
                            <div>
                              <div className="font-medium text-gray-800 flex items-center gap-2">
                                {assignment.memberName}
                                {member?.isVeteran && (
                                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
                                    资深
                                  </span>
                                )}
                                {assignment.isManual && (
                                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                                    手动
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 flex items-center gap-2">
                                <Clock className="w-3 h-3" />
                                {member?.attendance && `${Math.round(member.attendance.rate * 100)}%`}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`font-bold ${getScoreColor(assignment.matchScore)}`}>
                              {Math.round(assignment.matchScore)}%
                            </span>
                            {assignment.conflicts.length > 0 && (
                              <span className="w-2 h-2 bg-red-500 rounded-full" />
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-3 pb-3 border-t border-gray-100 pt-3">
                            <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                              <div>
                                <span className="text-gray-500">音域：</span>
                                <span className="text-gray-700">
                                  {member?.voiceRange.lowest} - {member?.voiceRange.highest}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">工龄：</span>
                                <span className="text-gray-700">{member?.seniority} 年</span>
                              </div>
                              {member?.bindPartnerName && (
                                <div className="col-span-2">
                                  <span className="text-gray-500">绑定搭档：</span>
                                  <span className="text-gray-700">{member.bindPartnerName}</span>
                                </div>
                              )}
                            </div>

                            {assignment.conflicts.length > 0 && (
                              <div className="space-y-1 mb-3">
                                {assignment.conflicts.map((conflict, i) => (
                                  <div
                                    key={i}
                                    className={`p-2 rounded text-sm ${getConflictColor(conflict.severity)} border`}
                                  >
                                    {conflict.message}
                                  </div>
                                ))}
                              </div>
                            )}

                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <select
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  value={assignment.partId}
                                  onChange={(e) => {
                                    onReassign(assignment.memberId, e.target.value);
                                    setEditingMember(null);
                                  }}
                                >
                                  {voiceParts.map(p => (
                                    <option key={p.id} value={p.id}>{p.displayName}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => setEditingMember(null)}
                                  className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingMember(assignment.memberId);
                                }}
                                className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                              >
                                <Edit2 className="w-4 h-4" />
                                调整声部
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {partAssignments.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>暂无分配</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
