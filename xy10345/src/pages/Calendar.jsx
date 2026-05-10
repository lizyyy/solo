import React, { useState, useEffect } from 'react';
import { propertyApi, passwordApi, orderApi } from '../services/api';
import { 
  getDaysInMonth, 
  getFirstDayOfMonth, 
  formatDate, 
  formatDateTime,
  formatDateForInput,
  addDays,
  getPropertyStatusBadge
} from '../utils/helpers';

function Calendar() {
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [selectedDates, setSelectedDates] = useState({ start: null, end: null });
  const [formData, setFormData] = useState({
    guestName: '',
    guestPhone: '',
    checkIn: '',
    checkOut: ''
  });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      loadCalendar();
    }
  }, [selectedProperty, currentDate]);

  const loadProperties = async () => {
    try {
      const res = await propertyApi.getAll();
      setProperties(res.data);
    } catch (error) {
      console.error('加载房源失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendar = async () => {
    try {
      const res = await passwordApi.getCalendar(selectedProperty.id);
      setCalendarEvents(res.data.events);
    } catch (error) {
      console.error('加载日历失败:', error);
    }
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    const prevMonthDays = getDaysInMonth(year, month - 1);
    
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        day: prevMonthDays - i,
        isOtherMonth: true,
        date: new Date(year, month - 1, prevMonthDays - i)
      });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const events = calendarEvents.filter(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return date >= new Date(eventStart.setHours(0,0,0,0)) && 
               date <= new Date(eventEnd.setHours(23,59,59,999));
      });
      
      days.push({
        day: i,
        isOtherMonth: false,
        isToday: date.toDateString() === new Date().toDateString(),
        date,
        events
      });
    }
    
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        isOtherMonth: true,
        date: new Date(year, month + 1, i)
      });
    }

    return days;
  };

  const handleDateClick = (dayInfo) => {
    if (dayInfo.isOtherMonth) return;
    if (!selectedProperty) return;

    if (!selectedDates.start || (selectedDates.start && selectedDates.end)) {
      setSelectedDates({ start: dayInfo.date, end: null });
      setStep(2);
    } else {
      if (dayInfo.date < selectedDates.start) {
        setSelectedDates({ start: dayInfo.date, end: selectedDates.start });
      } else {
        setSelectedDates({ ...selectedDates, end: dayInfo.date });
      }
      setStep(3);
    }
  };

  const handleCreateOrder = async () => {
    if (!selectedDates.start || !selectedDates.end) {
      setMessage({ type: 'error', text: '请先选择入住和退房日期' });
      return;
    }

    const checkIn = new Date(selectedDates.start);
    checkIn.setHours(14, 0, 0, 0);
    const checkOut = new Date(selectedDates.end);
    checkOut.setHours(12, 0, 0, 0);

    try {
      const res = await orderApi.create({
        propertyId: selectedProperty.id,
        guestName: formData.guestName || '测试客人',
        guestPhone: formData.guestPhone || '13800000000',
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString()
      });

      if (res.data.success) {
        setMessage({ 
          type: 'success', 
          text: `订单创建成功！已自动生成密码：${res.data.password.code}` 
        });
        setShowCreateOrderModal(false);
        setSelectedDates({ start: null, end: null });
        setStep(1);
        loadCalendar();
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || '创建订单失败，请检查日期是否与现有订单冲突' 
      });
    }
  };

  const isDateSelected = (date) => {
    if (!selectedDates.start) return false;
    if (selectedDates.start.toDateString() === date.toDateString()) return true;
    if (selectedDates.end && selectedDates.end.toDateString() === date.toDateString()) return true;
    if (selectedDates.start && selectedDates.end) {
      return date > selectedDates.start && date < selectedDates.end;
    }
    return false;
  };

  const days = renderCalendar();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>📅 房源日历</h2>
      </div>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
          {message.text}
        </div>
      )}

      <div className="card">
        <h3 className="card-title">步骤说明</h3>
        <div className="step-indicator">
          <div className={`step ${step >= 1 ? (step > 1 ? 'completed' : 'active') : ''}`}>
            <div className="step-number">1</div>
            <div className="step-label">选择房源</div>
          </div>
          <div className={`step ${step >= 2 ? (step > 2 ? 'completed' : 'active') : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">选择入住日期</div>
          </div>
          <div className={`step ${step >= 3 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <div className="step-label">选择退房日期</div>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <div className="step-label">生成密码</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        <div>
          <div className="card">
            <h3 className="card-title">选择房源</h3>
            {properties.map(property => {
              const statusBadge = getPropertyStatusBadge(property.status);
              return (
                <div
                  key={property.id}
                  className={`property-card ${selectedProperty?.id === property.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedProperty(property);
                    setSelectedDates({ start: null, end: null });
                    setStep(2);
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3>{property.name}</h3>
                    <span className={`badge ${statusBadge.class}`}>{statusBadge.label}</span>
                  </div>
                  <p className="text-sm text-muted">{property.address}</p>
                </div>
              );
            })}
          </div>

          {selectedDates.start && (
            <div className="card">
              <h3 className="card-title">已选择的日期</h3>
              <p><strong>入住：</strong>{formatDate(selectedDates.start)}</p>
              {selectedDates.end && (
                <p><strong>退房：</strong>{formatDate(selectedDates.end)}</p>
              )}
              {selectedDates.end && (
                <div className="mt-4">
                  <button 
                    className="btn btn-primary"
                    onClick={() => setShowCreateOrderModal(true)}
                  >
                    ➕ 创建订单并生成密码
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          {!selectedProperty ? (
            <div className="select-property-hint">
              <p>👈 请先从左侧选择一个房源</p>
            </div>
          ) : (
            <div className="calendar-container">
              <div className="calendar-header">
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                >
                  ◀ 上月
                </button>
                <h3>
                  {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月
                </h3>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                >
                  下月 ▶
                </button>
              </div>

              <div className="calendar-week">
                {weekDays.map(day => (
                  <div key={day} className="calendar-day-header">{day}</div>
                ))}
              </div>

              <div className="calendar-days">
                {days.map((dayInfo, index) => (
                  <div
                    key={index}
                    className={`calendar-day ${dayInfo.isOtherMonth ? 'other-month' : ''} ${dayInfo.isToday ? 'today' : ''} ${isDateSelected(dayInfo.date) ? 'selected' : ''}`}
                    onClick={() => handleDateClick(dayInfo)}
                  >
                    <div className="calendar-day-number">{dayInfo.day}</div>
                    {!dayInfo.isOtherMonth && dayInfo.events && dayInfo.events.slice(0, 2).map(event => (
                      <div 
                        key={event.id} 
                        className={`calendar-event ${event.type}`}
                        title={`${event.title}\n${formatDateTime(event.start)} - ${formatDateTime(event.end)}`}
                      >
                        {event.title}
                      </div>
                    ))}
                    {!dayInfo.isOtherMonth && dayInfo.events && dayInfo.events.length > 2 && (
                      <div className="text-sm text-muted">+{dayInfo.events.length - 2} 更多</div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 explanation-box">
                <h4>📝 使用说明</h4>
                <ul>
                  <li>点击日期选择<strong>入住日期</strong>（步骤2）</li>
                  <li>再点击另一个日期选择<strong>退房日期</strong>（步骤3）</li>
                  <li>系统会自动检查日期是否与现有订单冲突</li>
                  <li>创建订单后会<strong>自动生成入住密码</strong></li>
                  <li>蓝色条表示订单，绿色条表示密码有效期</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateOrderModal && (
        <div className="modal-overlay" onClick={() => setShowCreateOrderModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>确认订单信息</h3>
              <button className="modal-close" onClick={() => setShowCreateOrderModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="explanation-box">
                <h4>⚠️ 系统将自动执行以下操作</h4>
                <ul>
                  <li>检查所选日期是否与现有密码时间重叠</li>
                  <li>创建订单记录</li>
                  <li>生成6位随机入住密码</li>
                  <li>密码有效期：入住日14:00 - 退房日12:00</li>
                </ul>
              </div>

              <div className="mt-4">
                <div className="form-group">
                  <label className="form-label">房源</label>
                  <div className="form-input" style={{ backgroundColor: '#f5f7fa' }}>
                    {selectedProperty?.name}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">入住时间</label>
                  <div className="form-input" style={{ backgroundColor: '#f5f7fa' }}>
                    {formatDate(selectedDates.start)} 14:00
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">退房时间</label>
                  <div className="form-input" style={{ backgroundColor: '#f5f7fa' }}>
                    {formatDate(selectedDates.end)} 12:00
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">客人姓名</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={formData.guestName}
                    onChange={e => setFormData({ ...formData, guestName: e.target.value })}
                    placeholder="请输入客人姓名"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">联系电话</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={formData.guestPhone}
                    onChange={e => setFormData({ ...formData, guestPhone: e.target.value })}
                    placeholder="请输入联系电话"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowCreateOrderModal(false)}
              >
                取消
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleCreateOrder}
              >
                确认创建并生成密码
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Calendar;
