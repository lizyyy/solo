import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LEVELS } from '../levels';
import { useGameStore } from '../store/gameStore';
import LevelCard from '../components/LevelCard';
import { Bus, History, BookOpen, Play, Trash2, Home as HomeIcon } from 'lucide-react';

type Tab = 'levels' | 'replays' | 'rules';

function Home() {
  const [tab, setTab] = useState<Tab>('levels');
  const nav = useNavigate();
  const state = useGameStore();

  return (
    <div className="min-h-screen p-8 flex flex-col">
      <header className="mb-8 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center">
          <Bus size={26} className="text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-wide">公交改线调度模拟器</h1>
          <p className="text-sm text-base-400">在施工封路、客流高峰中做出真实可玩的调度决策</p>
        </div>
      </header>

      <nav className="flex gap-1 mb-6 border-b border-base-500/30">
        {[
          { id: 'levels', label: '关卡选择', icon: <Play size={14} /> },
          { id: 'replays', label: '历史回放', icon: <History size={14} /> },
          { id: 'rules', label: '规则说明', icon: <BookOpen size={14} /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${
              tab === t.id ? 'border-accent text-accent' : 'border-transparent text-base-400 hover:text-base-200'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1">
        {tab === 'levels' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {LEVELS.map((lvl) => (
              <LevelCard key={lvl.id} level={lvl} onClick={() => { state.loadLevel(lvl.id); nav(`/level/${lvl.id}`); }} />
            ))}
          </div>
        )}

        {tab === 'replays' && (
          <div className="card p-4">
            {state.replays.length === 0 ? (
              <div className="text-center text-base-400 py-12">
                <History size={36} className="mx-auto mb-2 opacity-50" />
                <div className="text-sm">暂无历史记录，完成关卡后会自动保存</div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-base-400 uppercase tracking-wider">
                  <tr className="border-b border-base-500/30">
                    <th className="text-left py-2">关卡</th>
                    <th className="text-left">完成时间</th>
                    <th className="text-left">时长</th>
                    <th className="text-right">分数</th>
                    <th className="text-left">结果</th>
                    <th className="text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {state.replays.map((r) => (
                    <tr key={r.id} className="border-b border-base-500/20 hover:bg-base-700/30">
                      <td className="py-2">{r.levelName}</td>
                      <td className="text-xs text-base-400">{new Date(r.finishedAt).toLocaleString()}</td>
                      <td className="font-mono">{r.durationMin.toFixed(1)} min</td>
                      <td className="text-right font-mono text-accent">{r.score}</td>
                      <td>{r.failures.length === 0 ? <span className="tag bg-success/20 text-success">胜利</span> : <span className="tag bg-danger/20 text-danger">失败</span>}</td>
                      <td className="text-right">
                        <button className="btn btn-sm btn-primary mr-1" onClick={() => { state.loadReplay(r.id); nav(`/replay/${r.id}`); }}>
                          <Play size={12} /> 回放
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={() => state.deleteReplay(r.id)}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'rules' && (
          <div className="card p-6 max-w-3xl text-sm leading-relaxed space-y-4">
            <h2 className="text-lg font-bold text-accent">如何游玩</h2>
            <p>玩家作为调度员，在线路运营期间处理施工封路、客流高峰等突发事件。目标是在规定时间内完成运营，同时控制投诉、延误与间隔均衡度。</p>

            <h3 className="font-semibold text-base-100">核心操作</h3>
            <ul className="list-disc list-inside space-y-1 text-base-300">
              <li><b>派车</b>：将车库中的车辆投入指定线路。</li>
              <li><b>跳站</b>：临时跳过拥堵站点以抢回时间，但产生 1 次投诉。</li>
              <li><b>改线（备用路径）</b>：遇施工时切换到备用线路，增加少量延误但避免封路。</li>
              <li><b>调整发车间隔</b>：通过滑块调整每条线路的最小发车间隔，越短越能应对高峰但车辆压力越大。</li>
            </ul>

            <h3 className="font-semibold text-base-100">失败条件（任一触发）</h3>
            <ul className="list-disc list-inside space-y-1 text-base-300">
              <li>投诉次数超过阈值。</li>
              <li>单线路最大延误超过阈值。</li>
              <li>服务覆盖低于最低要求。</li>
            </ul>

            <h3 className="font-semibold text-base-100">评分指标</h3>
            <ul className="list-disc list-inside space-y-1 text-base-300">
              <li>准点率（30%）、间隔稳定性（20%）、投诉控制（25%）、满载率（15%）、服务覆盖（10%）。</li>
            </ul>

            <h3 className="font-semibold text-base-100">回放与导出</h3>
            <ul className="list-disc list-inside space-y-1 text-base-300">
              <li>每关完成后自动保存历史，可在「历史回放」中拖动时间轴复盘。</li>
              <li>结算页支持导出 TXT 与 JSON 报告。</li>
            </ul>

            <div className="pt-2">
              <button className="btn btn-primary" onClick={() => setTab('levels')}>
                <HomeIcon size={14} /> 开始挑战
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="mt-8 text-xs text-base-500 text-center">
        调度模拟器 · 所有数据本地保存，无需联网
      </footer>
    </div>
  );
}

export default Home;
