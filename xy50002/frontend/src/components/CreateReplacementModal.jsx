import React, { useState } from 'react';

function CreateReplacementModal({ ticketId, spareParts, onClose, onCreated }) {
  const [form, setForm] = useState({
    replacement_type: 'spare_part',
    item_sku: '',
    item_name: '',
    quantity: 1,
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSkuSelect(e) {
    const sku = e.target.value;
    const part = spareParts.find(p => p.sku === sku);
    setForm(prev => ({
      ...prev,
      item_sku: sku,
      item_name: part ? part.name : ''
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.item_sku || !form.item_name) return;
    
    setSaving(true);
    try {
      await fetch(`/api/tickets/${ticketId}/replacements`, {
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
          <div className="modal-title">Create Replacement</div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Type</label>
              <select 
                name="replacement_type"
                className="form-select"
                value={form.replacement_type}
                onChange={handleChange}
              >
                <option value="spare_part">Spare Part</option>
                <option value="full_product">Full Product</option>
                <option value="accessory">Accessory</option>
                <option value="other">Other</option>
              </select>
            </div>

            {spareParts.length > 0 && (
              <div className="form-group">
                <label className="form-label">Select from Available Spare Parts</label>
                <select 
                  className="form-select"
                  value={form.item_sku}
                  onChange={handleSkuSelect}
                >
                  <option value="">-- Select a part --</option>
                  {spareParts.map(part => (
                    <option key={part.id} value={part.sku}>
                      {part.name} (SKU: {part.sku}) - {part.available} available
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Item SKU</label>
              <input 
                type="text"
                name="item_sku"
                className="form-input"
                value={form.item_sku}
                onChange={handleChange}
                placeholder="Enter SKU or select above"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Item Name</label>
              <input 
                type="text"
                name="item_name"
                className="form-input"
                value={form.item_name}
                onChange={handleChange}
                placeholder="Item name"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input 
                type="number"
                name="quantity"
                className="form-input"
                value={form.quantity}
                onChange={handleChange}
                min="1"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea 
                name="notes"
                className="form-textarea"
                value={form.notes}
                onChange={handleChange}
                placeholder="Shipping method, special instructions..."
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create Replacement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateReplacementModal;
