const { db, treatmentStageConfig } = require('./database');

const getNextStage = (treatmentType, currentStage) => {
  const config = treatmentStageConfig[treatmentType];
  if (!config) return null;

  const stages = config.stages;
  if (!currentStage) {
    return stages[0];
  }

  const currentIndex = stages.findIndex(s => s.stage === currentStage);
  if (currentIndex === -1) return stages[0];
  if (currentIndex >= stages.length - 1) return null;

  return stages[currentIndex + 1];
};

const getCurrentStage = (treatmentPlanId) => {
  const appointments = db.prepare(`
    SELECT a.* 
    FROM appointments a 
    WHERE a.treatment_plan_id = ? 
    AND a.status IN ('completed', 'cancelled', 'no_show')
    ORDER BY a.appointment_date DESC, a.appointment_time DESC
    LIMIT 1
  `).get(treatmentPlanId);

  if (!appointments) return null;
  return appointments.treatment_stage;
};

const checkTimeConflict = (doctorId, appointmentDate, appointmentTime, excludeAppointmentId = null) => {
  const timeRangeStart = new Date(`2000-01-01 ${appointmentTime}`);
  const timeRangeEnd = new Date(timeRangeStart.getTime() + 30 * 60 * 1000);

  let query = `
    SELECT a.*, p.name as patient_name 
    FROM appointments a 
    JOIN patients p ON a.patient_id = p.id 
    WHERE a.doctor_id = ? 
    AND a.appointment_date = ? 
    AND a.status = 'scheduled'
  `;

  const params = [doctorId, appointmentDate];

  if (excludeAppointmentId) {
    query += ' AND a.id != ?';
    params.push(excludeAppointmentId);
  }

  const appointments = db.prepare(query).all(...params);

  for (const appt of appointments) {
    const apptStart = new Date(`2000-01-01 ${appt.appointment_time}`);
    const apptEnd = new Date(apptStart.getTime() + 30 * 60 * 1000);

    if ((timeRangeStart < apptEnd && timeRangeEnd > apptStart)) {
      return {
        conflict: true,
        existingAppointment: appt
      };
    }
  }

  return { conflict: false };
};

const checkStageCompleted = (treatmentPlanId, stage) => {
  const count = db.prepare(`
    SELECT COUNT(*) as count 
    FROM appointments 
    WHERE treatment_plan_id = ? 
    AND treatment_stage = ? 
    AND status = 'completed'
  `).get(treatmentPlanId, stage);

  return count.count > 0;
};

const getNoShowCount = (patientId) => {
  const count = db.prepare(`
    SELECT COUNT(*) as count 
    FROM no_show_records 
    WHERE patient_id = ?
  `).get(patientId);

  return count.count;
};

const needsDoctorConfirmation = (patientId) => {
  return getNoShowCount(patientId) >= 2;
};

const calculateNextAppointmentDate = (treatmentPlanId, completedDate) => {
  const plan = db.prepare(`
    SELECT * FROM treatment_plans WHERE id = ?
  `).get(treatmentPlanId);

  if (!plan) return null;

  const completedStage = db.prepare(`
    SELECT treatment_stage FROM appointments 
    WHERE treatment_plan_id = ? 
    AND appointment_date = ? 
    AND status = 'completed'
    ORDER BY appointment_time DESC LIMIT 1
  `).get(treatmentPlanId, completedDate);

  if (!completedStage) return null;

  const nextStage = getNextStage(plan.treatment_type, completedStage.treatment_stage);
  if (!nextStage) return null;

  const baseDate = new Date(completedDate);
  const nextDate = new Date(baseDate.getTime() + nextStage.nextInterval * 24 * 60 * 60 * 1000);

  return {
    nextDate: nextDate.toISOString().split('T')[0],
    nextStage: nextStage
  };
};

const validateAppointmentCreation = (data) => {
  const errors = [];
  const warnings = [];

  if (!data.patient_id) errors.push('必须选择患者');
  if (!data.doctor_id) errors.push('必须选择医生');
  if (!data.appointment_date) errors.push('必须选择日期');
  if (!data.appointment_time) errors.push('必须选择时间');

  if (data.treatment_plan_id && data.treatment_stage) {
    if (checkStageCompleted(data.treatment_plan_id, data.treatment_stage)) {
      errors.push('该治疗阶段已完成，不能重复预约');
    }
  }

  const timeConflict = checkTimeConflict(
    data.doctor_id,
    data.appointment_date,
    data.appointment_time
  );

  if (timeConflict.conflict) {
    errors.push(`时间冲突！该时段已有患者 ${timeConflict.existingAppointment.patient_name} 的预约`);
  }

  if (needsDoctorConfirmation(data.patient_id)) {
    warnings.push('警告：该患者爽约次数过多，需要医生确认后方可预约');
  }

  return { errors, warnings, requiresDoctorConfirmation: needsDoctorConfirmation(data.patient_id) };
};

