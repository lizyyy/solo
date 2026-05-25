import { useGameStore } from '../store/gameStore';
import { Trophy, XCircle, Download, RotateCcw, Home, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function ScoreBar({ label, value, max = 100, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-base-400">{label}</span>
        <span className="font-mono text-base-100">{value.toFixed(1)}{max === 100 ? '%' : ''}</span>
      </div>
      <div className="h-2 bg-base-700 rounded overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function ScoreReport() {
  const state = useGameStore();
  const nav = useNavigate();

  const isWin = state.failures.length === 0;

  const download = (ext: 'json' | 'txt', content: string) => {
    const blob = new Blob([content], { type: ext === 'json' ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bus-report-${state.levelId}-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { json, text } = state.exportReport();

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-base-900/80 backdrop-blur-sm">
      <div className="card p-6 w-[640px] max-w-[92vw] max-h-[90vh] overflow-y-auto scroll-thin">
        <div className="flex items-center gap-3 mb-4">
          {isWin ? (
            <Trophy className="text-accent" size={28} />
          ) : (
            <XCircle className="text-danger" size={28} />
          )}
          <div>
            <div className="text-lg font-bold">
              {isWin ? '关卡完成' : '运营失败'}
            </div>
            <div className="text-xs text-base-400">
              {state.level?.name} · 时长 {state.currentMinute.toFixed(1)} 分钟
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-base-400">总分</div>
            <div className="text-3xl font-bold text-accent">{state.score}</div>
          </div>
        </div>

        {!isWin && (
          <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30">
            <div className="text-sm font-semibold text-danger mb-1">失败原因</div>
            <ul className="text-xs list-disc list-inside space-y-0.5">
              {state.failures.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-4">
          <ScoreBar label="准点率" value={state.stats.punctuality * 100} color="#3AA0FF" />
          <ScoreBar label="间隔稳定性 (1-CV)" value={Math.max(0, (1 - state.stats.intervalCV) * 100)} color="#49B265" />
          <ScoreBar label="投诉控制" value={Math.max(0, 100 - (state.stats.complaints / (state.level?.maxComplaints || 1)) * 100)} color="#E05252" />
          <ScoreBar label="平均满载率" value={state.stats.loadFactor * 100} color="#E2A93B" />
          <ScoreBar label="服务覆盖" value={state.stats.coverage * 100} color="#9F7AEA" />
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-base-400">投诉次数</span>
              <span className="font-mono text-base-100">{state.stats.complaints} / {state.level?.maxComplaints}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={() => download('txt', text)}>
            <Download size={14} /> 导出 TXT
          </button>
          <button className="btn btn-ghost" onClick={() => download('json', json)}>
            <Download size={14} /> 导出 JSON
          </button>
          <button className="btn btn-primary" onClick={() => state.reset()}>
            <RotateCcw size={14} /> 重开
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => nav(`/replay/${state.replays[0]?.id || ''}`)}
            disabled={!state.replays.length}
          >
            <Play size={14} /> 历史回放
          </button>
          <button className="btn btn-ghost ml-auto" onClick={() => { state.toMenu(); nav('/'); }}>
            <Home size={14} /> 返回主菜单
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScoreReport;
