import { ControlPanel } from '../components/ControlPanel';
import { TrackCanvas } from '../components/TrackCanvas';
import { DataDisplay } from '../components/DataDisplay';
import { GameControls } from '../components/GameControls';
import { DataImport } from '../components/DataImport';
import { DiagnosticsPanel } from '../components/DiagnosticsPanel';
import { ResultsModal } from '../components/ResultsModal';
import { useGameStore } from '../store/gameStore';
import { Trophy, Zap, BookOpen } from 'lucide-react';

const Home = () => {
  const { lapHistory } = useGameStore();

  const bestLap = lapHistory
    .filter(l => l.status === 'completed')
    .reduce((best, lap) => 
      !best || lap.totalTime < best.totalTime ? lap : best
    , null);

  const formatTime = (time: number) => {
    if (!time) return '--:--.--';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#050d1a] text-white">
      <header className="border-b border-[#1e3a5f] bg-[#0a1628]/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#ff6b35] flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-['Orbitron'] tracking-wider bg-gradient-to-r from-[#00d4ff] to-[#ff6b35] bg-clip-text text-transparent">
                  风洞赛车调参赛
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  空气动力学物理教学实验平台 · 阻力与下压力探究
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              {bestLap && (
                <div className="flex items-center gap-3 px-4 py-2 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <div>
                    <div className="text-[10px] text-yellow-500/70">最佳圈速</div>
                    <div className="text-sm font-bold text-yellow-500 font-mono">
                      {formatTime(bestLap.totalTime)}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-3 px-4 py-2 bg-[#1e3a5f]/30 rounded-xl border border-[#1e3a5f]">
                <BookOpen className="w-5 h-5 text-[#00d4ff]" />
                <div>
                  <div className="text-[10px] text-gray-500">完成圈数</div>
                  <div className="text-sm font-bold text-[#00d4ff] font-mono">
                    {lapHistory.filter(l => l.status === 'completed').length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3 space-y-6">
            <ControlPanel />
            <DataImport />
          </div>

          <div className="col-span-6 space-y-6">
            <GameControls />
            <TrackCanvas />
          </div>

          <div className="col-span-3 space-y-6">
            <DataDisplay />
            <DiagnosticsPanel />
          </div>
        </div>

        <div className="mt-6 bg-[#0f1c33] border border-[#1e3a5f] rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">物理教学提示</h3>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-[#0a1628] rounded-lg border border-[#1e3a5f]">
              <div className="text-[#ff6b35] font-medium mb-1">阻力 F<sub>d</sub></div>
              <p className="text-gray-500 mb-2">
                阻碍运动的空气阻力，与速度平方成正比。翼片角度越大，阻力越大。
              </p>
              <div className="font-mono text-[10px] text-gray-600">
                F<sub>d</sub> = ½ρv²C<sub>d</sub>A
              </div>
            </div>
            <div className="p-3 bg-[#0a1628] rounded-lg border border-[#1e3a5f]">
              <div className="text-[#00d4ff] font-medium mb-1">下压力 F<sub>df</sub></div>
              <p className="text-gray-500 mb-2">
                翼片产生的向下压力，增加轮胎抓地力。负角度翼片产生下压力。
              </p>
              <div className="font-mono text-[10px] text-gray-600">
                F<sub>df</sub> = -½ρv²C<sub>l</sub>A
              </div>
            </div>
            <div className="p-3 bg-[#0a1628] rounded-lg border border-[#1e3a5f]">
              <div className="text-[#4ade80] font-medium mb-1">抓地力 μ</div>
              <p className="text-gray-500 mb-2">
                轮胎与地面的摩擦系数，决定过弯极限。下压力可提升有效抓地力。
              </p>
              <div className="font-mono text-[10px] text-gray-600">
                μ = μ<sub>0</sub> + 0.3·(F<sub>df</sub>/mg)
              </div>
            </div>
          </div>
          <div className="mt-3 p-3 bg-[#00d4ff]/5 border border-[#00d4ff]/20 rounded-lg">
            <p className="text-xs text-gray-400">
              <span className="text-[#00d4ff] font-medium">探究建议：</span>
              尝试将翼片从-15°调到+15°，观察阻力和下压力的变化。思考：为什么F1赛车
              在直道上使用较小的翼片角度，而在弯道多的赛道使用较大的负角度？
            </p>
          </div>
        </div>

        {lapHistory.length > 0 && (
          <div className="mt-6 bg-[#0f1c33] border border-[#1e3a5f] rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">历史记录</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-[#1e3a5f]">
                    <th className="text-left py-2 px-3">圈速ID</th>
                    <th className="text-left py-2 px-3">时间</th>
                    <th className="text-right py-2 px-3">总圈速</th>
                    <th className="text-right py-2 px-3">S1</th>
                    <th className="text-right py-2 px-3">S2</th>
                    <th className="text-right py-2 px-3">S3</th>
                    <th className="text-right py-2 px-3">最高速</th>
                    <th className="text-right py-2 px-3">翼片角度</th>
                    <th className="text-right py-2 px-3">风速</th>
                    <th className="text-right py-2 px-3">问题数</th>
                  </tr>
                </thead>
                <tbody>
                  {[...lapHistory].reverse().slice(0, 5).map((lap) => (
                    <tr key={lap.id} className="border-b border-[#1e3a5f]/50 text-gray-300 hover:bg-[#1e3a5f]/20">
                      <td className="py-2 px-3 font-mono text-[#00d4ff]">{lap.id.slice(0, 10)}</td>
                      <td className="py-2 px-3 text-gray-500">
                        {new Date(lap.startTime).toLocaleTimeString('zh-CN')}
                      </td>
                      <td className={`py-2 px-3 text-right font-mono font-bold ${
                        lap.id === bestLap?.id ? 'text-yellow-500' : 'text-white'
                      }`}>
                        {formatTime(lap.totalTime)}
                        {lap.id === bestLap?.id && ' 🏆'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-[#00d4ff]">{formatTime(lap.sectorTimes[0])}</td>
                      <td className="py-2 px-3 text-right font-mono text-[#ff6b35]">{formatTime(lap.sectorTimes[1])}</td>
                      <td className="py-2 px-3 text-right font-mono text-[#4ade80]">{formatTime(lap.sectorTimes[2])}</td>
                      <td className="py-2 px-3 text-right font-mono">{lap.maxSpeed.toFixed(1)} km/h</td>
                      <td className="py-2 px-3 text-right font-mono">{lap.wingConfig.angle.toFixed(1)}°</td>
                      <td className="py-2 px-3 text-right font-mono">{lap.windConfig.speed.toFixed(0)} km/h</td>
                      <td className="py-2 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${
                          lap.issues.length === 0 ? 'bg-green-500/20 text-green-400' :
                          lap.issues.length <= 2 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {lap.issues.length}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-[#1e3a5f] bg-[#0a1628]/50 mt-8">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div>
              风洞赛车调参赛 · 物理教学实验平台 · 空气动力学探究
            </div>
            <div className="flex items-center gap-4">
              <span>ρ = 1.225 kg/m³</span>
              <span>g = 9.81 m/s²</span>
              <span>采样率: 60 Hz</span>
            </div>
          </div>
        </div>
      </footer>

      <ResultsModal />
    </div>
  );
};

export default Home;
