const { getAll, getOne } = require('./dbHelper');

const ConflictTypes = {
  TOO_MANY_SHIFTS: 'too_many_shifts',
  SKILL_MISMATCH: 'skill_mismatch',
  POSITION_UNDERSTAFFED: 'position_understaffed',
  NOT_AVAILABLE: 'not_available',
  ALREADY_SCHEDULED: 'already_scheduled'
};

async function getAllData() {
  const eventDates = await getAll(`
    SELECT ed.*, 
           dpr.id as req_id, dpr.position_id, dpr.required_count,
           p.name as position_name, p.required_skills as position_skills
    FROM event_dates ed
    LEFT JOIN date_position_requirements dpr ON ed.id = dpr.date_id
    LEFT JOIN positions p ON dpr.position_id = p.id
    ORDER BY ed.date
  `);
  
  const positions = await getAll(`
    SELECT p.*
    FROM positions p
  `);
  
  const volunteers = await getAll(`
    SELECT v.*
    FROM volunteers v
  `);
  
  const volunteerSkills = await getAll(`
    SELECT vs.volunteer_id, vs.skill_id, s.name as skill_name
    FROM volunteer_skills vs
    JOIN skills s ON vs.skill_id = s.id
  `);
  
  const volunteerAvailableDates = await getAll(`
    SELECT vad.volunteer_id, vad.date_id
    FROM volunteer_available_dates vad
  `);
  
  const schedules = await getAll(`
    SELECT s.*, ed.date, p.name as position_name, v.name as volunteer_name,
           p.required_skills as position_skills
    FROM schedules s
    JOIN event_dates ed ON s.date_id = ed.id
    JOIN positions p ON s.position_id = p.id
    JOIN volunteers v ON s.volunteer_id = v.id
  `);
  
  const dateRequirements = await getAll(`
    SELECT dpr.*, ed.date, p.name as position_name, p.required_skills
    FROM date_position_requirements dpr
    JOIN event_dates ed ON dpr.date_id = ed.id
    JOIN positions p ON dpr.position_id = p.id
  `);
  
  return {
    eventDates,
    positions,
    volunteers,
    volunteerSkills,
    volunteerAvailableDates,
    schedules,
    dateRequirements
  };
}

function detectTooManyShifts(schedules, volunteers) {
  const conflicts = [];
  
  const shiftsByVolunteerAndDate = {};
  for (const schedule of schedules) {
    const key = `${schedule.volunteer_id}_${schedule.date}`;
    if (!shiftsByVolunteerAndDate[key]) {
      shiftsByVolunteerAndDate[key] = [];
    }
    shiftsByVolunteerAndDate[key].push(schedule);
  }
  
  for (const key of Object.keys(shiftsByVolunteerAndDate)) {
    const [volunteerId, date] = key.split('_');
    const shifts = shiftsByVolunteerAndDate[key];
    const volunteer = volunteers.find(v => v.id === volunteerId);
    
    if (volunteer && shifts.length > volunteer.max_daily_shifts) {
      conflicts.push({
        type: ConflictTypes.TOO_MANY_SHIFTS,
        severity: 'error',
        message: `志愿者 ${volunteer.name} 在 ${date} 被安排了 ${shifts.length} 个班次，超过了每天最多 ${volunteer.max_daily_shifts} 个班次的限制`,
        volunteer_id: volunteerId,
        volunteer_name: volunteer.name,
        date: date,
        shift_count: shifts.length,
        max_allowed: volunteer.max_daily_shifts,
        affected_schedules: shifts.map(s => s.id)
      });
    }
  }
  
  return conflicts;
}

function detectSkillMismatch(schedules, volunteerSkills) {
  const conflicts = [];
  
  const skillsByVolunteer = {};
  for (const vs of volunteerSkills) {
    if (!skillsByVolunteer[vs.volunteer_id]) {
      skillsByVolunteer[vs.volunteer_id] = [];
    }
    skillsByVolunteer[vs.volunteer_id].push(vs.skill_name);
  }
  
  for (const schedule of schedules) {
    let requiredSkills = [];
    try {
      requiredSkills = JSON.parse(schedule.position_skills || '[]');
    } catch (e) {
      requiredSkills = [];
    }
    
    if (requiredSkills.length > 0) {
      const volunteerSkillNames = skillsByVolunteer[schedule.volunteer_id] || [];
      const missingSkills = requiredSkills.filter(skill => !volunteerSkillNames.includes(skill));
      
      if (missingSkills.length > 0) {
        conflicts.push({
          type: ConflictTypes.SKILL_MISMATCH,
          severity: 'warning',
          message: `志愿者 ${schedule.volunteer_name} 在 ${schedule.date} 的 ${schedule.position_name} 岗位缺少技能: ${missingSkills.join(', ')}`,
          volunteer_id: schedule.volunteer_id,
          volunteer_name: schedule.volunteer_name,
          position_id: schedule.position_id,
          position_name: schedule.position_name,
          date: schedule.date,
          required_skills: requiredSkills,
          volunteer_skills: volunteerSkillNames,
          missing_skills: missingSkills,
          affected_schedule: schedule.id
        });
      }
    }
  }
  
  return conflicts;
}

