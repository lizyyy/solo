const express = require('express');
const { Parser } = require('json2csv');
const { getData } = require('./database');
const {
  validateAdmission,
  checkPendingCareTasks,
  checkInfectiousIsolation,
  checkCatDogIsolation
} = require('./validation');

const router = express.Router();

function getSpeciesById(id) {
  return getData().animal_species.find(s => s.id === id);
}

function getCageById(id) {
  return getData().cages.find(c => c.id === id);
}

function getPetById(id) {
  return getData().pets.find(p => p.id === id);
}

function getOwnerById(id) {
  return getData().owners.find(o => o.id === id);
}

function getCareLevelById(id) {
  return getData().care_levels.find(c => c.id === id);
}

function getLocationById(id) {
  return getData().cage_locations.find(l => l.id === id);
}

function enrichHospitalization(h) {
  const pet = getPetById(h.pet_id);
  const cage = getCageById(h.cage_id);
  const species = pet ? getSpeciesById(pet.species_id) : null;
  const owner = pet ? getOwnerById(pet.owner_id) : null;
  const location = cage ? getLocationById(cage.location_id) : null;
  const careLevel = getCareLevelById(h.care_level_id);

  return {
    ...h,
    pet_name: pet ? pet.name : null,
    species_name: species ? species.name : null,
    species_id: species ? species.id : null,
    cage_number: cage ? cage.cage_number : null,
    cage_is_isolation: cage ? cage.is_isolation : 0,
    location_name: location ? location.name : null,
    care_level_name: careLevel ? careLevel.name : null,
    owner_name: owner ? owner.name : null,
    owner_phone: owner ? owner.phone : null
  };
}

function enrichCareTask(ct) {
  const hosp = getData().hospitalizations.find(h => h.id === ct.hospitalization_id);
  if (!hosp) return ct;

  const pet = getPetById(hosp.pet_id);
  const cage = getCageById(hosp.cage_id);

  return {
    ...ct,
    admission_number: hosp.admission_number,
    pet_name: pet ? pet.name : null,
    cage_number: cage ? cage.cage_number : null
  };
}

function enrichTransferRequest(t) {
  const hosp = getData().hospitalizations.find(h => h.id === t.hospitalization_id);
  const pet = hosp ? getPetById(hosp.pet_id) : null;
  const fromCage = getCageById(t.from_cage_id);
  const toCage = getCageById(t.to_cage_id);

  return {
    ...t,
    admission_number: hosp ? hosp.admission_number : null,
    pet_name: pet ? pet.name : null,
    from_cage_number: fromCage ? fromCage.cage_number : null,
    to_cage_number: toCage ? toCage.cage_number : null
  };
}

function enrichAlert(a) {
  const hosp = getData().hospitalizations.find(h => h.id === a.hospitalization_id);
  const pet = hosp ? getPetById(hosp.pet_id) : null;
  const cage = hosp ? getCageById(hosp.cage_id) : null;

  return {
    ...a,
    admission_number: hosp ? hosp.admission_number : null,
    pet_name: pet ? pet.name : null,
    cage_number: cage ? cage.cage_number : null
  };
}

router.get('/species', (req, res) => {
  res.json(getData().animal_species);
});

router.get('/care-levels', (req, res) => {
  res.json(getData().care_levels);
});

router.get('/locations', (req, res) => {
  res.json(getData().cage_locations);
});

router.get('/cages', (req, res) => {
  const { status, location_id, is_isolation } = req.query;

  let cages = [...getData().cages];

  if (location_id) {
    cages = cages.filter(c => c.location_id === parseInt(location_id));
  }
  if (is_isolation !== undefined) {
    const filterVal = is_isolation === 'true' ? 1 : 0;
    cages = cages.filter(c => c.is_isolation === filterVal);
  }

  const enriched = cages.map(c => {
    const location = getLocationById(c.location_id);
    return { ...c, location_name: location ? location.name : null };
  }).sort((a, b) => a.cage_number.localeCompare(b.cage_number));

  res.json(enriched);
});

