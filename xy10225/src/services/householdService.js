const { v4: uuidv4 } = require('uuid');
const { loadStore, saveStore } = require('../storage/dataStore');

const validateHousehold = (data) => {
  const errors = [];
  if (!data.name || data.name.trim() === '') {
    errors.push('户主姓名不能为空');
  }
  if (!data.address || data.address.trim() === '') {
    errors.push('住址不能为空');
  }
  if (!data.phone || data.phone.trim() === '') {
    errors.push('联系电话不能为空');
  }
  if (data.familyMembers === undefined || data.familyMembers < 1) {
    errors.push('家庭人数必须大于等于1');
  }
  return errors;
};

const importHouseholds = (householdList) => {
  const store = loadStore();
  const results = {
    success: [],
    skipped: [],
    errors: []
  };

  householdList.forEach((item, index) => {
    const validationErrors = validateHousehold(item);
    
    if (validationErrors.length > 0) {
      results.skipped.push({
        row: index + 1,
        data: item,
        reason: validationErrors.join('; ')
      });
      return;
    }

    const existing = store.households.find(
      h => h.phone === item.phone || (h.name === item.name && h.address === item.address)
    );

    if (existing) {
      results.skipped.push({
        row: index + 1,
        data: item,
        reason: `户主已存在 (ID: ${existing.id})`
      });
      return;
    }

    const household = {
      id: uuidv4(),
      name: item.name.trim(),
      address: item.address.trim(),
      phone: item.phone.trim(),
      familyMembers: parseInt(item.familyMembers),
      notes: item.notes || '',
      createdAt: new Date().toISOString(),
      isActive: true
    };

    store.households.push(household);
    results.success.push(household);
  });

  saveStore(store);
  return results;
};

const listHouseholds = (options = {}) => {
  const store = loadStore();
  let households = [...store.households];

  if (options.activeOnly) {
    households = households.filter(h => h.isActive);
  }

  return households;
};

const getHouseholdById = (id) => {
  const store = loadStore();
  return store.households.find(h => h.id === id);
};

module.exports = {
  validateHousehold,
  importHouseholds,
  listHouseholds,
  getHouseholdById
};
