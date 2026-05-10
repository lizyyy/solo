import { useDraggable } from '@dnd-kit/core';
import { BookingType, BookingStatus } from '../types';
import type { Booking, TeamBooking, IndividualBooking, PrivateBooking } from '../types';
import {
  getBookingTypeName,
  getBookingStatusName,
  getBookingTypeColor,
  getBookingStatusColor,
} from '../utils';

interface BookingCardProps {
  booking: Booking;
  onClick: () => void;
  onDelete: () => void;
  hasConflict: boolean;
}

export const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  onClick,
  onDelete,
  hasConflict,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: booking.id,
    data: { booking },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const getBookingTitle = () => {
    if (booking.type === BookingType.TEAM) {
      const teamBooking = booking as TeamBooking;
      return teamBooking.teamName;
    } else if (booking.type === BookingType.INDIVIDUAL) {
      const individualBooking = booking as IndividualBooking;
      return individualBooking.customerName;
    } else {
      const privateBooking = booking as PrivateBooking;
      return privateBooking.customerName;
    }
  };

  const getBookingSubtitle = () => {
    if (booking.type === BookingType.TEAM) {
      const teamBooking = booking as TeamBooking;
      return `${teamBooking.coachName} | ${teamBooking.teamSize}人`;
    } else if (booking.type === BookingType.PRIVATE) {
      const privateBooking = booking as PrivateBooking;
      return privateBooking.coachName;
    } else {
      return '散客';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`
        relative p-3 rounded-lg cursor-move shadow-sm transition-all
        ${getBookingTypeColor(booking.type)} text-white
        ${isDragging ? 'opacity-50 scale-105 shadow-lg z-50' : 'hover:shadow-md'}
        ${hasConflict ? 'ring-2 ring-red-400 animate-pulse' : ''}
        ${booking.status === BookingStatus.PENDING ? 'ring-2 ring-yellow-400' : ''}
      `}
    >
      {hasConflict && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
          冲突
        </div>
      )}
      
      {booking.status === BookingStatus.PENDING && (
        <div className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-bold">
          待复核
        </div>
      )}

      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium opacity-80">
          {getBookingTypeName(booking.type)}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${getBookingStatusColor(booking.status)}`}>
          {getBookingStatusName(booking.status)}
        </span>
      </div>

      <div className="font-bold text-sm mb-1 truncate">
        {getBookingTitle()}
      </div>

      <div className="text-xs opacity-90 truncate">
        {getBookingSubtitle()}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full text-white text-xs opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
      >
        ✕
      </button>
    </div>
  );
};
