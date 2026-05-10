const { v4: uuidv4 } = require('uuid');
const { loadStore, saveStore } = require('../storage/dataStore');

const validateVolunteer = (data) => {
  const errors = [];
  if (!data.name || data.name.trim() === '') {
    errors.push('志愿者姓名不能为空');
  }
  if (!data.phone || data.phone.trim() === '') {
    errors.push('联系电话不能为空');
  }
  return errors;
};

const registerVolunteer = (data) => {
  const store = loadStore();
  const validationErrors = validateVolunteer(data);
  
  if (validationErrors.length > 0) {
    return { success: false, errors: validationErrors };
  }

  const existing = store.volunteers.find(
    v => v.phone === data.phone.trim()
  );

  if (existing) {
    return { 
      success: false, 
      errors: [`志愿者已存在 (ID: ${existing.id})`] 
    };
  }

  const volunteer = {
    id: uuidv4(),
    name: data.name.trim(),
    phone: data.phone.trim(),
    organization: data.organization || '个人志愿者',
    createdAt: new Date().toISOString(),
    isActive: true
  };

  store.volunteers.push(volunteer);
  saveStore(store);
  
  return { success: true, volunteer };
};

const listVolunteers = (options = {}) => {
  const store = loadStore();
  let volunteers = [...store.volunteers];

  if (options.activeOnly) {
    volunteers = volunteers.filter(v => v.isActive);
  }

  return volunteers;
};

const getVolunteerById = (id) => {
  const store = loadStore();
  return store.volunteers.find(v => v.id === id);
};

const getVolunteerStats = () => {
  const store = loadStore();
  const stats = [];

  store.volunteers.forEach(volunteer => {
    const volunteerDeliveries = store.deliveries.filter(
      d => d.volunteerId === volunteer.id
    );

    const volunteerSignatures = store.signatures.filter(
      s => s.verifiedBy === volunteer.id
    );

    const exceptions = store.exceptions.filter(
      e => e.relatedVolunteerId === volunteer.id
    );

    stats.push({
      volunteerId: volunteer.id,
      volunteerName: volunteer.name,
      totalDeliveries: volunteerDeliveries.length,
      totalSignatures: volunteerSignatures.length,
      exceptionCount: exceptions.length,
      successRate: volunteerDeliveries.length > 0 
        ? ((volunteerDeliveries.length - exceptions.filter(e => e.type === 'missing').length) / volunteerDeliveries.length * 100).toFixed(1)
        : '100.0'
    });
  });

  return stats.sort((a, b) => b.totalDeliveries - a.totalDeliveries);
};

module.exports = {
  validateVolunteer,
  registerVolunteer,
  listVolunteers,
  getVolunteerById,
  getVolunteerStats
};