router.get('/cages/:id', (req, res) => {
  const cageId = parseInt(req.params.id);
  const cage = getData().cages.find(c => c.id === cageId);

  if (!cage) {
    return res.status(404).json({ error: '笼位不存在' });
  }

  const location = getLocationById(cage.location_id);
  const enrichedCage = { ...cage, location_name: location ? location.name : null };

  const activeHosp = getData().hospitalizations.find(h => h.cage_id === cageId && h.status === 'active');
  const currentHosp = activeHosp ? enrichHospitalization(activeHosp) : null;

  const futureReservations = getData().hospitalizations
    .filter(h => h.cage_id === cageId && h.status === 'scheduled')
    .sort((a, b) => new Date(a.admission_date) - new Date(b.admission_date))
    .map(h => {
      const pet = getPetById(h.pet_id);
      const species = pet ? getSpeciesById(pet.species_id) : null;
      return { ...h, pet_name: pet ? pet.name : null, species_name: species ? species.name : null };
    });

  const history = getData().cage_history
    .filter(ch => ch.cage_id === cageId)
    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
    .slice(0, 20)
    .map(ch => {
      const hosp = getData().hospitalizations.find(h => h.id === ch.hospitalization_id);
      const pet = hosp ? getPetById(hosp.pet_id) : null;
      return { ...ch, admission_number: hosp ? hosp.admission_number : null, pet_name: pet ? pet.name : null };
    });

  res.json({
    cage: enrichedCage,
    currentHosp,
    futureReservations,
    history
  });
});

router.get('/owners', (req, res) => {
  res.json([...getData().owners].sort((a, b) => a.name.localeCompare(b.name)));
});

router.get('/pets', (req, res) => {
  const pets = getData().pets.map(p => {
    const species = getSpeciesById(p.species_id);
    const owner = getOwnerById(p.owner_id);
    return { ...p, species_name: species ? species.name : null, owner_name: owner ? owner.name : null };
  }).sort((a, b) => a.name.localeCompare(b.name));

  res.json(pets);
});

router.get('/pets/:id', (req, res) => {
  const petId = parseInt(req.params.id);
  const pet = getData().pets.find(p => p.id === petId);

  if (!pet) {
    return res.status(404).json({ error: '宠物不存在' });
  }

  const species = getSpeciesById(pet.species_id);
  const owner = getOwnerById(pet.owner_id);

  const history = getData().hospitalizations
    .filter(h => h.pet_id === petId)
    .sort((a, b) => new Date(b.admission_date) - new Date(a.admission_date))
    .map(h => {
      const cage = getCageById(h.cage_id);
      const careLevel = getCareLevelById(h.care_level_id);
      return { ...h, cage_number: cage ? cage.cage_number : null, care_level_name: careLevel ? careLevel.name : null };
    });

  res.json({
    pet: {
      ...pet,
      species_name: species ? species.name : null,
      owner_name: owner ? owner.name : null,
      owner_phone: owner ? owner.phone : null
    },
    history
  });
});

router.get('/hospitalizations', (req, res) => {
  const { status, pet_id, cage_id, is_infectious } = req.query;

  let hosps = [...getData().hospitalizations];

  if (status) {
    hosps = hosps.filter(h => h.status === status);
  }
  if (pet_id) {
    hosps = hosps.filter(h => h.pet_id === parseInt(pet_id));
  }
  if (cage_id) {
    hosps = hosps.filter(h => h.cage_id === parseInt(cage_id));
  }
  if (is_infectious !== undefined) {
    const filterVal = is_infectious === 'true' ? 1 : 0;
    hosps = hosps.filter(h => h.is_infectious === filterVal);
  }

  const enriched = hosps.map(enrichHospitalization)
    .sort((a, b) => new Date(b.admission_date) - new Date(a.admission_date));

  res.json(enriched);
});