const getTreatmentTimeline = (patientId) => {
  const treatmentPlans = db.prepare(`
    SELECT tp.*, d.name as doctor_name, 
           (SELECT name FROM patients WHERE id = tp.patient_id) as patient_name
    FROM treatment_plans tp
    JOIN doctors d ON tp.doctor_id = d.id
    WHERE tp.patient_id = ?
    ORDER BY tp.start_date DESC
  `).all(patientId);

  const timeline = [];

  for (const plan of treatmentPlans) {
    const config = treatmentStageConfig[plan.treatment_type];
    const treatmentName = config ? config.name : plan.treatment_type;

    const appointments = db.prepare(`
      SELECT a.*, d.name as doctor_name
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.treatment_plan_id = ?
      ORDER BY a.appointment_date ASC, a.appointment_time ASC
    `).all(plan.id);

    const stageNames = {};
    if (config) {
      config.stages.forEach(s => {
        stageNames[s.stage] = s.name;
      });
    }

    timeline.push({
      plan,
      treatmentName,
      appointments: appointments.map(a => ({
        ...a,
        stage_name: stageNames[a.treatment_stage] || a.treatment_stage
      }))
    });
  }

  return timeline;
};

const getUpcomingReminders = () => {
  const today = new Date();
  const threeDaysLater = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

  const appointments = db.prepare(`
    SELECT a.*, p.name as patient_name, p.phone as patient_phone,
           d.name as doctor_name, tp.treatment_type
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN doctors d ON a.doctor_id = d.id
    LEFT JOIN treatment_plans tp ON a.treatment_plan_id = tp.id
    WHERE a.status = 'scheduled'
    AND a.appointment_date >= ?
    AND a.appointment_date <= ?
    ORDER BY a.appointment_date ASC, a.appointment_time ASC
  `).all(
    today.toISOString().split('T')[0],
    threeDaysLater.toISOString().split('T')[0]
  );

  const stageNames = {};
  Object.values(treatmentStageConfig).forEach(config => {
    config.stages.forEach(s => {
      stageNames[s.stage] = s.name;
    });
  });

  return appointments.map(a => ({
    ...a,
    stage_name: stageNames[a.treatment_stage] || a.treatment_stage
  }));
};

const getNoShowStatistics = () => {
  const totalNoShows = db.prepare(`
    SELECT COUNT(*) as count FROM no_show_records
  `).get().count;

  const patientNoShows = db.prepare(`
    SELECT p.id, p.name, COUNT(n.id) as no_show_count
    FROM no_show_records n
    JOIN patients p ON n.patient_id = p.id
    GROUP BY n.patient_id
    ORDER BY no_show_count DESC
  `).all();

  const recentNoShows = db.prepare(`
    SELECT n.*, p.name as patient_name, a.appointment_date, a.appointment_time
    FROM no_show_records n
    JOIN patients p ON n.patient_id = p.id
    JOIN appointments a ON n.appointment_id = a.id
    ORDER BY n.no_show_date DESC
    LIMIT 20
  `).all();

  return {
    totalNoShows,
    patientNoShows,
    recentNoShows
  };
};

const getDoctorSchedule = (doctorId, date) => {
  const appointments = db.prepare(`
    SELECT a.*, p.name as patient_name, p.phone as patient_phone,
           tp.treatment_type
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    LEFT JOIN treatment_plans tp ON a.treatment_plan_id = tp.id
    WHERE a.doctor_id = ?
    AND a.appointment_date = ?
    ORDER BY a.appointment_time ASC
  `).all(doctorId, date);

  const stageNames = {};
  Object.values(treatmentStageConfig).forEach(config => {
    config.stages.forEach(s => {
      stageNames[s.stage] = s.name;
    });
  });

  return appointments.map(a => ({
    ...a,
    stage_name: stageNames[a.treatment_stage] || a.treatment_stage
  }));
};

const getExportData = () => {
  const appointments = db.prepare(`
    SELECT 
      a.id,
      p.name as patient_name,
      p.phone as patient_phone,
      d.name as doctor_name,
      CASE 
        WHEN tp.treatment_type = 'root_canal' THEN '根管治疗'
        WHEN tp.treatment_type = 'orthodontics' THEN '正畸治疗'
        WHEN tp.treatment_type = 'cleaning' THEN '洁牙复诊'
        ELSE a.type
      END as treatment_name,
      a.treatment_stage,
      a.appointment_date,
      a.appointment_time,
      CASE a.status
        WHEN 'scheduled' THEN '已预约'
        WHEN 'completed' THEN '已完成'
        WHEN 'cancelled' THEN '已取消'
        WHEN 'no_show' THEN '爽约'
        ELSE a.status
      END as status_name,
      a.notes
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN doctors d ON a.doctor_id = d.id
    LEFT JOIN treatment_plans tp ON a.treatment_plan_id = tp.id
    ORDER BY a.appointment_date DESC, a.appointment_time DESC
  `).all();

  return appointments;
};

module.exports = {
  getNextStage,
  getCurrentStage,
  checkTimeConflict,
  checkStageCompleted,
  getNoShowCount,
  needsDoctorConfirmation,
  calculateNextAppointmentDate,
  validateAppointmentCreation,
  getTreatmentTimeline,
  getUpcomingReminders,
  getNoShowStatistics,
  getDoctorSchedule,
  getExportData
};
