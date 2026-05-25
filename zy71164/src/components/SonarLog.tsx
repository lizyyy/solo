import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { ScrollText } from 'lucide-react';

export default function SonarLog() {
  const { sonarLog } = useGameStore();
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sonarLog]);

  const getLineColor = (line: string) => {
    if (line.startsWith('[错误]')) return 'var(--sonar-red)';
    if (line.includes('命中') || line.includes('HIT')) return 'var(--sonar-green)';
    if (line.includes('近失') || line.includes('未命中')) return 'var(--sonar-amber)';
    if (line.includes('首次发现')) return 'var(--sonar-cyan)';
    if (line.includes('目标逃离') || line.includes('规避')) return 'var(--sonar-amber)';
    if (line.includes('错误')) return 'var(--sonar-red)';
    if (line.includes('===')) return 'var(--sonar-cyan)';
    return 'var(--sonar-green)';
  };

  const formatLine = (line: string) => {
    if (line.startsWith('[回合')) {
      const match = line.match(/\[回合(\d+)\](.*)/);
      if (match) {
        return (
          <span>
            <span className="text-sonar-cyan">[回合{match[1]}]</span>
            {match[2]}
          </span>
        );
      }
    }
    if (line.startsWith('  →')) {
      return (
        <span className="pl-4">
          <span className="text-sonar-green/50">→</span>
          {line.slice(3)}
        </span>
      );
    }
    return line;
  };

  return (
    <div className="panel h-full flex flex-col">
      <h3 className="panel-title flex items-center gap-2">
        <ScrollText className="w-5 h-5" />
        侦测报告
      </h3>

      <div className="flex-1 overflow-y-auto terminal-text space-y-1 pr-2 min-h-[200px] max-h-[300px]">
        {sonarLog.length === 0 ? (
          <div className="text-sonar-green/30 text-center py-8">
            等待声呐数据...
          </div>
        ) : (
          sonarLog.map((line, index) => (
            <div
              key={index}
              className="terminal-line"
              style={{ color: getLineColor(line) }}
            >
              {formatLine(line)}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>

      <div className="border-t border-sonar-green/30 pt-3 mt-3">
        <div className="flex items-center justify-between text-xs text-sonar-green/50 font-jetbrains">
          <span>日志条目: {sonarLog.length}/200</span>
          <span className="cursor-blink">_</span>
        </div>
      </div>
    </div>
  );
}
