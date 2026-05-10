import React, { useState, useEffect } from 'react';
import { formatDate, formatCurrency, getStatusLabel } from '../utils';
import CreateOrderModal from '../components/CreateOrderModal';
import ImportOrdersModal from '../components/ImportOrdersModal';

function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [search]);

  function loadOrders() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    fetch(`/api/orders?${params.toString()}`)
      .then(r => r.json())
      .then(setOrders)
      .finally(() => setLoading(false));
  }

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Orders</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowImportModal(true)}
          >
            Import CSV
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            + New Order
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label className="filter-label">Search</label>
          <input 
            type="text"
            className="input"
            placeholder="Search by order ID, customer name, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ minWidth: '300px' }}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {orders.length === 0 ? (
              <div className="empty-state">No orders found.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Order Date</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Tickets</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id}>
                      <td>
                        <strong>{order.id}</strong>
                        {order.notes && (
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{order.notes}</div>
                        )}
                      </td>
                      <td>
                        <div>{order.customer_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {order.customer_email || order.customer_phone || 'N/A'}
                        </div>
                      </td>
                      <td>{formatDate(order.order_date)}</td>
                      <td>{formatCurrency(order.total_amount)}</td>
                      <td>
                        <span className={`badge ${order.status}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td>
                        {order.ticket_count > 0 ? (
                          <span className="badge warning">{order.ticket_count} ticket{order.ticket_count > 1 ? 's' : ''}</span>
                        ) : (
                          <span style={{ color: '#6b7280' }}>0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateOrderModal 
          onClose={() => setShowCreateModal(false)}
          onCreated={loadOrders}
        />
      )}

      {showImportModal && (
        <ImportOrdersModal 
          onClose={() => setShowImportModal(false)}
          onImported={loadOrders}
        />
      )}
    </div>
  );
}

export default OrdersPage;
