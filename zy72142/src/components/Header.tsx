import { useState, useRef, useEffect } from 'react';
import { Music2, RotateCcw, Tag, Clock, User, Edit2, Check, X } from 'lucide-react';
import type { Playlist } from '../types';
import { formatDateTime } from '../utils/formatters';

interface HeaderProps {
  playlist: Playlist;
  onReset: () => void;
  onUpdateVersion: (version: string) => void;
}

export function Header({ playlist, onReset, onUpdateVersion }: HeaderProps) {
  const [isEditingVersion, setIsEditingVersion] = useState(false);
  const [versionValue, setVersionValue] = useState(playlist.version);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVersionValue(playlist.version);
  }, [playlist.version]);

  useEffect(() => {
    if (isEditingVersion && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingVersion]);

  const handleSaveVersion = () => {
    const trimmed = versionValue.trim();
    if (trimmed && trimmed !== playlist.version) {
      onUpdateVersion(trimmed);
    } else {
      setVersionValue(playlist.version);
    }
    setIsEditingVersion(false);
  };

  const handleCancelVersion = () => {
    setVersionValue(playlist.version);
    setIsEditingVersion(false);
  };

  const handleVersionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveVersion();
    } else if (e.key === 'Escape') {
      handleCancelVersion();
    }
  };

  return (
    <header className="bg-[#1E3A3A] text-white px-6 py-4 shadow-lg">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#F2CC8F] p-2 rounded-lg">
              <Music2 className="w-6 h-6 text-[#1E3A3A]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wide">{playlist.name}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-gray-300">
                <span className="flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" />
                  {isEditingVersion ? (
                    <div className="flex items-center gap-1">
                      <input
                        ref={inputRef}
                        type="text"
                        value={versionValue}
                        onChange={(e) => setVersionValue(e.target.value)}
                        onKeyDown={handleVersionKeyDown}
                        onBlur={handleSaveVersion}
                        className="px-2 py-0.5 bg-white/20 rounded text-xs text-white w-24 focus:outline-none focus:ring-1 focus:ring-[#F2CC8F]"
                      />
                      <button
                        onClick={handleSaveVersion}
                        className="p-0.5 text-green-400 hover:text-green-300"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleCancelVersion}
                        className="p-0.5 text-red-400 hover:text-red-300"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="group/ver flex items-center gap-1">
                      <span className="bg-white/20 px-2 py-0.5 rounded text-xs">
                        {playlist.version}
                      </span>
                      <button
                        onClick={() => setIsEditingVersion(true)}
                        className="p-0.5 opacity-0 group-hover/ver:opacity-100 hover:text-[#F2CC8F] transition-opacity"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDateTime(playlist.updatedAt)}
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  {playlist.source}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-sm transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重置数据
          </button>
        </div>
      </div>
    </header>
  );
}
