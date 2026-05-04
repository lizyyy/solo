const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb, saveDatabase } = require('./database');
const {
  calculateTotalDuration,
  calculateCost,
  runRiskCheck,
  validateCurve,
  getTotalWeight,
  checkDurationAndCost
} = require('./firingCalculator');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/kilns', (req, res) => {
  const db = getDb();
  const result = db.exec('SELECT * FROM kilns ORDER BY created_at');
  res.json(result.length > 0 ? result[0].values.map(row => ({
    id: row[0],
    name: row[1],
    power: row[2],
    capacity: row[3],
    max_temperature: row[4],
    description: row[5],
    created_at: row[6],
    updated_at: row[7]
  })) : []);
});

router.get('/kilns/:id', (req, res) => {
  const db = getDb();
  const result = db.exec('SELECT * FROM kilns WHERE id = ?', [req.params.id]);
  if (result.length === 0) {
    return res.status(404).json({ error: 'Kiln not found' });
  }
  const row = result[0].values[0];
  res.json({
    id: row[0],
    name: row[1],
    power: row[2],
    capacity: row[3],
    max_temperature: row[4],
    description: row[5],
    created_at: row[6],
    updated_at: row[7]
  });
});

router.post('/kilns', (req, res) => {
  const { name, power, capacity, max_temperature, description } = req.body;
  if (!name || !power || !capacity || !max_temperature) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const db = getDb();
  const id = uuidv4();
  db.run(
    'INSERT INTO kilns (id, name, power, capacity, max_temperature, description) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, power, capacity, max_temperature, description]
  );
  saveDatabase();
  res.status(201).json({ id, ...req.body });
});

router.put('/kilns/:id', (req, res) => {
  const { name, power, capacity, max_temperature, description } = req.body;
  const db = getDb();
  
  db.run(
    'UPDATE kilns SET name = ?, power = ?, capacity = ?, max_temperature = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, power, capacity, max_temperature, description, req.params.id]
  );
  saveDatabase();
  res.json({ id: req.params.id, ...req.body });
});