function detectUnderstaffedPositions(schedules, dateRequirements) {
  const conflicts = [];
  
  const scheduledByDateAndPosition = {};
  for (const schedule of schedules) {
    const key = `${schedule.date_id}_${schedule.position_id}`;
    if (!scheduledByDateAndPosition[key]) {
      scheduledByDateAndPosition[key] = 0;
    }
    scheduledByDateAndPosition[key]++;
  }
  
  for (const req of dateRequirements) {
    const key = `${req.date_id}_${req.position_id}`;
    const scheduled = scheduledByDateAndPosition[key] || 0;
    
    if (scheduled < req.required_count) {
      conflicts.push({
        type: ConflictTypes.POSITION_UNDERSTAFFED,
        severity: 'error',
        message: `${req.date} 的 ${req.position_name} 岗位需要 ${req.required_count} 人，目前只安排了 ${scheduled} 人`,
        date: req.date,
        date_id: req.date_id,
        position_id: req.position_id,
        position_name: req.position_name,
        required_count: req.required_count,
        scheduled_count: scheduled,
        deficit: req.required_count - scheduled
      });
    }
  }
  
  return conflicts;
}

function detectNotAvailable(schedules, volunteerAvailableDates) {
  const conflicts = [];
  
  const availableDatesByVolunteer = {};
  for (const vad of volunteerAvailableDates) {
    if (!availableDatesByVolunteer[vad.volunteer_id]) {
      availableDatesByVolunteer[vad.volunteer_id] = [];
    }
    availableDatesByVolunteer[vad.volunteer_id].push(vad.date_id);
  }
  
  for (const schedule of schedules) {
    const availableDates = availableDatesByVolunteer[schedule.volunteer_id] || [];
    
    if (availableDates.length > 0 && !availableDates.includes(schedule.date_id)) {
      conflicts.push({
        type: ConflictTypes.NOT_AVAILABLE,
        severity: 'error',
        message: `志愿者 ${schedule.volunteer_name} 在 ${schedule.date} 不可用`,
        volunteer_id: schedule.volunteer_id,
        volunteer_name: schedule.volunteer_name,
        date: schedule.date,
        date_id: schedule.date_id,
        affected_schedule: schedule.id
      });
    }
  }
  
  return conflicts;
}

async function detectAllConflicts() {
  const data = await getAllData();
  
  const conflicts = [
    ...detectTooManyShifts(data.schedules, data.volunteers),
    ...detectSkillMismatch(data.schedules, data.volunteerSkills),
    ...detectUnderstaffedPositions(data.schedules, data.dateRequirements),
    ...detectNotAvailable(data.schedules, data.volunteerAvailableDates)
  ];
  
  conflicts.sort((a, b) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
  
  const stats = {
    total: conflicts.length,
    errors: conflicts.filter(c => c.severity === 'error').length,
    warnings: conflicts.filter(c => c.severity === 'warning').length
  };
  
  return {
    conflicts,
    stats
  };
}

async function detectConflictsForSchedule(scheduleId) {
  const schedule = await getOne(`
    SELECT s.*, ed.date, p.name as position_name, v.name as volunteer_name,
           p.required_skills as position_skills, v.max_daily_shifts
    FROM schedules s
    JOIN event_dates ed ON s.date_id = ed.id
    JOIN positions p ON s.position_id = p.id
    JOIN volunteers v ON s.volunteer_id = v.id
    WHERE s.id = ?
  `, [scheduleId]);
  
  if (!schedule) {
    return { conflicts: [], stats: { total: 0, errors: 0, warnings: 0 } };
  }
  
  const allSchedulesForVolunteerOnDate = await getAll(`
    SELECT s.*
    FROM schedules s
    WHERE s.volunteer_id = ? AND s.date_id = ?
  `, [schedule.volunteer_id, schedule.date_id]);
  
  const conflicts = [];
  
  if (allSchedulesForVolunteerOnDate.length > schedule.max_daily_shifts) {
    conflicts.push({
      type: ConflictTypes.TOO_MANY_SHIFTS,
      severity: 'error',
      message: `志愿者 ${schedule.volunteer_name} 在 ${schedule.date} 被安排了 ${allSchedulesForVolunteerOnDate.length} 个班次，超过了每天最多 ${schedule.max_daily_shifts} 个班次的限制`
    });
  }
  
  const volunteerSkills = await getAll(`
    SELECT s.name as skill_name
    FROM skills s
    JOIN volunteer_skills vs ON s.id = vs.skill_id
    WHERE vs.volunteer_id = ?
  `, [schedule.volunteer_id]);
  
  let requiredSkills = [];
  try {
    requiredSkills = JSON.parse(schedule.position_skills || '[]');
  } catch (e) {
    requiredSkills = [];
  }
  
  if (requiredSkills.length > 0) {
    const volunteerSkillNames = volunteerSkills.map(vs => vs.skill_name);
    const missingSkills = requiredSkills.filter(skill => !volunteerSkillNames.includes(skill));
    
    if (missingSkills.length > 0) {
      conflicts.push({
        type: ConflictTypes.SKILL_MISMATCH,
        severity: 'warning',
        message: `志愿者 ${schedule.volunteer_name} 缺少技能: ${missingSkills.join(', ')}`
      });
    }
  }
  
  const availableDates = await getAll(`
    SELECT vad.date_id
    FROM volunteer_available_dates vad
    WHERE vad.volunteer_id = ?
  `, [schedule.volunteer_id]);
  
  if (availableDates.length > 0 && !availableDates.some(d => d.date_id === schedule.date_id)) {
    conflicts.push({
      type: ConflictTypes.NOT_AVAILABLE,
      severity: 'error',
      message: `志愿者 ${schedule.volunteer_name} 在 ${schedule.date} 不可用`
    });
  }
  
  return {
    conflicts,
    stats: {
      total: conflicts.length,
      errors: conflicts.filter(c => c.severity === 'error').length,
      warnings: conflicts.filter(c => c.severity === 'warning').length
    }
  };
}

module.exports = {
  ConflictTypes,
  detectAllConflicts,
  detectConflictsForSchedule
};