router.get('/hospitalizations/:id', (req, res) => {
  const hospId = parseInt(req.params.id);
  const hosp = getData().hospitalizations.find(h => h.id === hospId);

  if (!hosp) {
    return res.status(404).json({ error: '住院记录不存在' });
  }

  const pet = getPetById(hosp.pet_id);
  const cage = getCageById(hosp.cage_id);
  const species = pet ? getSpeciesById(pet.species_id) : null;
  const owner = pet ? getOwnerById(pet.owner_id) : null;
  const location = cage ? getLocationById(cage.location_id) : null;
  const careLevel = getCareLevelById(hosp.care_level_id);

  const enrichedHosp = {
    ...hosp,
    pet_name: pet ? pet.name : null,
    species_name: species ? species.name : null,
    species_id: species ? species.id : null,
    gender: pet ? pet.gender : null,
    age_years: pet ? pet.age_years : null,
    weight_kg: pet ? pet.weight_kg : null,
    breed: pet ? pet.breed : null,
    cage_number: cage ? cage.cage_number : null,
    cage_id: cage ? cage.id : null,
    cage_is_isolation: cage ? cage.is_isolation : 0,
    location_name: location ? location.name : null,
    care_level_name: careLevel ? careLevel.name : null,
    owner_name: owner ? owner.name : null,
    owner_phone: owner ? owner.phone : null
  };

  const tasks = getData().care_tasks
    .filter(t => t.hospitalization_id === hospId)
    .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));

  const transfers = getData().transfer_requests
    .filter(t => t.hospitalization_id === hospId)
    .sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at))
    .map(enrichTransferRequest);

  const cageHistory = getData().cage_history
    .filter(ch => ch.hospitalization_id === hospId)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .map(ch => {
      const cage = getCageById(ch.cage_id);
      return { ...ch, cage_number: cage ? cage.cage_number : null };
    });

  res.json({
    hospitalization: enrichedHosp,
    tasks,
    transfers,
    cageHistory
  });
});

const { getDb, nextId, now } = require('./database');

router.post('/hospitalizations', (req, res) => {
  const {
    pet_id, cage_id, primary_diagnosis, is_infectious, infectious_disease,
    care_level_id, admission_date, expected_discharge_date,
    admission_reason, attending_vet
  } = req.body;

  const validation = validateAdmission(
    pet_id,
    cage_id,
    is_infectious || false,
    admission_date,
    expected_discharge_date
  );

  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const admissionNumber = `ADM-${Date.now()}`;
  const data = getData();

  const newHosp = {
    id: nextId('hospitalizations'),
    pet_id,
    cage_id,
    admission_number: admissionNumber,
    primary_diagnosis,
    is_infectious: is_infectious ? 1 : 0,
    infectious_disease: infectious_disease || null,
    care_level_id: care_level_id || null,
    admission_date,
    expected_discharge_date: expected_discharge_date || null,
    actual_discharge_date: null,
    admission_reason: admission_reason || null,
    attending_vet: attending_vet || null,
    status: 'active',
    created_at: now(),
    updated_at: now()
  };

  data.hospitalizations.push(newHosp);

  const cageHistory = {
    id: nextId('cage_history'),
    hospitalization_id: newHosp.id,
    cage_id,
    start_date: admission_date,
    end_date: null,
    notes: null,
    created_at: now()
  };
  data.cage_history.push(cageHistory);

  if (is_infectious) {
    const alert = {
      id: nextId('alerts'),
      hospitalization_id: newHosp.id,
      alert_type: 'infectious',
      message: `传染病病例隔离：${infectious_disease || primary_diagnosis}`,
      severity: 'danger',
      is_resolved: 0,
      resolved_at: null,
      created_at: now()
    };
    data.alerts.push(alert);
  }

  res.json({ id: newHosp.id, admission_number: admissionNumber });
});

router.post('/hospitalizations/:id/discharge', (req, res) => {
  const hospId = parseInt(req.params.id);

  const careCheck = checkPendingCareTasks(hospId);
  if (!careCheck.valid) {
    return res.status(400).json({
      error: careCheck.error,
      pendingTasks: careCheck.pendingTasks
    });
  }

  const data = getData();
  const hosp = data.hospitalizations.find(h => h.id === hospId);

  if (!hosp) {
    return res.status(404).json({ error: '住院记录不存在' });
  }
  if (hosp.status === 'discharged') {
    return res.status(400).json({ error: '该病例已出院' });
  }

  const currentTime = now();

  hosp.status = 'discharged';
  hosp.actual_discharge_date = currentTime;
  hosp.updated_at = currentTime;

  const cageHistory = data.cage_history.find(ch => ch.hospitalization_id === hospId && ch.end_date === null);
  if (cageHistory) {
    cageHistory.end_date = currentTime;
  }

  res.json({ success: true, discharge_date: currentTime });
});

