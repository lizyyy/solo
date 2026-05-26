import React, { useState } from 'react';
import { Volume2, Monitor, Mouse, Tablet, X } from 'lucide-react';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Settings({ isOpen, onClose }: SettingsProps) {
  const [volume, setVolume] = useState(80);
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [controlMode, setControlMode] = useState<'mouse' | 'touch'>('mouse');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-96 max-w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">设置</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Volume2 className="w-5 h-5 text-amber-500" />
              音量
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="flex-1 accent-amber-500"
              />
              <span className="w-12 text-center text-sm font-mono text-gray-600">
                {volume}%
              </span>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Monitor className="w-5 h-5 text-amber-500" />
              画质
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`py-2 rounded-lg text-sm font-medium transition-all ${
                    quality === q
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {q === 'low' ? '低' : q === 'medium' ? '中' : '高'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Mouse className="w-5 h-5 text-amber-500" />
              操作方式
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setControlMode('mouse')}
                className={`py-3 rounded-lg text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                  controlMode === 'mouse'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Mouse className="w-6 h-6" />
                键鼠
              </button>
              <button
                onClick={() => setControlMode('touch')}
                className={`py-3 rounded-lg text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                  controlMode === 'touch'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Tablet className="w-6 h-6" />
                触屏
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 transition-colors shadow-md"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}