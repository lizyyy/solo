import { useState } from 'react';
import { Play, Pause, RotateCcw, StepForward, Upload, Settings, Edit3 } from 'lucide-react';
import { useSimulationStore } from '../store/useSimulationStore';
import { WindowPanel } from '../components/WindowPanel';
import { SubmissionCard } from '../components/SubmissionCard';
import { StatsBar } from '../components/StatsBar';
import { importTestData, generateDefaultDraftContent } from '../services/testDataService';
import { createDraft } from '../services/draftService';

export function Console() {
  const {
    windows,
    submissions,
    teams,
    drafts,
    currentUser,
    isRunning,
    isPaused,
    speed,
    config,
    replaySnapshotId,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    stepSimulation,
    setSpeed,
    setConfig,
    importData,
    saveDraft,
    getWindowCloseTime,
  } = useSimulationStore();

  const [showDraftEditor, setShowDraftEditor] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [draftContent, setDraftContent] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  const handleImportTestData = () => {
    const { teams: testTeams, submissions: testSubmissions } = importTestData();
    const initialDrafts = testTeams.map((team) =>
      createDraft(
        team.id,
        generateDefaultDraftContent(team.name),
        currentUser,
        '初始版本'
      )
    );
    importData(testTeams, testSubmissions, initialDrafts);
  };

  const handleOpenDraftEditor = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;

    const teamDrafts = drafts.filter((d) => d.teamId === teamId);
    const latestDraft = teamDrafts.sort((a, b) => b.version - a.version)[0];

    setSelectedTeamId(teamId);
    setDraftContent(latestDraft ? latestDraft.content : generateDefaultDraftContent(team.name));
    setChangeSummary('');
    setShowDraftEditor(true);
  };

  const handleSaveDraft = () => {
    if (!selectedTeamId || !draftContent.trim()) return;
    saveDraft(selectedTeamId, draftContent, changeSummary || '修改参数草稿');
    setShowDraftEditor(false);
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const windowCloseTime = getWindowCloseTime();

  return (
    <div>
      <StatsBar />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <h1 className="text-xl font-semibold">仿真控制台</h1>
          {replaySnapshotId && (
            <span className="badge text-blue-400 bg-blue-900/30 border-blue-500/50">
              回放模式
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {teams.length === 0 && (
            <button className="btn btn-primary" onClick={handleImportTestData}>
              <Upload className="w-4 h-4 mr-2" />
              导入试跑材料
            </button>
          )}
          <button
            className="btn"
            onClick={() => setShowConfig(!showConfig)}
          >
            <Settings className="w-4 h-4 mr-2" />
            配置
          </button>
        </div>
      </div>

      {showConfig && (
        <div className="panel mb-6">
          <h3 className="panel-header">仿真配置</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">窗口数量</label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.windowCount}
                onChange={(e) => setConfig({ windowCount: parseInt(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">处理时长 (ms)</label>
              <input
                type="number"
                min="1000"
                step="1000"
                value={config.processingTimeMs}
                onChange={(e) => setConfig({ processingTimeMs: parseInt(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">自动检测异常</label>
              <select
                value={config.autoDetectAnomalies ? 'true' : 'false'}
                onChange={(e) => setConfig({ autoDetectAnomalies: e.target.value === 'true' })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="true">开启</option>
                <option value="false">关闭</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">保留历史记录</label>
              <select
                value={config.preserveHistory ? 'true' : 'false'}
                onChange={(e) => setConfig({ preserveHistory: e.target.value === 'true' })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="true">开启</option>
                <option value="false">关闭</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="panel mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <div className="text-xs text-slate-400">仿真时间</div>
              <div className="font-mono text-2xl font-semibold text-amber-400">
                {formatTime(useSimulationStore.getState().simulationTime)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">窗口关闭倒计时</div>
              <div className="font-mono text-2xl font-semibold text-slate-300">
                {formatTime(Math.max(0, windowCloseTime - useSimulationStore.getState().simulationTime))}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">速度</div>
              <select
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                disabled={replaySnapshotId !== null}
              >
                <option value="0.5">0.5x</option>
                <option value="1">1x</option>
                <option value="2">2x</option>
                <option value="4">4x</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {!isRunning ? (
              <button
                className="btn btn-success"
                onClick={startSimulation}
                disabled={teams.length === 0 || replaySnapshotId !== null}
              >
                <Play className="w-4 h-4 mr-2" />
                开始仿真
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={isPaused ? startSimulation : pauseSimulation}
                disabled={replaySnapshotId !== null}
              >
                {isPaused ? (
                  <><Play className="w-4 h-4 mr-2" /> 继续</>
                ) : (
                  <><Pause className="w-4 h-4 mr-2" /> 暂停</>
                )}
              </button>
            )}
            <button
              className="btn"
              onClick={stepSimulation}
              disabled={isRunning && !isPaused || replaySnapshotId !== null}
            >
              <StepForward className="w-4 h-4 mr-2" />
              单步
            </button>
            <button
              className="btn btn-danger"
              onClick={resetSimulation}
              disabled={replaySnapshotId !== null}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              重置
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="panel">
            <h3 className="panel-header">窗口状态</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {windows.map((window) => (
                <WindowPanel key={window.id} window={window} submissions={submissions} />
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="flex items-center justify-between mb-3">
              <h3 className="panel-header mb-0">提交记录</h3>
              {teams.length > 0 && (
                <span className="text-xs text-slate-500">
                  共 {submissions.length} 条记录
                </span>
              )}
            </div>
            {teams.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p>暂无数据</p>
                <p className="text-sm mt-2">点击"导入试跑材料"开始仿真</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
                {submissions.map((submission) => (
                  <SubmissionCard key={submission.id} submission={submission} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel">
            <h3 className="panel-header">队伍列表</h3>
            {teams.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                暂无队伍数据
              </div>
            ) : (
              <div className="space-y-2">
                {teams.map((team) => {
                  const teamDrafts = drafts.filter((d) => d.teamId === team.id);
                  const latestDraft = teamDrafts.sort((a, b) => b.version - a.version)[0];
                  return (
                    <div
                      key={team.id}
                      className="p-3 bg-slate-800/50 rounded border border-slate-700"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{team.name}</span>
                        <button
                          className="text-xs text-amber-400 hover:text-amber-300 flex items-center space-x-1"
                          onClick={() => handleOpenDraftEditor(team.id)}
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>编辑草稿</span>
                        </button>
                      </div>
                      <div className="text-xs text-slate-400">
                        队员: {team.members.join(', ')}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        提交次数: {team.submissionCount} | 草稿版本: v{latestDraft?.version || 0}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="panel">
            <h3 className="panel-header">快速提示</h3>
            <ul className="text-xs text-slate-400 space-y-2">
              <li className="flex items-start space-x-2">
                <span className="text-amber-400">•</span>
                <span>点击"导入试跑材料"加载包含各种异常场景的测试数据</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-amber-400">•</span>
                <span>编辑参数草稿会自动记录版本和修改人</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-amber-400">•</span>
                <span>同一队伍二次提交不会覆盖历史记录</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-amber-400">•</span>
                <span>导出的记录包含完整哈希链，可校验一致性</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {showDraftEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-semibold">编辑参数草稿</h3>
              <button
                className="text-slate-400 hover:text-slate-200"
                onClick={() => setShowDraftEditor(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-xs text-slate-400 mb-1">修改说明</label>
                <input
                  type="text"
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder="简要描述本次修改内容..."
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">草稿内容</label>
                <textarea
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  className="w-full h-80 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end space-x-2 p-4 border-t border-slate-800">
              <button className="btn" onClick={() => setShowDraftEditor(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSaveDraft}>
                保存新版本
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
