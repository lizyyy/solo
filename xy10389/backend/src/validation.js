const { getData } = require('./database');

const CAT_SPECIES_ID = 1;
const DOG_SPECIES_ID = 2;

function checkCatDogIsolation(speciesId, cageId) {
  const data = getData();
  const cage = data.cages.find(c => c.id === cageId);

  if (!cage) {
    return { valid: false, error: '笼位不存在' };
  }

  const activeHospitalizations = data.hospitalizations
    .filter(h => h.cage_id === cageId && h.status === 'active')
    .map(h => {
      const pet = data.pets.find(p => p.id === h.pet_id);
      return { ...h, species_id: pet ? pet.species_id : null };
    });

  for (const h of activeHospitalizations) {
    if (h.species_id === CAT_SPECIES_ID && speciesId === DOG_SPECIES_ID) {
      return { valid: false, error: '隔离违规：猫和狗不能同住一笼' };
    }
    if (h.species_id === DOG_SPECIES_ID && speciesId === CAT_SPECIES_ID) {
      return { valid: false, error: '隔离违规：狗和猫不能同住一笼' };
    }
  }

  return { valid: true };
}

function checkInfectiousIsolation(isInfectious, cageId) {
  const data = getData();
  const cage = data.cages.find(c => c.id === cageId);

  if (!cage) {
    return { valid: false, error: '笼位不存在' };
  }

  if (isInfectious && !cage.is_isolation) {
    return { valid: false, error: '隔离违规：传染病病例必须使用隔离笼位' };
  }

  if (cage.is_isolation) {
    const hasNonInfectious = data.hospitalizations.some(h => 
      h.cage_id === cageId && h.status === 'active' && !h.is_infectious
    );

    if (hasNonInfectious) {
      return { valid: false, error: '隔离违规：隔离笼位不能放置非传染病病例' };
    }
  }

  return { valid: true };
}

function checkCageOccupancyConflict(cageId, admissionDate, expectedDischargeDate, excludeHospitalizationId = null) {
  const data = getData();
  
  const existing = data.hospitalizations.filter(h => 
    h.cage_id === cageId && 
    ['active', 'scheduled'].includes(h.status) &&
    h.id !== excludeHospitalizationId
  );

  const newStart = new Date(admissionDate).getTime();
  const newEnd = expectedDischargeDate ? new Date(expectedDischargeDate).getTime() : null;

  for (const h of existing) {
    const hStart = new Date(h.admission_date).getTime();
    const hEnd = h.expected_discharge_date ? new Date(h.expected_discharge_date).getTime() : null;

    const hasOverlap = newEnd === null || hEnd === null
      ? true
      : newStart < hEnd && newEnd > hStart;

    if (hasOverlap) {
      return {
        valid: false,
        error: '时间冲突：该笼位在此时间段已被占用',
        conflict: {
          hospitalization_id: h.id,
          admission_date: h.admission_date,
          expected_discharge_date: h.expected_discharge_date
        }
      };
    }
  }

  return { valid: true };
}

function checkPendingCareTasks(hospitalizationId) {
  const data = getData();
  
  const pendingTasks = data.care_tasks.filter(t => 
    t.hospitalization_id === hospitalizationId && t.status === 'pending'
  );

  if (pendingTasks.length > 0) {
    return {
      valid: false,
      error: `存在 ${pendingTasks.length} 项未完成的护理任务，请先完成所有护理任务再办理出院`,
      pendingTasks: pendingTasks
    };
  }

  return { valid: true };
}

function validateAdmission(petId, cageId, isInfectious, admissionDate, expectedDischargeDate, excludeHospitalizationId = null) {
  const data = getData();
  const pet = data.pets.find(p => p.id === petId);

  if (!pet) {
    return { valid: false, error: '宠物不存在' };
  }

  const catDogCheck = checkCatDogIsolation(pet.species_id, cageId);
  if (!catDogCheck.valid) return catDogCheck;

  const infectiousCheck = checkInfectiousIsolation(isInfectious, cageId);
  if (!infectiousCheck.valid) return infectiousCheck;

  const occupancyCheck = checkCageOccupancyConflict(
    cageId,
    admissionDate,
    expectedDischargeDate,
    excludeHospitalizationId
  );
  if (!occupancyCheck.valid) return occupancyCheck;

  return { valid: true };
}

module.exports = {
  checkCatDogIsolation,
  checkInfectiousIsolation,
  checkCageOccupancyConflict,
  checkPendingCareTasks,
  validateAdmission,
  CAT_SPECIES_ID,
  DOG_SPECIES_ID
};
