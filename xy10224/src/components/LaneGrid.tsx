import { useDroppable } from '@dnd-kit/core';
import { useApp } from '../AppContext';
import { BookingCard } from './BookingCard';
import type { Booking } from '../types';

interface DroppableCellProps {
  laneId: string;
  timeSlotId: string;
  bookings: Booking[];
  hasConflict: boolean;
  onClick: () => void;
  onEdit: (booking: Booking) => void;
  onDelete: (bookingId: string) => void;
}

const DroppableCell: React.FC<DroppableCellProps> = ({
  laneId,
  timeSlotId,
  bookings,
  hasConflict,
  onClick,
  onEdit,
  onDelete,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `${laneId}-${timeSlotId}`,
    data: { laneId, timeSlotId },
  });

  const getBookingConflictStatus = (_bookingId: string) => {
    return hasConflict;
  };

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`
        min-h-[120px] p-2 border border-gray-200 rounded transition-all
        ${isOver ? 'bg-blue-50 border-blue-400 border-2' : 'bg-white hover:bg-gray-50'}
        ${hasConflict ? 'bg-red-50' : ''}
      `}
    >
      <div className="flex flex-col gap-2">
        {bookings.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            <span>点击添加预约</span>
          </div>
        ) : (
          bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onClick={() => onEdit(booking)}
              onDelete={() => onDelete(booking.id)}
              hasConflict={getBookingConflictStatus(booking.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

interface LaneGridProps {
  onAddBooking: (laneId: string, timeSlotId: string) => void;
  onEditBooking: (booking: Booking) => void;
}

export const LaneGrid: React.FC<LaneGridProps> = ({ onAddBooking, onEditBooking }) => {
  const { state, dispatch } = useApp();

  const getBookingsForCell = (laneId: string, timeSlotId: string) => {
    return state.bookings.filter(
      (b) => b.laneId === laneId && b.timeSlotId === timeSlotId
    );
  };

  const hasCellConflict = (laneId: string, timeSlotId: string) => {
    return state.conflicts.some(
      (c) => c.laneId === laneId && c.timeSlotId === timeSlotId
    );
  };

  const handleDeleteBooking = (bookingId: string) => {
    if (confirm('确定要删除这个预约吗？')) {
      dispatch({ type: 'DELETE_BOOKING', payload: bookingId });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
              <th className="p-4 text-left min-w-[150px] sticky left-0 z-10 bg-gradient-to-r from-blue-500 to-cyan-500">
                泳道 \ 时段
              </th>
              {state.timeSlots.map((slot) => (
                <th
                  key={slot.id}
                  className="p-4 text-center min-w-[180px] whitespace-nowrap"
                >
                  <div className="font-bold">{slot.startTime} - {slot.endTime}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.lanes.map((lane) => (
              <tr key={lane.id} className="hover:bg-gray-50">
                <td className="p-4 min-w-[150px] sticky left-0 z-10 bg-white border-r border-gray-200">
                  <div className="font-bold text-lg">{lane.name}</div>
                  <div className="text-sm text-gray-500">
                    长度: {lane.length}米
                    {lane.length === 25 ? ' (短道)' : ' (长道)'}
                  </div>
                  <div className={`text-xs mt-1 ${lane.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    {lane.isActive ? '● 可用' : '● 停用'}
                  </div>
                </td>
                {state.timeSlots.map((slot) => (
                  <td key={slot.id} className="p-2">
                    <DroppableCell
                      laneId={lane.id}
                      timeSlotId={slot.id}
                      bookings={getBookingsForCell(lane.id, slot.id)}
                      hasConflict={hasCellConflict(lane.id, slot.id)}
                      onClick={() => onAddBooking(lane.id, slot.id)}
                      onEdit={onEditBooking}
                      onDelete={handleDeleteBooking}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
