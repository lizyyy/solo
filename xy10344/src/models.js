class Athlete {
  constructor(data) {
    this.bib = data.bib;
    this.name = data.name;
    this.phone = data.phone || '';
    this.category = data.category || '';
    this.gender = data.gender || '';
  }
}

class EquipmentItem {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.category = data.category || 'general';
    this.required = data.required !== false;
  }
}

class ScanRecord {
  constructor(data) {
    this.bib = data.bib;
    this.type = data.type;
    this.timestamp = data.timestamp || new Date().toISOString();
    this.scanner = data.scanner || 'unknown';
  }
}

class EquipmentCheck {
  constructor(data) {
    this.bib = data.bib;
    this.equipmentId = data.equipmentId;
    this.present = data.present || false;
    this.timestamp = data.timestamp || new Date().toISOString();
  }
}

class Waiving {
  constructor(data) {
    this.bib = data.bib;
    this.equipmentId = data.equipmentId;
    this.reason = data.reason;
    this.authorizedBy = data.authorizedBy || 'unknown';
    this.timestamp = data.timestamp || new Date().toISOString();
  }
}

class CheckInStatus {
  static get VALUES() {
    return {
      PENDING: 'pending',
      APPROVED: 'approved',
      PENDING_EQUIPMENT: 'pending_equipment',
      WAIVED: 'waived',
      REJECTED: 'rejected'
    };
  }
}

module.exports = {
  Athlete,
  EquipmentItem,
  ScanRecord,
  EquipmentCheck,
  Waiving,
  CheckInStatus
};
