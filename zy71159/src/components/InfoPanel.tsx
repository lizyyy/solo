import { Droplets, Trophy, Sun, Cloud, CloudRain, CloudLightning } from 'lucide-react';
import { useGame } from '../hooks/useGameState';
import { WEATHER_INFO, CROP_INFO, PlotTile } from '../game/types';
import { getLevelById } from '../game/levels';

function WeatherIcon({ weather }: { weather: string }) {
  switch (weather) {
    case 'sunny':
      return <Sun className="w-8 h-8 text-yellow-500" />;
    case 'cloudy':
      return <Cloud className="w-8 h-8 text-gray-500" />;
    case 'rainy':
      return <CloudRain className="w-8 h-8 text-blue-500" />;
    case 'drought':
      return <CloudLightning className="w-8 h-8 text-orange-500" />;
    default:
      return <Sun className="w-8 h-8 text-yellow-500" />;
  }
}

export function InfoPanel() {
  const { state } = useGame();
  const level = getLevelById(state.level);
  const weatherInfo = WEATHER_INFO[state.currentWeather];

  const plots: PlotTile[] = [];
  state.board.forEach((row) => {
    row.forEach((tile) => {
      if (tile?.type === 'plot') {
        plots.push(tile as PlotTile);
      }
    });
  });

  const wateredPlots = plots.filter((p) => p.isWatered).length;
  const overwateredPlots = plots.filter((p) => p.overwatered).length;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-lg p-4">
        <h3 className="text-lg font-bold text-amber-800 mb-3 flex items-center gap-2">
          <WeatherIcon weather={state.currentWeather} />
          天气卡
        </h3>
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-800">{weatherInfo.name}</p>
              <p className="text-sm text-gray-600 mt-1">
                蒸发量: {weatherInfo.evaporation > 0 ? '+' : ''}{weatherInfo.evaporation}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">水量加成</p>
              <p className="text-xl font-bold text-blue-600">+{weatherInfo.bonus}</p>
            </div>
          </div>
          {state.weatherDeck.length > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <p className="text-xs text-gray-500">
                后续天气: {state.weatherDeck.slice(0, 3).map(w => WEATHER_INFO[w].emoji).join(' ')}
                {state.weatherDeck.length > 3 && ` ...还有${state.weatherDeck.length - 3}回合`}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-4">
        <h3 className="text-lg font-bold text-amber-800 mb-3 flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          游戏状态
        </h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">当前得分</span>
              <span className="font-bold text-amber-600">{state.score}</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{ width: `${Math.min(100, (state.score / (level?.targetScore || 100)) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">目标分数: {level?.targetScore || 100}</p>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 flex items-center gap-1">
                <Droplets className="w-4 h-4" /> 已用水量
              </span>
              <span className="font-bold text-blue-600">
                {state.waterUsed} / {state.totalWater}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${(state.waterUsed / state.totalWater) * 100}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{wateredPlots}</p>
              <p className="text-xs text-green-700">已灌溉</p>
            </div>
            <div className="text-center p-2 bg-amber-50 rounded-lg">
              <p className="text-2xl font-bold text-amber-600">{plots.length - wateredPlots}</p>
              <p className="text-xs text-amber-700">待灌溉</p>
            </div>
            <div className="text-center p-2 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{overwateredPlots}</p>
              <p className="text-xs text-red-700">过度</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-4">
        <h3 className="text-lg font-bold text-amber-800 mb-3">地块状态</h3>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {plots.map((plot, index) => {
            const cropInfo = CROP_INFO[plot.crop];
            const percentage = Math.min(100, (plot.currentWater / plot.waterNeeded) * 100);
            
            let statusColor = 'bg-amber-500';
            let statusText = '灌溉中';
            if (plot.overwatered) {
              statusColor = 'bg-red-500';
              statusText = '过度灌溉';
            } else if (plot.isWatered) {
              statusColor = 'bg-green-500';
              statusText = '已达标';
            }

            return (
              <div key={plot.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <span className="text-2xl">{cropInfo.emoji}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{cropInfo.name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs text-white ${statusColor}`}>
                      {statusText}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full transition-all duration-500 ${statusColor}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {plot.currentWater} / {plot.waterNeeded}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
