import { Plane, Clock, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import type { FlightStatus } from '@/types/game';

export const FlightStatusPanel = () => {
  const flights = useGameStore(state => state.flights);
  const currentLevel = useGameStore(state => state.currentLevel);

  const getStatusIcon = (status: FlightStatus) => {
    switch (status) {
      case 'ontime':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'delayed':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const getStatusText = (status: FlightStatus) => {
    switch (status) {
      case 'ontime':
        return '正点';
      case 'delayed':
        return '延误';
      case 'cancelled':
        return '取消';
    }
  };

  const getStatusBg = (status: FlightStatus) => {
    switch (status) {
      case 'ontime':
        return 'bg-green-900/30 border-green-700/50';
      case 'delayed':
        return 'bg-yellow-900/30 border-yellow-700/50';
      case 'cancelled':
        return 'bg-red-900/30 border-red-700/50';
    }
  };

  if (!currentLevel || !currentLevel.hasDelays) return null;

  const normalFlights = flights.filter(f => {
    const gate = currentLevel.gates.find(g => g.id === f.gate);
    return gate?.type === 'normal';
  });

  return (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-4 pointer-events-auto">
      <div className="bg-gray-900/90 backdrop-blur-sm rounded-xl border border-gray-700 shadow-xl overflow-hidden w-64">
        <div className="p-3 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-white">航班状态</span>
          </div>
        </div>
        <div className="p-2 max-h-80 overflow-y-auto">
          {normalFlights.map(flight => (
            <div
              key={flight.number}
              className={`p-3 mb-2 rounded-lg border ${getStatusBg(flight.status)} transition-all duration-300`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-blue-400 text-sm">
                    {flight.number}
                  </span>
                  {getStatusIcon(flight.status)}
                </div>
                <span className="text-xs font-mono text-gray-400">
                  {flight.departureTime}'
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">{flight.destination}</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">口</span>
                  <span className="text-xs font-bold text-white">{flight.gate}</span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className={`text-xs font-medium ${
                  flight.status === 'ontime' ? 'text-green-400' :
                  flight.status === 'delayed' ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {getStatusText(flight.status)}
                </span>
                {flight.status !== 'ontime' && (
                  <span className="text-xs text-gray-500">行李转存</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="p-2 border-t border-gray-700 bg-gray-800/30">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <AlertTriangle className="w-3 h-3 text-yellow-400" />
            <span>延误/取消航班行李请送往STORAGE</span>
          </div>
        </div>
      </div>
    </div>
  );
};
