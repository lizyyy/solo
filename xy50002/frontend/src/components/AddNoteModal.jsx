import React, { useState } from 'react';

function AddNoteModal({ ticketId, onClose, onAdded }) {
  const [form, setForm] = useState({
    content: '',
    author: '',
    is_internal: true
  });
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    setForm(prev => ({ 
      ...prev, 
      [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value 
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.content) return;
    
    setSaving(true);
    try {
      await fetch(`/api/tickets/${ticketId}/notes`, {
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
          <div className="modal-title">Add Internal Note</div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
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
              <label className="form-label">Note</label>
              <textarea 
                name="content"
                className="form-textarea"
                value={form.content}
                onChange={handleChange}
                placeholder="Enter your note..."
                required
              />
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="checkbox"
                id="is_internal"
                name="is_internal"
                checked={form.is_internal}
                onChange={handleChange}
              />
              <label htmlFor="is_internal" className="form-label" style={{ margin: 0 }}>
                Internal note (visible to team only)
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Adding...' : 'Add Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddNoteModal;
