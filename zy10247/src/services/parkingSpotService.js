const { db } = require('../database');
const { generateId, now, logOperation } = require('../utils');

async function createParkingSpot(data) {
  const { spotNumber, ownerId, ownerName, pricePerHour } = data;

  const existing = await db.get('SELECT id FROM parking_spots WHERE spot_number = ?', [spotNumber]);
  if (existing) {
    throw new Error('车位编号已存在');
  }

  const id = generateId();
  await db.run(
    `INSERT INTO parking_spots (id, spot_number, owner_id, owner_name, price_per_hour, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'available', ?, ?)`,
    [id, spotNumber, ownerId, ownerName, pricePerHour, now(), now()]
  );

  return getParkingSpotById(id);
}

async function getParkingSpotById(id) {
  return await db.get('SELECT * FROM parking_spots WHERE id = ?', [id]);
}

async function getParkingSpotByNumber(spotNumber) {
  return await db.get('SELECT * FROM parking_spots WHERE spot_number = ?', [spotNumber]);
}

async function listParkingSpots(status = null) {
  let query = 'SELECT * FROM parking_spots';
  const params = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';
  return await db.all(query, params);
}

async function updateParkingSpot(id, data) {
  const spot = await getParkingSpotById(id);
  if (!spot) {
    throw new Error('车位不存在');
  }

  const updates = [];
  const params = [];

  if (data.pricePerHour !== undefined) {
    updates.push('price_per_hour = ?');
    params.push(data.pricePerHour);
  }

  if (data.status !== undefined) {
    updates.push('status = ?');
    params.push(data.status);
  }

  if (updates.length === 0) {
    return spot;
  }

  updates.push('updated_at = ?');
  params.push(now(), id);

  await db.run(`UPDATE parking_spots SET ${updates.join(', ')} WHERE id = ?`, params);

  return getParkingSpotById(id);
}

module.exports = {
  createParkingSpot,
  getParkingSpotById,
  getParkingSpotByNumber,
  listParkingSpots,
  updateParkingSpot
};
