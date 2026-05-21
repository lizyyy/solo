const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const subscriptions = new Map();
const changes = new Map();
const confirmations = new Map();
const changeHashIndex = new Map();

const RiskLevel = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

const ChangeType = {
  FIELD_DELETED: 'field_deleted',
  FIELD_TYPE_CHANGED: 'field_type_changed',
  FIELD_DESCRIPTION_CHANGED: 'field_description_changed',
  FIELD_ADDED: 'field_added'
};

function generateChangeHash(apiPath, diff) {
  const content = apiPath + JSON.stringify(diff);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function createSubscription(serviceName, teamName, apiPath, fields) {
  const id = uuidv4();
  const subscription = {
    id,
    serviceName,
    teamName,
    apiPath,
    fields,
    createdAt: new Date().toISOString()
  };
  subscriptions.set(id, subscription);
  return subscription;
}

function getSubscriptionsByApiPath(apiPath) {
  return Array.from(subscriptions.values()).filter(s => s.apiPath === apiPath);
}

function getAllSubscriptions() {
  return Array.from(subscriptions.values());
}

function createChange(apiPath, oldSchema, newSchema, commitAuthor, commitMessage) {
  const diff = calculateSchemaDiff(oldSchema, newSchema);
  const contentHash = generateChangeHash(apiPath, diff);

  if (changeHashIndex.has(contentHash)) {
    const existingChangeId = changeHashIndex.get(contentHash);
    const existingChange = changes.get(existingChangeId);
    if (existingChange) {
      const affectedSubscriptions = getSubscriptionsByApiPath(apiPath);
      for (const subscription of affectedSubscriptions) {
        const affectedFields = diff.filter(d => 
          subscription.fields.includes(d.path) || 
          subscription.fields.some(f => d.path.startsWith(f + '.'))
        );
        if (affectedFields.length > 0) {
          const confirmationId = `${contentHash}-${subscription.id}`;
          if (!confirmations.has(confirmationId)) {
            const riskLevel = calculateRiskLevel(affectedFields);
            confirmations.set(confirmationId, {
              id: confirmationId,
              changeId: existingChange.id,
              subscriptionId: subscription.id,
              serviceName: subscription.serviceName,
              teamName: subscription.teamName,
              apiPath: apiPath,
              affectedFields,
              riskLevel,
              status: 'pending',
              note: '',
              createdAt: new Date().toISOString(),
              deadline: calculateDeadline(existingChange.createdAt, riskLevel)
            });
          }
        }
      }
      return existingChange;
    }
  }

  const id = uuidv4();
  const change = {
    id,
    apiPath,
    oldSchema,
    newSchema,
    diff,
    commitAuthor,
    commitMessage,
    createdAt: new Date().toISOString(),
    riskLevel: calculateRiskLevel(diff),
    contentHash
  };
  changes.set(id, change);
  changeHashIndex.set(contentHash, id);
  createConfirmationsForChange(change, contentHash);
  return change;
}

function calculateSchemaDiff(oldSchema, newSchema) {
  const diffs = [];
  const oldFields = flattenSchema(oldSchema);
  const newFields = flattenSchema(newSchema);

  for (const [path, oldField] of oldFields.entries()) {
    const newField = newFields.get(path);
    if (!newField) {
      diffs.push({
        type: ChangeType.FIELD_DELETED,
        path,
        oldType: oldField.type,
        oldDescription: oldField.description
      });
    } else if (oldField.type !== newField.type) {
      diffs.push({
        type: ChangeType.FIELD_TYPE_CHANGED,
        path,
        oldType: oldField.type,
        newType: newField.type
      });
    } else if (oldField.description !== newField.description) {
      diffs.push({
        type: ChangeType.FIELD_DESCRIPTION_CHANGED,
        path,
        oldDescription: oldField.description,
        newDescription: newField.description
      });
    }
  }

  for (const [path, newField] of newFields.entries()) {
    if (!oldFields.has(path)) {
      diffs.push({
        type: ChangeType.FIELD_ADDED,
        path,
        newType: newField.type,
        newDescription: newField.description
      });
    }
  }

  return diffs;
}

function flattenSchema(schema, prefix = '') {
  const fields = new Map();
  if (schema && typeof schema === 'object') {
    for (const [key, value] of Object.entries(schema)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && value.type && !value.properties) {
        fields.set(path, {
          type: value.type,
          description: value.description || ''
        });
      } else if (value && value.properties) {
        fields.set(path, {
          type: 'object',
          description: value.description || ''
        });
        const nested = flattenSchema(value.properties, path);
        for (const [nestedPath, nestedField] of nested.entries()) {
          fields.set(nestedPath, nestedField);
        }
      }
    }
  }
  return fields;
}

