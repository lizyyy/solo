import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../utils';

function SparePartsPage() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/spare-parts')
      .then(r => r.json())
      .then(setParts)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Spare Parts Inventory</h2>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {parts.length === 0 ? (
              <div className="empty-state">No spare parts in inventory.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Part Name</th>
                    <th>For Product</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Reserved</th>
                    <th>Available</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map(part => (
                    <tr key={part.id}>
                      <td>
                        <strong>{part.sku}</strong>
                      </td>
                      <td>
                        <div>{part.name}</div>
                        {part.notes && (
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{part.notes}</div>
                        )}
                      </td>
                      <td>
                        {part.product_sku || 'Universal'}
                      </td>
                      <td>{formatCurrency(part.price)}</td>
                      <td>{part.stock}</td>
                      <td>{part.reserved}</td>
                      <td>
                        <span className={`spare-part-stock ${part.available <= 10 ? 'low' : ''} ${part.available === 0 ? 'out' : ''}`}>
                          {part.available}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <div className="alert alert-info">
        <strong>Tip:</strong> Spare parts are linked to product SKUs. When processing replacements, the system will show related spare parts for the products in the order.
      </div>
    </div>
  );
}

export default SparePartsPage;
