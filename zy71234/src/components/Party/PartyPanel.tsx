import { motion } from 'framer-motion';
import { PartyStatus } from './PartyStatus';
import type { PartyState } from '../../types';
import { formatCurrency } from '../../utils/settlementEngine';

interface PartyPanelProps {
  parties: PartyState[];
  totalRevenue: number;
}

export function PartyPanel({ parties, totalRevenue }: PartyPanelProps) {
  const totalSplit = parties.reduce((sum, p) => sum + p.splitPercentage, 0);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-serif text-xl text-music-gold">三方状态</h2>
        <div className="text-sm">
          <span className="text-gray-400">总分成: </span>
          <span className={`font-bold ${
            totalSplit >= 95 && totalSplit <= 105 ? 'text-green-400' : 'text-red-400'
          }`}>
            {totalSplit.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {parties.map((party, index) => (
          <motion.div
            key={party.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <PartyStatus party={party} />
            
            <div className="mt-2 text-center text-sm">
              <span className="text-gray-400">预估收入: </span>
              <span className="text-white font-bold">
                {formatCurrency(totalRevenue * party.splitPercentage / 100)}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
