import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GameScene } from '@/components/game3d/GameScene';
import { HUD } from '@/components/ui/HUD';
import { ControlPanel } from '@/components/ui/ControlPanel';
import { FlightStatusPanel } from '@/components/ui/FlightStatusPanel';
import { BaggageInfo } from '@/components/ui/BaggageInfo';
import { ReportPanel } from '@/components/ui/ReportPanel';
import { useGameStore } from '@/store/useGameStore';
import { useGameLoop } from '@/hooks/useGameLoop';
import { getGameRecord } from '@/utils/reportGenerator';
import { getLevelConfig } from '@/utils/levelConfigs';
import { HelpCircle, Home } from 'lucide-react';

export const GamePage = () => {
  const { levelId } = useParams();
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);
  const [showReport, setShowReport] = useState(false);
  
  const initLevel = useGameStore(state => state.initLevel);
  const status = useGameStore(state => state.status);
  const lastRecordId = useGameStore(state => state.lastRecordId);
  const setReplayMode = useGameStore(state => state.setReplayMode);

  useGameLoop();

  useEffect(() => {
    const id = parseInt(levelId || '1');
    initLevel(id);
  }, [levelId, initLevel]);

  useEffect(() => {
    if (status === 'finished' || status === 'failed') {
      const timer = setTimeout(() => {
        setShowReport(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleReplay = () => {
    if (!lastRecordId) return;
    const record = getGameRecord(lastRecordId);
    if (record) {
      setReplayMode(record);
      setShowReport(false);
    }
  };

  const level = getLevelConfig(parseInt(levelId || '1'));
  const record = lastRecordId ? getGameRecord(lastRecordId) : null;

  return (
    <div className="w-full h-screen bg-gray-950 relative">
      <div className="absolute inset-0">
        <GameScene />
      </div>
      <div className="absolute inset-0 pointer-events-none">
        <HUD />
        <BaggageInfo />
        <FlightStatusPanel />
        <div className="absolute bottom-0 left-0 right-0 pointer-events-auto">
          <ControlPanel onShowHelp={() => setShowHelp(true)} />
        </div>
      </div>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl max-w-2xl w-full">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-6 h-6 text-blue-400" />
                <h2 className="text-xl font-bold text-white">操作说明</h2>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="p-2 rounded-lg hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
              >
                <Home className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <h3 className="font-bold text-white mb-2">🎮 基本操作</h3>
                <ul className="text-gray-300 text-sm space-y-2">
                  <li>• 点击<span className="text-yellow-400 font-mono">黄色切换器</span>改变传送带方向</li>
                  <li>• 点击<span className="text-blue-400">行李</span>查看详细信息</li>
                  <li>• 鼠标滚轮缩放视角，拖动旋转视角</li>
                  <li>• 空格键可以暂停/继续游戏</li>
                </ul>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <h3 className="font-bold text-white mb-2">📦 行李类型</h3>
                <ul className="text-gray-300 text-sm space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-blue-500"></span>
                    <span><strong>普通行李</strong> - 送到对应航班口</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-orange-500"></span>
                    <span><strong>转机行李</strong> - 注意转机时间，超时算错误</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-red-500"></span>
                    <span><strong>超规行李</strong> - 必须送到 OVERSIZE 口</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <h3 className="font-bold text-white mb-2">✈️ 航班状态</h3>
                <ul className="text-gray-300 text-sm space-y-2">
                  <li>• <span className="text-green-400">正点</span> - 正常送往对应航班口</li>
                  <li>• <span className="text-yellow-400">延误</span> - 可选择送往 STORAGE 转存</li>
                  <li>• <span className="text-red-400">取消</span> - 必须送往 STORAGE 转存</li>
                </ul>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <h3 className="font-bold text-white mb-2">🎯 计分规则</h3>
                <ul className="text-gray-300 text-sm space-y-2">
                  <li>• 普通行李正确送达：+100分</li>
                  <li>• 转机行李正确送达：+150~200分</li>
                  <li>• 超规行李正确送达：+200分</li>
                  <li>• 任何错误：-50分</li>
                </ul>
              </div>

              {level && (
                <div className="bg-blue-900/20 rounded-xl p-4 border border-blue-700/50">
                  <h3 className="font-bold text-blue-400 mb-2">📍 当前关卡：{level.name}</h3>
                  <p className="text-gray-300 text-sm">{level.description}</p>
                  <div className="mt-2 text-xs text-gray-400">
                    <p>时间限制：{Math.floor(level.timeLimit / 60)}分{level.timeLimit % 60}秒</p>
                    <p>通关条件：准确率≥{level.passConditions.minAccuracy * 100}%，错误≤{level.passConditions.maxErrors}个</p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-700 flex justify-end">
              <button
                onClick={() => setShowHelp(false)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {showReport && record && (
        <ReportPanel
          record={record}
          onClose={() => setShowReport(false)}
          onReplay={handleReplay}
        />
      )}
    </div>
  );
};
