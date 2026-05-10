import React, { useState } from 'react';

function CreateOrderModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    order_date: new Date().toISOString().slice(0, 10),
    total_amount: '',
    shipping_address: '',
    status: 'pending',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.customer_name || !form.total_amount) return;
    
    setSaving(true);
    try {
      const payload = {
        ...form,
        total_amount: parseFloat(form.total_amount)
      };
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
          <div className="modal-title">Create New Order</div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Order ID (optional)</label>
              <input 
                type="text"
                name="id"
                className="form-input"
                value={form.id}
                onChange={handleChange}
                placeholder="Auto-generated if empty"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Customer Name *</label>
              <input 
                type="text"
                name="customer_name"
                className="form-input"
                value={form.customer_name}
                onChange={handleChange}
                placeholder="John Smith"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input 
                type="email"
                name="customer_email"
                className="form-input"
                value={form.customer_email}
                onChange={handleChange}
                placeholder="customer@example.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone</label>
              <input 
                type="tel"
                name="customer_phone"
                className="form-input"
                value={form.customer_phone}
                onChange={handleChange}
                placeholder="+1-555-123-4567"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Order Date *</label>
              <input 
                type="date"
                name="order_date"
                className="form-input"
                value={form.order_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Total Amount ($) *</label>
              <input 
                type="number"
                name="total_amount"
                className="form-input"
                value={form.total_amount}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Shipping Address</label>
              <textarea 
                name="shipping_address"
                className="form-textarea"
                value={form.shipping_address}
                onChange={handleChange}
                placeholder="Full shipping address..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select 
                name="status"
                className="form-select"
                value={form.status}
                onChange={handleChange}
              >
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea 
                name="notes"
                className="form-textarea"
                value={form.notes}
                onChange={handleChange}
                placeholder="Special instructions..."
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateOrderModal;
