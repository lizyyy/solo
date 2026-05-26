import { Play, Pause, RotateCcw, ClipboardList, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FooterProps {
  isPaused: boolean;
  isCompleted: boolean;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onGenerateReport: () => void;
  canGenerateReport: boolean;
}

export function Footer({ 
  isPaused, 
  isCompleted, 
  onPause, 
  onResume, 
  onRestart, 
  onGenerateReport,
  canGenerateReport 
}: FooterProps) {
  const navigate = useNavigate();

  return (
    <footer className="bg-slate-800 border-t border-slate-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
        >
          <Home className="w-5 h-5" />
          <span>返回主页</span>
        </button>
        
        <div className="flex items-center gap-4">
          {!isCompleted && (
            <>
              {isPaused ? (
                <button
                  onClick={onResume}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <Play className="w-5 h-5" />
                  <span>继续</span>
                </button>
              ) : (
                <button
                  onClick={onPause}
                  className="flex items-center gap-2 px-6 py-2 bg-industrial-yellow hover:bg-amber-500 text-slate-900 rounded-lg transition-colors"
                >
                  <Pause className="w-5 h-5" />
                  <span>暂停</span>
                </button>
              )}
              
              <button
                onClick={onRestart}
                className="flex items-center gap-2 px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
                <span>重开</span>
              </button>
            </>
          )}
          
          <button
            onClick={onGenerateReport}
            disabled={!canGenerateReport}
            className="flex items-center gap-2 px-6 py-2 bg-industrial-blue hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ClipboardList className="w-5 h-5" />
            <span>生成报告</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
