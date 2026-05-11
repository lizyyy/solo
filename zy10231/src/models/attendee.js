const storage = require('../storage');

const GUEST_TYPES = ['正式嘉宾', 'VIP', '工作人员', '媒体', '临时嘉宾', '赞助商'];
const CHECKIN_STATUSES = ['未签到', '已签到', '已离场'];

function validateField(key, value, isNew = true) {
  const errors = [];
  
  if (!value || String(value).trim() === '') {
    if (['permissionZone', 'reprintReason'].includes(key)) {
      return errors;
    }
    return [`字段 "${key}" 不能为空`];
  }
  
  switch (key) {
    case 'badgeNumber':
      if (!/^[A-Za-z0-9]{3,12}$/.test(value)) {
        errors.push('胸牌编号必须是 3-12 位字母或数字');
      }
      break;
    case 'guestType':
      if (!GUEST_TYPES.includes(value)) {
        errors.push(`嘉宾类型无效，允许值: ${GUEST_TYPES.join(', ')}`);
      }
      break;
    case 'checkinStatus':
      if (!CHECKIN_STATUSES.includes(value)) {
        errors.push(`签到状态无效，允许值: ${CHECKIN_STATUSES.join(', ')}`);
      }
      break;
    case 'permissionZone':
      if (value && !/^[\u4e00-\u9fa5A-Za-z0-9, ]+$/.test(value)) {
        errors.push('权限区域格式不正确，仅支持中文、字母、数字、逗号和空格');
      }
      break;
  }
  
  return errors;
}

function buildAttendeeKey(data) {
  return `${data.name}_${data.company}_${data.phone || ''}`.toLowerCase().replace(/\s+/g, '');
}

function findByBadgeNumber(badgeNumber) {
  const attendees = storage.getAttendees();
  return attendees.find(a => a.badgeNumber === badgeNumber);
}

function findByNameAndCompany(name, company) {
  const attendees = storage.getAttendees();
  return attendees.find(a => 
    a.name === name && 
    a.company === company
  );
}

function findByKey(key) {
  const attendees = storage.getAttendees();
  return attendees.find(a => a.key === key);
}

function createOrUpdate(data) {
  const attendees = storage.getAttendees();
  const key = buildAttendeeKey(data);
  const existingIndex = attendees.findIndex(a => a.key === key);
  
  const now = new Date().toISOString();
  
  if (existingIndex >= 0) {
    const existing = attendees[existingIndex];
    const updated = {
      ...existing,
      name: data.name,
      company: data.company,
      guestType: data.guestType,
      phone: data.phone || existing.phone,
      email: data.email || existing.email,
      permissionZone: data.permissionZone || existing.permissionZone,
      checkinStatus: data.checkinStatus || existing.checkinStatus,
      updatedAt: now,
      reprintCount: existing.reprintCount || 0,
      reprintReasons: existing.reprintReasons || []
    };
    
    if (data.badgeNumber && data.badgeNumber !== existing.badgeNumber) {
      updated.badgeNumber = data.badgeNumber;
    }
    
    attendees[existingIndex] = updated;
    storage.saveAttendees(attendees);
    return { attendee: updated, isNew: false };
  }
  
  const newAttendee = {
    id: `A${Date.now()}${Math.random().toString(36).substr(2, 4)}`,
    key,
    name: data.name,
    company: data.company,
    badgeNumber: data.badgeNumber,
    guestType: data.guestType,
    phone: data.phone || '',
    email: data.email || '',
    permissionZone: data.permissionZone || '',
    checkinStatus: data.checkinStatus || '未签到',
    reprintCount: 0,
    reprintReasons: [],
    createdAt: now,
    updatedAt: now
  };
  
  attendees.push(newAttendee);
  storage.saveAttendees(attendees);
  return { attendee: newAttendee, isNew: true };
}

function incrementReprint(attendeeId, reason) {
  const attendees = storage.getAttendees();
  const index = attendees.findIndex(a => a.id === attendeeId);
  if (index < 0) return null;
  
  attendees[index].reprintCount = (attendees[index].reprintCount || 0) + 1;
  attendees[index].reprintReasons = [
    ...(attendees[index].reprintReasons || []),
    { reason, timestamp: new Date().toISOString() }
  ];
  attendees[index].updatedAt = new Date().toISOString();
  
  storage.saveAttendees(attendees);
  return attendees[index];
}

function updateCheckinStatus(badgeNumber, status) {
  const attendees = storage.getAttendees();
  const index = attendees.findIndex(a => a.badgeNumber === badgeNumber);
  if (index < 0) return null;
  
  attendees[index].checkinStatus = status;
  attendees[index].updatedAt = new Date().toISOString();
  
  storage.saveAttendees(attendees);
  return attendees[index];
}

function updateBadgeNumber(attendeeId, newBadgeNumber) {
  const attendees = storage.getAttendees();
  const index = attendees.findIndex(a => a.id === attendeeId);
  if (index < 0) return null;
  
  attendees[index].badgeNumber = newBadgeNumber;
  attendees[index].updatedAt = new Date().toISOString();
  
  storage.saveAttendees(attendees);
  return attendees[index];
}

function getAll() {
  return storage.getAttendees();
}

module.exports = {
  GUEST_TYPES,
  CHECKIN_STATUSES,
  validateField,
  buildAttendeeKey,
  findByBadgeNumber,
  findByNameAndCompany,
  findByKey,
  createOrUpdate,
  incrementReprint,
  updateCheckinStatus,
  updateBadgeNumber,
  getAll
};
