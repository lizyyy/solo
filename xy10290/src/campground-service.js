const db = require('./database');
const { v4: uuidv4 } = require('uuid');
const { RuleViolation, ValidationError } = require('./rules');
const issueTracker = require('./issue-tracker');

function createCampsite(name) {
  const id = uuidv4();
  const now = Date.now();
  
  db.prepare(`
    INSERT INTO campsites (id, name, created_at) VALUES (?, ?, ?)
  `).run(id, name, now);
  
  return { id, name, created_at: now };
}

function createParkingSpot(campsiteId, spotNumber) {
  const id = uuidv4();
  const now = Date.now();
  
  db.prepare(`
    INSERT INTO parking_spots (id, campsite_id, spot_number, created_at) VALUES (?, ?, ?, ?)
  `).run(id, campsiteId, spotNumber, now);
  
  return { id, campsite_id: campsiteId, spot_number: spotNumber, created_at: now };
}

function createUtilityPillar(campsiteId, pillarCode, waterFee, electricFee) {
  const id = uuidv4();
  const now = Date.now();
  
  db.prepare(`
    INSERT INTO utility_pillars 
      (id, campsite_id, pillar_code, water_fee_per_unit, electric_fee_per_unit, created_at) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, campsiteId, pillarCode, waterFee || 500, electricFee || 800, now);
  
  return { 
    id, 
    campsite_id: campsiteId, 
    pillar_code: pillarCode,
    water_fee_per_unit: waterFee || 500,
    electric_fee_per_unit: electricFee || 800,
    created_at: now 
  };
}

function connectPillarToSpot(pillarId, spotId) {
  const id = uuidv4();
  const now = Date.now();
  
  try {
    db.prepare(`
      INSERT INTO pillar_spot_connections (id, pillar_id, spot_id, is_active, created_at) 
      VALUES (?, ?, ?, 1, ?)
    `).run(id, pillarId, spotId, now);
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      db.prepare(`
        UPDATE pillar_spot_connections 
        SET is_active = 1 
        WHERE pillar_id = ? AND spot_id = ?
      `).run(pillarId, spotId);
    } else {
      throw e;
    }
  }
  
  return { pillar_id: pillarId, spot_id: spotId, connected: true };
}

function getSpotConnectedPillars(spotId) {
  return db.prepare(`
    SELECT up.* 
    FROM pillar_spot_connections psc
    JOIN utility_pillars up ON psc.pillar_id = up.id
    WHERE psc.spot_id = ? AND psc.is_active = 1
  `).all(spotId);
}

function getPillarConnectedSpots(pillarId) {
  return db.prepare(`
    SELECT ps.* 
    FROM pillar_spot_connections psc
    JOIN parking_spots ps ON psc.spot_id = ps.id
    WHERE psc.pillar_id = ? AND psc.is_active = 1
  `).all(pillarId);
}

function getActiveStayAtSpot(spotId) {
  return db.prepare(`
    SELECT * FROM stays 
    WHERE spot_id = ? AND status = 'CHECKED_IN'
    ORDER BY check_in_time DESC
    LIMIT 1
  `).get(spotId);
}

function getLastCheckoutAtSpot(spotId) {
  return db.prepare(`
    SELECT check_out_time FROM stays 
    WHERE spot_id = ? AND status = 'CHECKED_OUT'
    ORDER BY check_out_time DESC
    LIMIT 1
  `).get(spotId);
}

function checkIn(campsiteId, spotId, vehiclePlate, depositAmount, checkInTime) {
  const now = Date.now();
  const effectiveCheckIn = checkInTime || now;
  
  if (effectiveCheckIn > now) {
    throw new RuleViolation(
      'R002',
      `入住时间 ${new Date(effectiveCheckIn).toISOString()} 不能晚于当前时间`,
      'CHECK_IN',
      vehiclePlate
    );
  }
  
  const activeStay = getActiveStayAtSpot(spotId);
  if (activeStay) {
    throw new RuleViolation(
      'R001',
      `车位 ${spotId} 已有在住记录 ${activeStay.id}（车牌 ${activeStay.vehicle_plate}）`,
      'CHECK_IN',
      vehiclePlate
    );
  }
  
  const lastCheckout = getLastCheckoutAtSpot(spotId);
  if (lastCheckout && effectiveCheckIn < lastCheckout.check_out_time) {
    throw new RuleViolation(
      'R002',
      `入住时间 ${new Date(effectiveCheckIn).toISOString()} 早于最近退营时间 ${new Date(lastCheckout.check_out_time).toISOString()}`,
      'CHECK_IN',
      vehiclePlate
    );
  }
  
  const stayId = uuidv4();
  
  db.prepare(`
    INSERT INTO stays 
      (id, campsite_id, spot_id, vehicle_plate, check_in_time, deposit_amount, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'CHECKED_IN', ?)
  `).run(stayId, campsiteId, spotId, vehiclePlate, effectiveCheckIn, depositAmount, now);
  
  return {
    id: stayId,
    campsite_id: campsiteId,
    spot_id: spotId,
    vehicle_plate: vehiclePlate,
    check_in_time: effectiveCheckIn,
    deposit_amount: depositAmount,
    status: 'CHECKED_IN'
  };
}

function getPillarLastReading(pillarId) {
  return db.prepare(`
    SELECT * FROM meter_readings 
    WHERE pillar_id = ? 
    ORDER BY reading_time DESC 
    LIMIT 1
  `).get(pillarId);
}

function recordMeterReading(pillarId, readingTime, waterReading, electricReading, sourceType, sourceRef, isCorrection = false) {
  const now = Date.now();
  const effectiveReadingTime = readingTime || now;
  
  const lastReading = getPillarLastReading(pillarId);
  
  if (lastReading && !isCorrection) {
    if (effectiveReadingTime <= lastReading.reading_time) {
      throw new RuleViolation(
        'R003',
        `新读数时间 ${new Date(effectiveReadingTime).toISOString()} 不晚于历史最新读数时间 ${new Date(lastReading.reading_time).toISOString()}`,
        'METER_READING',
        pillarId
      );
    }
    
    if (waterReading < lastReading.water_reading) {
      throw new RuleViolation(
        'R004',
        `水表读数回退：当前 ${waterReading} < 历史 ${lastReading.water_reading}`,
        'METER_READING',
        pillarId
      );
    }
    
    if (electricReading < lastReading.electric_reading) {
      throw new RuleViolation(
        'R004',
        `电表读数回退：当前 ${electricReading} < 历史 ${lastReading.electric_reading}`,
        'METER_READING',
        pillarId
      );
    }
  }
  
  const readingId = uuidv4();
  
  db.prepare(`
    INSERT INTO meter_readings 
      (id, pillar_id, reading_time, water_reading, electric_reading, source_type, source_ref, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    readingId,
    pillarId,
    effectiveReadingTime,
    waterReading,
    electricReading,
    sourceType || 'MANUAL',
    sourceRef,
    now
  );
  
  return {
    id: readingId,
    pillar_id: pillarId,
    reading_time: effectiveReadingTime,
    water_reading: waterReading,
    electric_reading: electricReading,
    source_type: sourceType || 'MANUAL'
  };
}

function getActiveStaysAtTime(spotIds, timestamp) {
  if (!spotIds || spotIds.length === 0) return [];
  
  const placeholders = spotIds.map(() => '?').join(',');
  
  return db.prepare(`
    SELECT * FROM stays 
    WHERE spot_id IN (${placeholders})
    AND check_in_time <= ?
    AND (check_out_time IS NULL OR check_out_time >= ?)
    AND status = 'CHECKED_IN'
  `).all(...spotIds, timestamp, timestamp);
}

function getStaysBetweenTimes(spotIds, fromTime, toTime) {
  if (!spotIds || spotIds.length === 0) return [];
  
  const placeholders = spotIds.map(() => '?').join(',');
  
  return db.prepare(`
    SELECT * FROM stays 
    WHERE spot_id IN (${placeholders})
    AND (check_out_time IS NULL OR check_out_time >= ?)
    AND check_in_time <= ?
    ORDER BY check_in_time ASC
  `).all(...spotIds, fromTime, toTime);
}

function allocateUtilityUsage(pillarId, fromReadingId, toReadingId, allocationType, sourceRef) {
  const pillar = db.prepare('SELECT * FROM utility_pillars WHERE id = ?').get(pillarId);
  if (!pillar) {
    throw new ValidationError(`水电桩 ${pillarId} 不存在`, 'pillar_id');
  }
  
  const fromReading = db.prepare('SELECT * FROM meter_readings WHERE id = ?').get(fromReadingId);
  const toReading = db.prepare('SELECT * FROM meter_readings WHERE id = ?').get(toReadingId);
  
  if (!toReading) {
    throw new ValidationError(`终止读数 ${toReadingId} 不存在`, 'to_reading_id');
  }
  
  if (fromReadingId && !fromReading) {
    throw new ValidationError(`起始读数 ${fromReadingId} 不存在`, 'from_reading_id');
  }
  
  if (fromReading && fromReading.reading_time >= toReading.reading_time) {
    throw new ValidationError('起始读数时间必须早于终止读数时间', 'from_reading_id');
  }
  
  const waterDelta = toReading.water_reading - (fromReading ? fromReading.water_reading : 0);
  const electricDelta = toReading.electric_reading - (fromReading ? fromReading.electric_reading : 0);
  
  const connectedSpots = getPillarConnectedSpots(pillarId);
  const spotIds = connectedSpots.map(s => s.id);
  
  if (spotIds.length === 0) {
    issueTracker.createIssue(
      issueTracker.ISSUE_TYPES.ALLOCATION_DISCREPANCY,
      'ALLOCATION',
      pillarId,
      { pillarId, fromReadingId, toReadingId },
      `水电桩 ${pillarId} 没有绑定的车位，无法分摊`,
      issueTracker.SEVERITY.HIGH
    );
    return {
      pillar_id: pillarId,
      from_reading_id: fromReadingId,
      to_reading_id: toReadingId,
      water_delta: waterDelta,
      electric_delta: electricDelta,
      allocations: [],
      note: '无绑定车位，分摊跳过（已记录问题）'
    };
  }
  
  const activeStays = getStaysBetweenTimes(
    spotIds, 
    fromReading ? fromReading.reading_time : 0,
    toReading.reading_time
  );
  
  const allocationStart = fromReading ? fromReading.reading_time : 0;
  const allocationEnd = toReading.reading_time;
  
  const spotStayMap = new Map();
  for (const stay of activeStays) {
    if (!spotStayMap.has(stay.spot_id)) {
      spotStayMap.set(stay.spot_id, []);
    }
    spotStayMap.get(stay.spot_id).push(stay);
  }
  
  const spotActiveTimes = new Map();
  for (const [spotId, stays] of spotStayMap) {
    let totalActiveMs = 0;
    for (const stay of stays) {
      const stayStart = Math.max(stay.check_in_time, allocationStart);
      const stayEnd = Math.min(stay.check_out_time || allocationEnd, allocationEnd);
      if (stayEnd > stayStart) {
        totalActiveMs += (stayEnd - stayStart);
      }
    }
    spotActiveTimes.set(spotId, totalActiveMs);
  }
  
  const totalActiveMs = Array.from(spotActiveTimes.values()).reduce((a, b) => a + b, 0);
  
  const allocations = [];
  const now = Date.now();
  
  for (const [spotId, activeMs] of spotActiveTimes) {
    if (activeMs === 0) continue;
    
    const ratio = totalActiveMs > 0 ? activeMs / totalActiveMs : 0;
    const waterUnits = Math.round(waterDelta * ratio);
    const electricUnits = Math.round(electricDelta * ratio);
    
    const staysForSpot = spotStayMap.get(spotId) || [];
    if (staysForSpot.length === 0) continue;
    
    let targetStay = null;
    for (const stay of staysForSpot) {
      const stayStart = Math.max(stay.check_in_time, allocationStart);
      const stayEnd = Math.min(stay.check_out_time || allocationEnd, allocationEnd);
      if (stayEnd > stayStart) {
        targetStay = stay;
        break;
      }
    }
    
    if (!targetStay) continue;
    
    const existingAlloc = db.prepare(`
      SELECT * FROM utility_allocations 
      WHERE stay_id = ? AND pillar_id = ? AND to_reading_id = ?
    `).get(targetStay.id, pillarId, toReadingId);
    
    if (existingAlloc) {
      allocations.push(existingAlloc);
      continue;
    }
    
    const waterCost = waterUnits * pillar.water_fee_per_unit;
    const electricCost = electricUnits * pillar.electric_fee_per_unit;
    const totalCost = waterCost + electricCost;
    
    const allocId = uuidv4();
    
    db.prepare(`
      INSERT INTO utility_allocations
        (id, stay_id, pillar_id, allocation_type, from_reading_id, to_reading_id,
         water_units, electric_units, water_cost, electric_cost, total_cost, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?)
    `).run(
      allocId,
      targetStay.id,
      pillarId,
      allocationType || 'AUTO',
      fromReadingId,
      toReadingId,
      waterUnits,
      electricUnits,
      waterCost,
      electricCost,
      totalCost,
      now
    );
    
    allocations.push({
      id: allocId,
      stay_id: targetStay.id,
      pillar_id: pillarId,
      allocation_type: allocationType || 'AUTO',
      from_reading_id: fromReadingId,
      to_reading_id: toReadingId,
      water_units: waterUnits,
      electric_units: electricUnits,
      water_cost: waterCost,
      electric_cost: electricCost,
      total_cost: totalCost,
      active_ratio: ratio,
      active_duration_ms: activeMs
    });
  }
  
  const allocatedWater = allocations.reduce((sum, a) => sum + (a.water_units || 0), 0);
  const allocatedElectric = allocations.reduce((sum, a) => sum + (a.electric_units || 0), 0);
  
  if (allocatedWater !== waterDelta || allocatedElectric !== electricDelta) {
    issueTracker.createIssue(
      issueTracker.ISSUE_TYPES.ALLOCATION_DISCREPANCY,
      'ALLOCATION',
      pillarId,
      { 
        pillarId, fromReadingId, toReadingId, 
        waterDelta, electricDelta,
        allocatedWater, allocatedElectric 
      },
      `水电桩 ${pillarId} 分摊金额与实际用量不符：水 ${allocatedWater}/${waterDelta}，电 ${allocatedElectric}/${electricDelta}`,
      issueTracker.SEVERITY.HIGH
    );
  }
  
  return {
    pillar_id: pillarId,
    from_reading_id: fromReadingId,
    to_reading_id: toReadingId,
    water_delta: waterDelta,
    electric_delta: electricDelta,
    total_active_duration_ms: totalActiveMs,
    allocations
  };
}

function getStayAllocations(stayId) {
  return db.prepare(`
    SELECT ua.*, up.pillar_code 
    FROM utility_allocations ua
    JOIN utility_pillars up ON ua.pillar_id = up.id
    WHERE ua.stay_id = ?
    ORDER BY ua.created_at ASC
  `).all(stayId);
}

function getStaySummary(stayId) {
  const stay = db.prepare('SELECT * FROM stays WHERE id = ?').get(stayId);
  if (!stay) return null;
  
  const allocations = getStayAllocations(stayId);
  
  const totalWaterUnits = allocations.reduce((sum, a) => sum + a.water_units, 0);
  const totalElectricUnits = allocations.reduce((sum, a) => sum + a.electric_units, 0);
  const totalWaterCost = allocations.reduce((sum, a) => sum + a.water_cost, 0);
  const totalElectricCost = allocations.reduce((sum, a) => sum + a.electric_cost, 0);
  const totalUtilityCost = allocations.reduce((sum, a) => sum + a.total_cost, 0);
  
  return {
    stay,
    allocations,
    totals: {
      water_units: totalWaterUnits,
      electric_units: totalElectricUnits,
      water_cost: totalWaterCost,
      electric_cost: totalElectricCost,
      total_utility_cost: totalUtilityCost,
      deposit_amount: stay.deposit_amount,
      balance: stay.deposit_amount - totalUtilityCost
    }
  };
}

module.exports = {
  createCampsite,
  createParkingSpot,
  createUtilityPillar,
  connectPillarToSpot,
  getSpotConnectedPillars,
  getPillarConnectedSpots,
  getActiveStayAtSpot,
  getLastCheckoutAtSpot,
  checkIn,
  getPillarLastReading,
  recordMeterReading,
  getActiveStaysAtTime,
  getStaysBetweenTimes,
  allocateUtilityUsage,
  getStayAllocations,
  getStaySummary
};