router.put('/hospitalizations/:id/cage', (req, res) => {
  const hospId = parseInt(req.params.id);
  const { new_cage_id, reason } = req.body;

  const data = getData();
  const hosp = data.hospitalizations.find(h => h.id === hospId);

  if (!hosp) {
    return res.status(404).json({ error: '住院记录不存在' });
  }
  if (hosp.status !== 'active') {
    return res.status(400).json({ error: '只有活动中的病例才能转笼' });
  }

  const validation = validateAdmission(
    hosp.pet_id,
    new_cage_id,
    !!hosp.is_infectious,
    now(),
    hosp.expected_discharge_date,
    hospId
  );

  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const currentTime = now();

  const oldCageHistory = data.cage_history.find(ch => ch.hospitalization_id === hospId && ch.end_date === null);
  if (oldCageHistory) {
    oldCageHistory.end_date = currentTime;
  }

  const newCageHistory = {
    id: nextId('cage_history'),
    hospitalization_id: hospId,
    cage_id: new_cage_id,
    start_date: currentTime,
    end_date: null,
    notes: reason || '转笼',
    created_at: now()
  };
  data.cage_history.push(newCageHistory);

  hosp.cage_id = new_cage_id;
  hosp.updated_at = currentTime;

  res.json({ success: true });
});

router.get('/care-tasks', (req, res) => {
  const { hospitalization_id, status } = req.query;

  let tasks = [...getData().care_tasks];

  if (hospitalization_id) {
    tasks = tasks.filter(t => t.hospitalization_id === parseInt(hospitalization_id));
  }
  if (status) {
    tasks = tasks.filter(t => t.status === status);
  }

  const enriched = tasks.map(enrichCareTask)
    .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));

  res.json(enriched);
});

router.post('/care-tasks', (req, res) => {
  const { hospitalization_id, task_type, scheduled_time, notes } = req.body;

  const data = getData();
  const task = {
    id: nextId('care_tasks'),
    hospitalization_id,
    task_type,
    scheduled_time,
    completed_time: null,
    completed_by: null,
    notes: notes || null,
    status: 'pending',
    created_at: now()
  };

  data.care_tasks.push(task);
  res.json({ id: task.id });
});

router.post('/care-tasks/:id/complete', (req, res) => {
  const taskId = parseInt(req.params.id);
  const { completed_by, notes } = req.body;

  const task = getData().care_tasks.find(t => t.id === taskId);
  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }

  task.status = 'completed';
  task.completed_time = now();
  task.completed_by = completed_by || null;
  if (notes) task.notes = notes;

  res.json({ success: true });
});

router.get('/transfer-requests', (req, res) => {
  const { hospitalization_id, status } = req.query;

  let requests = [...getData().transfer_requests];

  if (hospitalization_id) {
    requests = requests.filter(t => t.hospitalization_id === parseInt(hospitalization_id));
  }
  if (status) {
    requests = requests.filter(t => t.status === status);
  }

  const enriched = requests.map(enrichTransferRequest)
    .sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));

  res.json(enriched);
});

