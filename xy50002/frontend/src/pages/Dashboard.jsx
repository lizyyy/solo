import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, formatCurrency, getStatusLabel, getPriorityLabel } from '../utils';

function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(setDashboard)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading"><div className="spinner"></div></div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="dashboard">
        <div className="alert alert-danger">
          Failed to load dashboard. Please ensure backend is running.
        </div>
      </div>
    );
  }

  const typeColors = {
    damage: '#dc2626',
    missing_parts: '#d97706',
    warranty: '#059669',
    return: '#7c3aed'
  };

  const maxTypeCount = Math.max(...(dashboard.byType || []).map(t => t.count), 1);
  const maxStatusCount = Math.max(...(dashboard.byStatus || []).map(s => s.count), 1);

  return (
    <div className="dashboard">
      <div className="stats-grid">
        <div className="stat-card info">
          <h3>Open Tickets</h3>
          <div className="stat-value">{dashboard.openCount || 0}</div>
        </div>
        <div className="stat-card critical">
          <h3>Critical Priority</h3>
          <div className="stat-value">{dashboard.criticalCount || 0}</div>
        </div>
        <div className="stat-card warning">
          <h3>High Risk Cases</h3>
          <div className="stat-value">{dashboard.highRiskCount || 0}</div>
        </div>
        <div className="stat-card danger">
          <h3>SLA Breaching</h3>
          <div className="stat-value">{dashboard.slaBreachingCount || 0}</div>
        </div>
      </div>

      <div className="chart-container">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Tickets by Type</div>
          </div>
          <div className="card-body">
            <div className="chart-bars" style={{ marginTop: '1.5rem', paddingBottom: '1.5rem' }}>
              {(dashboard.byType || []).map(type => (
                <div 
                  key={type.ticket_type} 
                  className="chart-bar" 
                  style={{ 
                    height: `${(type.count / maxTypeCount) * 100}%`,
                    background: typeColors[type.ticket_type] || '#1e3a5f'
                  }}
                  title={type.ticket_type}
                >
                  <span className="chart-value">{type.count}</span>
                  <span className="chart-label">{type.ticket_type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Tickets by Status</div>
          </div>
          <div className="card-body">
            <div className="chart-bars" style={{ marginTop: '1.5rem', paddingBottom: '1.5rem' }}>
              {(dashboard.byStatus || []).map(status => (
                <div 
                  key={status.status} 
                  className="chart-bar" 
                  style={{ height: `${(status.count / maxStatusCount) * 100}%` }}
                >
                  <span className="chart-value">{status.count}</span>
                  <span className="chart-label">{status.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Recent Tickets</div>
          <Link to="/tickets" className="btn btn-primary btn-sm">
            View All
          </Link>
        </div>
        <div className="card-body">
          <table className="table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Customer</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Order Amount</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard.recentTickets || []).map(ticket => (
                <tr key={ticket.id}>
                  <td>
                    <Link to={`/tickets/${ticket.id}`} style={{ color: '#1e3a5f', textDecoration: 'none' }}>
                      <strong>{ticket.id}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{ticket.title}</div>
                    </Link>
                  </td>
                  <td>{ticket.customer_name}</td>
                  <td>
                    <span className={`badge ${ticket.priority}`}>
                      {getPriorityLabel(ticket.priority)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${ticket.status}`}>
                      {getStatusLabel(ticket.status)}
                    </span>
                  </td>
                  <td>{formatCurrency(ticket.total_amount)}</td>
                  <td>{formatDate(ticket.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="alert alert-info">
        <strong>Quick Start:</strong> Explore the sample tickets to see different scenarios - shipping damage (Emma Johnson), missing parts (Michael Brown), and warranty cases (Sarah Davis).
      </div>
    </div>
  );
}

export default Dashboard;
