import { X, Plane, Package, Zap, AlertTriangle, Clock } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { BAGGAGE_COLORS } from '@/utils/levelConfigs';

export const BaggageInfo = () => {
  const selectedBaggageId = useGameStore(state => state.selectedBaggageId);
  const baggages = useGameStore(state => state.baggages);
  const selectBaggage = useGameStore(state => state.selectBaggage);
  const flights = useGameStore(state => state.flights);

  const baggage = baggages.find(b => b.id === selectedBaggageId);

  if (!baggage) return null;

  const flight = flights.find(f => f.number === baggage.flightNumber);
  const transferFlight = baggage.transferFlight
    ? flights.find(f => f.number === baggage.transferFlight)
    : null;

  const typeLabels = {
    normal: '普通行李',
    transfer: '转机行李',
    oversize: '超规行李',
  };

  return (
    <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-4 pointer-events-auto">
      <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl border border-gray-700 shadow-xl overflow-hidden w-72">
        <div className="p-3 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5" style={{ color: baggage.color }} />
            <span className="font-bold text-white">行李详情</span>
          </div>
          <button
            onClick={() => selectBaggage(undefined)}
            className="p-1 rounded hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: baggage.color + '33', borderColor: baggage.color, borderWidth: 2 }}
            >
              <Package className="w-6 h-6" style={{ color: baggage.color }} />
            </div>
            <div>
              <div className="text-white font-mono font-bold">{baggage.flightNumber}</div>
              <div className="text-sm" style={{ color: baggage.color }}>
                {typeLabels[baggage.type]}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400 flex items-center gap-1">
                <Plane className="w-4 h-4" />
                目的地
              </span>
              <span className="text-white font-medium">{flight?.destination || '-'}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400 flex items-center gap-1">
                <Plane className="w-4 h-4" />
                目标口
              </span>
              <span className="text-blue-400 font-mono font-bold">{baggage.targetGate}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400 flex items-center gap-1">
                <Package className="w-4 h-4" />
                重量
              </span>
              <span className="text-white font-mono">{baggage.weight} kg</span>
            </div>

            {baggage.type === 'transfer' && (
              <>
                <div className="h-px bg-gray-700 my-2" />
                <div className="flex items-center gap-1 text-orange-400 text-xs mb-2">
                  <Zap className="w-4 h-4" />
                  <span className="font-medium">转机信息</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">转机航班</span>
                  <span className="text-orange-400 font-mono font-bold">
                    {baggage.transferFlight || '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    剩余时间
                  </span>
                  <span className={`font-mono font-bold ${
                    baggage.transferTime && baggage.transferTime < 10
                      ? 'text-red-400 animate-pulse'
                      : baggage.transferTime && baggage.transferTime < 20
                      ? 'text-yellow-400'
                      : 'text-green-400'
                  }`}>
                    {baggage.transferTime !== undefined ? `${Math.floor(baggage.transferTime)} 分` : '-'}
                  </span>
                </div>
              </>
            )}

            {baggage.isOversize && (
              <>
                <div className="h-px bg-gray-700 my-2" />
                <div className="flex items-center gap-1 text-red-400 text-xs">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">超规行李 - 请送往 OVERSIZE</span>
                </div>
              </>
            )}

            {flight?.status !== 'ontime' && (
              <>
                <div className="h-px bg-gray-700 my-2" />
                <div className={`flex items-center gap-1 text-xs ${
                  flight?.status === 'delayed' ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">
                    航班{flight?.status === 'delayed' ? '延误' : '取消'} - 请转存 STORAGE
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="h-px bg-gray-700 my-2" />
          <div className="flex items-center gap-4">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: BAGGAGE_COLORS.normal }} />
            <span className="text-xs text-gray-400">普通</span>
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: BAGGAGE_COLORS.transfer }} />
            <span className="text-xs text-gray-400">转机</span>
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: BAGGAGE_COLORS.oversize }} />
            <span className="text-xs text-gray-400">超规</span>
          </div>
        </div>
      </div>
    </div>
  );
};
