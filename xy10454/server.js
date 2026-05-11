const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Parser } = require('json2csv');
const { db, treatmentStageConfig } = require('./database');
const bl = require('./businessLogic');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/api/doctors', (req, res) => {
  const doctors = db.prepare('SELECT * FROM doctors ORDER BY name').all();
  res.json(doctors);
});

app.post('/api/doctors', (req, res) => {
  const { name, specialization, phone } = req.body;
  const result = db.prepare('INSERT INTO doctors (name, specialization, phone) VALUES (?, ?, ?)').run(name, specialization, phone);
  res.json({ id: result.lastInsertRowid, success: true });
});

app.get('/api/patients', (req, res) => {
  const patients = db.prepare('SELECT * FROM patients ORDER BY name').all();
  res.json(patients);
});

app.post('/api/patients', (req, res) => {
  const { name, phone, age, gender, address, notes } = req.body;
  const result = db.prepare('INSERT INTO patients (name, phone, age, gender, address, notes) VALUES (?, ?, ?, ?, ?, ?)').run(name, phone, age, gender, address, notes);
  res.json({ id: result.lastInsertRowid, success: true });
});

app.get('/api/treatment-plans', (req, res) => {
  const plans = db.prepare(`
    SELECT tp.*, p.name as patient_name, d.name as doctor_name
    FROM treatment_plans tp
    JOIN patients p ON tp.patient_id = p.id
    JOIN doctors d ON tp.doctor_id = d.id
    ORDER BY tp.start_date DESC
  `).all();

  const stageNames = {};
  Object.values(treatmentStageConfig).forEach(config => {
    config.stages.forEach(s => {
      stageNames[s.stage] = s.name;
    });
  });

  res.json(plans.map(p => ({
    ...p,
    treatment_name: treatmentStageConfig[p.treatment_type]?.name || p.treatment_type
  })));
});

app.get('/api/treatment-plans/patient/:patientId', (req, res) => {
  const plans = db.prepare(`
    SELECT tp.*, p.name as patient_name, d.name as doctor_name
    FROM treatment_plans tp
    JOIN patients p ON tp.patient_id = p.id
    JOIN doctors d ON tp.doctor_id = d.id
    WHERE tp.patient_id = ?
    ORDER BY tp.start_date DESC
  `).all(req.params.patientId);

  res.json(plans.map(p => ({
    ...p,
    treatment_name: treatmentStageConfig[p.treatment_type]?.name || p.treatment_type
  })));
});

app.post('/api/treatment-plans', (req, res) => {
  const { patient_id, doctor_id, treatment_type, start_date } = req.body;
  const result = db.prepare('INSERT INTO treatment_plans (patient_id, doctor_id, treatment_type, start_date) VALUES (?, ?, ?, ?)').run(patient_id, doctor_id, treatment_type, start_date);
  res.json({ id: result.lastInsertRowid, success: true });
});

app.get('/api/appointments', (req, res) => {
  const appointments = db.prepare(`
    SELECT a.*, p.name as patient_name, d.name as doctor_name, tp.treatment_type
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN doctors d ON a.doctor_id = d.id
    LEFT JOIN treatment_plans tp ON a.treatment_plan_id = tp.id
    ORDER BY a.appointment_date DESC, a.appointment_time DESC
  `).all();

  const stageNames = {};
  Object.values(treatmentStageConfig).forEach(config => {
    config.stages.forEach(s => {
      stageNames[s.stage] = s.name;
    });
  });

  res.json(appointments.map(a => ({
    ...a,
    stage_name: stageNames[a.treatment_stage] || a.treatment_stage,
    treatment_name: treatmentStageConfig[a.treatment_type]?.name || a.type
  })));
});

app.post('/api/appointments/validate', (req, res) => {
  const validation = bl.validateAppointmentCreation(req.body);
  res.json(validation);
});

