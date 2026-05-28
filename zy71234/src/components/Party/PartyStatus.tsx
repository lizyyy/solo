import { motion } from 'framer-motion';
import type { PartyState } from '../../types';
import { getPartyIcon } from '../../utils/settlementEngine';

interface PartyStatusProps {
  party: PartyState;
  showDetails?: boolean;
}

export function PartyStatus({ party, showDetails = true }: PartyStatusProps) {
  const getRightName = (right: string): string => {
    const names: Record<string, string> = {
      mechanical_right: '机械复制权',
      performance_right: '表演权',
      sync_right: '同步权',
    };
    return names[right] || right;
  };

  return (
    <motion.div
      className="bg-music-card rounded-xl p-4 border border-white/10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{getPartyIcon(party.type)}</span>
        <div>
          <h3 className="font-serif text-music-gold font-bold">{party.name}</h3>
          <p className="text-xs text-gray-400 capitalize">{party.type}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">分成比例</span>
            <span className="font-bold text-white">{party.splitPercentage.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-music-darker rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-music-gold to-music-gold-light"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(party.splitPercentage, 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">信誉</span>
            <span className={`font-bold ${
              party.reputation >= 70 ? 'text-green-400' :
              party.reputation >= 50 ? 'text-yellow-400' : 'text-red-400'
            }`}>{party.reputation}</span>
          </div>
          <div className="h-2 bg-music-darker rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${
                party.reputation >= 70 ? 'bg-green-500' :
                party.reputation >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${party.reputation}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {showDetails && party.rights.length > 0 && (
          <div className="pt-2 border-t border-white/10">
            <p className="text-xs text-gray-400 mb-2">拥有权利</p>
            <div className="flex flex-wrap gap-1">
              {party.rights.map(right => (
                <span
                  key={right}
                  className="text-xs px-2 py-1 rounded-full bg-music-gold/20 text-music-gold"
                >
                  {getRightName(right)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
