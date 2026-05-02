module.exports = {
  server: {
    port: process.env.PORT || 3000
  },
  database: {
    filename: process.env.DB_FILE || './data/chemicals.db'
  },
  roles: {
    admin: 'admin',
    safety_officer: 'safety_officer',
    user: 'user'
  },
  permissions: {
    create_chemical: ['admin', 'safety_officer'],
    update_chemical: ['admin', 'safety_officer'],
    delete_chemical: ['admin'],
    
    create_batch: ['admin', 'safety_officer'],
    update_batch: ['admin', 'safety_officer'],
    
    create_request: ['admin', 'safety_officer', 'user'],
    approve_request: ['admin', 'safety_officer'],
    reject_request: ['admin', 'safety_officer'],
    execute_request: ['admin', 'safety_officer'],
    
    return_chemical: ['admin', 'safety_officer', 'user'],
    dispose_chemical: ['admin', 'safety_officer'],
    
    view_audit_log: ['admin', 'safety_officer'],
    export_report: ['admin', 'safety_officer'],
    import_batch: ['admin', 'safety_officer']
  },
  danger_levels: {
    low: 'low',
    medium: 'medium',
    high: 'high',
    extreme: 'extreme'
  },
  request_status: {
    draft: 'draft',
    pending: 'pending',
    approved: 'approved',
    rejected: 'rejected',
    executed: 'executed',
    returned: 'returned',
    disposed: 'disposed'
  },
  alert: {
    stock_threshold: 10,
    expiry_days_threshold: 30
  }
};