router.delete('/kilns/:id', (req, res) => {
  const db = getDb();
  db.run('DELETE FROM kilns WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json({ success: true });
});

router.get('/bodies', (req, res) => {
  const db = getDb();
  const result = db.exec('SELECT * FROM bodies ORDER BY created_at');
  res.json(result.length > 0 ? result[0].values.map(row => ({
    id: row[0],
    name: row[1],
    max_heating_rate: row[2],
    max_cooling_rate: row[3],
    min_hold_time: row[4],
    safe_heating_rate_for_thick: row[5],
    description: row[6],
    created_at: row[7],
    updated_at: row[8]
  })) : []);
});

router.get('/bodies/:id', (req, res) => {
  const db = getDb();
  const result = db.exec('SELECT * FROM bodies WHERE id = ?', [req.params.id]);
  if (result.length === 0) {
    return res.status(404).json({ error: 'Body not found' });
  }
  const row = result[0].values[0];
  res.json({
    id: row[0],
    name: row[1],
    max_heating_rate: row[2],
    max_cooling_rate: row[3],
    min_hold_time: row[4],
    safe_heating_rate_for_thick: row[5],
    description: row[6],
    created_at: row[7],
    updated_at: row[8]
  });
});

router.post('/bodies', (req, res) => {
  const { name, max_heating_rate, max_cooling_rate, min_hold_time, safe_heating_rate_for_thick, description } = req.body;
  if (!name || !max_heating_rate || !max_cooling_rate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const db = getDb();
  const id = uuidv4();
  db.run(
    'INSERT INTO bodies (id, name, max_heating_rate, max_cooling_rate, min_hold_time, safe_heating_rate_for_thick, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, name, max_heating_rate, max_cooling_rate, min_hold_time || 0.5, safe_heating_rate_for_thick || max_heating_rate * 0.5, description]
  );
  saveDatabase();
  res.status(201).json({ id, ...req.body });
});

router.put('/bodies/:id', (req, res) => {
  const { name, max_heating_rate, max_cooling_rate, min_hold_time, safe_heating_rate_for_thick, description } = req.body;
  const db = getDb();
  
  db.run(
    'UPDATE bodies SET name = ?, max_heating_rate = ?, max_cooling_rate = ?, min_hold_time = ?, safe_heating_rate_for_thick = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, max_heating_rate, max_cooling_rate, min_hold_time, safe_heating_rate_for_thick, description, req.params.id]
  );
  saveDatabase();
  res.json({ id: req.params.id, ...req.body });
});

router.delete('/bodies/:id', (req, res) => {
  const db = getDb();
  db.run('DELETE FROM bodies WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json({ success: true });
});

router.get('/glazes', (req, res) => {
  const db = getDb();
  const result = db.exec('SELECT * FROM glazes ORDER BY created_at');
  res.json(result.length > 0 ? result[0].values.map(row => ({
    id: row[0],
    name: row[1],
    min_firing_temp: row[2],
    max_firing_temp: row[3],
    optimal_firing_temp: row[4],
    hold_time_required: row[5],
    cooling_sensitivity: row[6],
    description: row[7],
    created_at: row[8],
    updated_at: row[9]
  })) : []);
});

router.get('/glazes/:id', (req, res) => {
  const db = getDb();
  const result = db.exec('SELECT * FROM glazes WHERE id = ?', [req.params.id]);
  if (result.length === 0) {
    return res.status(404).json({ error: 'Glaze not found' });
  }
  const row = result[0].values[0];
  res.json({
    id: row[0],
    name: row[1],
    min_firing_temp: row[2],
    max_firing_temp: row[3],
    optimal_firing_temp: row[4],
    hold_time_required: row[5],
    cooling_sensitivity: row[6],
    description: row[7],
    created_at: row[8],
    updated_at: row[9]
  });
});

router.post('/glazes', (req, res) => {
  const { name, min_firing_temp, max_firing_temp, optimal_firing_temp, hold_time_required, cooling_sensitivity, description } = req.body;
  if (!name || !min_firing_temp || !max_firing_temp) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const db = getDb();
  const id = uuidv4();
  db.run(
    'INSERT INTO glazes (id, name, min_firing_temp, max_firing_temp, optimal_firing_temp, hold_time_required, cooling_sensitivity, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, min_firing_temp, max_firing_temp, optimal_firing_temp || (min_firing_temp + max_firing_temp) / 2, hold_time_required || 0.5, cooling_sensitivity || 'low', description]
  );
  saveDatabase();
  res.status(201).json({ id, ...req.body });
});

router.put('/glazes/:id', (req, res) => {
  const { name, min_firing_temp, max_firing_temp, optimal_firing_temp, hold_time_required, cooling_sensitivity, description } = req.body;
  const db = getDb();
  
  db.run(
    'UPDATE glazes SET name = ?, min_firing_temp = ?, max_firing_temp = ?, optimal_firing_temp = ?, hold_time_required = ?, cooling_sensitivity = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, min_firing_temp, max_firing_temp, optimal_firing_temp, hold_time_required, cooling_sensitivity, description, req.params.id]
  );
  saveDatabase();
  res.json({ id: req.params.id, ...req.body });
});

router.delete('/glazes/:id', (req, res) => {
  const db = getDb();
  db.run('DELETE FROM glazes WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json({ success: true });
});

router.get('/pieces', (req, res) => {
  const db = getDb();
  const result = db.exec(`
    SELECT p.*, b.name as body_name, g.name as glaze_name 
    FROM pieces p 
    LEFT JOIN bodies b ON p.body_id = b.id 
    LEFT JOIN glazes g ON p.glaze_id = g.id 
    ORDER BY p.created_at
  `);
  res.json(result.length > 0 ? result[0].values.map(row => ({
    id: row[0],
    name: row[1],
    body_id: row[2],
    glaze_id: row[3],
    thickness: row[4],
    weight: row[5],
    type: row[6],
    notes: row[7],
    created_at: row[8],
    updated_at: row[9],
    body_name: row[10],
    glaze_name: row[11]
  })) : []);
});

router.get('/pieces/:id', (req, res) => {
  const db = getDb();
  const result = db.exec(`
    SELECT p.*, b.name as body_name, g.name as glaze_name 
    FROM pieces p 
    LEFT JOIN bodies b ON p.body_id = b.id 
    LEFT JOIN glazes g ON p.glaze_id = g.id 
    WHERE p.id = ?
  `, [req.params.id]);
  if (result.length === 0) {
    return res.status(404).json({ error: 'Piece not found' });
  }
  const row = result[0].values[0];
  res.json({
    id: row[0],
    name: row[1],
    body_id: row[2],
    glaze_id: row[3],
    thickness: row[4],
    weight: row[5],
    type: row[6],
    notes: row[7],
    created_at: row[8],
    updated_at: row[9],
    body_name: row[10],
    glaze_name: row[11]
  });
});

router.post('/pieces', (req, res) => {
  const { name, body_id, glaze_id, thickness, weight, type, notes } = req.body;
  if (!name || !body_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const db = getDb();
  const id = uuidv4();
  db.run(
    'INSERT INTO pieces (id, name, body_id, glaze_id, thickness, weight, type, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, body_id, glaze_id, thickness || 0.5, weight || 0.3, type, notes]
  );
  saveDatabase();
  res.status(201).json({ id, ...req.body });
});

router.put('/pieces/:id', (req, res) => {
  const { name, body_id, glaze_id, thickness, weight, type, notes } = req.body;
  const db = getDb();
  
  db.run(
    'UPDATE pieces SET name = ?, body_id = ?, glaze_id = ?, thickness = ?, weight = ?, type = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, body_id, glaze_id, thickness, weight, type, notes, req.params.id]
  );
  saveDatabase();
  res.json({ id: req.params.id, ...req.body });
});

router.delete('/pieces/:id', (req, res) => {
  const db = getDb();
  db.run('DELETE FROM pieces WHERE id = ?', [req.params.id]);
  db.run('DELETE FROM plan_pieces WHERE piece_id = ?', [req.params.id]);
  saveDatabase();
  res.json({ success: true });
});

router.get('/plans', (req, res) => {
  const db = getDb();
  const result = db.exec(`
    SELECT fp.*, k.name as kiln_name, k.power as kiln_power 
    FROM firing_plans fp 
    LEFT JOIN kilns k ON fp.kiln_id = k.id 
    ORDER BY fp.created_at DESC
  `);
  res.json(result.length > 0 ? result[0].values.map(row => ({
    id: row[0],
    name: row[1],
    kiln_id: row[2],
    electricity_price: row[3],
    expected_max_duration: row[4],
    expected_max_cost: row[5],
    total_pieces_weight: row[6],
    estimated_duration: row[7],
    estimated_cost: row[8],
    created_at: row[9],
    updated_at: row[10],
    kiln_name: row[11],
    kiln_power: row[12]
  })) : []);
});

router.get('/plans/:id', (req, res) => {
  const db = getDb();
  
  const planResult = db.exec(`
    SELECT fp.*, k.name as kiln_name, k.power as kiln_power, k.capacity as kiln_capacity, k.max_temperature as kiln_max_temp
    FROM firing_plans fp 
    LEFT JOIN kilns k ON fp.kiln_id = k.id 
    WHERE fp.id = ?
  `, [req.params.id]);
  
  if (planResult.length === 0) {
    return res.status(404).json({ error: 'Plan not found' });
  }
  
  const planRow = planResult[0].values[0];
  const plan = {
    id: planRow[0],
    name: planRow[1],
    kiln_id: planRow[2],
    electricity_price: planRow[3],
    expected_max_duration: planRow[4],
    expected_max_cost: planRow[5],
    total_pieces_weight: planRow[6],
    estimated_duration: planRow[7],
    estimated_cost: planRow[8],
    created_at: planRow[9],
    updated_at: planRow[10],
    kiln_name: planRow[11],
    kiln_power: planRow[12],
    kiln_capacity: planRow[13],
    kiln_max_temp: planRow[14]
  };
  
  const stagesResult = db.exec(`
    SELECT * FROM firing_curve_stages WHERE plan_id = ? ORDER BY stage_order
  `, [req.params.id]);
  
  plan.stages = stagesResult.length > 0 ? stagesResult[0].values.map(row => ({
    id: row[0],
    plan_id: row[1],
    stage_order: row[2],
    stage_type: row[3],
    start_temp: row[4],
    target_temp: row[5],
    heating_rate: row[6],
    cooling_rate: row[7],
    hold_duration: row[8],
    estimated_duration: row[9],
    description: row[10]
  })) : [];
  
  const piecesResult = db.exec(`
    SELECT p.*, b.name as body_name, g.name as glaze_name 
    FROM plan_pieces pp 
    JOIN pieces p ON pp.piece_id = p.id 
    LEFT JOIN bodies b ON p.body_id = b.id 
    LEFT JOIN glazes g ON p.glaze_id = g.id 
    WHERE pp.plan_id = ?
  `, [req.params.id]);
  
  plan.pieces = piecesResult.length > 0 ? piecesResult[0].values.map(row => ({
    id: row[0],
    name: row[1],
    body_id: row[2],
    glaze_id: row[3],
    thickness: row[4],
    weight: row[5],
    type: row[6],
    notes: row[7],
    body_name: row[10],
    glaze_name: row[11]
  })) : [];
  
  const risksResult = db.exec(`
    SELECT rc.*, p.name as piece_name 
    FROM risk_checks rc 
    LEFT JOIN pieces p ON rc.piece_id = p.id 
    WHERE rc.plan_id = ?
  `, [req.params.id]);
  
  plan.risks = risksResult.length > 0 ? risksResult[0].values.map(row => ({
    id: row[0],
    plan_id: row[1],
    piece_id: row[2],
    risk_type: row[3],
    risk_level: row[4],
    message: row[5],
    details: row[6],
    checked_at: row[7],
    piece_name: row[8]
  })) : [];
  
  res.json(plan);
});

router.post('/plans', (req, res) => {
  const { name, kiln_id, electricity_price, expected_max_duration, expected_max_cost, stages, pieces } = req.body;
  if (!name || !kiln_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const db = getDb();
  const id = uuidv4();
  
  const kilnResult = db.exec('SELECT * FROM kilns WHERE id = ?', [kiln_id]);
  if (kilnResult.length === 0) {
    return res.status(400).json({ error: 'Invalid kiln_id' });
  }
  const kiln = {
    id: kilnResult[0].values[0][0],
    name: kilnResult[0].values[0][1],
    power: kilnResult[0].values[0][2],
    capacity: kilnResult[0].values[0][3],
    max_temperature: kilnResult[0].values[0][4]
  };
  
  if (stages && stages.length > 0) {
    const validation = validateCurve(stages, kiln);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid firing curve', errors: validation.errors, warnings: validation.warnings });
    }
  }
  
  const piecesList = [];
  if (pieces && pieces.length > 0) {
    for (const pieceId of pieces) {
      const pieceResult = db.exec('SELECT * FROM pieces WHERE id = ?', [pieceId]);
      if (pieceResult.length > 0) {
        piecesList.push({
          id: pieceResult[0].values[0][0],
          name: pieceResult[0].values[0][1],
          body_id: pieceResult[0].values[0][2],
          glaze_id: pieceResult[0].values[0][3],
          thickness: pieceResult[0].values[0][4],
          weight: pieceResult[0].values[0][5]
        });
      }
    }
  }
  
  const totalWeight = getTotalWeight(piecesList);
  
  let estimatedDuration = 0;
  let estimatedCost = 0;
  let detailedStages = [];
  
  if (stages && stages.length > 0) {
    const durationResult = calculateTotalDuration(stages, kiln, piecesList);
    estimatedDuration = durationResult.totalDuration;
    detailedStages = durationResult.detailedStages;
    estimatedCost = calculateCost(estimatedDuration, kiln, electricity_price || 1.0);
  }
  
  db.run(
    'INSERT INTO firing_plans (id, name, kiln_id, electricity_price, expected_max_duration, expected_max_cost, total_pieces_weight, estimated_duration, estimated_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, kiln_id, electricity_price || 1.0, expected_max_duration, expected_max_cost, totalWeight, estimatedDuration, estimatedCost]
  );
  
  if (stages && stages.length > 0) {
    for (let i = 0; i < detailedStages.length; i++) {
      const stage = detailedStages[i];
      db.run(
        'INSERT INTO firing_curve_stages (id, plan_id, stage_order, stage_type, start_temp, target_temp, heating_rate, cooling_rate, hold_duration, estimated_duration, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), id, i, stage.stage_type, stage.start_temp, stage.target_temp, stage.heating_rate, stage.cooling_rate, stage.hold_duration, stage.estimated_duration, stage.description]
      );
    }
  }
  
  if (piecesList && piecesList.length > 0) {
    for (const piece of piecesList) {
      db.run(
        'INSERT INTO plan_pieces (id, plan_id, piece_id) VALUES (?, ?, ?)',
        [uuidv4(), id, piece.id]
      );
    }
  }
  
  saveDatabase();
  res.status(201).json({ 
    id, 
    name, 
    kiln_id, 
    total_pieces_weight: totalWeight,
    estimated_duration: estimatedDuration,
    estimated_cost: estimatedCost,
    stages: detailedStages,
    pieces: piecesList
  });
});

router.put('/plans/:id', (req, res) => {
  const { name, kiln_id, electricity_price, expected_max_duration, expected_max_cost, stages, pieces } = req.body;
  const db = getDb();
  
  const kilnResult = db.exec('SELECT * FROM kilns WHERE id = ?', [kiln_id]);
  if (kilnResult.length === 0) {
    return res.status(400).json({ error: 'Invalid kiln_id' });
  }
  const kiln = {
    id: kilnResult[0].values[0][0],
    name: kilnResult[0].values[0][1],
    power: kilnResult[0].values[0][2],
    capacity: kilnResult[0].values[0][3],
    max_temperature: kilnResult[0].values[0][4]
  };
  
  if (stages && stages.length > 0) {
    const validation = validateCurve(stages, kiln);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid firing curve', errors: validation.errors, warnings: validation.warnings });
    }
  }
  
  const piecesList = [];
  if (pieces && pieces.length > 0) {
    for (const pieceId of pieces) {
      const pieceResult = db.exec('SELECT * FROM pieces WHERE id = ?', [pieceId]);
      if (pieceResult.length > 0) {
        piecesList.push({
          id: pieceResult[0].values[0][0],
          name: pieceResult[0].values[0][1],
          body_id: pieceResult[0].values[0][2],
          glaze_id: pieceResult[0].values[0][3],
          thickness: pieceResult[0].values[0][4],
          weight: pieceResult[0].values[0][5]
        });
      }
    }
  }
  
  const totalWeight = getTotalWeight(piecesList);
  
  let estimatedDuration = 0;
  let estimatedCost = 0;
  let detailedStages = [];
  
  if (stages && stages.length > 0) {
    const durationResult = calculateTotalDuration(stages, kiln, piecesList);
    estimatedDuration = durationResult.totalDuration;
    detailedStages = durationResult.detailedStages;
    estimatedCost = calculateCost(estimatedDuration, kiln, electricity_price || 1.0);
  }
  
  db.run(
    'UPDATE firing_plans SET name = ?, kiln_id = ?, electricity_price = ?, expected_max_duration = ?, expected_max_cost = ?, total_pieces_weight = ?, estimated_duration = ?, estimated_cost = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, kiln_id, electricity_price, expected_max_duration, expected_max_cost, totalWeight, estimatedDuration, estimatedCost, req.params.id]
  );
  
  db.run('DELETE FROM firing_curve_stages WHERE plan_id = ?', [req.params.id]);
  db.run('DELETE FROM plan_pieces WHERE plan_id = ?', [req.params.id]);
  
  if (stages && stages.length > 0) {
    for (let i = 0; i < detailedStages.length; i++) {
      const stage = detailedStages[i];
      db.run(
        'INSERT INTO firing_curve_stages (id, plan_id, stage_order, stage_type, start_temp, target_temp, heating_rate, cooling_rate, hold_duration, estimated_duration, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uuidv4(), req.params.id, i, stage.stage_type, stage.start_temp, stage.target_temp, stage.heating_rate, stage.cooling_rate, stage.hold_duration, stage.estimated_duration, stage.description]
      );
    }
  }
  
  if (piecesList && piecesList.length > 0) {
    for (const piece of piecesList) {
      db.run(
        'INSERT INTO plan_pieces (id, plan_id, piece_id) VALUES (?, ?, ?)',
        [uuidv4(), req.params.id, piece.id]
      );
    }
  }
  
  saveDatabase();
  res.json({ 
    id: req.params.id, 
    name, 
    kiln_id, 
    total_pieces_weight: totalWeight,
    estimated_duration: estimatedDuration,
    estimated_cost: estimatedCost,
    stages: detailedStages,
    pieces: piecesList
  });
});

router.delete('/plans/:id', (req, res) => {
  const db = getDb();
  db.run('DELETE FROM firing_curve_stages WHERE plan_id = ?', [req.params.id]);
  db.run('DELETE FROM plan_pieces WHERE plan_id = ?', [req.params.id]);
  db.run('DELETE FROM risk_checks WHERE plan_id = ?', [req.params.id]);
  db.run('DELETE FROM firing_records WHERE plan_id = ?', [req.params.id]);
  db.run('DELETE FROM firing_plans WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json({ success: true });
});

router.post('/plans/:id/calculate', (req, res) => {
  const db = getDb();
  
  const planResult = db.exec('SELECT * FROM firing_plans WHERE id = ?', [req.params.id]);
  if (planResult.length === 0) {
    return res.status(404).json({ error: 'Plan not found' });
  }
  
  const planRow = planResult[0].values[0];
  const plan = {
    id: planRow[0],
    name: planRow[1],
    kiln_id: planRow[2],
    electricity_price: planRow[3],
    expected_max_duration: planRow[4],
    expected_max_cost: planRow[5]
  };
  
  const kilnResult = db.exec('SELECT * FROM kilns WHERE id = ?', [plan.kiln_id]);
  const kiln = {
    id: kilnResult[0].values[0][0],
    name: kilnResult[0].values[0][1],
    power: kilnResult[0].values[0][2],
    capacity: kilnResult[0].values[0][3],
    max_temperature: kilnResult[0].values[0][4]
  };
  
  const stagesResult = db.exec('SELECT * FROM firing_curve_stages WHERE plan_id = ? ORDER BY stage_order', [req.params.id]);
  const stages = stagesResult.length > 0 ? stagesResult[0].values.map(row => ({
    id: row[0],
    plan_id: row[1],
    stage_order: row[2],
    stage_type: row[3],
    start_temp: row[4],
    target_temp: row[5],
    heating_rate: row[6],
    cooling_rate: row[7],
    hold_duration: row[8],
    estimated_duration: row[9],
    description: row[10]
  })) : [];
  
  const piecesResult = db.exec(`
    SELECT p.*, b.*, g.* 
    FROM plan_pieces pp 
    JOIN pieces p ON pp.piece_id = p.id 
    LEFT JOIN bodies b ON p.body_id = b.id 
    LEFT JOIN glazes g ON p.glaze_id = g.id 
    WHERE pp.plan_id = ?
  `, [req.params.id]);
  
  const pieces = piecesResult.length > 0 ? piecesResult[0].values.map(row => ({
    id: row[0],
    name: row[1],
    body_id: row[2],
    glaze_id: row[3],
    thickness: row[4],
    weight: row[5],
    type: row[6],
    notes: row[7]
  })) : [];
  
  const bodies = piecesResult.length > 0 ? piecesResult[0].values.map(row => ({
    id: row[10],
    name: row[11],
    max_heating_rate: row[12],
    max_cooling_rate: row[13],
    min_hold_time: row[14],
    safe_heating_rate_for_thick: row[15],
    description: row[16]
  })).filter((b, i, arr) => arr.findIndex(x => x.id === b.id) === i) : [];
  
  const glazes = piecesResult.length > 0 ? piecesResult[0].values.filter(row => row[18]).map(row => ({
    id: row[18],
    name: row[19],
    min_firing_temp: row[20],
    max_firing_temp: row[21],
    optimal_firing_temp: row[22],
    hold_time_required: row[23],
    cooling_sensitivity: row[24],
    description: row[25]
  })).filter((g, i, arr) => arr.findIndex(x => x.id === g.id) === i) : [];
  
  const validation = validateCurve(stages, kiln);
  if (!validation.valid) {
    return res.status(400).json({ error: 'Invalid firing curve', errors: validation.errors, warnings: validation.warnings });
  }
  
  const durationResult = calculateTotalDuration(stages, kiln, pieces);
  const estimatedDuration = durationResult.totalDuration;
  const detailedStages = durationResult.detailedStages;
  const estimatedCost = calculateCost(estimatedDuration, kiln, plan.electricity_price);
  
  const risks = runRiskCheck(plan, kiln, pieces, stages, bodies, glazes);
  
  const durationCostRisks = checkDurationAndCost(plan, estimatedDuration, estimatedCost);
  risks.push(...durationCostRisks);
  
  db.run('DELETE FROM risk_checks WHERE plan_id = ?', [req.params.id]);
  for (const risk of risks) {
    db.run(
      'INSERT INTO risk_checks (id, plan_id, piece_id, risk_type, risk_level, message, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), req.params.id, risk.piece_id || null, risk.risk_type, risk.risk_level, risk.message, risk.details]
    );
  }
  
  db.run(
    'UPDATE firing_plans SET estimated_duration = ?, estimated_cost = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [estimatedDuration, estimatedCost, req.params.id]
  );
  
  saveDatabase();
  
  res.json({
    estimated_duration: estimatedDuration,
    estimated_cost: estimatedCost,
    stages: detailedStages,
    risks,
    validation_warnings: validation.warnings
  });
});

router.get('/plans/compare/:planId1/:planId2', (req, res) => {
  const db = getDb();
  const { planId1, planId2 } = req.params;
  
  const plan1Result = db.exec(`
    SELECT fp.*, k.name as kiln_name, k.power as kiln_power 
    FROM firing_plans fp 
    LEFT JOIN kilns k ON fp.kiln_id = k.id 
    WHERE fp.id = ?
  `, [planId1]);
  
  const plan2Result = db.exec(`
    SELECT fp.*, k.name as kiln_name, k.power as kiln_power 
    FROM firing_plans fp 
    LEFT JOIN kilns k ON fp.kiln_id = k.id 
    WHERE fp.id = ?
  `, [planId2]);
  
  if (plan1Result.length === 0 || plan2Result.length === 0) {
    return res.status(404).json({ error: 'One or both plans not found' });
  }
  
  const plan1Row = plan1Result[0].values[0];
  const plan2Row = plan2Result[0].values[0];
  
  const stages1Result = db.exec('SELECT * FROM firing_curve_stages WHERE plan_id = ? ORDER BY stage_order', [planId1]);
  const stages2Result = db.exec('SELECT * FROM firing_curve_stages WHERE plan_id = ? ORDER BY stage_order', [planId2]);
  
  const risks1Result = db.exec('SELECT * FROM risk_checks WHERE plan_id = ?', [planId1]);
  const risks2Result = db.exec('SELECT * FROM risk_checks WHERE plan_id = ?', [planId2]);
  
  const comparison = {
    plan1: {
      id: plan1Row[0],
      name: plan1Row[1],
      kiln_name: plan1Row[11],
      estimated_duration: plan1Row[7],
      estimated_cost: plan1Row[8],
      total_pieces_weight: plan1Row[6],
      stages_count: stages1Result.length > 0 ? stages1Result[0].values.length : 0,
      risks_count: risks1Result.length > 0 ? risks1Result[0].values.length : 0,
      high_risks_count: risks1Result.length > 0 ? risks1Result[0].values.filter(r => r[4] === 'high').length : 0
    },
    plan2: {
      id: plan2Row[0],
      name: plan2Row[1],
      kiln_name: plan2Row[11],
      estimated_duration: plan2Row[7],
      estimated_cost: plan2Row[8],
      total_pieces_weight: plan2Row[6],
      stages_count: stages2Result.length > 0 ? stages2Result[0].values.length : 0,
      risks_count: risks2Result.length > 0 ? risks2Result[0].values.length : 0,
      high_risks_count: risks2Result.length > 0 ? risks2Result[0].values.filter(r => r[4] === 'high').length : 0
    },
    differences: {
      duration_diff: plan2Row[7] - plan1Row[7],
      cost_diff: plan2Row[8] - plan1Row[8],
      risk_diff: (risks2Result.length > 0 ? risks2Result[0].values.length : 0) - (risks1Result.length > 0 ? risks1Result[0].values.length : 0)
    }
  };
  
  res.json(comparison);
});

router.get('/records', (req, res) => {
  const db = getDb();
  const result = db.exec(`
    SELECT fr.*, fp.name as plan_name 
    FROM firing_records fr 
    LEFT JOIN firing_plans fp ON fr.plan_id = fp.id 
    ORDER BY fr.created_at DESC
  `);
  res.json(result.length > 0 ? result[0].values.map(row => ({
    id: row[0],
    plan_id: row[1],
    actual_start_time: row[2],
    actual_end_time: row[3],
    actual_duration: row[4],
    actual_cost: row[5],
    had_cracks: row[6],
    glaze_matured: row[7],
    issues: row[8],
    notes: row[9],
    created_at: row[10],
    plan_name: row[11]
  })) : []);
});

router.get('/records/:id', (req, res) => {
  const db = getDb();
  const result = db.exec(`
    SELECT fr.*, fp.name as plan_name 
    FROM firing_records fr 
    LEFT JOIN firing_plans fp ON fr.plan_id = fp.id 
    WHERE fr.id = ?
  `, [req.params.id]);
  
  if (result.length === 0) {
    return res.status(404).json({ error: 'Record not found' });
  }
  
  const row = result[0].values[0];
  res.json({
    id: row[0],
    plan_id: row[1],
    actual_start_time: row[2],
    actual_end_time: row[3],
    actual_duration: row[4],
    actual_cost: row[5],
    had_cracks: row[6],
    glaze_matured: row[7],
    issues: row[8],
    notes: row[9],
    created_at: row[10],
    plan_name: row[11]
  });
});

router.post('/records', (req, res) => {
  const { plan_id, actual_start_time, actual_end_time, actual_duration, actual_cost, had_cracks, glaze_matured, issues, notes } = req.body;
  if (!plan_id) {
    return res.status(400).json({ error: 'Missing plan_id' });
  }
  
  const db = getDb();
  const id = uuidv4();
  
  db.run(
    'INSERT INTO firing_records (id, plan_id, actual_start_time, actual_end_time, actual_duration, actual_cost, had_cracks, glaze_matured, issues, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, plan_id, actual_start_time, actual_end_time, actual_duration, actual_cost, had_cracks ? 1 : 0, glaze_matured ? 1 : 0, issues, notes]
  );
  
  saveDatabase();
  res.status(201).json({ id, ...req.body });
});

router.put('/records/:id', (req, res) => {
  const { plan_id, actual_start_time, actual_end_time, actual_duration, actual_cost, had_cracks, glaze_matured, issues, notes } = req.body;
  const db = getDb();
  
  db.run(
    'UPDATE firing_records SET plan_id = ?, actual_start_time = ?, actual_end_time = ?, actual_duration = ?, actual_cost = ?, had_cracks = ?, glaze_matured = ?, issues = ?, notes = ? WHERE id = ?',
    [plan_id, actual_start_time, actual_end_time, actual_duration, actual_cost, had_cracks ? 1 : 0, glaze_matured ? 1 : 0, issues, notes, req.params.id]
  );
  
  saveDatabase();
  res.json({ id: req.params.id, ...req.body });
});

router.delete('/records/:id', (req, res) => {
  const db = getDb();
  db.run('DELETE FROM firing_records WHERE id = ?', [req.params.id]);
  saveDatabase();
  res.json({ success: true });
});

router.get('/plans/:id/export/markdown', (req, res) => {
  const db = getDb();
  
  const planResult = db.exec(`
    SELECT fp.*, k.name as kiln_name, k.power as kiln_power, k.capacity as kiln_capacity
    FROM firing_plans fp 
    LEFT JOIN kilns k ON fp.kiln_id = k.id 
    WHERE fp.id = ?
  `, [req.params.id]);
  
  if (planResult.length === 0) {
    return res.status(404).json({ error: 'Plan not found' });
  }
  
  const planRow = planResult[0].values[0];
  const plan = {
    id: planRow[0],
    name: planRow[1],
    kiln_id: planRow[2],
    electricity_price: planRow[3],
    expected_max_duration: planRow[4],
    expected_max_cost: planRow[5],
    total_pieces_weight: planRow[6],
    estimated_duration: planRow[7],
    estimated_cost: planRow[8],
    created_at: planRow[9],
    kiln_name: planRow[11],
    kiln_power: planRow[12],
    kiln_capacity: planRow[13]
  };
  
  const stagesResult = db.exec('SELECT * FROM firing_curve_stages WHERE plan_id = ? ORDER BY stage_order', [req.params.id]);
  const stages = stagesResult.length > 0 ? stagesResult[0].values.map(row => ({
    stage_order: row[2],
    stage_type: row[3],
    start_temp: row[4],
    target_temp: row[5],
    heating_rate: row[6],
    cooling_rate: row[7],
    hold_duration: row[8],
    estimated_duration: row[9],
    description: row[10]
  })) : [];
  
  const piecesResult = db.exec(`
    SELECT p.name, p.thickness, p.weight, b.name as body_name, g.name as glaze_name 
    FROM plan_pieces pp 
    JOIN pieces p ON pp.piece_id = p.id 
    LEFT JOIN bodies b ON p.body_id = b.id 
    LEFT JOIN glazes g ON p.glaze_id = g.id 
    WHERE pp.plan_id = ?
  `, [req.params.id]);
  
  const pieces = piecesResult.length > 0 ? piecesResult[0].values.map(row => ({
    name: row[0],
    thickness: row[1],
    weight: row[2],
    body_name: row[3],
    glaze_name: row[4]
  })) : [];
  
  const risksResult = db.exec(`
    SELECT rc.risk_type, rc.risk_level, rc.message, rc.details, p.name as piece_name 
    FROM risk_checks rc 
    LEFT JOIN pieces p ON rc.piece_id = p.id 
    WHERE rc.plan_id = ?
  `, [req.params.id]);
  
  const risks = risksResult.length > 0 ? risksResult[0].values.map(row => ({
    risk_type: row[0],
    risk_level: row[1],
    message: row[2],
    details: row[3],
    piece_name: row[4]
  })) : [];
  
  const recordResult = db.exec(`
    SELECT * FROM firing_records WHERE plan_id = ? ORDER BY created_at DESC LIMIT 1
  `, [req.params.id]);
  
  let record = null;
  if (recordResult.length > 0 && recordResult[0].values.length > 0) {
    const row = recordResult[0].values[0];
    record = {
      actual_start_time: row[2],
      actual_end_time: row[3],
      actual_duration: row[4],
      actual_cost: row[5],
      had_cracks: row[6],
      glaze_matured: row[7],
      issues: row[8],
      notes: row[9],
      created_at: row[10]
    };
  }
  
  let markdown = `# ${plan.name}\n\n`;
  markdown += `## 基本信息\n\n`;
  markdown += `- **窑炉**: ${plan.kiln_name || '未指定'}\n`;
  markdown += `- **窑炉功率**: ${plan.kiln_power || 0} kW\n`;
  markdown += `- **窑炉容量**: ${plan.kiln_capacity || 0} m³\n`;
  markdown += `- **电价**: ¥${plan.electricity_price || 0}/度\n`;
  markdown += `- **作品总重**: ${plan.total_pieces_weight || 0} kg\n`;
  markdown += `- **预计时长**: ${plan.estimated_duration ? plan.estimated_duration.toFixed(1) : 0} 小时\n`;
  markdown += `- **预计电费**: ¥${plan.estimated_cost ? plan.estimated_cost.toFixed(2) : 0}\n`;
  markdown += `- **创建时间**: ${plan.created_at}\n\n`;
  
  if (record) {
    markdown += `## 烧成复盘记录\n\n`;
    if (record.actual_start_time) markdown += `- **开始时间**: ${record.actual_start_time}\n`;
    if (record.actual_end_time) markdown += `- **结束时间**: ${record.actual_end_time}\n`;
    if (record.actual_duration) markdown += `- **实际时长**: ${record.actual_duration} 小时\n`;
    if (record.actual_cost) markdown += `- **实际电费**: ¥${record.actual_cost.toFixed(2)}\n`;
    markdown += `- **是否开裂**: ${record.had_cracks ? '是' : '否'}\n`;
    if (record.glaze_matured !== null) markdown += `- **釉面是否成熟**: ${record.glaze_matured ? '是' : '否'}\n`;
    if (record.issues) markdown += `- **遇到的问题**: ${record.issues}\n`;
    if (record.notes) markdown += `- **备注**: ${record.notes}\n`;
    markdown += `\n`;
  }
  
  markdown += `## 烧成曲线阶段\n\n`;
  markdown += `| 阶段 | 类型 | 起始温度 | 目标温度 | 速率 | 时长 |\n`;
  markdown += `|------|------|----------|----------|------|------|\n`;
  
  for (const stage of stages) {
    let stageType = '';
    let rate = '';
    
    switch (stage.stage_type) {
      case 'heating':
        stageType = '升温';
        rate = `${stage.heating_rate}°C/小时`;
        break;
      case 'holding':
        stageType = '保温';
        rate = '-';
        break;
      case 'cooling':
        stageType = '降温';
        rate = `${stage.cooling_rate}°C/小时`;
        break;
    }
    
    const duration = stage.estimated_duration || stage.hold_duration || 0;
    markdown += `| ${stage.stage_order + 1} | ${stageType} | ${stage.start_temp}°C | ${stage.target_temp || '-'}°C | ${rate} | ${duration.toFixed(1)}小时 |\n`;
  }
  
  markdown += `\n`;
  
  if (pieces.length > 0) {
    markdown += `## 待烧作品\n\n`;
    markdown += `| 作品名称 | 厚度 | 重量 | 坯体 | 釉料 |\n`;
    markdown += `|----------|------|------|------|------|\n`;
    
    for (const piece of pieces) {
      markdown += `| ${piece.name} | ${piece.thickness}cm | ${piece.weight}kg | ${piece.body_name || '-'} | ${piece.glaze_name || '-'} |\n`;
    }
    
    markdown += `\n`;
  }
  
  if (risks.length > 0) {
    markdown += `## 风险检查\n\n`;
    
    const highRisks = risks.filter(r => r.risk_level === 'high');
    const mediumRisks = risks.filter(r => r.risk_level === 'medium');
    const lowRisks = risks.filter(r => r.risk_level === 'low');
    
    if (highRisks.length > 0) {
      markdown += `### 高风险 (${highRisks.length}项)\n\n`;
      for (const risk of highRisks) {
        markdown += `**${risk.message}**\n\n`;
        if (risk.details) markdown += `> ${risk.details}\n\n`;
      }
    }
    
    if (mediumRisks.length > 0) {
      markdown += `### 中风险 (${mediumRisks.length}项)\n\n`;
      for (const risk of mediumRisks) {
        markdown += `**${risk.message}**\n\n`;
        if (risk.details) markdown += `> ${risk.details}\n\n`;
      }
    }
    
    if (lowRisks.length > 0) {
      markdown += `### 低风险 (${lowRisks.length}项)\n\n`;
      for (const risk of lowRisks) {
        markdown += `${risk.message}\n\n`;
        if (risk.details) markdown += `> ${risk.details}\n\n`;
      }
    }
  }
  
  markdown += `\n---\n`;
  markdown += `*报告生成时间: ${new Date().toISOString()}*\n`;
  
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${plan.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.md"`);
  res.send(markdown);
});

router.get('/plans/:id/export/html', (req, res) => {
  const db = getDb();
  
  const planResult = db.exec(`
    SELECT fp.*, k.name as kiln_name, k.power as kiln_power, k.capacity as kiln_capacity
    FROM firing_plans fp 
    LEFT JOIN kilns k ON fp.kiln_id = k.id 
    WHERE fp.id = ?
  `, [req.params.id]);
  
  if (planResult.length === 0) {
    return res.status(404).json({ error: 'Plan not found' });
  }
  
  const planRow = planResult[0].values[0];
  const plan = {
    id: planRow[0],
    name: planRow[1],
    kiln_id: planRow[2],
    electricity_price: planRow[3],
    expected_max_duration: planRow[4],
    expected_max_cost: planRow[5],
    total_pieces_weight: planRow[6],
    estimated_duration: planRow[7],
    estimated_cost: planRow[8],
    created_at: planRow[9],
    kiln_name: planRow[11],
    kiln_power: planRow[12],
    kiln_capacity: planRow[13]
  };
  
  const stagesResult = db.exec('SELECT * FROM firing_curve_stages WHERE plan_id = ? ORDER BY stage_order', [req.params.id]);
  const stages = stagesResult.length > 0 ? stagesResult[0].values.map(row => ({
    stage_order: row[2],
    stage_type: row[3],
    start_temp: row[4],
    target_temp: row[5],
    heating_rate: row[6],
    cooling_rate: row[7],
    hold_duration: row[8],
    estimated_duration: row[9],
    description: row[10]
  })) : [];
  
  const piecesResult = db.exec(`
    SELECT p.name, p.thickness, p.weight, b.name as body_name, g.name as glaze_name 
    FROM plan_pieces pp 
    JOIN pieces p ON pp.piece_id = p.id 
    LEFT JOIN bodies b ON p.body_id = b.id 
    LEFT JOIN glazes g ON p.glaze_id = g.id 
    WHERE pp.plan_id = ?
  `, [req.params.id]);
  
  const pieces = piecesResult.length > 0 ? piecesResult[0].values.map(row => ({
    name: row[0],
    thickness: row[1],
    weight: row[2],
    body_name: row[3],
    glaze_name: row[4]
  })) : [];
  
  const risksResult = db.exec(`
    SELECT rc.risk_type, rc.risk_level, rc.message, rc.details, p.name as piece_name 
    FROM risk_checks rc 
    LEFT JOIN pieces p ON rc.piece_id = p.id 
    WHERE rc.plan_id = ?
  `, [req.params.id]);
  
  const risks = risksResult.length > 0 ? risksResult[0].values.map(row => ({
    risk_type: row[0],
    risk_level: row[1],
    message: row[2],
    details: row[3],
    piece_name: row[4]
  })) : [];
  
  const recordResult = db.exec(`
    SELECT * FROM firing_records WHERE plan_id = ? ORDER BY created_at DESC LIMIT 1
  `, [req.params.id]);
  
  let record = null;
  if (recordResult.length > 0 && recordResult[0].values.length > 0) {
    const row = recordResult[0].values[0];
    record = {
      actual_start_time: row[2],
      actual_end_time: row[3],
      actual_duration: row[4],
      actual_cost: row[5],
      had_cracks: row[6],
      glaze_matured: row[7],
      issues: row[8],
      notes: row[9],
      created_at: row[10]
    };
  }
  
  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${plan.name} - 烧成计划</title>
  <style>
    body { font-family: 'Microsoft YaHei', Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333; }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; border-bottom: 2px solid #bdc3c7; padding-bottom: 5px; margin-top: 30px; }
    h3 { color: #2980b9; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #bdc3c7; padding: 12px; text-align: left; }
    th { background-color: #3498db; color: white; }
    tr:nth-child(even) { background-color: #f8f9fa; }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .info-item { background-color: #ecf0f1; padding: 15px; border-radius: 5px; }
    .info-label { font-weight: bold; color: #7f8c8d; font-size: 0.9em; }
    .info-value { font-size: 1.2em; color: #2c3e50; margin-top: 5px; }
    .risk-high { background-color: #ff6b6b; color: white; padding: 3px 8px; border-radius: 3px; font-size: 0.8em; }
    .risk-medium { background-color: #feca57; color: #333; padding: 3px 8px; border-radius: 3px; font-size: 0.8em; }
    .risk-low { background-color: #48dbfb; color: white; padding: 3px 8px; border-radius: 3px; font-size: 0.8em; }
    .risk-item { margin: 15px 0; padding: 15px; border-left: 4px solid; }
    .risk-item.high { border-color: #ff6b6b; background-color: #fff5f5; }
    .risk-item.medium { border-color: #feca57; background-color: #fffef0; }
    .risk-item.low { border-color: #48dbfb; background-color: #f0fbff; }
    .risk-message { font-weight: bold; margin-bottom: 8px; }
    .risk-details { color: #666; font-size: 0.9em; }
    .record-box { background-color: #fff; border: 1px solid #ddd; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.9em; margin-right: 10px; }
    .status-yes { background-color: #1dd1a1; color: white; }
    .status-no { background-color: #ff6b6b; color: white; }
    footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #bdc3c7; color: #7f8c8d; font-size: 0.9em; text-align: center; }
  </style>
</head>
<body>
  <h1>${plan.name}</h1>
  
  <h2>基本信息</h2>
  <div class="info-grid">
    <div class="info-item">
      <div class="info-label">窑炉</div>
      <div class="info-value">${plan.kiln_name || '未指定'}</div>
    </div>
    <div class="info-item">
      <div class="info-label">窑炉功率</div>
      <div class="info-value">${plan.kiln_power || 0} kW</div>
    </div>
    <div class="info-item">
      <div class="info-label">窑炉容量</div>
      <div class="info-value">${plan.kiln_capacity || 0} m³</div>
    </div>
    <div class="info-item">
      <div class="info-label">电价</div>
      <div class="info-value">¥${plan.electricity_price || 0}/度</div>
    </div>
    <div class="info-item">
      <div class="info-label">作品总重</div>
      <div class="info-value">${plan.total_pieces_weight || 0} kg</div>
    </div>
    <div class="info-item">
      <div class="info-label">预计时长</div>
      <div class="info-value">${plan.estimated_duration ? plan.estimated_duration.toFixed(1) : 0} 小时</div>
    </div>
    <div class="info-item">
      <div class="info-label">预计电费</div>
      <div class="info-value">¥${plan.estimated_cost ? plan.estimated_cost.toFixed(2) : 0}</div>
    </div>
    <div class="info-item">
      <div class="info-label">创建时间</div>
      <div class="info-value" style="font-size: 0.9em;">${plan.created_at}</div>
    </div>
  </div>`;
  
  if (record) {
    html += `
  <h2>烧成复盘记录</h2>
  <div class="record-box">
    <div class="info-grid">
      ${record.actual_start_time ? `<div class="info-item"><div class="info-label">开始时间</div><div class="info-value" style="font-size: 0.9em;">${record.actual_start_time}</div></div>` : ''}
      ${record.actual_end_time ? `<div class="info-item"><div class="info-label">结束时间</div><div class="info-value" style="font-size: 0.9em;">${record.actual_end_time}</div></div>` : ''}
      ${record.actual_duration ? `<div class="info-item"><div class="info-label">实际时长</div><div class="info-value">${record.actual_duration} 小时</div></div>` : ''}
      ${record.actual_cost ? `<div class="info-item"><div class="info-label">实际电费</div><div class="info-value">¥${record.actual_cost.toFixed(2)}</div></div>` : ''}
    </div>
    <div style="margin-top: 15px;">
      <span class="status-badge ${record.had_cracks ? 'status-no' : 'status-yes'}">
        是否开裂: ${record.had_cracks ? '是' : '否'}
      </span>
      ${record.glaze_matured !== null ? `<span class="status-badge ${record.glaze_matured ? 'status-yes' : 'status-no'}">釉面是否成熟: ${record.glaze_matured ? '是' : '否'}</span>` : ''}
    </div>
    ${record.issues ? `<p><strong>遇到的问题:</strong> ${record.issues}</p>` : ''}
    ${record.notes ? `<p><strong>备注:</strong> ${record.notes}</p>` : ''}
  </div>`;
  }
  
  html += `
  <h2>烧成曲线阶段</h2>
  <table>
    <thead>
      <tr>
        <th>阶段</th>
        <th>类型</th>
        <th>起始温度</th>
        <th>目标温度</th>
        <th>速率</th>
        <th>时长</th>
      </tr>
    </thead>
    <tbody>`;
  
  for (const stage of stages) {
    let stageType = '';
    let rate = '';
    
    switch (stage.stage_type) {
      case 'heating':
        stageType = '升温';
        rate = `${stage.heating_rate}°C/小时`;
        break;
      case 'holding':
        stageType = '保温';
        rate = '-';
        break;
      case 'cooling':
        stageType = '降温';
        rate = `${stage.cooling_rate}°C/小时`;
        break;
    }
    
    const duration = stage.estimated_duration || stage.hold_duration || 0;
    html += `
      <tr>
        <td>${stage.stage_order + 1}</td>
        <td>${stageType}</td>
        <td>${stage.start_temp}°C</td>
        <td>${stage.target_temp || '-'}°C</td>
        <td>${rate}</td>
        <td>${duration.toFixed(1)}小时</td>
      </tr>`;
  }
  
  html += `
    </tbody>
  </table>`;
  
  if (pieces.length > 0) {
    html += `
  <h2>待烧作品</h2>
  <table>
    <thead>
      <tr>
        <th>作品名称</th>
        <th>厚度</th>
        <th>重量</th>
        <th>坯体</th>
        <th>釉料</th>
      </tr>
    </thead>
    <tbody>`;
    
    for (const piece of pieces) {
      html += `
      <tr>
        <td>${piece.name}</td>
        <td>${piece.thickness}cm</td>
        <td>${piece.weight}kg</td>
        <td>${piece.body_name || '-'}</td>
        <td>${piece.glaze_name || '-'}</td>
      </tr>`;
    }
    
    html += `
    </tbody>
  </table>`;
  }
  
  if (risks.length > 0) {
    html += `
  <h2>风险检查</h2>`;
    
    const highRisks = risks.filter(r => r.risk_level === 'high');
    const mediumRisks = risks.filter(r => r.risk_level === 'medium');
    const lowRisks = risks.filter(r => r.risk_level === 'low');
    
    if (highRisks.length > 0) {
      html += `
  <h3><span class="risk-high">高风险</span> (${highRisks.length}项)</h3>`;
      for (const risk of highRisks) {
        html += `
  <div class="risk-item high">
    <div class="risk-message">${risk.message}</div>
    ${risk.details ? `<div class="risk-details">${risk.details}</div>` : ''}
  </div>`;
      }
    }
    
    if (mediumRisks.length > 0) {
      html += `
  <h3><span class="risk-medium">中风险</span> (${mediumRisks.length}项)</h3>`;
      for (const risk of mediumRisks) {
        html += `
  <div class="risk-item medium">
    <div class="risk-message">${risk.message}</div>
    ${risk.details ? `<div class="risk-details">${risk.details}</div>` : ''}
  </div>`;
      }
    }
    
    if (lowRisks.length > 0) {
      html += `
  <h3><span class="risk-low">低风险</span> (${lowRisks.length}项)</h3>`;
      for (const risk of lowRisks) {
        html += `
  <div class="risk-item low">
    <div class="risk-message">${risk.message}</div>
    ${risk.details ? `<div class="risk-details">${risk.details}</div>` : ''}
  </div>`;
      }
    }
  }
  
  html += `
  <footer>
    <p>报告生成时间: ${new Date().toISOString()}</p>
  </footer>
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${plan.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.html"`);
  res.send(html);
});

module.exports = router;