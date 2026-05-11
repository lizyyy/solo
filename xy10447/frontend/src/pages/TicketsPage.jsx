import React, { useState, useEffect } from 'react';

export default function TicketsPage() {
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [tickets, setTickets] = useState([]);

  const loadSchedules = async () => {
    const res = await fetch('/api/schedules');
    const data = await res.json();
    setSchedules(data);
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadTickets = async (schedule) => {
    setSelectedSchedule(schedule);
    const res = await fetch(`/api/schedules/${schedule.id}/tickets`);
    const data = await res.json();
    setTickets(data);
  };

  const formatDateTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { 
      month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  const statusLabels = {
    sold: { label: '已售', class: 'badge-processing' },
    exchanged: { label: '已换厅', class: 'badge-success' },
    refunded: { label: '已退票', class: 'badge-danger' }
  };

  return (
    <div>
      <h2 className="page-title">售票记录</h2>

      <div className="card">
        <h3>选择场次查看售票</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>影片</th>
                <th>影厅</th>
                <th>时间</th>
                <th>已售票数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(schedule => (
                <tr key={schedule.id}>
                  <td>{schedule.movie_name}</td>
                  <td>{schedule.hall_name}</td>
                  <td>{formatDateTime(schedule.start_time)}</td>
                  <td>{schedule.sold_count}</td>
                  <td>
                    <button 
                      className={`btn btn-small ${selectedSchedule?.id === schedule.id ? 'btn-success' : 'btn-secondary'}`}
                      onClick={() => loadTickets(schedule)}
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSchedule && (
        <div className="card">
          <h3>
            {selectedSchedule.movie_name} - {selectedSchedule.hall_name}
            <span style={{ marginLeft: '1rem', fontSize: '0.875rem', color: '#718096' }}>
              {formatDateTime(selectedSchedule.start_time)}
            </span>
          </h3>
          {tickets.length === 0 ? (
            <div className="empty-state">
              <span style={{ fontSize: '3rem' }}>🎟️</span>
              <p>该场次暂无售票记录</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>订单号</th>
                    <th>座位</th>
                    <th>购票人</th>
                    <th>电话</th>
                    <th>票价</th>
                    <th>实付</th>
                    <th>状态</th>
                    <th>购票时间</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(ticket => {
                    const status = statusLabels[ticket.status] || { label: ticket.status, class: 'badge-pending' };
                    return (
                      <tr key={ticket.id}>
                        <td>{ticket.order_no}</td>
                        <td>
                          {ticket.seat_code}
                          {ticket.is_vip && <span className="badge badge-pending" style={{ marginLeft: '0.5rem' }}>VIP</span>}
                        </td>
                        <td>{ticket.customer_name || '-'}</td>
                        <td>{ticket.customer_phone || '-'}</td>
                        <td>¥{ticket.price}</td>
                        <td>¥{ticket.paid_price}</td>
                        <td>
                          <span className={`badge ${status.class}`}>{status.label}</span>
                        </td>
                        <td>{ticket.sold_at ? formatDateTime(ticket.sold_at) : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
