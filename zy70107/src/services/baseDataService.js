const db = require('../database');
const { v4: uuidv4 } = require('uuid');

function createBoat(data) {
  const { name, registration_number, crew_capacity, fuel_tank_capacity } = data;
  
  if (!name || !registration_number || crew_capacity === undefined || fuel_tank_capacity === undefined) {
    throw new Error('缺少必要参数');
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO boats (id, name, registration_number, crew_capacity, fuel_tank_capacity, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(id, name, registration_number, crew_capacity, fuel_tank_capacity);

  return getBoat(id);
}

function getBoat(id) {
  return db.prepare('SELECT * FROM boats WHERE id = ?').get(id);
}

function listBoats() {
  return db.prepare('SELECT * FROM boats ORDER BY created_at DESC').all();
}

function updateBoat(id, data) {
  const boat = db.prepare('SELECT * FROM boats WHERE id = ?').get(id);
  if (!boat) throw new Error('渔船不存在');

  const fields = [];
  const values = [];
  
  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if (data.registration_number !== undefined) {
    fields.push('registration_number = ?');
    values.push(data.registration_number);
  }
  if (data.crew_capacity !== undefined) {
    fields.push('crew_capacity = ?');
    values.push(data.crew_capacity);
  }
  if (data.fuel_tank_capacity !== undefined) {
    fields.push('fuel_tank_capacity = ?');
    values.push(data.fuel_tank_capacity);
  }
  if (data.status !== undefined) {
    fields.push('status = ?');
    values.push(data.status);
  }

  if (fields.length === 0) return boat;

  values.push(id);
  db.prepare(`UPDATE boats SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getBoat(id);
}

function createCrew(data) {
  const { name, id_card, certificate_number, certificate_type } = data;
  
  if (!name || !id_card) {
    throw new Error('缺少必要参数');
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO crew (id, name, id_card, certificate_number, certificate_type, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(id, name, id_card, certificate_number, certificate_type);

  return getCrew(id);
}

function getCrew(id) {
  return db.prepare('SELECT * FROM crew WHERE id = ?').get(id);
}

function listCrew() {
  return db.prepare('SELECT * FROM crew ORDER BY created_at DESC').all();
}

function updateCrew(id, data) {
  const crew = db.prepare('SELECT * FROM crew WHERE id = ?').get(id);
  if (!crew) throw new Error('船员不存在');

  const fields = [];
  const values = [];
  
  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if (data.id_card !== undefined) {
    fields.push('id_card = ?');
    values.push(data.id_card);
  }
  if (data.certificate_number !== undefined) {
    fields.push('certificate_number = ?');
    values.push(data.certificate_number);
  }
  if (data.certificate_type !== undefined) {
    fields.push('certificate_type = ?');
    values.push(data.certificate_type);
  }
  if (data.status !== undefined) {
    fields.push('status = ?');
    values.push(data.status);
  }

  if (fields.length === 0) return crew;

  values.push(id);
  db.prepare(`UPDATE crew SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getCrew(id);
}

function createNoFishingZone(data) {
  const { name, description, coordinates, start_date, end_date } = data;
  
  if (!name || !coordinates) {
    throw new Error('缺少必要参数');
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO no_fishing_zones (id, name, description, coordinates, start_date, end_date, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(id, name, description, typeof coordinates === 'string' ? coordinates : JSON.stringify(coordinates), start_date, end_date);

  return getNoFishingZone(id);
}

function getNoFishingZone(id) {
  const zone = db.prepare('SELECT * FROM no_fishing_zones WHERE id = ?').get(id);
  if (zone && zone.coordinates) {
    try {
      zone.coordinates = JSON.parse(zone.coordinates);
    } catch (e) {
    }
  }
  return zone;
}

function listNoFishingZones() {
  const zones = db.prepare('SELECT * FROM no_fishing_zones ORDER BY created_at DESC').all();
  return zones.map(zone => {
    if (zone.coordinates) {
      try {
        zone.coordinates = JSON.parse(zone.coordinates);
      } catch (e) {
      }
    }
    return zone;
  });
}

function updateNoFishingZone(id, data) {
  const zone = db.prepare('SELECT * FROM no_fishing_zones WHERE id = ?').get(id);
  if (!zone) throw new Error('禁渔区不存在');

  const fields = [];
  const values = [];
  
  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if (data.description !== undefined) {
    fields.push('description = ?');
    values.push(data.description);
  }
  if (data.coordinates !== undefined) {
    fields.push('coordinates = ?');
    values.push(typeof data.coordinates === 'string' ? data.coordinates : JSON.stringify(data.coordinates));
  }
  if (data.start_date !== undefined) {
    fields.push('start_date = ?');
    values.push(data.start_date);
  }
  if (data.end_date !== undefined) {
    fields.push('end_date = ?');
    values.push(data.end_date);
  }
  if (data.is_active !== undefined) {
    fields.push('is_active = ?');
    values.push(data.is_active ? 1 : 0);
  }

  if (fields.length === 0) return getNoFishingZone(id);

  values.push(id);
  db.prepare(`UPDATE no_fishing_zones SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getNoFishingZone(id);
}

module.exports = {
  createBoat,
  getBoat,
  listBoats,
  updateBoat,
  createCrew,
  getCrew,
  listCrew,
  updateCrew,
  createNoFishingZone,
  getNoFishingZone,
  listNoFishingZones,
  updateNoFishingZone
};
