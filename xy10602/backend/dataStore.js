const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, 'data');

function loadJSON(filename) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return [];
  }
}

function saveJSON(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${uuidv4().slice(0, 8)}`;
}

function generateIdSimple(prefix, counter) {
  return `${prefix}-${String(counter).padStart(3, '0')}`;
}

function getNextId(data, prefix) {
  if (data.length === 0) return `${prefix}-001`;
  const maxNum = Math.max(...data.map(item => {
    const match = item.id.match(new RegExp(`${prefix}-(\\d+)`));
    return match ? parseInt(match[1]) : 0;
  }));
  return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
}

function ensureStableId(data, prefix, newData) {
  const existing = data.find(item => {
    if (item.assetNumber && newData.assetNumber) {
      return item.assetNumber === newData.assetNumber;
    }
    if (item.employeeId && newData.employeeId) {
      return item.employeeId === newData.employeeId;
    }
    if (item.acceptanceId && newData.acceptanceId) {
      return item.acceptanceId === newData.acceptanceId;
    }
    if (item.id && newData.id) {
      return item.id === newData.id;
    }
    return false;
  });
  if (existing) return existing.id;
  return getNextId(data, prefix);
}

function updateData(dataArray, newItem, identifier) {
  const index = dataArray.findIndex(item => {
    if (identifier.assetNumber) {
      return item.assetNumber === identifier.assetNumber;
    }
    if (identifier.employeeId) {
      return item.employeeId === identifier.employeeId;
    }
    if (identifier.acceptanceId) {
      return item.acceptanceId === identifier.acceptanceId;
    }
    if (identifier.id) {
      return item.id === identifier.id;
    }
    return false;
  });

  if (index === -1) {
    dataArray.push({ ...newItem });
  } else {
    dataArray[index] = { ...newItem, id: dataArray[index].id };
  }

  return dataArray;
}

function stableUpdate(dataArray, newItem, identifier) {
  const existing = dataArray.find(item => {
    if (identifier.assetNumber) {
      return item.assetNumber === identifier.assetNumber;
    }
    if (identifier.employeeId) {
      return item.employeeId === identifier.employeeId;
    }
    if (identifier.acceptanceId) {
      return item.acceptanceId === identifier.acceptanceId;
    }
    if (identifier.id) {
      return item.id === identifier.id;
    }
    return false;
  });

  if (existing) {
    const changes = {};
    Object.keys(newItem).forEach(key => {
      if (JSON.stringify(existing[key]) !== JSON.stringify(newItem[key])) {
        changes[key] = {
          oldValue: existing[key],
          newValue: newItem[key]
        };
      }
    });
    
    if (Object.keys(changes).length > 0) {
      Object.assign(existing, newItem);
      return {
        success: true,
        updated: true,
        changes,
        item: existing
      };
    } else {
      return {
        success: true,
        updated: false,
        changes: {},
        item: existing
      };
    }
  } else {
    dataArray.push({ ...newItem });
    return {
      success: true,
      updated: true,
      isNew: true,
      item: newItem
    };
  }
}

module.exports = {
  loadJSON,
  saveJSON,
  generateId,
  getNextId,
  ensureStableId,
  updateData,
  stableUpdate
};
