import { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { BookingType, BookingStatus } from '../types';
import type { Booking, TeamBooking, IndividualBooking, PrivateBooking } from '../types';
import { getBookingTypeName } from '../utils';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  laneId?: string;
  timeSlotId?: string;
  existingBooking?: Booking;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  laneId,
  timeSlotId,
  existingBooking,
}) => {
  const { state, dispatch } = useApp();
  const [formData, setFormData] = useState<Partial<Booking>>({
    type: BookingType.TEAM,
    status: BookingStatus.CONFIRMED,
  });

  useEffect(() => {
    if (existingBooking) {
      setFormData(existingBooking);
    } else if (laneId && timeSlotId) {
      setFormData({
        type: BookingType.TEAM,
        status: BookingStatus.CONFIRMED,
        laneId,
        timeSlotId,
      });
    }
  }, [existingBooking, laneId, timeSlotId, isOpen]);

  if (!isOpen) return null;

  const lane = state.lanes.find((l) => l.id === formData.laneId);
  const timeSlot = state.timeSlots.find((t) => t.id === formData.timeSlotId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.laneId || !formData.timeSlotId) {
      alert('请选择泳道和时段');
      return;
    }

    const baseBooking = {
      laneId: formData.laneId!,
      timeSlotId: formData.timeSlotId!,
      type: formData.type!,
      status: formData.status!,
    };

    let bookingData: Booking;

    if (formData.type === BookingType.TEAM) {
      const teamBooking = formData as Partial<TeamBooking>;
      if (!teamBooking.teamName || !teamBooking.coachName || !teamBooking.teamSize) {
        alert('请填写训练队名称、教练和队员人数');
        return;
      }
      bookingData = {
        ...baseBooking,
        type: BookingType.TEAM,
        teamName: teamBooking.teamName,
        coachName: teamBooking.coachName,
        teamSize: teamBooking.teamSize,
        description: teamBooking.description,
      } as TeamBooking;
    } else if (formData.type === BookingType.INDIVIDUAL) {
      const individualBooking = formData as Partial<IndividualBooking>;
      if (!individualBooking.customerName || !individualBooking.phone) {
        alert('请填写客户姓名和电话');
        return;
      }
      bookingData = {
        ...baseBooking,
        type: BookingType.INDIVIDUAL,
        customerName: individualBooking.customerName,
        phone: individualBooking.phone,
        swimmerLevel: individualBooking.swimmerLevel || 'intermediate',
      } as IndividualBooking;
    } else {
      const privateBooking = formData as Partial<PrivateBooking>;
      if (!privateBooking.customerName || !privateBooking.coachName || !privateBooking.phone) {
        alert('请填写客户姓名、教练和电话');
        return;
      }
      bookingData = {
        ...baseBooking,
        type: BookingType.PRIVATE,
        customerName: privateBooking.customerName,
        coachName: privateBooking.coachName,
        phone: privateBooking.phone,
        sessionGoal: privateBooking.sessionGoal,
      } as PrivateBooking;
    }

    if (existingBooking) {
      dispatch({
        type: 'UPDATE_BOOKING',
        payload: { id: existingBooking.id, updates: bookingData },
      });
    } else {
      dispatch({ type: 'ADD_BOOKING', payload: bookingData });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">
            {existingBooking ? '编辑预约' : '新增预约'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                泳道 *
              </label>
              <select
                value={formData.laneId || ''}
                onChange={(e) => setFormData({ ...formData, laneId: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">请选择泳道</option>
                {state.lanes
                  .filter((l) => l.isActive)
                  .map((lane) => (
                    <option key={lane.id} value={lane.id}>
                      {lane.name} ({lane.length}米)
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                时段 *
              </label>
              <select
                value={formData.timeSlotId || ''}
                onChange={(e) => setFormData({ ...formData, timeSlotId: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">请选择时段</option>
                {state.timeSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.startTime} - {slot.endTime}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {lane && timeSlot && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-800">
                <strong>位置信息：</strong> {lane.name} ({lane.length}米) | {timeSlot.startTime} - {timeSlot.endTime}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                预约类型 *
              </label>
              <div className="flex gap-2">
                {[BookingType.TEAM, BookingType.INDIVIDUAL, BookingType.PRIVATE].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, type })}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      formData.type === type
                        ? type === BookingType.TEAM
                          ? 'bg-blue-500 text-white'
                          : type === BookingType.INDIVIDUAL
                          ? 'bg-green-500 text-white'
                          : 'bg-purple-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {getBookingTypeName(type)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                状态 *
              </label>
              <select
                value={formData.status || BookingStatus.CONFIRMED}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as BookingStatus })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={BookingStatus.CONFIRMED}>已确认</option>
                <option value={BookingStatus.PENDING}>待复核</option>
                <option value={BookingStatus.CONFLICT}>有冲突</option>
                <option value={BookingStatus.CANCELLED}>已取消</option>
              </select>
            </div>
          </div>

          {formData.type === BookingType.TEAM && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-800">训练队信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    队伍名称 *
                  </label>
                  <input
                    type="text"
                    value={(formData as Partial<TeamBooking>).teamName || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, teamName: e.target.value } as Partial<Booking>)
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="例如：市体校一队"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    教练姓名 *
                  </label>
                  <input
                    type="text"
                    value={(formData as Partial<TeamBooking>).coachName || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, coachName: e.target.value } as Partial<Booking>)
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="例如：李教练"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    队员人数 *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={(formData as Partial<TeamBooking>).teamSize || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        teamSize: parseInt(e.target.value) || 0,
                      } as Partial<Booking>)
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    训练说明
                  </label>
                  <input
                    type="text"
                    value={(formData as Partial<TeamBooking>).description || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value } as Partial<Booking>)
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="例如：赛前强化训练"
                  />
                </div>
              </div>
            </div>
          )}

          {formData.type === BookingType.INDIVIDUAL && (
            <div className="space-y-4 p-4 bg-green-50 rounded-lg">
              <h3 className="font-medium text-green-800">散客信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    客户姓名 *
                  </label>
                  <input
                    type="text"
                    value={(formData as Partial<IndividualBooking>).customerName || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, customerName: e.target.value } as Partial<Booking>)
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="例如：张三"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    联系电话 *
                  </label>
                  <input
                    type="tel"
                    value={(formData as Partial<IndividualBooking>).phone || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value } as Partial<Booking>)
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="例如：13800138001"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  游泳水平
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'beginner', label: '初级' },
                    { value: 'intermediate', label: '中级' },
                    { value: 'advanced', label: '高级' },
                  ].map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          swimmerLevel: level.value,
                        } as Partial<Booking>)
                      }
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        (formData as Partial<IndividualBooking>).swimmerLevel === level.value
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {formData.type === BookingType.PRIVATE && (
            <div className="space-y-4 p-4 bg-purple-50 rounded-lg">
              <h3 className="font-medium text-purple-800">私教课信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    客户姓名 *
                  </label>
                  <input
                    type="text"
                    value={(formData as Partial<PrivateBooking>).customerName || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, customerName: e.target.value } as Partial<Booking>)
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="例如：李四"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    教练姓名 *
                  </label>
                  <input
                    type="text"
                    value={(formData as Partial<PrivateBooking>).coachName || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, coachName: e.target.value } as Partial<Booking>)
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="例如：王教练"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    联系电话 *
                  </label>
                  <input
                    type="tel"
                    value={(formData as Partial<PrivateBooking>).phone || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value } as Partial<Booking>)
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="例如：13800138002"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    课程目标
                  </label>
                  <input
                    type="text"
                    value={(formData as Partial<PrivateBooking>).sessionGoal || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, sessionGoal: e.target.value } as Partial<Booking>)
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="例如：自由泳技术提升"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              {existingBooking ? '保存修改' : '创建预约'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
