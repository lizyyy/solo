const { addUser } = require('./store');

function initializeDemoData() {
  addUser('user-1', 'tenant-1', 'alice@example.com', 'user');
  addUser('user-2', 'tenant-1', 'bob@example.com', 'user');
  addUser('admin-1', 'tenant-1', 'admin@example.com', 'tenant_admin');
  
  console.log('Demo data initialized');
}

module.exports = { initializeDemoData };
