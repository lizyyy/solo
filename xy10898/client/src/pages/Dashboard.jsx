import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import StatusBadge from '../components/StatusBadge'
import MethodBadge from '../components/MethodBadge'

const Dashboard = () => {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: '',
    environment: '',
    search: ''
  })
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    reviewing: 0,
    approved: 0,
    rejected: 0
  })

  useEffect(() => {
    fetchRequests()
  }, [filters])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const params = {}
      if (filters.status) params.status = filters.status
      if (filters.search) params.search = filters.search
      
      const response = await axios.get('/api/requests', { params })
      setRequests(response.data.data || [])
      
      const allRequests = response.data.data || []
      setStats({
        total: allRequests.length,
        pending: allRequests.filter(r => r.status === 'pending').length,
        reviewing: allRequests.filter(r => r.status === 'reviewing').length,
        approved: allRequests.filter(r => r.status === 'approved').length,
        rejected: allRequests.filter(r => r.status === 'rejected').length
      })
    } catch (error) {
      console.error('Failed to fetch requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportData = async (format) => {
    try {
      const response = await axios.get(`/api/export/requests?format=${format}`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `requests.${format}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">Loading requests...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3">📋 API Request History</h1>
        <div className="btn-group">
          <button 
            className="btn btn-outline-primary btn-sm"
            onClick={() => exportData('json')}
          >
            📥 Export JSON
          </button>
          <button 
            className="btn btn-outline-success btn-sm"
            onClick={() => exportData('csv')}
          >
            📊 Export CSV
          </button>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-md-2">
          <div className="card text-center">
            <div className="card-body">
              <h3 className="card-title">{stats.total}</h3>
              <p className="card-text text-muted small">Total</p>
            </div>
          </div>
        </div>
        <div className="col-md-2">
          <div className="card text-center border-warning">
            <div className="card-body">
              <h3 className="card-title text-warning">{stats.pending}</h3>
              <p className="card-text text-muted small">Pending</p>
            </div>
          </div>
        </div>
        <div className="col-md-2">
          <div className="card text-center border-primary">
            <div className="card-body">
              <h3 className="card-title text-primary">{stats.reviewing}</h3>
              <p className="card-text text-muted small">Reviewing</p>
            </div>
          </div>
        </div>
        <div className="col-md-2">
          <div className="card text-center border-success">
            <div className="card-body">
              <h3 className="card-title text-success">{stats.approved}</h3>
              <p className="card-text text-muted small">Approved</p>
            </div>
          </div>
        </div>
        <div className="col-md-2">
          <div className="card text-center border-danger">
            <div className="card-body">
              <h3 className="card-title text-danger">{stats.rejected}</h3>
              <p className="card-text text-muted small">Rejected</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <input
                type="text"
                className="form-control"
                placeholder="🔍 Search by name or URL..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
            <div className="col-md-4">
              <select
                className="form-select"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="reviewing">Reviewing</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="col-md-4">
              <button 
                className="btn btn-outline-secondary w-100"
                onClick={() => setFilters({ status: '', environment: '', search: '' })}
              >
                🔄 Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {requests.map(request => (
          <div className="col-md-6 col-lg-4" key={request.id}>
            <Link 
              to={`/request/${request.id}`} 
              className="text-decoration-none"
            >
              <div className="card h-100 card-hover">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <MethodBadge method={request.method} />
                    <StatusBadge status={request.status} />
                  </div>
                  <h5 className="card-title mb-2">{request.name}</h5>
                  <p className="card-text text-muted small text-truncate mb-2">
                    {request.url}
                  </p>
                  <div className="d-flex justify-content-between align-items-center">
                    <small className="text-muted">
                      {request.response_count || 0} responses
                    </small>
                    <small className="text-muted">
                      {new Date(request.created_at).toLocaleDateString()}
                    </small>
                  </div>
                  {request.sensitive_fields && request.sensitive_fields.length > 0 && (
                    <div className="mt-2">
                      <span className="badge bg-info text-dark">
                        🔒 {request.sensitive_fields.length} sensitive fields masked
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {requests.length === 0 && (
        <div className="text-center py-5">
          <h3 className="text-muted">No requests found</h3>
          <p className="text-muted">Try adjusting your filters or create a new request.</p>
          <Link to="/create" className="btn btn-primary">
            Create First Request
          </Link>
        </div>
      )}
    </div>
  )
}

export default Dashboard
