import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { CalendarData, Nanny } from '../types';

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dateInRange(date: Date, startDate: string, endDate: string): boolean {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  return date >= start && date <= end;
}

export default function Calendar() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [nannies, setNannies] = useState<Nanny[]>([]);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    loadData();
  }, [currentDate]);

  async function loadData() {
    setLoading(true);
    try {
      const [calendarRes, nanniesRes] = await Promise.all([
        api.calendar.get(year, month + 1),
        api.nannies.getAll(),
      ]);
      setCalendarData(calendarRes.data);
      setNannies(nanniesRes.data);
    } catch (error) {
      console.error('加载日历数据失败:', error);
    } finally {
      setLoading(false);
    }
  }

  const getNannyName = (id: number) => {
    const nanny = nannies.find(n => n.id === id);
    return nanny ? nanny.name : `月嫂${id}`;
  };

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();

  const days: { date: Date; isOtherMonth: boolean }[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isOtherMonth: true });
  }

  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isOtherMonth: false });
  }

  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), isOtherMonth: true });
  }

  function goToPrevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function goToNextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>排班日历</h1>
        <p>查看月嫂服务排班、请假和换人情况</p>
      </div>

      <div className="calendar">
        <div className="calendar-header">
          <h3>{year}年 {monthNames[month]}</h3>
          <div className="calendar-nav">
            <button className="btn btn-primary btn-sm" onClick={goToPrevMonth}>上一月</button>
            <button className="btn btn-primary btn-sm" onClick={goToNextMonth}>下一月</button>
          </div>
        </div>

        <div className="calendar-grid">
          {weekdayNames.map(name => (
            <div key={name} className="calendar-weekday">{name}</div>
          ))}
          {days.map(({ date, isOtherMonth }, idx) => {
            const dateStr = date.toISOString().split('T')[0];
            const dayEvents = calendarData ? {
              orders: calendarData.orders.filter(o => dateInRange(date, o.startDate, o.endDate)),
              leaves: calendarData.leaves.filter(l => dateInRange(date, l.startDate, l.endDate)),
              replacements: calendarData.replacements.filter(r => dateInRange(date, r.startDate, r.endDate)),
            } : { orders: [], leaves: [], replacements: [] };

            return (
              <div
                key={idx}
                className={`calendar-day ${isOtherMonth ? 'other-month' : ''}`}
              >
                <div className="day-number">{date.getDate()}</div>
                {dayEvents.orders.map(order => (
                  <div
                    key={`order-${order.id}`}
                    className="calendar-event order"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    {getNannyName(order.nannyId)} 服务
                  </div>
                ))}
                {dayEvents.leaves.map(leave => (
                  <div key={`leave-${leave.id}`} className="calendar-event leave">
                    {getNannyName(leave.nannyId)} 请假
                  </div>
                ))}
                {dayEvents.replacements.map(rep => (
                  <div key={`rep-${rep.id}`} className="calendar-event replacement">
                    {getNannyName(rep.replacementNannyId)} 替班
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="calendar-legend">
          <div className="legend-item">
            <div className="legend-color order"></div>
            <span>服务中</span>
          </div>
          <div className="legend-item">
            <div className="legend-color leave"></div>
            <span>请假</span>
          </div>
          <div className="legend-item">
            <div className="legend-color replacement"></div>
            <span>替班</span>
          </div>
        </div>
      </div>
    </div>
  );
}
