const { getAll, getOne, runQuery, generateId } = require('./dbHelper');

async function getAllSchedulingData() {
  const eventDates = await getAll(`
    SELECT ed.*
    FROM event_dates ed
    ORDER BY ed.date
  `);
  
  const positions = await getAll(`
    SELECT p.*
    FROM positions p
  `);
  
  const dateRequirements = await getAll(`
    SELECT dpr.*, ed.date, p.name as position_name, p.required_skills
    FROM date_position_requirements dpr
    JOIN event_dates ed ON dpr.date_id = ed.id
    JOIN positions p ON dpr.position_id = p.id
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
  
  const existingSchedules = await getAll(`
    SELECT s.*
    FROM schedules s
  `);
  
  return {
    eventDates,
    positions,
    dateRequirements,
    volunteers,
    volunteerSkills,
    volunteerAvailableDates,
    existingSchedules
  };
}

function hasRequiredSkills(volunteerId, requiredSkills, volunteerSkillsMap) {
  if (!requiredSkills || requiredSkills.length === 0) {
    return true;
  }
  
  const volunteerSkillNames = volunteerSkillsMap[volunteerId] || [];
  
  for (const skill of requiredSkills) {
    if (!volunteerSkillNames.includes(skill)) {
      return false;
    }
  }
  
  return true;
}

function isAvailable(volunteerId, dateId, availableDatesMap) {
  const availableDates = availableDatesMap[volunteerId] || [];
  
  if (availableDates.length === 0) {
    return true;
  }
  
  return availableDates.includes(dateId);
}

function getCurrentShiftCount(volunteerId, dateId, existingAssignments, schedulesByVolunteerAndDate) {
  let count = 0;
  
  const key = `${volunteerId}_${dateId}`;
  if (schedulesByVolunteerAndDate[key]) {
    count += schedulesByVolunteerAndDate[key].length;
  }
  
  if (existingAssignments[key]) {
    count += existingAssignments[key].length;
  }
  
  return count;
}

async function generateSchedule(options = {}) {
  const { clearExisting = false } = options;
  
  const data = await getAllSchedulingData();
  
  const volunteerSkillsMap = {};
  for (const vs of data.volunteerSkills) {
    if (!volunteerSkillsMap[vs.volunteer_id]) {
      volunteerSkillsMap[vs.volunteer_id] = [];
    }
    volunteerSkillsMap[vs.volunteer_id].push(vs.skill_name);
  }
  
  const availableDatesMap = {};
  for (const vad of data.volunteerAvailableDates) {
    if (!availableDatesMap[vad.volunteer_id]) {
      availableDatesMap[vad.volunteer_id] = [];
    }
    availableDatesMap[vad.volunteer_id].push(vad.date_id);
  }
  
  const schedulesByVolunteerAndDate = {};
  if (!clearExisting) {
    for (const s of data.existingSchedules) {
      const key = `${s.volunteer_id}_${s.date_id}`;
      if (!schedulesByVolunteerAndDate[key]) {
        schedulesByVolunteerAndDate[key] = [];
      }
      schedulesByVolunteerAndDate[key].push(s);
    }
  }
  
  const existingAssignments = {};
  const newSchedules = [];
  const now = new Date().toISOString();
  
  const sortedRequirements = [...data.dateRequirements].sort((a, b) => {
    let aSkills = [];
    let bSkills = [];
    try {
      aSkills = JSON.parse(a.required_skills || '[]');
      bSkills = JSON.parse(b.required_skills || '[]');
    } catch (e) {}
    
    if (aSkills.length !== bSkills.length) {
      return bSkills.length - aSkills.length;
    }
    
    return a.date.localeCompare(b.date);
  });
  
  for (const req of sortedRequirements) {
    let requiredSkills = [];
    try {
      requiredSkills = JSON.parse(req.required_skills || '[]');
    } catch (e) {
      requiredSkills = [];
    }
    
    const eligibleVolunteers = [];
    
    for (const volunteer of data.volunteers) {
      if (!isAvailable(volunteer.id, req.date_id, availableDatesMap)) {
        continue;
      }
      
      if (!hasRequiredSkills(volunteer.id, requiredSkills, volunteerSkillsMap)) {
        continue;
      }
      
      const key = `${volunteer.id}_${req.date_id}`;
      const currentCount = getCurrentShiftCount(
        volunteer.id, 
        req.date_id, 
        existingAssignments, 
        schedulesByVolunteerAndDate
      );
      
      if (currentCount >= volunteer.max_daily_shifts) {
        continue;
      }
      
      eligibleVolunteers.push({
        ...volunteer,
        currentShiftCount: currentCount,
        hasExactSkills: requiredSkills.length > 0 && 
          requiredSkills.every(s => (volunteerSkillsMap[volunteer.id] || []).includes(s))
      });
    }
    
    eligibleVolunteers.sort((a, b) => {
      if (a.hasExactSkills !== b.hasExactSkills) {
        return b.hasExactSkills ? 1 : -1;
      }
      
      if (a.currentShiftCount !== b.currentShiftCount) {
        return a.currentShiftCount - b.currentShiftCount;
      }
      
      return a.name.localeCompare(b.name);
    });
    
    const key = `${req.date_id}_${req.position_id}`;
    const existingCount = !clearExisting ? 
      data.existingSchedules.filter(s => s.date_id === req.date_id && s.position_id === req.position_id).length : 0;
    
    const toAssign = Math.max(0, req.required_count - existingCount);
    
    for (let i = 0; i < toAssign && i < eligibleVolunteers.length; i++) {
      const volunteer = eligibleVolunteers[i];
      
      const assignmentKey = `${volunteer.id}_${req.date_id}`;
      if (!existingAssignments[assignmentKey]) {
        existingAssignments[assignmentKey] = [];
      }
      existingAssignments[assignmentKey].push({ position_id: req.position_id });
      
      const id = generateId();
      const schedule = {
        id,
        date_id: req.date_id,
        position_id: req.position_id,
        volunteer_id: volunteer.id,
        is_draft: 1,
        created_at: now,
        updated_at: now,
        date: req.date,
        position_name: req.position_name,
        volunteer_name: volunteer.name
      };
      
      newSchedules.push(schedule);
    }
  }
  
  if (clearExisting && data.existingSchedules.length > 0) {
    await runQuery('DELETE FROM schedules');
  }
  
  for (const schedule of newSchedules) {
    try {
      await runQuery(`
        INSERT INTO schedules (id, date_id, position_id, volunteer_id, is_draft, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        schedule.id, 
        schedule.date_id, 
        schedule.position_id, 
        schedule.volunteer_id, 
        schedule.is_draft, 
        schedule.created_at, 
        schedule.updated_at
      ]);
    } catch (e) {
      console.error('Error inserting schedule:', e);
    }
  }
  
  const allSchedules = await getAll(`
    SELECT s.*, ed.date, p.name as position_name, v.name as volunteer_name
    FROM schedules s
    JOIN event_dates ed ON s.date_id = ed.id
    JOIN positions p ON s.position_id = p.id
    JOIN volunteers v ON s.volunteer_id = v.id
    ORDER BY ed.date, p.name
  `);
  
  const totalRequired = data.dateRequirements.reduce((sum, req) => sum + req.required_count, 0);
  const totalScheduled = allSchedules.length;
  
  return {
    message: `已生成 ${newSchedules.length} 个新排班`,
    newSchedulesCount: newSchedules.length,
    totalScheduled,
    totalRequired,
    coverage: totalRequired > 0 ? Math.round((totalScheduled / totalRequired) * 100) : 0,
    schedules: allSchedules
  };
}

module.exports = {
  generateSchedule
};
