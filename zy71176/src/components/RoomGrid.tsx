import { useGameStore } from '../game/state';
import { getRoomStatusText } from '../game/rules';
import { assignRoom, dispatchCleaner } from '../game/engine';

const statusColors: Record<string, string> = {
  empty: 'bg-room-empty border-room-empty',
  dirty: 'bg-room-dirty border-room-dirty',
  occupied: 'bg-room-occupied border-room-occupied',
  maintenance: 'bg-room-maintenance border-room-maintenance',
  extend: 'bg-room-extend border-room-extend',
};

const statusBgColors: Record<string, string> = {
  empty: 'bg-green-900/50',
  dirty: 'bg-yellow-900/50',
  occupied: 'bg-blue-900/50',
  maintenance: 'bg-red-900/50',
  extend: 'bg-purple-900/50',
};

export function RoomGrid() {
  const rooms = useGameStore((state) => state.rooms);
  const guests = useGameStore((state) => state.guests);
  const cleaners = useGameStore((state) => state.cleaners);
  const selectedGuestId = useGameStore((state) => state.selectedGuestId);
  const selectedRoomId = useGameStore((state) => state.selectedRoomId);
  const setSelectedRoom = useGameStore((state) => state.setSelectedRoom);
  const status = useGameStore((state) => state.status);

  const floors = Array.from(new Set(rooms.map((r) => r.floor))).sort();

  const handleRoomClick = (roomId: number) => {
    if (status !== 'playing') return;

    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    if (selectedGuestId && room.status === 'empty') {
      assignRoom(selectedGuestId, roomId);
      setSelectedRoom(null);
    } else if (room.status === 'dirty') {
      const idleCleaner = cleaners.find((c) => c.status === 'idle');
      if (idleCleaner) {
        dispatchCleaner(idleCleaner.id, roomId);
      }
    } else if (room.status === 'empty' || room.status === 'maintenance') {
      setSelectedRoom(selectedRoomId === roomId ? null : roomId);
    }
  };

  const getRoomGuest = (roomId: number) => {
    return guests.find((g) => g.roomId === roomId);
  };

  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <span className="text-2xl">🏨</span> 客房状态
      </h3>

      <div className="space-y-4">
        {floors.map((floor) => (
          <div key={floor} className="space-y-2">
            <div className="text-sm text-gray-400 font-medium">{floor}楼</div>
            <div className="grid grid-cols-5 gap-2">
              {rooms
                .filter((r) => r.floor === floor)
                .map((room) => {
                  const roomGuest = getRoomGuest(room.id);
                  const isSelected = selectedRoomId === room.id;
                  const canAssign = selectedGuestId && room.status === 'empty';

                  return (
                    <div
                      key={room.id}
                      onClick={() => handleRoomClick(room.id)}
                      className={`
                        relative p-3 rounded-lg border-2 cursor-pointer
                        transition-all duration-200
                        ${statusBgColors[room.status]}
                        ${statusColors[room.status]}
                        ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800' : ''}
                        ${canAssign ? 'animate-pulse hover:scale-105' : 'hover:scale-102'}
                        ${status !== 'playing' ? 'cursor-not-allowed opacity-70' : ''}
                      `}
                    >
                      <div className="text-white font-bold text-sm">
                        {room.number}
                      </div>
                      <div className="text-xs text-gray-300 mt-1">
                        {getRoomStatusText(room.status)}
                      </div>

                      {roomGuest && (
                        <div className="mt-2 text-lg" title={roomGuest.name}>
                          {roomGuest.avatar}
                        </div>
                      )}

                      {room.cleanProgress !== undefined && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 transition-all duration-300"
                              style={{ width: `${room.cleanProgress}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            清洁中 {Math.round(room.cleanProgress)}%
                          </div>
                        </div>
                      )}

                      {room.maintenanceProgress !== undefined && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-500 transition-all duration-300"
                              style={{ width: `${room.maintenanceProgress}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            维修中 {Math.round(room.maintenanceProgress)}%
                          </div>
                        </div>
                      )}

                      {canAssign && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-xs">
                          +
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-room-empty"></span>
          <span className="text-gray-400">空房</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-room-dirty"></span>
          <span className="text-gray-400">脏房</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-room-occupied"></span>
          <span className="text-gray-400">已入住</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-room-maintenance"></span>
          <span className="text-gray-400">维修中</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-room-extend"></span>
          <span className="text-gray-400">续住申请</span>
        </div>
      </div>
    </div>
  );
}
