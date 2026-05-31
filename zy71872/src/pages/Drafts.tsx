import { useState } from 'react';
import { FileText, Clock, User, GitCompare, ArrowRight } from 'lucide-react';
import { useSimulationStore } from '../store/useSimulationStore';
import { getDraftHistory, compareDrafts, validateDraftChain } from '../services/draftService';
import { COACHES } from '../types';

export function Drafts() {
  const { drafts, teams } = useSimulationStore();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [compareVersion1, setCompareVersion1] = useState<number | null>(null);
  const [compareVersion2, setCompareVersion2] = useState<number | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const getCoachName = (coachId: string) => {
    return COACHES.find((c) => c.id === coachId)?.name || coachId;
  };

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const teamDrafts = selectedTeamId ? getDraftHistory(selectedTeamId, drafts) : [];
  const isValidChain = selectedTeamId ? validateDraftChain(teamDrafts) : true;

  const selectedDraft1 = teamDrafts.find((d) => d.version === compareVersion1);
  const selectedDraft2 = teamDrafts.find((d) => d.version === compareVersion2);
  const diffResult = selectedDraft1 && selectedDraft2
    ? compareDrafts(selectedDraft1, selectedDraft2)
    : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">草稿版本中心</h1>
        {teams.length > 0 && (
          <span className="text-sm text-slate-400">
            共 {drafts.length} 个版本
          </span>
        )}
      </div>

      {teams.length === 0 ? (
        <div className="panel text-center py-12 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>暂无草稿数据</p>
          <p className="text-sm mt-2">请先在仿真控制台导入试跑材料</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="panel">
              <h3 className="panel-header">选择队伍</h3>
              <div className="space-y-2">
                {teams.map((team) => {
                  const teamDraftCount = drafts.filter((d) => d.teamId === team.id).length;
                  return (
                    <button
                      key={team.id}
                      onClick={() => {
                        setSelectedTeamId(team.id);
                        setCompareVersion1(null);
                        setCompareVersion2(null);
                        setShowCompare(false);
                      }}
                      className={`w-full text-left p-3 rounded border transition-colors ${
                        selectedTeamId === team.id
                          ? 'bg-amber-900/20 border-amber-600/50 text-amber-300'
                          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-medium text-sm">{team.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {teamDraftCount} 个版本
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {selectedTeam ? (
              <>
                <div className="panel mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium">{selectedTeam.name} - 版本历史</h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-slate-400">版本链完整性:</span>
                        <span className={`text-xs font-mono ${isValidChain ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isValidChain ? '✓ 有效' : '✗ 已篡改'}
                        </span>
                      </div>
                    </div>
                    <button
                      className="btn btn-primary text-xs"
                      onClick={() => setShowCompare(!showCompare)}
                      disabled={teamDrafts.length < 2}
                    >
                      <GitCompare className="w-3 h-3 mr-2" />
                      版本对比
                    </button>
                  </div>

                  <div className="space-y-2">
                    {teamDrafts.map((draft, idx) => (
                      <div
                        key={draft.id}
                        className={`p-3 rounded border transition-colors ${
                          idx === 0
                            ? 'bg-emerald-900/20 border-emerald-700/50'
                            : 'bg-slate-800/50 border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {showCompare && (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  name="v1"
                                  checked={compareVersion1 === draft.version}
                                  onChange={() => setCompareVersion1(draft.version)}
                                  className="accent-amber-500"
                                />
                                <input
                                  type="radio"
                                  name="v2"
                                  checked={compareVersion2 === draft.version}
                                  onChange={() => setCompareVersion2(draft.version)}
                                  className="accent-amber-500"
                                />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-mono font-semibold text-amber-400">
                                  v{draft.version}
                                </span>
                                {idx === 0 && (
                                  <span className="badge text-emerald-400 bg-emerald-900/30 border-emerald-500/50 text-xs">
                                    最新
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 mt-1">
                                {draft.changeSummary}
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-xs">
                            <div className="flex items-center space-x-1 text-slate-400">
                              <User className="w-3 h-3" />
                              <span>{getCoachName(draft.modifiedBy)}</span>
                            </div>
                            <div className="flex items-center space-x-1 text-slate-500 mt-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatTime(draft.modifiedAt)}</span>
                            </div>
                            <div className="font-mono text-slate-600 mt-1">
                              {draft.hash.substring(0, 16)}...
                            </div>
                          </div>
                        </div>

                        {!showCompare && (
                          <div className="mt-3 p-3 bg-slate-900/50 rounded border border-slate-700 font-mono text-xs whitespace-pre-wrap max-h-40 overflow-y-auto scrollbar-thin">
                            {draft.content}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {showCompare && diffResult && selectedDraft1 && selectedDraft2 && (
                  <div className="panel">
                    <h3 className="panel-header">
                      版本对比: v{selectedDraft1.version} {selectedDraft1.modifiedAt < selectedDraft2.modifiedAt ? '→' : '←'} v{selectedDraft2.version}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-400 mb-2">v{selectedDraft1.version} - {getCoachName(selectedDraft1.modifiedBy)}</div>
                        <div className="p-3 bg-slate-900/50 rounded border border-slate-700 font-mono text-xs whitespace-pre-wrap max-h-60 overflow-y-auto scrollbar-thin">
                          {selectedDraft1.content}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 mb-2">v{selectedDraft2.version} - {getCoachName(selectedDraft2.modifiedBy)}</div>
                        <div className="p-3 bg-slate-900/50 rounded border border-slate-700 font-mono text-xs whitespace-pre-wrap max-h-60 overflow-y-auto scrollbar-thin">
                          {selectedDraft2.content}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <h4 className="text-sm font-medium text-slate-300">差异摘要</h4>
                      {diffResult.added.length > 0 && (
                        <div className="p-2 bg-emerald-900/20 border border-emerald-700/50 rounded">
                          <div className="text-xs text-emerald-400 mb-1">新增 ({diffResult.added.length})</div>
                          {diffResult.added.map((line, idx) => (
                            <div key={idx} className="text-xs text-emerald-300 font-mono">
                              + {line}
                            </div>
                          ))}
                        </div>
                      )}
                      {diffResult.removed.length > 0 && (
                        <div className="p-2 bg-red-900/20 border border-red-700/50 rounded">
                          <div className="text-xs text-red-400 mb-1">删除 ({diffResult.removed.length})</div>
                          {diffResult.removed.map((line, idx) => (
                            <div key={idx} className="text-xs text-red-300 font-mono">
                              - {line}
                            </div>
                          ))}
                        </div>
                      )}
                      {diffResult.modified.length > 0 && (
                        <div className="p-2 bg-amber-900/20 border border-amber-700/50 rounded">
                          <div className="text-xs text-amber-400 mb-1">修改 ({diffResult.modified.length})</div>
                          {diffResult.modified.map((line, idx) => (
                            <div key={idx} className="text-xs text-amber-300 font-mono">
                              {line}
                            </div>
                          ))}
                        </div>
                      )}
                      {diffResult.added.length === 0 && diffResult.removed.length === 0 && diffResult.modified.length === 0 && (
                        <div className="text-sm text-slate-500">两个版本内容完全相同</div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="panel text-center py-12 text-slate-500">
                <p>请从左侧选择一个队伍查看草稿版本历史</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
