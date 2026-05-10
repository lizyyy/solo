import React, { useState } from 'react';

function ImportOrdersModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [importing, setImporting] = useState(false);

  const sampleCsv = `Order ID,Customer Name,Email,Phone,Order Date,Total,Address,Status,Notes
ORD-2025-TEST1,Jane Doe,jane@example.com,+1-555-111-2222,2025-05-01,799.99,123 Test St, Test City,delivered,Test order 1
ORD-2025-TEST2,Bob Wilson,bob@example.com,+1-555-222-3333,2025-05-05,449.00,456 Sample Ave, Sample Town,shipped,Test order 2`;

  function handleFileChange(e) {
    setFile(e.target.files[0]);
    setResult(null);
  }

  async function handleImport() {
    if (!file) return;
    
    setImporting(true);
    try {
      const text = await file.text();
      const response = await fetch('/api/import/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: text, format: 'csv' })
      });
      const result = await response.json();
      setResult(result);
      if (result.imported > 0) {
        setTimeout(() => onImported(), 1500);
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Import Orders from CSV</div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Select CSV File</label>
            <input 
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="form-input"
              style={{ padding: '0.5rem' }}
            />
          </div>

          {result && (
            <div className={`alert ${result.imported > 0 ? 'alert-info' : 'alert-danger'}`}>
              {result.imported > 0 
                ? `Successfully imported ${result.imported} of ${result.total} orders!`
                : 'Failed to import orders. Please check the file format.'
              }
            </div>
          )}

          <div style={{ marginTop: '1.5rem' }}>
            <div className="form-label">CSV Format (required columns):</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              Order ID, Customer Name, Email, Phone, Order Date, Total, Address, Status, Notes
            </div>
            <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', overflowX: 'auto' }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{sampleCsv}</pre>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={handleImport}
            disabled={!file || importing}
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportOrdersModal;
