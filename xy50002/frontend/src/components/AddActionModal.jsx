import React, { useState } from 'react';

function AddActionModal({ ticketId, onClose, onAdded }) {
  const [form, setForm] = useState({
    action_type: 'review',
    description: '',
    author: ''
  });
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.description) return;
    
    setSaving(true);
    try {
      await fetch(`/api/tickets/${ticketId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Log Action</div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Action Type</label>
              <select 
                name="action_type"
                className="form-select"
                value={form.action_type}
                onChange={handleChange}
              >
                <option value="review">Review</option>
                <option value="email">Email Sent</option>
                <option value="call">Phone Call</option>
                <option value="proposal">Proposal</option>
                <option value="stock_check">Stock Check</option>
                <option value="refund">Refund Processed</option>
                <option value="return_initiated">Return Initiated</option>
                <option value="resolution">Resolution</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Author</label>
              <select 
                name="author"
                className="form-select"
                value={form.author}
                onChange={handleChange}
              >
                <option value="">Select agent...</option>
                <option value="Agent Sarah">Agent Sarah</option>
                <option value="Agent Mike">Agent Mike</option>
                <option value="Agent Lisa">Agent Lisa</option>
                <option value="Agent Tom">Agent Tom</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea 
                name="description"
                className="form-textarea"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe the action taken..."
                required
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Logging...' : 'Log Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddActionModal;