router.post('/transfer-requests', (req, res) => {
  const { hospitalization_id, to_cage_id, request_reason, requested_by } = req.body;

  const data = getData();
  const hosp = data.hospitalizations.find(h => h.id === hospitalization_id);

  if (!hosp) {
    return res.status(404).json({ error: '住院记录不存在' });
  }
  if (hosp.status !== 'active') {
    return res.status(400).json({ error: '只有活动中的病例才能申请转笼' });
  }

  const pet = getPetById(hosp.pet_id);
  const catDogCheck = checkCatDogIsolation(pet ? pet.species_id : null, to_cage_id);
  if (!catDogCheck.valid) {
    return res.status(400).json({ error: catDogCheck.error });
  }

  const infectiousCheck = checkInfectiousIsolation(!!hosp.is_infectious, to_cage_id);
  if (!infectiousCheck.valid) {
    return res.status(400).json({ error: infectiousCheck.error });
  }

  const request = {
    id: nextId('transfer_requests'),
    hospitalization_id,
    from_cage_id: hosp.cage_id,
    to_cage_id,
    request_reason: request_reason || null,
    requested_by: requested_by || null,
    requested_at: now(),
    reviewed_by: null,
    reviewed_at: null,
    status: 'pending',
    rejection_reason: null,
    created_at: now()
  };

  data.transfer_requests.push(request);
  res.json({ id: request.id });
});

router.post('/transfer-requests/:id/approve', (req, res) => {
  const requestId = parseInt(req.params.id);
  const { reviewed_by } = req.body;

  const data = getData();
  const transfer = data.transfer_requests.find(t => t.id === requestId);

  if (!transfer) {
    return res.status(404).json({ error: '转笼申请不存在' });
  }
  if (transfer.status !== 'pending') {
    return res.status(400).json({ error: '只能审批待处理的申请' });
  }

  const hosp = data.hospitalizations.find(h => h.id === transfer.hospitalization_id);
  if (!hosp) {
    return res.status(404).json({ error: '住院记录不存在' });
  }

  const validation = validateAdmission(
    hosp.pet_id,
    transfer.to_cage_id,
    !!hosp.is_infectious,
    now(),
    hosp.expected_discharge_date,
    hosp.id
  );

  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const currentTime = now();

  transfer.status = 'approved';
  transfer.reviewed_by = reviewed_by || null;
  transfer.reviewed_at = currentTime;

  const oldCageHistory = data.cage_history.find(ch => ch.hospitalization_id === hosp.id && ch.end_date === null);
  if (oldCageHistory) {
    oldCageHistory.end_date = currentTime;
  }

  const newCageHistory = {
    id: nextId('cage_history'),
    hospitalization_id: hosp.id,
    cage_id: transfer.to_cage_id,
    start_date: currentTime,
    end_date: null,
    notes: '转笼（已批准）',
    created_at: now()
  };
  data.cage_history.push(newCageHistory);

  hosp.cage_id = transfer.to_cage_id;
  hosp.updated_at = currentTime;

  res.json({ success: true });
});

router.post('/transfer-requests/:id/reject', (req, res) => {
  const requestId = parseInt(req.params.id);
  const { reviewed_by, rejection_reason } = req.body;

  const transfer = getData().transfer_requests.find(t => t.id === requestId);
  if (!transfer) {
    return res.status(404).json({ error: '转笼申请不存在' });
  }
  if (transfer.status !== 'pending') {
    return res.status(400).json({ error: '只能驳回待处理的申请' });
  }

  transfer.status = 'rejected';
  transfer.reviewed_by = reviewed_by || null;
  transfer.reviewed_at = now();
  transfer.rejection_reason = rejection_reason || null;

  res.json({ success: true });
});

router.post('/transfer-requests/:id/close', (req, res) => {
  const requestId = parseInt(req.params.id);
  const { reviewed_by } = req.body;

  const transfer = getData().transfer_requests.find(t => t.id === requestId);
  if (!transfer) {
    return res.status(404).json({ error: '转笼申请不存在' });
  }

  transfer.status = 'closed';
  transfer.reviewed_by = reviewed_by || null;
  transfer.reviewed_at = now();

  res.json({ success: true });
});

router.get('/alerts', (req, res) => {
  const { is_resolved, hospitalization_id } = req.query;

  let alerts = [...getData().alerts];

  if (is_resolved !== undefined) {
    const filterVal = is_resolved === 'true' ? 1 : 0;
    alerts = alerts.filter(a => a.is_resolved === filterVal);
  }
  if (hospitalization_id) {
    alerts = alerts.filter(a => a.hospitalization_id === parseInt(hospitalization_id));
  }

  const enriched = alerts.map(enrichAlert)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json(enriched);
});

