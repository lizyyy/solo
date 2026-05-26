import { useGameStore } from '../game/state';
import { formatTime } from '../game/rules';
import { approveExtend, rejectExtend } from '../game/engine';
import { Clock, UserPlus, RefreshCw } from 'lucide-react';

export function GuestQueue() {
  const guests = useGameStore((state) => state.guests);
  const currentTime = useGameStore((state) => state.currentTime);
  const selectedGuestId = useGameStore((state) => state.selectedGuestId);
  const setSelectedGuest = useGameStore((state) => state.setSelectedGuest);
  const status = useGameStore((state) => state.status);

  const waitingGuests = guests.filter((g) => g.status === 'waiting');
  const checkedInGuests = guests.filter((g) => g.status === 'checked-in');

  const handleGuestClick = (guestId: string) => {
    if (status !== 'playing') return;
    setSelectedGuest(selectedGuestId === guestId ? null : guestId);
  };

  const handleApproveExtend = (e: React.MouseEvent, guestId: string) => {
    e.stopPropagation();
    approveExtend(guestId);
  };

  const handleRejectExtend = (e: React.MouseEvent, guestId: string) => {
    e.stopPropagation();
    rejectExtend(guestId);
  };

  const getWaitTime = (guest: typeof guests[0]) => {
    if (guest.arrivalTime < currentTime && guest.status === 'waiting') {
      return currentTime - guest.arrivalTime;
    }
    return 0;
  };

  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <span className="text-2xl">👥</span> 客人队列
      </h3>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-gray-300">等待入住 ({waitingGuests.length})</span>
        </div>

        {waitingGuests.length === 0 ? (
          <div className="text-gray-500 text-sm py-4 text-center">暂无等待的客人</div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {waitingGuests.map((guest) => {
              const waitTime = getWaitTime(guest);
              const isSelected = selectedGuestId === guest.id;
              const isUrgent = waitTime > 5;

              return (
                <div
                  key={guest.id}
                  onClick={() => handleGuestClick(guest.id)}
                  className={`
                    p-3 rounded-lg cursor-pointer transition-all duration-200
                    ${isSelected ? 'bg-blue-600/30 border-2 border-blue-500' : 'bg-gray-700/50 hover:bg-gray-700'}
                    ${isUrgent ? 'border-l-4 border-red-500' : ''}
                    ${status !== 'playing' ? 'cursor-not-allowed opacity-70' : ''}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{guest.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{guest.name}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        预计 {formatTime(guest.arrivalTime)} 到达
                      </div>
                    </div>
                    {isSelected && (
                      <div className="text-xs bg-blue-500 text-white px-2 py-1 rounded">已选中</div>
                    )}
                  </div>

                  {waitTime > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-xs ${isUrgent ? 'text-red-400' : 'text-yellow-400'}`}>
                        已等待 {waitTime} 分钟
                      </span>
                    </div>
                  )}

                  {guest.specialRequest && (
                    <div className="mt-2 text-xs text-purple-400">⚠️ {guest.specialRequest}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-gray-300">已入住 ({checkedInGuests.length})</span>
        </div>

        {checkedInGuests.length === 0 ? (
          <div className="text-gray-500 text-sm py-4 text-center">暂无入住的客人</div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {checkedInGuests.map((guest) => (
              <div
                key={guest.id}
                className="p-3 rounded-lg bg-blue-900/30 border border-blue-700/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{guest.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">{guest.name}</div>
                    <div className="text-xs text-gray-400">
                      房间: {guests.find((g) => g.id === guest.id)?.roomId || 'N/A'} | 预计离开: {formatTime(guest.departureTime)}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    满意度: {guest.satisfaction}%
                  </div>
                </div>

                {guest.hasExtendRequest && (
                  <div className="mt-3 p-2 bg-purple-900/50 rounded-lg">
                    <div className="text-xs text-purple-300 mb-2">🔄 申请续住 {guest.extendNights || 5} 晚</div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => handleApproveExtend(e, guest.id)}
                        disabled={status !== 'playing'}
                        className="flex-1 py-1 px-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded text-xs text-white transition-colors"
                      >
                        同意
                      </button>
                      <button
                        onClick={(e) => handleRejectExtend(e, guest.id)}
                        disabled={status !== 'playing'}
                        className="flex-1 py-1 px-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded text-xs text-white transition-colors"
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedGuestId && (
        <div className="mt-4 p-3 bg-blue-600/20 border border-blue-500/50 rounded-lg">
          <div className="text-sm text-blue-300">💡 点击空房为选中的客人分配房间</div>
        </div>
      )}
    </div>
  );
}
