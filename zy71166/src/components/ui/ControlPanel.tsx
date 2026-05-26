import { useState } from 'react';
import {
  Wind,
  ArrowRightLeft,
  AlertTriangle,
  History,
  Power,
  ThermometerSun,
  ChevronDown,
  ChevronUp,
  Send,
  Play,
  Pause,
  RotateCcw,
  Home,
  Maximize,
  Grid,
  Eye,
  EyeOff,
  Map,
} from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { useUISTore } from '../../store/useUISTore';
import { getStatusColor, getStatusBgColor, formatHour } from '../../utils/temperature';
import { useNavigate } from 'react-router-dom';

type TabType = 'ac' | 'migrate' | 'events' | 'log';

const tabs: Array<{ id: TabType; label: string; icon: React.ReactNode }> = [
  { id: 'ac', label: '空调控制', icon: <Wind size={16} /> },
  { id: 'migrate', label: '负载迁移', icon: <ArrowRightLeft size={16} /> },
  { id: 'events', label: '事件记录', icon: <AlertTriangle size={16} /> },
  { id: 'log', label: '操作日志', icon: <History size={16} /> },
];

export function ControlPanel() {
  const navigate = useNavigate();
  const {
    acUnits,
    racks,
    turnState,
    gamePhase,
    toggleAC,
    setACSetPoint,
    migrateLoad,
    nextTurn,
    pauseGame,
    resumeGame,
    resetGame,
    eventLog,
    operationLog,
    actionMessage,
    failReason,
  } = useGameStore();

  const {
    controlPanelTab,
    setControlPanelTab,
    migrateFromRackId,
    migrateToRackId,
    migrateAmount,
    setMigrateFromRackId,
    setMigrateToRackId,
    setMigrateAmount,
    showHeatmap,
    showLabels,
    cameraView,
    toggleHeatmap,
    toggleLabels,
    setCameraView,
    resetUI,
    toggleFullscreen,
  } = useUISTore();

  const [collapsed, setCollapsed] = useState(false);

  const fromRack = racks.find((r) => r.id === migrateFromRackId);
  const toRack = racks.find((r) => r.id === migrateToRackId);

  const handleMigrate = () => {
    if (migrateFromRackId && migrateToRackId && migrateAmount > 0) {
      migrateLoad(migrateFromRackId, migrateToRackId, migrateAmount);
    }
  };

  const handleReset = () => {
    resetGame();
    resetUI();
  };

  const handleBackToMenu = () => {
    navigate('/');
  };

  return (
    <div className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 transition-all duration-300 ${collapsed ? 'translate-x-[340px]' : 'translate-x-0'}`}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full bg-slate-800/90 backdrop-blur-sm p-2 rounded-l-lg border border-r-0 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/90"
      >
        {collapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
      </button>

      <div className="w-80 max-h-[80vh] bg-slate-800/95 backdrop-blur-md border border-slate-700/50 rounded-l-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex border-b border-slate-700/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setControlPanelTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 text-xs transition-colors ${
                controlPanelTab === tab.id
                  ? 'bg-slate-700/50 text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {controlPanelTab === 'ac' && (
            <div className="space-y-3">
              <div className="text-sm text-slate-300 font-medium mb-3">空调机组控制</div>
              {acUnits.map((ac) => (
                <div
                  key={ac.id}
                  className={`p-3 rounded-lg border ${getStatusBgColor(ac.status)}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Wind size={16} className={getStatusColor(ac.status)} />
                      <span className="font-medium text-slate-200">{ac.name}</span>
                      <span className={`text-xs ${getStatusColor(ac.status)}`}>
                        {ac.isOn ? (ac.status === 'overload' ? '过载' : '运行') : '关闭'}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleAC(ac.id)}
                      disabled={gamePhase !== 'playing'}
                      className={`p-2 rounded-md transition-colors ${
                        ac.isOn
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          : 'bg-slate-600/50 text-slate-400 hover:bg-slate-600/70'
                      } ${gamePhase !== 'playing' && 'opacity-50 cursor-not-allowed'}`}
                    >
                      <Power size={16} />
                    </button>
                  </div>

                  {ac.isOn && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>设定温度: {ac.setPoint}°C</span>
                        <span>制冷量: {ac.capacity.toFixed(1)} kW</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ThermometerSun size={14} className="text-slate-500" />
                        <input
                          type="range"
                          min="18"
                          max="30"
                          value={ac.setPoint}
                          onChange={(e) => setACSetPoint(ac.id, parseInt(e.target.value))}
                          disabled={gamePhase !== 'playing'}
                          className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-cyan-400 disabled:opacity-50"
                        />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>18°C</span>
                        <span>30°C</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {controlPanelTab === 'migrate' && (
            <div className="space-y-4">
              <div className="text-sm text-slate-300 font-medium">负载迁移</div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400">源机柜</label>
                <select
                  value={migrateFromRackId || ''}
                  onChange={(e) => setMigrateFromRackId(e.target.value || null)}
                  disabled={gamePhase !== 'playing'}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 disabled:opacity-50"
                >
                  <option value="">选择源机柜...</option>
                  {racks.filter(r => r.status !== 'fault').map((rack) => (
                    <option key={rack.id} value={rack.id}>
                      {rack.name} - {rack.load.toFixed(1)} kW / {rack.maxLoad.toFixed(1)} kW
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-center">
                <ArrowRightLeft size={20} className="text-cyan-400" />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400">目标机柜</label>
                <select
                  value={migrateToRackId || ''}
                  onChange={(e) => setMigrateToRackId(e.target.value || null)}
                  disabled={gamePhase !== 'playing'}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 disabled:opacity-50"
                >
                  <option value="">选择目标机柜...</option>
                  {racks.filter(r => r.status !== 'fault' && r.id !== migrateFromRackId).map((rack) => (
                    <option key={rack.id} value={rack.id}>
                      {rack.name} - {rack.load.toFixed(1)} kW / {rack.maxLoad.toFixed(1)} kW
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400">
                  迁移量: {migrateAmount.toFixed(1)} kW
                </label>
                <input
                  type="range"
                  min="0.5"
                  max={fromRack ? fromRack.load : 10}
                  step="0.5"
                  value={migrateAmount}
                  onChange={(e) => setMigrateAmount(parseFloat(e.target.value))}
                  disabled={gamePhase !== 'playing' || !fromRack}
                  className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-cyan-400 disabled:opacity-50"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>0.5 kW</span>
                  <span>{fromRack ? fromRack.load.toFixed(1) + ' kW' : '10 kW'}</span>
                </div>
              </div>

              {fromRack && toRack && (
                <div className="bg-slate-700/30 rounded-lg p-3 text-xs space-y-1">
                  <div className="text-slate-300">
                    {fromRack.name} ({fromRack.load.toFixed(1)} kW) → {toRack.name} ({toRack.load.toFixed(1)} kW)
                  </div>
                  <div className="text-slate-400">
                    迁移后: {fromRack.name} {(fromRack.load - migrateAmount).toFixed(1)} kW / {toRack.name} {(toRack.load + migrateAmount).toFixed(1)} kW
                  </div>
                </div>
              )}

              <button
                onClick={handleMigrate}
                disabled={gamePhase !== 'playing' || !fromRack || !toRack}
                className="w-full flex items-center justify-center gap-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 px-4 py-2 rounded-lg border border-cyan-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} />
                执行迁移
              </button>
            </div>
          )}

          {controlPanelTab === 'events' && (
            <div className="space-y-2">
              <div className="text-sm text-slate-300 font-medium mb-3">事件记录</div>
              {eventLog.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-8">
                  暂无事件记录
                </div>
              ) : (
                [...eventLog].reverse().map((event) => (
                  <div
                    key={event.id}
                    className={`p-3 rounded-lg border text-sm ${
                      event.severity === 'danger'
                        ? 'bg-red-500/10 border-red-500/30'
                        : event.severity === 'warning'
                        ? 'bg-yellow-500/10 border-yellow-500/30'
                        : 'bg-slate-700/30 border-slate-600/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs ${
                        event.severity === 'danger'
                          ? 'text-red-400'
                          : event.severity === 'warning'
                          ? 'text-yellow-400'
                          : 'text-cyan-400'
                      }`}>
                        回合 {event.turn} - {formatHour(event.hour)}
                      </span>
                    </div>
                    <div className="text-slate-300">{event.message}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {controlPanelTab === 'log' && (
            <div className="space-y-2">
              <div className="text-sm text-slate-300 font-medium mb-3">操作日志</div>
              {operationLog.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-8">
                  暂无操作记录
                </div>
              ) : (
                [...operationLog].reverse().map((op) => (
                  <div
                    key={op.id}
                    className="p-2 rounded bg-slate-700/30 border border-slate-600/30 text-xs"
                  >
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                      <span>回合 {op.turn}</span>
                      <span>{op.type}</span>
                    </div>
                    <div className="text-slate-300">
                      {op.type === 'ac_toggle' && `${op.payload.acId} ${op.payload.isOn ? '开启' : '关闭'}`}
                      {op.type === 'ac_setpoint' && `${op.payload.acId} 设定温度 ${op.payload.temperature}°C`}
                      {op.type === 'migrate_load' && `迁移 ${op.payload.amount}kW: ${op.payload.fromRackId} → ${op.payload.toRackId} ${!op.payload.success ? '(失败)' : ''}`}
                      {op.type === 'next_turn' && `推进回合，得分 ${(op.payload.scoreDelta || 0)}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="border-t border-slate-700/50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setCameraView(cameraView === '3d' ? 'top' : '3d')}
              className="flex items-center justify-center gap-1 bg-slate-700/50 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg text-xs transition-colors"
            >
              {cameraView === '3d' ? <Map size={14} /> : <Grid size={14} />}
              {cameraView === '3d' ? '俯视图' : '3D视图'}
            </button>
            <button
              onClick={toggleHeatmap}
              className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs transition-colors ${showHeatmap ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300'}`}
            >
              {showHeatmap ? <Eye size={14} /> : <EyeOff size={14} />}
              热力图
            </button>
            <button
              onClick={toggleLabels}
              className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs transition-colors ${showLabels ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300'}`}
            >
              {showLabels ? <Eye size={14} /> : <EyeOff size={14} />}
              标签
            </button>
            <button
              onClick={toggleFullscreen}
              className="flex items-center justify-center gap-1 bg-slate-700/50 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg text-xs transition-colors"
            >
              <Maximize size={14} />
              全屏
            </button>
          </div>

          <div className="space-y-2">
            {gamePhase === 'playing' && (
              <button
                onClick={nextTurn}
                className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900 px-4 py-3 rounded-lg font-bold transition-colors shadow-lg shadow-cyan-500/20"
              >
                <Play size={18} />
                下一回合
              </button>
            )}
            {gamePhase === 'playing' && (
              <button
                onClick={pauseGame}
                className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg transition-colors"
              >
                <Pause size={16} />
                暂停
              </button>
            )}
            {gamePhase === 'paused' && (
              <button
                onClick={resumeGame}
                className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-slate-900 px-4 py-3 rounded-lg font-bold transition-colors"
              >
                <Play size={18} />
                继续游戏
              </button>
            )}
            {(gamePhase === 'won' || gamePhase === 'lost') && (
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-slate-900 px-4 py-3 rounded-lg font-bold transition-colors"
              >
                <RotateCcw size={18} />
                重新开始
              </button>
            )}
            <button
              onClick={handleBackToMenu}
              className="w-full flex items-center justify-center gap-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg transition-colors"
            >
              <Home size={16} />
              返回主菜单
            </button>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="absolute bottom-[-60px] left-1/2 -translate-x-1/2 bg-slate-800/95 backdrop-blur-sm px-6 py-3 rounded-lg border border-slate-700 text-sm text-slate-200 whitespace-nowrap shadow-xl">
          {actionMessage}
        </div>
      )}

      {failReason && gamePhase === 'lost' && (
        <div className="absolute top-[-80px] left-1/2 -translate-x-1/2 w-96 bg-red-900/95 backdrop-blur-sm p-6 rounded-xl border border-red-500/50 shadow-2xl">
          <div className="flex items-start gap-3">
            <AlertTriangle size={24} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-red-400 font-bold mb-1">挑战失败</div>
              <div className="text-slate-200 text-sm">{failReason}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
