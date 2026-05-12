'use client';

import { useEffect, useState } from 'react';
import { Rental } from '@/types';
import { store } from '@/lib/store';
import { formatDate, getStatusColor } from '@/lib/utils';

export default function CalendarPage() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);

  useEffect(() => {
    setRentals(store.getRentals());
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const days = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    days.push(day);
  }

  const getRentalsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return rentals.filter(rental => {
      const isActive = !['cancelled', 'blocked'].includes(rental.status);
      const isInRange = dateStr >= rental.startDate && dateStr <= rental.endDate;
      return isActive && isInRange;
    });
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const today = () => {
    setCurrentDate(new Date());
  };

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">📅 档期日历</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            ◀ 上月
          </button>
          <button
            onClick={today}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            今天
          </button>
          <button
            onClick={nextMonth}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            下月 ▶
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">
          {year}年{month + 1}月
        </h2>
        
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day, i) => (
            <div
              key={i}
              className="text-center py-2 font-medium text-gray-600 bg-gray-50 rounded-lg"
            >
              {day}
            </div>
          ))}
          
          {days.map((day, i) => {
            const dayRentals = getRentalsForDate(day);
            const isCurrentMonth = day.getMonth() === month;
            const isToday = day.toISOString().split('T')[0] === todayStr;
            
            return (
              <div
                key={i}
                className={`min-h-24 p-2 rounded-lg border ${
                  isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                } ${isToday ? 'border-blue-500 border-2' : 'border-gray-200'}`}
              >
                <div className={`text-sm font-medium mb-1 ${
                  isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                } ${isToday ? 'text-blue-600' : ''}`}>
                  {day.getDate()}
                </div>
                <div className="space-y-1">
                  {dayRentals.slice(0, 3).map((rental) => (
                    <div
                      key={rental.id}
                      onClick={() => setSelectedRental(rental)}
                      className={`text-xs px-2 py-1 rounded truncate cursor-pointer ${getStatusColor(rental.status)}`}
                      title={rental.crewName}
                    >
                      {rental.crewName.length > 6 ? rental.crewName.slice(0, 6) + '...' : rental.crewName}
                    </div>
                  ))}
                  {dayRentals.length > 3 && (
                    <div className="text-xs text-gray-500 px-2">
                      +{dayRentals.length - 3} 更多
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">图例说明</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { status: 'pending', label: '待处理' },
            { status: 'confirmed', label: '已确认' },
            { status: 'picked_up', label: '已取走' },
            { status: 'returned', label: '已归还' },
            { status: 'cleaning', label: '清洁中' },
            { status: 'completed', label: '已完成' },
            { status: 'damaged', label: '待赔付' },
          ].map((item) => (
            <div key={item.status} className="flex items-center gap-2">
              <span className={`w-4 h-4 rounded ${getStatusColor(item.status as any)}`}></span>
              <span className="text-sm text-gray-700">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {selectedRental && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">租借详情</h2>
              <button
                onClick={() => setSelectedRental(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">拍摄组</p>
                <p className="font-semibold text-gray-900">{selectedRental.crewName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">档期</p>
                <p className="font-medium text-gray-900">
                  {formatDate(selectedRental.startDate)} - {formatDate(selectedRental.endDate)}
                </p>
                <p className="text-sm text-gray-500">共 {selectedRental.totalDays} 天</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">道具</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedRental.items.map((item, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      {item.propName} × {item.quantity}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">租金</p>
                  <p className="font-bold text-blue-600">{selectedRental.subtotal} 元</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">押金</p>
                  <p className="font-bold text-orange-600">{selectedRental.totalDeposit} 元</p>
                </div>
              </div>
              {selectedRental.notes && (
                <div>
                  <p className="text-sm text-gray-500">备注</p>
                  <p className="text-gray-700">{selectedRental.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
