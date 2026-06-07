import React, { useState, useRef, useEffect } from 'react';
import { Send, AlertCircle, StickyNote, Clock } from 'lucide-react';
import type { GameStatus } from '../types';

interface DataInputProps {
  status: GameStatus;
  onSubmit: (value: string | number, note: string) => void;
  timeLimit?: number;
}

export const DataInput: React.FC<DataInputProps> = ({ status, onSubmit, timeLimit = 5000 }) => {
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [timeLeft, setTimeLeft] = useState<number>(timeLimit);
  const [timedOut, setTimedOut] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const hasSubmittedRef = useRef<boolean>(false);

  const isPlaying = status === 'playing';

  useEffect(() => {
    if (isPlaying) {
      setTimeLeft(timeLimit);
      startTimeRef.current = Date.now();
      hasSubmittedRef.current = false;
      setTimedOut(false);
      inputRef.current?.focus();
    }
  }, [isPlaying, timeLimit]);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = Math.max(0, timeLimit - elapsed);
        setTimeLeft(remaining);

        if (remaining <= 0 && !hasSubmittedRef.current) {
          hasSubmittedRef.current = true;
          setTimedOut(true);
          
          let submitValue: string | number = value.trim();
          const parsed = parseFloat(submitValue);
          if (!isNaN(parsed)) {
            submitValue = parsed;
          }
          
          const timeoutNote = note 
            ? `${note}；超时自动提交 - 用时${(timeLimit / 1000).toFixed(1)}秒`
            : `超时自动提交 - 用时${(timeLimit / 1000).toFixed(1)}秒`;
          
          onSubmit(submitValue, timeoutNote);
          
          setTimeout(() => {
            if (status === 'playing') {
              setValue('');
              setNote('');
              startTimeRef.current = Date.now();
              setTimeLeft(timeLimit);
              setTimedOut(false);
              hasSubmittedRef.current = false;
              inputRef.current?.focus();
            }
          }, 800);
        }
      }, 50);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, timeLimit, value, note, onSubmit, status]);

  const handleSubmit = () => {
    if (!isPlaying || hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    let submitValue: string | number = value.trim();
    const parsed = parseFloat(submitValue);
    if (!isNaN(parsed)) {
      submitValue = parsed;
    }

    onSubmit(submitValue, note);
    setValue('');
    setNote('');
    startTimeRef.current = Date.now();
    setTimeLeft(timeLimit);
    setTimedOut(false);
    hasSubmittedRef.current = false;
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const timePercent = (timeLeft / timeLimit) * 100;
  const isUrgent = timePercent < 30;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-gray-400">载荷输入</label>
          <div className={`flex items-center gap-1 font-mono text-sm ${timedOut ? 'text-red-500 font-bold' : isUrgent ? 'text-red-400 animate-pulse' : 'text-gray-400'}`}>
            {timedOut ? <Clock className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{timedOut ? '已超时，自动提交中...' : `${(timeLeft / 1000).toFixed(1)}s`}</span>
          </div>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ${timedOut ? 'bg-red-600' : isUrgent ? 'bg-red-500' : 'bg-amber-500'}`}
            style={{ width: `${timePercent}%` }}
          />
        </div>
      </div>

      {timedOut && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded-lg text-sm text-red-300">
          <Clock className="w-4 h-4" />
          <span>响应超时，系统已自动提交当前输入值</span>
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入载荷值 (数字)..."
            disabled={!isPlaying || timedOut}
            className={`w-full px-4 py-4 border-2 rounded-lg text-white text-xl font-mono placeholder-gray-600 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${timedOut ? 'bg-red-900/20 border-red-700' : 'bg-slate-800 border-slate-700 focus:border-amber-500'}`}
          />
          {value && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-mono">
              kg
            </div>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!isPlaying || timedOut}
          className="px-6 py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:scale-105 active:scale-95"
        >
          <Send className="w-5 h-5" />
          <span>提交</span>
        </button>
      </div>

      <div className="relative">
        <StickyNote className="absolute left-3 top-3 w-5 h-5 text-amber-500" />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="原始备注（永不清洗，原样保留） - 例如：学生A回答、有人举手、老师提示过..."
          disabled={!isPlaying || timedOut}
          rows={2}
          className={`w-full pl-10 pr-4 py-3 border-2 rounded-lg text-white placeholder-gray-600 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed resize-none ${timedOut ? 'bg-red-900/20 border-red-700' : 'bg-slate-800 border-slate-700 focus:border-amber-500/50'}`}
        />
      </div>

      {!isPlaying && (
        <div className="text-center text-gray-500 text-sm py-4">
          {status === 'idle' && '点击「开始」按钮开始游戏'}
          {status === 'paused' && '游戏已暂停，点击「继续」恢复'}
          {status === 'ended' && '游戏已结束，点击「重开」开始新一轮'}
          {status === 'playback' && '回放模式中，无法输入数据'}
        </div>
      )}
    </div>
  );
};
