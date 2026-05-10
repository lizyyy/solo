const { v4: uuidv4 } = require('uuid');
const { loadStore, saveStore } = require('../storage/dataStore');
const { getHouseholdById } = require('./householdService');
const { getVolunteerById } = require('./volunteerService');
const { getDonationById } = require('./donationService');

const validateDelivery = (data, store) => {
  const errors = [];
  
  if (!data.householdId || data.householdId.trim() === '') {
    errors.push('户主ID不能为空');
  } else if (!store.households.find(h => h.id === data.householdId)) {
    errors.push('户主ID不存在');
  }

  if (!data.volunteerId || data.volunteerId.trim() === '') {
    errors.push('志愿者ID不能为空');
  } else if (!store.volunteers.find(v => v.id === data.volunteerId)) {
    errors.push('志愿者ID不存在');
  }

  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    errors.push('投递物资列表不能为空');
  } else {
    data.items.forEach((item, index) => {
      if (!item.donationId || item.donationId.trim() === '') {
        errors.push(`第 ${index + 1} 项物资的捐赠ID不能为空`);
      } else if (!store.donations.find(d => d.id === item.donationId)) {
        errors.push(`第 ${index + 1} 项物资的捐赠ID不存在`);
      }
      if (!item.quantity || item.quantity < 1) {
        errors.push(`第 ${index + 1} 项物资的数量必须大于0`);
      }
    });
  }

  return errors;
};

const createDelivery = (data) => {
  const store = loadStore();
  const validationErrors = validateDelivery(data, store);
  
  if (validationErrors.length > 0) {
    return { success: false, errors: validationErrors };
  }

  const deliveryItems = [];
  const stockErrors = [];

  data.items.forEach(item => {
    const donation = store.donations.find(d => d.id === item.donationId);
    if (donation.remainingQuantity < item.quantity) {
      stockErrors.push(
        `物资 ${donation.itemName} 库存不足 (剩余: ${donation.remainingQuantity}, 需要: ${item.quantity})`
      );
    }
    
    deliveryItems.push({
      donationId: item.donationId,
      itemName: donation.itemName,
      quantity: parseInt(item.quantity),
      unit: donation.unit,
      category: donation.category
    });
  });

  if (stockErrors.length > 0) {
    return { success: false, errors: stockErrors };
  }

  data.items.forEach(item => {
    const donation = store.donations.find(d => d.id === item.donationId);
    donation.remainingQuantity -= parseInt(item.quantity);
  });

  const household = store.households.find(h => h.id === data.householdId);
  const volunteer = store.volunteers.find(v => v.id === data.volunteerId);

  const delivery = {
    id: uuidv4(),
    householdId: data.householdId,
    householdName: household.name,
    volunteerId: data.volunteerId,
    volunteerName: volunteer.name,
    deliveryDate: data.deliveryDate || new Date().toISOString(),
    items: deliveryItems,
    notes: data.notes || '',
    status: 'pending_verification',
    signatureId: null,
    exceptionIds: [],
    createdAt: new Date().toISOString()
  };

  store.deliveries.push(delivery);
  saveStore(store);

  return { success: true, delivery };
};

const importDeliveries = (deliveryList) => {
  const store = loadStore();
  const results = {
    success: [],
    skipped: [],
    errors: []
  };

  deliveryList.forEach((item, index) => {
    try {
      const validationErrors = validateDelivery(item, store);
      
      if (validationErrors.length > 0) {
        results.skipped.push({
          row: index + 1,
          data: item,
          reason: validationErrors.join('; ')
        });
        return;
      }

      const result = createDelivery(item);
      if (result.success) {
        results.success.push(result.delivery);
      } else {
        results.skipped.push({
          row: index + 1,
          data: item,
          reason: result.errors.join('; ')
        });
      }
    } catch (error) {
      results.errors.push({
        row: index + 1,
        data: item,
        reason: error.message
      });
    }
  });

  return results;
};

const listDeliveries = (options = {}) => {
  const store = loadStore();
  let deliveries = [...store.deliveries];

  if (options.status) {
    deliveries = deliveries.filter(d => d.status === options.status);
  }

  if (options.volunteerId) {
    deliveries = deliveries.filter(d => d.volunteerId === options.volunteerId);
  }

  if (options.householdId) {
    deliveries = deliveries.filter(d => d.householdId === options.householdId);
  }

  return deliveries;
};

const getDeliveryById = (id) => {
  const store = loadStore();
  return store.deliveries.find(d => d.id === id);
};

const getDeliveriesPendingVerification = () => {
  const store = loadStore();
  return store.deliveries.filter(d => d.status === 'pending_verification');
};

module.exports = {
  validateDelivery,
  createDelivery,
  importDeliveries,
  listDeliveries,
  getDeliveryById,
  getDeliveriesPendingVerification
};
