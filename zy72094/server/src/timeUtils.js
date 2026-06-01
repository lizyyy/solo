function parseTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return [];
  
  const timeSlots = [];
  const dayMap = {
    '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5,
    '星期六': 6, '周日': 7, '周六': 6, '星期日': 7
  };

  const patterns = [
    /(周[一二三四五六日]|星期六|星期日)\s*(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/g
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(timeStr)) !== null) {
      const day = match[1];
      const startHour = parseInt(match[2]);
      const startMin = parseInt(match[3]);
      const endHour = parseInt(match[4]);
      const endMin = parseInt(match[5]);

      timeSlots.push({
        day,
        dayNum: dayMap[day] || 0,
        start: startHour * 60 + startMin,
        end: endHour * 60 + endMin,
        startStr: `${match[2]}:${match[3]}`,
        endStr: `${match[4]}:${match[5]}`
      });
    }
  }

  return timeSlots;
}

function calculateOverlap(timeSlots1, timeSlots2) {
  let totalOverlap = 0;
  const details = [];

  for (const slot1 of timeSlots1) {
    for (const slot2 of timeSlots2) {
      if (slot1.day === slot2.day) {
        const overlapStart = Math.max(slot1.start, slot2.start);
        const overlapEnd = Math.min(slot1.end, slot2.end);
        
        if (overlapEnd > overlapStart) {
          const overlap = overlapEnd - overlapStart;
          totalOverlap += overlap;
          details.push({
            day: slot1.day,
            slot1: `${slot1.startStr}-${slot1.endStr}`,
            slot2: `${slot2.startStr}-${slot2.endStr}`,
            overlapMinutes: overlap
          });
        }
      }
    }
  }

  return {
    minutes: totalOverlap,
    details
  };
}

function getDayOfWeek(dayStr) {
  const map = {
    '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5,
    '周六': 6, '周日': 7
  };
  return map[dayStr] || 0;
}

module.exports = {
  parseTime,
  calculateOverlap,
  getDayOfWeek
};