app.post('/api/appointments', (req, res) => {
  const validation = bl.validateAppointmentCreation(req.body);
  
  if (validation.errors.length > 0) {
    return res.status(400).json({ errors: validation.errors, success: false });
  }

  if (validation.requiresDoctorConfirmation && !req.body.doctor_confirmed) {
    return res.status(400).json({ 
      errors: ['需要医生确认后方可预约'], 
      warnings: validation.warnings,
      requiresDoctorConfirmation: true,
      success: false 
    });
  }

  const { patient_id, doctor_id, treatment_plan_id, treatment_stage, appointment_date, appointment_time, type, notes } = req.body;
  
  const result = db.prepare(`
    INSERT INTO appointments (patient_id, doctor_id, treatment_plan_id, treatment_stage, appointment_date, appointment_time, type, notes) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(patient_id, doctor_id, treatment_plan_id, treatment_stage, appointment_date, appointment_time, type || 'follow-up', notes);

  res.json({ id: result.lastInsertRowid, success: true, warnings: validation.warnings });
});

app.put('/api/appointments/:id/status', (req, res) => {
  const { status, receptionist_note, doctor_confirmed_by, doctor_confirmation } = req.body;
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);

  if (!appointment) {
    return res.status(404).json({ error: '预约不存在' });
  }

  if (status === 'no_show') {
    db.prepare(`
      INSERT INTO no_show_records (appointment_id, patient_id, receptionist_note, doctor_confirmed_by, doctor_confirmation, doctor_confirmed_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      appointment.id, 
      appointment.patient_id, 
      receptionist_note || '',
      doctor_confirmed_by || null,
      doctor_confirmation || '',
      doctor_confirmed_by ? new Date().toISOString() : null,
      doctor_confirmed_by ? 'confirmed' : 'pending'
    );
  }

  if (status === 'completed' && appointment.treatment_plan_id) {
    const nextInfo = bl.calculateNextAppointmentDate(appointment.treatment_plan_id, appointment.appointment_date);
    db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, req.params.id);
    
    return res.json({ 
      success: true, 
      nextAppointment: nextInfo 
    });
  }

  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

app.put('/api/appointments/:id/reschedule', (req, res) => {
  const { new_date, new_time, reason } = req.body;
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);

  if (!appointment) {
    return res.status(404).json({ error: '预约不存在' });
  }

  const timeConflict = bl.checkTimeConflict(
    appointment.doctor_id,
    new_date,
    new_time,
    appointment.id
  );

  if (timeConflict.conflict) {
    return res.status(400).json({ 
      error: `时间冲突！该时段已有患者 ${timeConflict.existingAppointment.patient_name} 的预约`,
      success: false 
    });
  }

  db.prepare(`
    INSERT INTO reschedule_records (appointment_id, original_date, original_time, new_date, new_time, reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(appointment.id, appointment.appointment_date, appointment.appointment_time, new_date, new_time, reason);

  db.prepare('UPDATE appointments SET appointment_date = ?, appointment_time = ? WHERE id = ?').run(new_date, new_time, req.params.id);

  res.json({ success: true });
});

app.get('/api/treatment-stages/:treatmentType', (req, res) => {
  const config = treatmentStageConfig[req.params.treatmentType];
  if (!config) {
    return res.status(404).json({ error: '治疗类型不存在' });
  }
  res.json(config);
});

app.get('/api/patients/:id/timeline', (req, res) => {
  const timeline = bl.getTreatmentTimeline(req.params.id);
  res.json(timeline);
});

app.get('/api/reminders/upcoming', (req, res) => {
  const reminders = bl.getUpcomingReminders();
  res.json(reminders);
});

app.get('/api/no-shows/statistics', (req, res) => {
  const stats = bl.getNoShowStatistics();
  res.json(stats);
});

app.get('/api/doctors/:id/schedule', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const schedule = bl.getDoctorSchedule(req.params.id, date);
  res.json(schedule);
});

app.put('/api/no-shows/:id/confirm', (req, res) => {
  const { doctor_confirmation, doctor_confirmed_by } = req.body;
  db.prepare(`
    UPDATE no_show_records 
    SET doctor_confirmation = ?, doctor_confirmed_by = ?, doctor_confirmed_at = ?, status = 'confirmed'
    WHERE id = ?
  `).run(doctor_confirmation, doctor_confirmed_by, new Date().toISOString(), req.params.id);
  
  res.json({ success: true });
});

app.get('/api/export/appointments', (req, res) => {
  const data = bl.getExportData();
  
  if (data.length === 0) {
    return res.status(404).json({ error: '没有数据可导出' });
  }

  const fields = [
    { label: '患者姓名', value: 'patient_name' },
    { label: '患者电话', value: 'patient_phone' },
    { label: '医生', value: 'doctor_name' },
    { label: '治疗类型', value: 'treatment_name' },
    { label: '就诊日期', value: 'appointment_date' },
    { label: '就诊时间', value: 'appointment_time' },
    { label: '状态', value: 'status_name' },
    { label: '备注', value: 'notes' }
  ];

  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(data);

  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment('复诊计划.csv');
  res.send('\uFEFF' + csv);
});

app.listen(PORT, () => {
  console.log(`牙科复诊提醒台系统已启动: http://localhost:${PORT}`);
});
