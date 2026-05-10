import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { 
  formatDate, 
  formatDateShort,
  formatCurrency, 
  getStatusLabel, 
  getPriorityLabel, 
  getRiskLabel,
  getTicketTypeLabel,
  getLogisticsStatusLabel,
  getActionTypeLabel,
  calculateSlaStatus,
  isWarrantyValid,
  getWarrantyEndDate
} from '../utils';
import AddNoteModal from '../components/AddNoteModal';
import AddActionModal from '../components/AddActionModal';
import CreateReturnModal from '../components/CreateReturnModal';
import CreateReplacementModal from '../components/CreateReplacementModal';

function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showReplacementModal, setShowReplacementModal] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadTicket();
  }, [id]);

  function loadTicket() {
    setLoading(true);
    fetch(`/api/tickets/${id}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }

  async function updateTicket(fields) {
    setUpdating(true);
    try {
      await fetch(`/api/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });
      loadTicket();
    } finally {
      setUpdating(false);
    }
  }

  async function exportMarkdown() {
    if (!data) return;
    const exportData = encodeURIComponent(JSON.stringify({
      ticket: data.ticket,
      order: data.order,
      messages: data.messages,
      evidence: data.evidence,
      actions: data.actions,
      notes: data.notes,
      returns: data.returns,
      replacements: data.replacements
    }));
    window.open(`/api/tickets/${id}/export/markdown?data=${exportData}`, '_blank');
  }

  async function exportCsv() {
    if (!data) return;
    const exportData = encodeURIComponent(JSON.stringify({
      ticket: data.ticket,
      order: data.order
    }));
    window.open(`/api/tickets/${id}/export/csv?data=${exportData}`, '_blank');
  }

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading"><div className="spinner"></div></div>
      </div>
    );
  }

  if (!data || !data.ticket) {
    return (
      <div className="dashboard">
        <div className="alert alert-danger">Ticket not found.</div>
      </div>
    );
  }

  const { ticket, order, messages, evidence, actions, notes, returns, replacements, relatedSpareParts } = data;
  const sla = calculateSlaStatus(ticket.sla_deadline);

  return (
    <div className="ticket-detail">
      <div style={{ gridColumn: '1 / -1' }}>
        <Link to="/tickets" className="back-btn">
          ← Back to Tickets
        </Link>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              {ticket.id} - {ticket.title}
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className={`badge ${ticket.ticket_type === 'damage' ? 'critical' : ticket.ticket_type === 'warranty' ? 'low' : 'medium'}`}>
                {getTicketTypeLabel(ticket.ticket_type)}
              </span>
              <span className={`badge ${ticket.priority}`}>
                {getPriorityLabel(ticket.priority)}
              </span>
              <span className={`badge ${ticket.risk_level}_risk`}>
                {getRiskLabel(ticket.risk_level)}
              </span>
              <span className={`badge ${ticket.status}`}>
                {getStatusLabel(ticket.status)}
              </span>
            </div>
          </div>
          
          <div className="quick-actions">
            <button className="btn btn-secondary btn-sm" onClick={exportMarkdown}>
              Export MD
            </button>
            <button className="btn btn-secondary btn-sm" onClick={exportCsv}>
              Export CSV
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowNoteModal(true)}>
              Add Note
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowActionModal(true)}>
              Log Action
            </button>
          </div>
        </div>

        {ticket.risk_reason && (
          <div className="alert alert-warning">
            <strong>Risk Assessment:</strong> {ticket.risk_reason}
          </div>
        )}
      </div>

      <div>
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`tab ${activeTab === 'communication' ? 'active' : ''}`}
            onClick={() => setActiveTab('communication')}
          >
            Communication ({messages.length})
          </button>
          <button 
            className={`tab ${activeTab === 'evidence' ? 'active' : ''}`}
            onClick={() => setActiveTab('evidence')}
          >
            Evidence ({evidence.length})
          </button>
          <button 
            className={`tab ${activeTab === 'solutions' ? 'active' : ''}`}
            onClick={() => setActiveTab('solutions')}
          >
            Solutions
          </button>
        </div>

        {activeTab === 'overview' && (
          <>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Ticket Information</div>
              </div>
              <div className="card-body">
                <div className="ticket-info-grid">
                  <div className="info-item">
                    <span className="info-label">Assigned To</span>
                    <select 
                      className="form-select"
                      value={ticket.assigned_to || ''}
                      onChange={e => updateTicket({ assigned_to: e.target.value || null })}
                    >
                      <option value="">Unassigned</option>
                      <option value="Agent Sarah">Agent Sarah</option>
                      <option value="Agent Mike">Agent Mike</option>
                      <option value="Agent Lisa">Agent Lisa</option>
                      <option value="Agent Tom">Agent Tom</option>
                    </select>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Status</span>
                    <select 
                      className="form-select"
                      value={ticket.status}
                      onChange={e => updateTicket({ status: e.target.value })}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="waiting_customer">Waiting for Customer</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Priority</span>
                    <select 
                      className="form-select"
                      value={ticket.priority}
                      onChange={e => updateTicket({ priority: e.target.value })}
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Risk Level</span>
                    <select 
                      className="form-select"
                      value={ticket.risk_level}
                      onChange={e => updateTicket({ risk_level: e.target.value })}
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="info-item">
                    <span className="info-label">SLA Deadline</span>
                    <div className="info-value">
                      <div className="sla-indicator">
                        <span className={`sla-dot ${sla.className}`}></span>
                        <span>{formatDate(ticket.sla_deadline)}</span>
                      </div>
                      <small style={{ color: '#6b7280' }}>{sla.label}</small>
                    </div>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Created</span>
                    <div className="info-value">{formatDate(ticket.created_at)}</div>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label className="form-label">Description</label>
                  <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '6px' }}>
                    {ticket.description || 'No description provided'}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Resolution</label>
                  <textarea 
                    className="form-textarea"
                    placeholder="Enter resolution details..."
                    value={ticket.resolution || ''}
                    onChange={e => updateTicket({ resolution: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {order?.items?.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Order Items & Warranty</div>
                </div>
                <div className="card-body">
                  {order.items.map(item => (
                    <div key={item.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            {item.name}
                            {isWarrantyValid(order.order_date, item.warranty_months) ? (
                              <span className="warranty-badge">
                                Warranty until {getWarrantyEndDate(order.order_date, item.warranty_months)}
                              </span>
                            ) : (
                              <span className="warranty-badge warranty-expired">
                                Warranty Expired
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            SKU: {item.sku} | {item.warranty_months} months warranty
                          </div>
                          {item.dimensions && (
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                              Dimensions: {item.dimensions}
                            </div>
                          )}
                          {item.description && (
                            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                              {item.description}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 500 }}>{formatCurrency(item.price)}</div>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Qty: {item.quantity}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {order?.packages?.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Shipping & Logistics</div>
                </div>
                <div className="card-body">
                  {order.packages.map(pkg => (
                    <div key={pkg.id} style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <strong>Package: {pkg.tracking_number || pkg.id}</strong>
                        <span className={`badge ${pkg.package_status}`}>
                          {getStatusLabel(pkg.package_status)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                        Carrier: {pkg.carrier} | Shipped: {formatDateShort(pkg.shipped_date)} | Delivered: {formatDateShort(pkg.delivered_date)}
                      </div>
                      
                      {order.logistics?.filter(l => l.package_id === pkg.id).map((log, idx) => (
                        <div key={log.id} className={`logistics-step ${idx === 0 ? 'current' : ''}`}>
                          <div>
                            <div className="logistics-time">{formatDate(log.timestamp)}</div>
                            <div className="logistics-status">{getLogisticsStatusLabel(log.status)}</div>
                            {log.location && <div className="logistics-location">{log.location}</div>}
                            {log.description && <div className="logistics-location">{log.description}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'communication' && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Communication History</div>
            </div>
            <div className="card-body">
              {messages.length === 0 ? (
                <div className="empty-state">No communication history</div>
              ) : (
                <div className="message-list">
                  {messages.map(msg => (
                    <div key={msg.id} className={`message ${msg.message_type}`}>
                      <div className="message-header">
                        <strong>{msg.author || (msg.message_type === 'agent' ? 'Agent' : 'Customer')}</strong>
                        <span>{formatDate(msg.created_at)}</span>
                      </div>
                      <div className="message-content">{msg.content}</div>
                      {msg.attachment_url && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                          📎 Attachment: {msg.attachment_url}
                          {msg.is_evidence && <span className="badge critical" style={{ marginLeft: '0.5rem' }}>Evidence</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'evidence' && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Damage Evidence</div>
            </div>
            <div className="card-body">
              {evidence.length === 0 ? (
                <div className="empty-state">No evidence uploaded</div>
              ) : (
                evidence.map(item => (
                  <div key={item.id} className="evidence-item">
                    <div className="evidence-icon">📷</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{item.author}</div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {formatDate(item.created_at)}
                      </div>
                      <div style={{ marginTop: '0.25rem' }}>{item.content}</div>
                      {item.attachment_url && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: '#1e3a5f' }}>
                          {item.attachment_url}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'solutions' && (
          <>
            <div className="card">
              <div className="card-header">
                <div className="card-title">Resolution Options</div>
              </div>
              <div className="card-body">
                <div className="quick-actions" style={{ marginBottom: '1rem' }}>
                  <button className="btn btn-primary" onClick={() => setShowReturnModal(true)}>
                    Process Return / Refund
                  </button>
                  <button className="btn btn-primary" onClick={() => setShowReplacementModal(true)}>
                    Create Replacement
                  </button>
                </div>

                {relatedSpareParts?.length > 0 && (
                  <>
                    <div className="section-title">Available Spare Parts</div>
                    {relatedSpareParts.map(part => (
                      <div key={part.id} className="spare-part-item">
                        <div className="spare-part-info">
                          <div className="spare-part-name">{part.name}</div>
                          <div className="spare-part-sku">SKU: {part.sku} | {formatCurrency(part.price)}</div>
                          {part.product_sku && (
                            <div className="spare-part-sku">For Product: {part.product_sku}</div>
                          )}
                          {part.notes && (
                            <div className="spare-part-sku">{part.notes}</div>
                          )}
                        </div>
                        <div className={`spare-part-stock ${part.available <= 10 ? 'low' : ''} ${part.available === 0 ? 'out' : ''}`}>
                          {part.available} available
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {returns?.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Returns & Refunds</div>
                </div>
                <div className="card-body">
                  {returns.map(r => (
                    <div key={r.id} style={{ padding: '0.75rem', background: '#f9fafb', borderRadius: '6px', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <strong>{r.return_type}</strong>
                        <span className={`badge ${r.status}`}>{getStatusLabel(r.status)}</span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        Reason: {r.reason}
                      </div>
                      {r.refund_amount !== null && (
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          Refund Amount: {formatCurrency(r.refund_amount)}
                        </div>
                      )}
                      {r.shipping_cost !== null && (
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          Shipping Cost: {formatCurrency(r.shipping_cost)}
                          {r.shipping_cost_responsibility && ` (${r.shipping_cost_responsibility})`}
                        </div>
                      )}
                      {r.notes && (
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Notes: {r.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {replacements?.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Replacements</div>
                </div>
                <div className="card-body">
                  {replacements.map(r => (
                    <div key={r.id} style={{ padding: '0.75rem', background: '#f9fafb', borderRadius: '6px', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <strong>{r.item_name} ({r.item_sku})</strong>
                        <span className={`badge ${r.status}`}>{getStatusLabel(r.status)}</span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        Type: {r.replacement_type} | Qty: {r.quantity}
                      </div>
                      {r.tracking_number && (
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          Tracking: {r.tracking_number}
                        </div>
                      )}
                      {r.notes && (
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Notes: {r.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div>
        {order && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Customer Information</div>
            </div>
            <div className="card-body">
              <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>{order.customer_name}</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                📧 {order.customer_email || 'No email'}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                📞 {order.customer_phone || 'No phone'}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                📦 Order: {ticket.order_id}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                💰 Total: {formatCurrency(order.total_amount)}
              </div>
              {order.shipping_address && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                  <div className="info-label">Shipping Address</div>
                  <div style={{ fontSize: '0.875rem' }}>{order.shipping_address}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {actions?.length > 0 && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Action Timeline</div>
            </div>
            <div className="card-body">
              <div className="timeline">
                {actions.map(action => (
                  <div key={action.id} className="timeline-item">
                    <div className="timeline-time">
                      {formatDate(action.created_at)} - {action.author || 'System'}
                    </div>
                    <div className="timeline-content">
                      <span className="badge medium" style={{ marginRight: '0.5rem' }}>
                        {getActionTypeLabel(action.action_type)}
                      </span>
                      {action.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {notes?.length > 0 && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Internal Notes</div>
            </div>
            <div className="card-body">
              {notes.map(note => (
                <div key={note.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                    {note.author || 'Agent'} - {formatDate(note.created_at)}
                  </div>
                  <div style={{ fontSize: '0.875rem' }}>{note.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showNoteModal && (
        <AddNoteModal 
          ticketId={id}
          onClose={() => setShowNoteModal(false)}
          onAdded={loadTicket}
        />
      )}

      {showActionModal && (
        <AddActionModal 
          ticketId={id}
          onClose={() => setShowActionModal(false)}
          onAdded={loadTicket}
        />
      )}

      {showReturnModal && (
        <CreateReturnModal 
          ticketId={id}
          onClose={() => setShowReturnModal(false)}
          onCreated={loadTicket}
        />
      )}

      {showReplacementModal && (
        <CreateReplacementModal 
          ticketId={id}
          spareParts={relatedSpareParts || []}
          onClose={() => setShowReplacementModal(false)}
          onCreated={loadTicket}
        />
      )}
    </div>
  );
}

export default TicketDetail;
