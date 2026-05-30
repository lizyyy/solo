import type { CollectorProfile } from '../types';
import { Swords, Shield, Target, Zap } from 'lucide-react';

interface Props {
  collectors: CollectorProfile[];
  artworkCategory: string;
}

const typeIcons = {
  aggressive: Swords,
  conservative: Shield,
  selective: Target,
  opportunistic: Zap,
};

const typeLabels = {
  aggressive: '激进型',
  conservative: '保守型',
  selective: '选择型',
  opportunistic: '机会型',
};

const typeColors = {
  aggressive: 'text-[#8b2252] bg-[#8b2252]/10 border-[#8b2252]/30',
  conservative: 'text-[#2d5a3d] bg-[#2d5a3d]/10 border-[#2d5a3d]/30',
  selective: 'text-[#c9a84c] bg-[#c9a84c]/10 border-[#c9a84c]/30',
  opportunistic: 'text-[#5a7acc] bg-[#5a7acc]/10 border-[#5a7acc]/30',
};

export default function CollectorProfiles({ collectors, artworkCategory }: Props) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-[#c9a84c] uppercase tracking-wider">参与藏家</h3>
      {collectors.map(c => {
        const Icon = typeIcons[c.preferenceType];
        const isFavorite = c.favoriteCategory === artworkCategory;
        return (
          <div key={c.id} className="bg-[#1e1e30] border border-[#c9a84c]/10 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{c.avatar}</span>
                <div>
                  <p className="text-[#f5f0e8] text-sm font-bold">{c.name}</p>
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs ${typeColors[c.preferenceType]}`}>
                    <Icon className="w-3 h-3" />
                    {typeLabels[c.preferenceType]}
                  </div>
                </div>
              </div>
              {isFavorite && (
                <span className="px-2 py-1 bg-[#c9a84c]/20 text-[#c9a84c] text-xs rounded-full font-medium border border-[#c9a84c]/30">
                  偏好匹配
                </span>
              )}
            </div>
            <p className="text-[#f5f0e8]/50 text-xs leading-relaxed">{c.description}</p>
            <div className="flex items-center gap-4 text-xs text-[#f5f0e8]/40">
              <span>预算 ¥{(c.maxBudget / 10000).toFixed(0)}万</span>
              <span>偏好 {c.favoriteCategory}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
