import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import MapCanvas from '../components/MapCanvas';
import EventLog from '../components/EventLog';
import ScoreReport from '../components/ScoreReport';
import { Home, Play, Pause } from 'lucide-react';

function Replay() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const state = useGameStore();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (id && (!state.history.length || state.levelId !== state.replays.find((r) => r.id === id)?.levelId)) {
      state.loadReplay(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => {
      const next = state.historyIndex + 1;
      if (next >= state.history.length) {
        setPlaying(false);
        return;
      }
      state.setHistoryIndex(next);
    }, 60);
    return () => clearInterval(iv);
  }, [playing, state]);

  if (!state.history.length) {
    return (
      <div className="p-8 text-center text-base-400">
        无回放数据
        <button className="btn btn-ghost ml-4" onClick={() => nav('/')}>
          <Home size={14} /> 返回
        </button>
      </div>
    );
  }

  const total = state.history.length;
  const cur = state.historyIndex + 1;

  return (
    <div className="h-screen flex flex-col p-3 gap-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost" onClick={() => { state.toMenu(); nav('/'); }}>
            <Home size={14} /> 主菜单
          </button>
          <div className="text-sm font-semibold">回放：{state.level?.name}</div>
          <div className="text-xs text-base-400">{cur} / {total}</div>
        </div>
        <button className="btn btn-ghost" onClick={() => setPlaying((p) => !p)}>
          {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? '暂停' : '播放'}
        </button>
      </header>

      <div className="card p-3">
        <input
          type="range"
          min={0}
          max={total - 1}
          value={state.historyIndex}
          onChange={(e) => { setPlaying(false); state.setHistoryIndex(Number(e.target.value)); }}
          className="w-full accent-accent"
        />
      </div>

      <div className="flex-1 grid grid-cols-3 gap-3 min-h-0">
        <div className="col-span-2 flex flex-col gap-3 min-h-0">
          <MapCanvas />
          <div className="flex-1 min-h-0">
            <EventLog />
          </div>
        </div>
        <div className="col-span-1 flex flex-col gap-3 min-h-0">
          <div className="card p-3 text-xs space-y-1">
            <div className="text-sm font-semibold mb-1">回放摘要</div>
            <div>当前时刻：<b className="font-mono text-accent">T+{state.currentMinute.toFixed(1)}</b></div>
            <div>当前分数：<b className="text-accent">{state.score}</b></div>
            <div>投诉次数：<b>{state.stats.complaints}</b></div>
            <div>服务覆盖：<b>{(state.stats.coverage * 100).toFixed(0)}%</b></div>
          </div>
        </div>
      </div>

      {state.phase === 'ended' && <ScoreReport />}
    </div>
  );
}

export default Replay;
