import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import StatusBadge from '../components/StatusBadge'
import MethodBadge from '../components/MethodBadge'

const RequestDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [reviewComment, setReviewComment] = useState('')

  useEffect(() => {
    fetchRequest()
  }, [id])

  const fetchRequest = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/requests/${id}`)
      setRequest(response.data)
    } catch (error) {
      console.error('Failed to fetch request:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async () => {
    try {
      await axios.patch(`/api/requests/${id}/status`, {
        new_status: newStatus,
        comment: reviewComment,
        reviewer_id: 'current_user'
      })
      setShowStatusModal(false)
      setReviewComment('')
      fetchRequest()
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update status')
    }
  }

  const exportRequest = async (format) => {
    try {
      const response = await axios.get(`/api/export/requests/${id}?format=${format}`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `request_${id}.${format}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const addToFavorites = async () => {
    try {
      await axios.post('/api/favorites', {
        request_id: id,
        user_id: 'current_user',
        note: ''
      })
      alert('Added to favorites!')
    } catch (error) {
      if (error.response?.status === 409) {
        alert('Already in favorites!')
      } else {
        console.error('Failed to add favorite:', error)
      }
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">Loading request details...</p>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="text-center py-5">
        <h3 className="text-muted">Request not found</h3>
        <button className="btn btn-primary mt-3" onClick={() => navigate('/')}>
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <button className="btn btn-outline-secondary me-3" onClick={() => navigate('/')}>
            ← Back
          </button>
          <span className="h3 me-3">{request.name}</span>
          <MethodBadge method={request.method} />
          <span className="ms-2">
            <StatusBadge status={request.status} />
          </span>
        </div>
        <div className="btn-group">
          <button className="btn btn-outline-primary" onClick={addToFavorites}>
            ⭐ Favorite
          </button>
          <button className="btn btn-outline-info" onClick={() => setShowStatusModal(true)}>
            🔄 Change Status
          </button>
          <button className="btn btn-outline-success" onClick={() => exportRequest('json')}>
            📥 Export
          </button>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-8">
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">📡 Request Details</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label text-muted small">URL</label>
                <div className="bg-light p-2 rounded font-monospace small">
                  {request.url}
                </div>
              </div>
              <div className="row">
                <div className="col-md-6">
                  <label className="form-label text-muted small">Headers</label>
                  <pre className="json-preview">
                    {JSON.stringify(request.headers, null, 2)}
                  </pre>
                </div>
                <div className="col-md-6">
                  <label className="form-label text-muted small">Body</label>
                  <pre className="json-preview">
                    {JSON.stringify(request.body, null, 2)}
                  </pre>
                </div>
              </div>
              {request.sensitive_fields && request.sensitive_fields.length > 0 && (
                <div className="mt-3">
                  <label className="form-label text-muted small">
                    🔒 Masked Sensitive Fields
                  </label>
                  <div className="bg-info bg-opacity-10 p-3 rounded">
                    {request.sensitive_fields.map((field, idx) => (
                      <div key={idx} className="d-flex align-items-center mb-1">
                        <span className="badge bg-info me-2">{field.mask_type}</span>
                        <code className="small">{field.field_path}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">📨 Responses ({request.responses?.length || 0})</h5>
            </div>
            <div className="card-body">
              {!request.responses || request.responses.length === 0 ? (
                <p className="text-muted text-center py-3">No responses recorded</p>
              ) : (
                <div className="accordion" id="responsesAccordion">
                  {request.responses.map((response, idx) => (
                    <div className="accordion-item" key={idx}>
                      <h2 className="accordion-header">
                        <button 
                          className={`accordion-button ${idx !== 0 ? 'collapsed' : ''}`}
                          type="button"
                          data-bs-toggle="collapse"
                          data-bs-target={`#response-${idx}`}
                        >
                          <span className={`badge ${response.is_error ? 'bg-danger' : 'bg-success'} me-2`}>
                            {response.status_code}
                          </span>
                          <span className="text-muted small me-3">
                            {new Date(response.created_at).toLocaleString()}
                          </span>
                          <span className="text-muted small">
                            ⏱️ {response.response_time}ms
                          </span>
                          {response.is_error && (
                            <span className="badge bg-danger ms-2">⚠️ Error</span>
                          )}
                        </button>
                      </h2>
                      <div 
                        id={`response-${idx}`} 
                        className={`accordion-collapse collapse ${idx === 0 ? 'show' : ''}`}
                      >
                        <div className="accordion-body">
                          {response.is_error && (
                            <div className="alert alert-danger mb-3">
                              <strong>Error:</strong> {response.error_message}
                            </div>
                          )}
                          <div className="row">
                            <div className="col-md-6">
                              <label className="form-label text-muted small">Headers</label>
                              <pre className="json-preview">
                                {JSON.stringify(response.headers, null, 2)}
                              </pre>
                            </div>
                            <div className="col-md-6">
                              <label className="form-label text-muted small">Body</label>
                              <pre className="json-preview">
                                {JSON.stringify(response.body, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">📋 Info</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label text-muted small">Created By</label>
                <p className="mb-0">{request.created_by}</p>
              </div>
              <div className="mb-3">
                <label className="form-label text-muted small">Created At</label>
                <p className="mb-0">{new Date(request.created_at).toLocaleString()}</p>
              </div>
              <div className="mb-3">
                <label className="form-label text-muted small">Environment</label>
                <p className="mb-0">{request.environment_name || 'Default'}</p>
              </div>
              <div>
                <label className="form-label text-muted small">Available Actions</label>
                <div>
                  {request.available_transitions?.map(transition => (
                    <button
                      key={transition}
                      className="btn btn-sm btn-outline-primary me-2 mb-2"
                      onClick={() => {
                        setNewStatus(transition)
                        setShowStatusModal(true)
                      }}
                    >
                      → {transition}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">📜 Review History</h5>
            </div>
            <div className="card-body">
              {!request.reviews || request.reviews.length === 0 ? (
                <p className="text-muted text-center">No review history</p>
              ) : (
                <div>
                  {request.reviews.map((review, idx) => (
                    <div className="timeline-item" key={idx}>
                      <div className="mb-1">
                        <span className="badge bg-secondary me-2">
                          {review.previous_status} → {review.new_status}
                        </span>
                        <small className="text-muted">
                          {new Date(review.created_at).toLocaleString()}
                        </small>
                      </div>
                      <p className="mb-1 small"><strong>{review.reviewer_id}</strong></p>
                      {review.comment && (
                        <p className="mb-0 small text-muted">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showStatusModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Change Status</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowStatusModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Current Status</label>
                  <div>
                    <StatusBadge status={request.status} />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label">New Status</label>
                  <select 
                    className="form-select"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                  >
                    <option value="">Select new status...</option>
                    {request.available_transitions?.map(transition => (
                      <option key={transition} value={transition}>
                        {transition}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Review Comment</label>
                  <textarea 
                    className="form-control"
                    rows="3"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Add a comment about this status change..."
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowStatusModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={updateStatus}
                  disabled={!newStatus}
                >
                  Update Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RequestDetail