function calculateRiskLevel(diffs) {
  let hasHigh = false;
  let hasMedium = false;

  for (const diff of diffs) {
    if (diff.type === ChangeType.FIELD_DELETED) {
      hasHigh = true;
    } else if (diff.type === ChangeType.FIELD_TYPE_CHANGED) {
      hasMedium = true;
    }
  }

  if (hasHigh) return RiskLevel.HIGH;
  if (hasMedium) return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}

function createConfirmationsForChange(change, contentHash) {
  const affectedSubscriptions = getSubscriptionsByApiPath(change.apiPath);
  
  for (const subscription of affectedSubscriptions) {
    const affectedFields = change.diff.filter(d => 
      subscription.fields.includes(d.path) || 
      subscription.fields.some(f => d.path.startsWith(f + '.'))
    );

    if (affectedFields.length > 0) {
      const confirmationId = `${contentHash}-${subscription.id}`;
      if (!confirmations.has(confirmationId)) {
        const riskLevel = calculateRiskLevel(affectedFields);
        confirmations.set(confirmationId, {
          id: confirmationId,
          changeId: change.id,
          subscriptionId: subscription.id,
          serviceName: subscription.serviceName,
          teamName: subscription.teamName,
          apiPath: change.apiPath,
          affectedFields,
          riskLevel,
          status: 'pending',
          note: '',
          createdAt: new Date().toISOString(),
          deadline: calculateDeadline(change.createdAt, riskLevel)
        });
      }
    }
  }
}

function calculateDeadline(createdAt, riskLevel) {
  const date = new Date(createdAt);
  if (riskLevel === RiskLevel.HIGH) {
    date.setHours(date.getHours() + 24);
  } else if (riskLevel === RiskLevel.MEDIUM) {
    date.setDate(date.getDate() + 3);
  } else {
    date.setDate(date.getDate() + 7);
  }
  return date.toISOString();
}

function confirmImpact(confirmationId, note) {
  const confirmation = confirmations.get(confirmationId);
  if (confirmation) {
    confirmation.status = 'confirmed';
    confirmation.note = note;
    confirmation.confirmedAt = new Date().toISOString();
    return confirmation;
  }
  return null;
}

function markAsUnaffected(confirmationId, note) {
  const confirmation = confirmations.get(confirmationId);
  if (confirmation) {
    confirmation.status = 'unaffected';
    confirmation.note = note;
    confirmation.confirmedAt = new Date().toISOString();
    return confirmation;
  }
  return null;
}

function getConfirmations(filters = {}) {
  let results = Array.from(confirmations.values());
  
  if (filters.status) {
    results = results.filter(c => c.status === filters.status);
  }
  if (filters.teamName) {
    results = results.filter(c => c.teamName === filters.teamName);
  }
  if (filters.changeId) {
    results = results.filter(c => c.changeId === filters.changeId);
  }
  
  return results;
}

function getAllChanges() {
  return Array.from(changes.values());
}

function exportUnconfirmedList() {
  return getConfirmations({ status: 'pending' });
}

module.exports = {
  createSubscription,
  getSubscriptionsByApiPath,
  getAllSubscriptions,
  createChange,
  confirmImpact,
  markAsUnaffected,
  getConfirmations,
  getAllChanges,
  exportUnconfirmedList,
  RiskLevel,
  ChangeType
};