router.post('/alerts/:id/resolve', (req, res) => {
  const alertId = parseInt(req.params.id);
  const alert = getData().alerts.find(a => a.id === alertId);

  if (!alert) {
    return res.status(404).json({ error: '提示不存在' });
  }

  alert.is_resolved = 1;
  alert.resolved_at = now();

  res.json({ success: true });
});

router.get('/export/hospitalizations', (req, res) => {
  const { status, format = 'csv' } = req.query;

  let hosps = [...getData().hospitalizations];
  if (status) {
    hosps = hosps.filter(h => h.status === status);
  }

  const data = hosps.map(h => {
    const pet = getPetById(h.pet_id);
    const species = pet ? getSpeciesById(pet.species_id) : null;
    const cage = getCageById(h.cage_id);
    const location = cage ? getLocationById(cage.location_id) : null;
    const careLevel = getCareLevelById(h.care_level_id);

    return {
      admission_number: h.admission_number,
      pet_name: pet ? pet.name : '',
      species: species ? species.name : '',
      cage_number: cage ? cage.cage_number : '',
      location: location ? location.name : '',
      primary_diagnosis: h.primary_diagnosis || '',
      is_infectious: h.is_infectious ? '是' : '否',
      infectious_disease: h.infectious_disease || '',
      care_level: careLevel ? careLevel.name : '',
      admission_date: h.admission_date || '',
      expected_discharge_date: h.expected_discharge_date || '',
      actual_discharge_date: h.actual_discharge_date || '',
      attending_vet: h.attending_vet || '',
      hospitalization_status: h.status
    };
  });

  if (format === 'json') {
    res.json(data);
  } else {
    const parser = new Parser();
    const csv = parser.parse(data);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment(`hospitalizations_${Date.now()}.csv`);
    res.send('\uFEFF' + csv);
  }
});

router.get('/export/care-tasks', (req, res) => {
  const { status, format = 'csv' } = req.query;

  let tasks = [...getData().care_tasks];
  if (status) {
    tasks = tasks.filter(t => t.status === status);
  }

  const data = tasks.map(ct => {
    const hosp = getData().hospitalizations.find(h => h.id === ct.hospitalization_id);
    const pet = hosp ? getPetById(hosp.pet_id) : null;
    const cage = hosp ? getCageById(hosp.cage_id) : null;

    return {
      id: ct.id,
      admission_number: hosp ? hosp.admission_number : '',
      pet_name: pet ? pet.name : '',
      cage_number: cage ? cage.cage_number : '',
      task_type: ct.task_type,
      scheduled_time: ct.scheduled_time || '',
      completed_time: ct.completed_time || '',
      task_status: ct.status,
      completed_by: ct.completed_by || ''
    };
  });

  if (format === 'json') {
    res.json(data);
  } else {
    const parser = new Parser();
    const csv = parser.parse(data);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment(`care-tasks_${Date.now()}.csv`);
    res.send('\uFEFF' + csv);
  }
});

router.get('/dashboard/summary', (req, res) => {
  const data = getData();

  const totalCages = data.cages.length;
  const activeHosps = data.hospitalizations.filter(h => h.status === 'active');
  const occupiedCageIds = new Set(activeHosps.map(h => h.cage_id));
  const occupiedCages = occupiedCageIds.size;
  const availableCages = totalCages - occupiedCages;

  const activeHospitalizations = activeHosps.length;
  const infectiousCases = activeHosps.filter(h => h.is_infectious).length;
  const pendingTasks = data.care_tasks.filter(t => t.status === 'pending').length;
  const pendingTransfers = data.transfer_requests.filter(t => t.status === 'pending').length;
  const unresolvedAlerts = data.alerts.filter(a => a.is_resolved === 0).length;

  res.json({
    totalCages,
    occupiedCages,
    availableCages,
    activeHospitalizations,
    infectiousCases,
    pendingTasks,
    pendingTransfers,
    unresolvedAlerts
  });
});

module.exports = router;
