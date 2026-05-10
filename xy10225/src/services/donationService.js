const { v4: uuidv4 } = require('uuid');
const { loadStore, saveStore } = require('../storage/dataStore');

const validateDonation = (data) => {
  const errors = [];
  if (!data.itemName || data.itemName.trim() === '') {
    errors.push('物资名称不能为空');
  }
  if (!data.quantity || data.quantity < 1) {
    errors.push('物资数量必须大于0');
  }
  if (!data.unit || data.unit.trim() === '') {
    errors.push('物资单位不能为空');
  }
  if (!data.donor || data.donor.trim() === '') {
    errors.push('捐赠来源不能为空');
  }
  return errors;
};

const addDonation = (data) => {
  const store = loadStore();
  const validationErrors = validateDonation(data);
  
  if (validationErrors.length > 0) {
    return { success: false, errors: validationErrors };
  }

  const donation = {
    id: uuidv4(),
    itemName: data.itemName.trim(),
    quantity: parseInt(data.quantity),
    unit: data.unit.trim(),
    donor: data.donor.trim(),
    receivedDate: data.receivedDate || new Date().toISOString(),
    remainingQuantity: parseInt(data.quantity),
    notes: data.notes || '',
    category: data.category || '一般物资'
  };

  store.donations.push(donation);
  saveStore(store);
  
  return { success: true, donation };
};

const importDonations = (donationList) => {
  const store = loadStore();
  const results = {
    success: [],
    skipped: [],
    errors: []
  };

  donationList.forEach((item, index) => {
    const validationErrors = validateDonation(item);
    
    if (validationErrors.length > 0) {
      results.skipped.push({
        row: index + 1,
        data: item,
        reason: validationErrors.join('; ')
      });
      return;
    }

    const donation = {
      id: uuidv4(),
      itemName: item.itemName.trim(),
      quantity: parseInt(item.quantity),
      unit: item.unit.trim(),
      donor: item.donor.trim(),
      receivedDate: item.receivedDate || new Date().toISOString(),
      remainingQuantity: parseInt(item.quantity),
      notes: item.notes || '',
      category: item.category || '一般物资'
    };

    store.donations.push(donation);
    results.success.push(donation);
  });

  saveStore(store);
  return results;
};

const listDonations = (options = {}) => {
  const store = loadStore();
  let donations = [...store.donations];

  if (options.availableOnly) {
    donations = donations.filter(d => d.remainingQuantity > 0);
  }

  if (options.category) {
    donations = donations.filter(d => d.category === options.category);
  }

  return donations;
};

const getDonationById = (id) => {
  const store = loadStore();
  return store.donations.find(d => d.id === id);
};

const getInventorySummary = () => {
  const store = loadStore();
  const summary = {
    totalItems: store.donations.length,
    totalValue: 0,
    availableItems: store.donations.filter(d => d.remainingQuantity > 0).length,
    byCategory: {}
  };

  store.donations.forEach(d => {
    if (!summary.byCategory[d.category]) {
      summary.byCategory[d.category] = {
        count: 0,
        totalQuantity: 0,
        availableQuantity: 0
      };
    }
    summary.byCategory[d.category].count++;
    summary.byCategory[d.category].totalQuantity += d.quantity;
    summary.byCategory[d.category].availableQuantity += d.remainingQuantity;
  });

  return summary;
};

module.exports = {
  validateDonation,
  addDonation,
  importDonations,
  listDonations,
  getDonationById,
  getInventorySummary
};
