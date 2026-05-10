import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  formatDate, 
  formatCurrency, 
  getStatusLabel, 
  getPriorityLabel, 
  getRiskLabel,
  getTicketTypeLabel,
  calculateSlaStatus 
} from '../utils';
import CreateTicketModal from '../components/CreateTicketModal';

function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    risk: '',
    search: ''
  });
  const [showCreateModal, setShowCreateModal] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    loadTickets();
  }, [filters]);

  function loadTickets() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.risk) params.append('risk', filters.risk);
    if (filters.search) params.append('search', filters.search);
    
    fetch(`/api/tickets?${params.toString()}`)
      .then(r => r.json())
      .then(setTickets)
      .finally(() => setLoading(false));
  }

  function handleFilterChange(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  function handleTicketCreated() {
    setShowCreateModal(false);
    loadTickets();
  }

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Support Tickets</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + New Ticket
        </button>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label className="filter-label">Status</label>
          <select 
            className="select"
            value={filters.status}
            onChange={e => handleFilterChange('status', e.target.value)}
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting_customer">Waiting Customer</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Priority</label>
          <select 
            className="select"
            value={filters.priority}
            onChange={e => handleFilterChange('priority', e.target.value)}
          >
            <option value="">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Risk</label>
          <select 
            className="select"
            value={filters.risk}
            onChange={e => handleFilterChange('risk', e.target.value)}
          >
            <option value="">All Risk</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Search</label>
          <input 
            type="text"
            className="input"
            placeholder="Search tickets..."
            value={filters.search}
            onChange={e => handleFilterChange('search', e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {tickets.length === 0 ? (
              <div className="empty-state">
                No tickets found matching your filters.
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Priority</th>
                    <th>Risk</th>
                    <th>Status</th>
                    <th>Order Value</th>
                    <th>SLA</th>
                    <th>Messages</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(ticket => {
                    const sla = calculateSlaStatus(ticket.sla_deadline);
                    return (
                      <tr key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)} style={{ cursor: 'pointer' }}>
                        <td>
                          <strong>{ticket.id}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{ticket.title}</div>
                        </td>
                        <td>{ticket.customer_name}</td>
                        <td>{getTicketTypeLabel(ticket.ticket_type)}</td>
                        <td>
                          <span className={`badge ${ticket.priority}`}>
                            {getPriorityLabel(ticket.priority)}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${ticket.risk_level}_risk`}>
                            {getRiskLabel(ticket.risk_level)}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${ticket.status}`}>
                            {getStatusLabel(ticket.status)}
                          </span>
                        </td>
                        <td>{formatCurrency(ticket.total_amount)}</td>
                        <td>
                          <div className="sla-indicator">
                            <span className={`sla-dot ${sla.className}`}></span>
                            <span style={{ fontSize: '0.75rem' }}>{sla.label}</span>
                          </div>
                        </td>
                        <td>{ticket.message_count}</td>
                        <td>{formatDate(ticket.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateTicketModal 
          onClose={() => setShowCreateModal(false)}
          onCreated={handleTicketCreated}
        />
      )}
    </div>
  );
}

export default TicketsPage;
