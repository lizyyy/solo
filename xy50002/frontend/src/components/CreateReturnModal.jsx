import React, { useState } from 'react';

function CreateReturnModal({ ticketId, onClose, onCreated }) {
  const [form, setForm] = useState({
    return_type: 'partial_refund',
    reason: '',
    shipping_cost: '',
    shipping_cost_responsibility: '',
    refund_amount: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.reason) return;
    
    setSaving(true);
    try {
      const payload = {
        ...form,
        shipping_cost: form.shipping_cost ? parseFloat(form.shipping_cost) : null,
        refund_amount: form.refund_amount ? parseFloat(form.refund_amount) : null
      };
      await fetch(`/api/tickets/${ticketId}/returns`, {
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
          <div className="modal-title">Process Return / Refund</div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Type</label>
              <select 
                name="return_type"
                className="form-select"
                value={form.return_type}
                onChange={handleChange}
              >
                <option value="full_refund">Full Refund</option>
                <option value="partial_refund">Partial Refund</option>
                <option value="full_return">Full Return</option>
                <option value="partial_return">Partial Return</option>
                <option value="store_credit">Store Credit</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Reason</label>
              <input 
                type="text"
                name="reason"
                className="form-input"
                value={form.reason}
                onChange={handleChange}
                placeholder="e.g., Shipping damage, size too small..."
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Refund Amount ($)</label>
              <input 
                type="number"
                name="refund_amount"
                className="form-input"
                value={form.refund_amount}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Return Shipping Cost ($)</label>
              <input 
                type="number"
                name="shipping_cost"
                className="form-input"
                value={form.shipping_cost}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Shipping Cost Responsibility</label>
              <select 
                name="shipping_cost_responsibility"
                className="form-select"
                value={form.shipping_cost_responsibility}
                onChange={handleChange}
              >
                <option value="">Select...</option>
                <option value="company">Company (Seller)</option>
                <option value="customer">Customer</option>
                <option value="split">Split 50/50</option>
                <option value="carrier">Carrier (Claim)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea 
                name="notes"
                className="form-textarea"
                value={form.notes}
                onChange={handleChange}
                placeholder="Additional notes about this return..."
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Processing...' : 'Process Return'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateReturnModal;
