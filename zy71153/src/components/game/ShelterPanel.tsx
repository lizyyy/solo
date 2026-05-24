import { useGameStore } from '../../store/useGameStore';
import { SUPPLY_CONFIGS } from '../../types';

export const ShelterPanel = () => {
  const { nodes } = useGameStore();

  const shelters = nodes.filter((n) => n.type === 'shelter');

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-4">🏠 安置点需求</h3>
      
      <div className="space-y-3">
        {shelters.map((shelter) => {
          if (!shelter.demand || !shelter.received) return null;
          
          const allMet = 
            shelter.received.water >= shelter.demand.water &&
            shelter.received.medicine >= shelter.demand.medicine &&
            shelter.received.tent >= shelter.demand.tent;

          return (
            <div 
              key={shelter.id}
              className={`rounded-lg p-3 ${
                allMet 
                  ? 'bg-green-500/10 border border-green-500/30' 
                  : 'bg-slate-700/50 border border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">{shelter.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  allMet ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'
                }`}>
                  {allMet ? '已完成' : '进行中'}
                </span>
              </div>
              
              <div className="space-y-1">
                {SUPPLY_CONFIGS.map((supply) => {
                  const received = shelter.received![supply.type];
                  const demand = shelter.demand![supply.type];
                  const percentage = Math.min(100, (received / demand) * 100);
                  const isMet = received >= demand;
                  
                  return (
                    <div key={supply.type} className="flex items-center gap-2">
                      <span className="w-6">{supply.emoji}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs text-slate-300 mb-1">
                          <span>{supply.name}</span>
                          <span className={isMet ? 'text-green-400' : 'text-slate-400'}>
                            {received}/{demand}
                          </span>
                        </div>
                        <div className="w-full bg-slate-600 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full transition-all ${
                              isMet ? 'bg-green-500' : 'bg-yellow-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
