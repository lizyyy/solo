import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const CreateRequest = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    method: 'GET',
    url: '',
    headers: '{}',
    body: '{}',
    environment_id: '',
    created_by: 'developer'
  })
  const [environments, setEnvironments] = useState([])
  const [error, setError] = useState('')

  React.useEffect(() => {
    fetchEnvironments()
  }, [])

  const fetchEnvironments = async () => {
    try {
      const response = await axios.get('/api/environments')
      setEnvironments(response.data)
    } catch (error) {
      console.error('Failed to fetch environments:', error)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    try {
      setLoading(true)
      
      const payload = {
        ...formData,
        headers: JSON.parse(formData.headers),
        body: JSON.parse(formData.body)
      }

      const response = await axios.post('/api/requests', payload)
      alert('Request created successfully! Sensitive fields have been masked.')
      navigate(`/request/${response.data.id}`)
    } catch (err) {
      if (err.response?.status === 409) {
        setError(`Duplicate request detected! This request already exists. Existing ID: ${err.response.data.existing_id}`)
      } else if (err.response?.data?.error) {
        setError(err.response.data.error)
      } else {
        setError('Failed to create request. Please check your JSON formatting.')
      }
      console.error('Create error:', err)
    } finally {
      setLoading(false)
    }
  }

  const testDuplicate = async () => {
    try {
      const payload = {
        ...formData,
        headers: JSON.parse(formData.headers),
        body: JSON.parse(formData.body)
      }
      await axios.post('/api/requests', payload)
    } catch (err) {
      if (err.response?.status === 409) {
        alert(`✅ Duplicate detection working! This request already exists.\n\nExisting ID: ${err.response.data.existing_id}\n\nMessage: ${err.response.data.message}`)
      } else {
        alert('This is a new request - no duplicate found.')
      }
    }
  }

  return (
    <div className="row justify-content-center">
      <div className="col-lg-8">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="h3">➕ Create New Request</h1>
          <button className="btn btn-outline-secondary" onClick={() => navigate('/')}>
            ← Back
          </button>
        </div>

        {error && (
          <div className="alert alert-danger alert-dismissible">
            {error}
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => setError('')}
            ></button>
          </div>
        )}

        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row mb-3">
                <div className="col-md-8">
                  <label className="form-label">Request Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., User Login API"
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Method *</label>
                  <select
                    className="form-select"
                    name="method"
                    value={formData.method}
                    onChange={handleChange}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-8">
                  <label className="form-label">URL *</label>
                  <input
                    type="text"
                    className="form-control"
                    name="url"
                    value={formData.url}
                    onChange={handleChange}
                    placeholder="e.g., /api/auth/login"
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Environment</label>
                  <select
                    className="form-select"
                    name="environment_id"
                    value={formData.environment_id}
                    onChange={handleChange}
                  >
                    <option value="">Select environment...</option>
                    {environments.map(env => (
                      <option key={env.id} value={env.id}>
                        {env.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">
                  Headers (JSON)
                  <span className="text-info ms-2 small">
                    🔒 Sensitive fields like Authorization, API Key will be masked
                  </span>
                </label>
                <textarea
                  className="form-control font-monospace"
                  name="headers"
                  value={formData.headers}
                  onChange={handleChange}
                  rows="4"
                  placeholder='{"Content-Type": "application/json", "Authorization": "Bearer token123"}'
                ></textarea>
              </div>

              <div className="mb-3">
                <label className="form-label">
                  Body (JSON)
                  <span className="text-info ms-2 small">
                    🔒 Sensitive fields like password, secret will be masked
                  </span>
                </label>
                <textarea
                  className="form-control font-monospace"
                  name="body"
                  value={formData.body}
                  onChange={handleChange}
                  rows="6"
                  placeholder='{"username": "test_user", "password": "secret123"}'
                ></textarea>
              </div>

              <div className="mb-4">
                <label className="form-label">Created By</label>
                <input
                  type="text"
                  className="form-control"
                  name="created_by"
                  value={formData.created_by}
                  onChange={handleChange}
                />
              </div>

              <div className="alert alert-info mb-4">
                <h6 className="alert-heading">💡 Features Demonstrated:</h6>
                <ul className="mb-0 small">
                  <li><strong>Sensitive Field Detection:</strong> Fields containing password, token, secret, api_key, auth are automatically detected</li>
                  <li><strong>Data Masking:</strong> Sensitive values will be masked (partial, full, or hash)</li>
                  <li><strong>Duplicate Prevention:</strong> Same request (method + URL + headers + body) cannot be submitted twice</li>
                  <li><strong>Status Management:</strong> Request starts as "pending" and can transition through review workflow</li>
                </ul>
              </div>

              <div className="d-flex gap-2">
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Creating...
                    </>
                  ) : (
                    'Create Request'
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-warning"
                  onClick={testDuplicate}
                >
                  🔍 Test Duplicate Detection
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="card mt-4">
          <div className="card-header">
            <h5 className="card-title mb-0">🎯 Test Scenarios</h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <div className="border p-3 rounded">
                  <h6>✅ Success Scenario</h6>
                  <p className="small text-muted">
                    Create a new unique request with valid JSON. Sensitive fields will be automatically masked.
                  </p>
                  <code className="small">
                    URL: /api/test/success<br/>
                    Body: {"{\"password\": \"test123\", \"api_key\": \"secret\"}"}
                  </code>
                </div>
              </div>
              <div className="col-md-6">
                <div className="border p-3 rounded">
                  <h6>⚠️ Duplicate Scenario</h6>
                  <p className="small text-muted">
                    Submit the exact same request twice. System will detect duplicate and reject.
                  </p>
                  <code className="small">
                    Same URL + same body = 409 Conflict
                  </code>
                </div>
              </div>
              <div className="col-md-6">
                <div className="border p-3 rounded">
                  <h6>❌ Error Scenario</h6>
                  <p className="small text-muted">
                    Submit invalid JSON to see error handling in action.
                  </p>
                  <code className="small">
                    Body: invalid-json
                  </code>
                </div>
              </div>
              <div className="col-md-6">
                <div className="border p-3 rounded">
                  <h6>🔒 Masking Demo</h6>
                  <p className="small text-muted">
                    Include sensitive fields to see automatic masking applied.
                  </p>
                  <code className="small">
                    Headers: Authorization, X-API-Key<br/>
                    Body: password, secret, private_key
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateRequest
