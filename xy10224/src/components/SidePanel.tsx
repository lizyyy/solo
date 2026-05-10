import { useApp } from '../AppContext';
import { exportScheduleToCSV, downloadFile, getBookingTypeName } from '../utils';
import { BookingType } from '../types';
import type { TeamBooking, IndividualBooking, PrivateBooking } from '../types';

export const ConflictPanel: React.FC = () => {
  const { state } = useApp();

  const getBookingInfo = (bookingId: string) => {
    const booking = state.bookings.find((b) => b.id === bookingId);
    if (!booking) return null;

    const lane = state.lanes.find((l) => l.id === booking.laneId);
    const timeSlot = state.timeSlots.find((t) => t.id === booking.timeSlotId);

    let title = '';
    if (booking.type === BookingType.TEAM) {
      title = (booking as TeamBooking).teamName;
    } else if (booking.type === BookingType.INDIVIDUAL) {
      title = (booking as IndividualBooking).customerName;
    } else {
      title = (booking as PrivateBooking).customerName;
    }

    return {
      title,
      type: getBookingTypeName(booking.type),
      lane: lane?.name || '未知',
      timeSlot: timeSlot ? `${timeSlot.startTime}-${timeSlot.endTime}` : '未知',
    };
  };

  if (state.conflicts.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center gap-2 text-green-700">
          <span className="text-xl">✅</span>
          <h3 className="font-bold">当前无冲突</h3>
        </div>
        <p className="text-sm text-green-600 mt-2">
          所有预约排布合理，无需处理冲突。
        </p>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-red-700">
          <span className="text-xl">⚠️</span>
          <h3 className="font-bold">冲突检测 ({state.conflicts.length})</h3>
        </div>
      </div>

      <div className="space-y-3">
        {state.conflicts.map((conflict, index) => {
          const booking1 = getBookingInfo(conflict.bookingId1);
          const booking2 = getBookingInfo(conflict.bookingId2);

          return (
            <div
              key={conflict.id}
              className="bg-white border border-red-200 rounded-lg p-3"
            >
              <div className="flex items-center gap-2 text-red-600 font-medium text-sm mb-2">
                冲突 #{index + 1}: {conflict.message}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {booking1 && (
                  <div className="bg-red-100 p-2 rounded">
                    <div className="font-medium">{booking1.title}</div>
                    <div className="text-gray-600">{booking1.type}</div>
                    <div className="text-gray-600">{booking1.lane}</div>
                    <div className="text-gray-600">{booking1.timeSlot}</div>
                  </div>
                )}
                {booking2 && (
                  <div className="bg-red-100 p-2 rounded">
                    <div className="font-medium">{booking2.title}</div>
                    <div className="text-gray-600">{booking2.type}</div>
                    <div className="text-gray-600">{booking2.lane}</div>
                    <div className="text-gray-600">{booking2.timeSlot}</div>
                  </div>
                )}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                提示：请拖拽移动其中一个预约到其他时段或泳道，或删除其中一个预约。
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const HistoryPanel: React.FC = () => {
  const { state } = useApp();

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return '➕';
      case 'update':
        return '✏️';
      case 'delete':
        return '🗑️';
      case 'move':
        return '↔️';
      default:
        return '📝';
    }
  };

  const getActionName = (action: string) => {
    switch (action) {
      case 'create':
        return '创建';
      case 'update':
        return '更新';
      case 'delete':
        return '删除';
      case 'move':
        return '移动';
      default:
        return action;
    }
  };

  const getEntityTypeName = (entityType: string) => {
    switch (entityType) {
      case 'booking':
        return '预约';
      case 'lane':
        return '泳道';
      case 'timeslot':
        return '时段';
      default:
        return entityType;
    }
  };

  if (state.history.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 text-gray-600">
          <span className="text-xl">📜</span>
          <h3 className="font-bold">操作历史</h3>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          暂无操作记录。
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 text-gray-700 mb-4">
        <span className="text-xl">📜</span>
        <h3 className="font-bold">操作历史</h3>
        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
          {state.history.length} 条记录
        </span>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {state.history.map((record) => (
          <div
            key={record.id}
            className="flex items-start gap-2 p-2 bg-white rounded-lg border border-gray-200"
          >
            <span className="text-lg">{getActionIcon(record.action)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">
                  {getActionName(record.action)} {getEntityTypeName(record.entityType)}
                </span>
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {record.description}
              </div>
              {record.oldValue && record.newValue && (
                <div className="text-xs text-gray-500 mt-1">
                  <span className="text-red-500">{record.oldValue}</span>
                  <span className="mx-1">→</span>
                  <span className="text-green-600">{record.newValue}</span>
                </div>
              )}
              <div className="text-xs text-gray-400 mt-1">
                {record.timestamp}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ExportPanel: React.FC = () => {
  const { state } = useApp();

  const handleExportCSV = () => {
    const csvContent = exportScheduleToCSV(state.bookings, state.lanes, state.timeSlots);
    const filename = `游泳训练日程_${state.selectedDate}.csv`;
    downloadFile(csvContent, filename);
  };

  const handleExportJSON = () => {
    const jsonContent = JSON.stringify(
      {
        date: state.selectedDate,
        lanes: state.lanes,
        timeSlots: state.timeSlots,
        bookings: state.bookings,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
    const filename = `游泳训练日程_${state.selectedDate}.json`;
    downloadFile(jsonContent, filename, 'application/json');
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <div className="flex items-center gap-2 text-blue-700 mb-4">
        <span className="text-xl">📤</span>
        <h3 className="font-bold">日程导出</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleExportCSV}
          disabled={state.bookings.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          📊 导出 CSV
        </button>
        <button
          onClick={handleExportJSON}
          disabled={state.bookings.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          📋 导出 JSON
        </button>
      </div>

      <div className="mt-4 p-3 bg-white rounded-lg border border-blue-100">
        <div className="text-sm text-blue-800">
          <div className="font-medium mb-1">当前数据统计</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>泳道数量: {state.lanes.length}</div>
            <div>时段数量: {state.timeSlots.length}</div>
            <div>预约总数: {state.bookings.length}</div>
            <div>冲突数量: {state.conflicts.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
