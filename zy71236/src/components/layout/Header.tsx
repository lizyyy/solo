import { useSynthStore } from '../../store/useSynthStore';
import { WarningIndicator } from '../presets/WarningNotifications';
import { Button } from '../ui/Button';
import { LedDisplay } from '../ui/LedDisplay';
import { Waveform } from '../visualizers/Waveform';
import { BarChart3, RotateCcw, FileBarChart, Save } from 'lucide-react';
import { downloadSession } from '../../utils/export';

interface HeaderProps {
  onGenerateReport: () => void;
}

export function Header({ onGenerateReport }: HeaderProps) {
  const { currentScore, sessionId, sessionStartTime, resetSession, exportSessionFile } = useSynthStore();

  const handleSaveSession = () => {
    const json = exportSessionFile();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `synth-session-${Date.now()}.synthsession.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000);
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="bg-gray-900/90 backdrop-blur-sm border-b border-gray-800 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-pink-500 flex items-center justify-center">
                <span className="text-xl">🎛️</span>
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse border-2 border-gray-900" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wider">
                <span className="text-cyan-400">SYNTH</span>
                <span className="text-pink-400"> LAB</span>
              </h1>
              <div className="text-[10px] text-gray-500 font-mono tracking-wider">
                SOUND SYNTHESIS LABORATORY
              </div>
            </div>
          </div>

          <div className="h-10 w-px bg-gray-700" />

          <div className="text-xs text-gray-500">
            <span className="text-gray-400">会话ID:</span>{' '}
            <span className="font-mono">{sessionId.slice(0, 12)}...</span>
            <span className="ml-3 text-gray-400">时长:</span>{' '}
            <span className="font-mono">{formatDuration(sessionDuration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:block">
            <Waveform width={200} height={40} />
          </div>

          <div className="flex items-center gap-4">
            <LedDisplay value={currentScore.total} label="总分" variant="cyan" size="sm" />
            <WarningIndicator />
          </div>

          <div className="h-10 w-px bg-gray-700" />

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSaveSession}
              className="flex items-center gap-1.5"
              title="保存会话（支持后续导入续接）"
            >
              <Save size={14} />
              保存会话
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={resetSession}
              className="flex items-center gap-1.5"
            >
              <RotateCcw size={14} />
              重置
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={onGenerateReport}
              className="flex items-center gap-1.5"
              glow
            >
              <FileBarChart size={14} />
              生成报告
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-800">
        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <BarChart3 size={14} className="text-cyan-400" />
            维度得分:
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs">
              <span className="text-cyan-400 font-mono">{currentScore.dimensions.richness}</span>
              <span className="text-gray-600">/25 </span>
              <span className="text-gray-500">丰富度</span>
            </div>
            <div className="text-xs">
              <span className="text-pink-400 font-mono">{currentScore.dimensions.reasonableness}</span>
              <span className="text-gray-600">/25 </span>
              <span className="text-gray-500">合理性</span>
            </div>
            <div className="text-xs">
              <span className="text-orange-400 font-mono">{currentScore.dimensions.fluency}</span>
              <span className="text-gray-600">/20 </span>
              <span className="text-gray-500">流畅度</span>
            </div>
            <div className="text-xs">
              <span className="text-green-400 font-mono">{currentScore.dimensions.exploration}</span>
              <span className="text-gray-600">/20 </span>
              <span className="text-gray-500">探索度</span>
            </div>
            <div className="text-xs">
              <span className="text-yellow-400 font-mono">{currentScore.dimensions.riskControl}</span>
              <span className="text-gray-600">/10 </span>
              <span className="text-gray-500">风险</span>
            </div>
          </div>
        </div>

        <div className="flex-1 text-right text-xs text-gray-500">
          操作次数: {currentScore.stats.totalOperations} | 已探索参数:{' '}
          {currentScore.stats.paramsTouched.length}/13
        </div>
      </div>
    </header>
  );
}
