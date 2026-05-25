import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import MapCanvas from '../components/MapCanvas';
import ControlPanel from '../components/ControlPanel';
import EventLog from '../components/EventLog';
import DispatchPanel from '../components/DispatchPanel';
import ScoreReport from '../components/ScoreReport';
import { Home } from 'lucide-react';

function Level() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const state = useGameStore();

  useEffect(() => {
    if (id && (!state.level || state.level.id !== id)) {
      state.loadLevel(id);
    }
  }, [id]);

  if (!state.level) {
    return (
      <div className="p-8 text-center text-base-400">
        加载中...
        <button className="btn btn-ghost ml-4" onClick={() => nav('/')}>
          <Home size={14} /> 返回
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col p-3 gap-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost" onClick={() => { state.toMenu(); nav('/'); }}>
            <Home size={14} /> 主菜单
          </button>
          <div className="text-sm font-semibold">{state.level.name}</div>
          <div className="text-xs text-base-400">难度 {'★'.repeat(state.level.difficulty)}</div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="tag bg-base-700">投诉 <b className="text-accent ml-1">{state.stats.complaints}</b>/{state.level.maxComplaints}</span>
          <span className="tag bg-base-700">覆盖 <b className="text-accent ml-1">{(state.stats.coverage * 100).toFixed(0)}%</b></span>
          <span className="tag bg-base-700">满载 <b className="text-accent ml-1">{(state.stats.loadFactor * 100).toFixed(0)}%</b></span>
        </div>
      </header>

      <ControlPanel />

      <div className="flex-1 grid grid-cols-3 gap-3 min-h-0">
        <div className="col-span-2 flex flex-col gap-3 min-h-0">
          <MapCanvas />
          <div className="flex-1 min-h-0">
            <EventLog />
          </div>
        </div>
        <div className="col-span-1 flex flex-col gap-3 min-h-0">
          <DispatchPanel />
        </div>
      </div>

      {state.phase === 'ended' && <ScoreReport />}
    </div>
  );
}

export default Level;
