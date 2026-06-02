import { Music2, RotateCcw, Tag, Clock, User } from 'lucide-react';
import type { Playlist } from '../types';
import { formatDateTime } from '../utils/formatters';

interface HeaderProps {
  playlist: Playlist;
  onReset: () => void;
}

export function Header({ playlist, onReset }: HeaderProps) {
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
                  <span className="bg-white/20 px-2 py-0.5 rounded text-xs">
                    {playlist.version}
                  </span>
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
