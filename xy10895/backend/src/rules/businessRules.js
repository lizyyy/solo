const { getAsync, runAsync } = require('../config/database');

const VALID_STATUS_TRANSITIONS = {
  'draft': ['reviewing', 'archived'],
  'reviewing': ['draft', 'active', 'archived'],
  'active': ['deprecated', 'archived'],
  'deprecated': ['active', 'archived'],
  'archived': []
};

const canTransitionStatus = (currentStatus, newStatus) => {
  return VALID_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
};

const checkOwnerExists = async (ownerId) => {
  if (!ownerId) return true;
  const owner = await getAsync('SELECT id FROM owners WHERE id = ?', [ownerId]);
  return !!owner;
};

const checkExampleLimit = async (apiId) => {
  const examples = await getAsync(
    'SELECT COUNT(*) as count FROM example_requests WHERE api_id = ? AND is_active = 1',
    [apiId]
  );
  return examples.count < 10;
};

const checkPermissionHierarchy = (permissionLevel, userRole) => {
  const hierarchy = {
    'public': ['guest', 'user', 'admin', 'super_admin'],
    'internal': ['user', 'admin', 'super_admin'],
    'confidential': ['admin', 'super_admin'],
    'restricted': ['super_admin']
  };
  return hierarchy[permissionLevel]?.includes(userRole) || false;
};

const createChangeLog = async (apiId, changeType, oldValue, newValue, changedBy, description) => {
  await runAsync(
    `INSERT INTO change_logs (api_id, change_type, old_value, new_value, changed_by, description)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [apiId, changeType, oldValue, newValue, changedBy, description]
  );
};

module.exports = {
  canTransitionStatus,
  checkOwnerExists,
  checkExampleLimit,
  checkPermissionHierarchy,
  createChangeLog
};
