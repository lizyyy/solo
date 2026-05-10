import React, { useState, useEffect } from 'react';

function CreateTicketModal({ onClose, onCreated }) {
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({
    order_id: '',
    ticket_type: 'damage',
    priority: 'medium',
    title: '',
    description: '',
    assigned_to: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/orders')
      .then(r => r.json())
      .then(setOrders);
  }, []);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.order_id || !form.title) return;
    
    setSaving(true);
    try {
      await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Create New Support Ticket</div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Order</label>
              <select 
                name="order_id"
                className="form-select"
                value={form.order_id}
                onChange={handleChange}
                required
              >
                <option value="">Select an order...</option>
                {orders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.id} - {o.customer_name} (${o.total_amount?.toFixed(2) || 0})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Ticket Type</label>
              <select 
                name="ticket_type"
                className="form-select"
                value={form.ticket_type}
                onChange={handleChange}
              >
                <option value="damage">Damage</option>
                <option value="missing_parts">Missing Parts</option>
                <option value="warranty">Warranty</option>
                <option value="return">Return</option>
                <option value="shipping">Shipping Issue</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Priority</label>
              <select 
                name="priority"
                className="form-select"
                value={form.priority}
                onChange={handleChange}
              >
                <option value="critical">Critical (4h SLA)</option>
                <option value="high">High (24h SLA)</option>
                <option value="medium">Medium (48h SLA)</option>
                <option value="low">Low (72h SLA)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Title</label>
              <input 
                type="text"
                name="title"
                className="form-input"
                value={form.title}
                onChange={handleChange}
                placeholder="Brief description of the issue"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea 
                name="description"
                className="form-textarea"
                value={form.description}
                onChange={handleChange}
                placeholder="Detailed description of the customer's issue..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Assign To</label>
              <select 
                name="assigned_to"
                className="form-select"
                value={form.assigned_to}
                onChange={handleChange}
              >
                <option value="">Unassigned</option>
                <option value="Agent Sarah">Agent Sarah</option>
                <option value="Agent Mike">Agent Mike</option>
                <option value="Agent Lisa">Agent Lisa</option>
                <option value="Agent Tom">Agent Tom</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateTicketModal;
