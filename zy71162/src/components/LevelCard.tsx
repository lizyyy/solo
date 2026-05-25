import type { LevelDef } from '../engine/types';
import { Clock, AlertTriangle, Users } from 'lucide-react';

interface Props {
  level: LevelDef;
  onClick: () => void;
}

function LevelCard({ level, onClick }: Props) {
  const stars = Array.from({ length: level.difficulty }, (_, i) => i);
  return (
    <button
      onClick={onClick}
      className="card p-4 text-left hover:border-accent/60 hover:shadow-glow transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-xs text-base-400">关卡 {level.id}</div>
          <div className="text-lg font-bold text-base-100 group-hover:text-accent">{level.name}</div>
        </div>
        <div className="flex gap-0.5">
          {stars.map((i) => (
            <span key={i} className="text-accent text-sm">★</span>
          ))}
        </div>
      </div>
      <p className="text-xs text-base-400 leading-relaxed mb-3 line-clamp-3">{level.description}</p>
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="tag bg-base-700 text-base-200">
          <Clock size={10} className="mr-1" />{level.durationMin} 分钟
        </span>
        <span className="tag bg-base-700 text-base-200">
          <Users size={10} className="mr-1" />{level.routes.length} 条线路
        </span>
        {level.closures.length > 0 && (
          <span className="tag bg-danger/20 text-danger">
            <AlertTriangle size={10} className="mr-1" />{level.closures.length} 处施工
          </span>
        )}
      </div>
    </button>
  );
}

export default LevelCard;
