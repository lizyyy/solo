export const TimeUtils = {
  parseTime(timeStr) {
    if (!timeStr) return null;
    
    if (typeof timeStr === 'number') {
      return timeStr;
    }
    
    if (timeStr.includes('T') || timeStr.includes('-')) {
      return new Date(timeStr).getTime();
    }
    
    const timeParts = timeStr.split(':');
    if (timeParts.length >= 3) {
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);
      const seconds = parseInt(timeParts[2].split('.')[0], 10);
      const ms = timeParts[2].includes('.') 
        ? parseInt(timeParts[2].split('.')[1].padEnd(3, '0').slice(0, 3), 10) 
        : 0;
      
      return hours * 3600000 + minutes * 60000 + seconds * 1000 + ms;
    }
    
    return null;
  },

  formatTime(ms) {
    if (ms === null || ms === undefined) return '--:--:--';
    
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600) % 24;
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  },

  formatTimeWithDay(ms, startDayMs = 0) {
    if (ms === null || ms === undefined) return '--:--:--';
    
    const days = Math.floor(ms / 86400000);
    const dayOffset = Math.floor(startDayMs / 86400000);
    const actualDay = days - dayOffset;
    
    const timeStr = this.formatTime(ms);
    
    if (actualDay === 0) {
      return timeStr;
    } else if (actualDay === 1) {
      return `次日 ${timeStr}`;
    } else {
      return `+${actualDay}天 ${timeStr}`;
    }
  },

  calculateDuration(startMs, endMs) {
    if (startMs === null || endMs === null) return 0;
    return endMs - startMs;
  },

  isTimeInRange(timeMs, startMs, endMs) {
    if (timeMs === null || startMs === null || endMs === null) return false;
    return timeMs >= startMs && timeMs <= endMs;
  },

  handleMidnightCrossing(tracks, startTimeMs) {
    if (!tracks || tracks.length === 0) return tracks;
    
    const dayMs = 86400000;
    const threshold = startTimeMs + (dayMs / 2);
    
    let prevTime = null;
    let dayOffset = 0;
    
    return tracks.map(track => {
      const trackTime = track.timestamp || track.time;
      let currentTime = this.parseTime(trackTime);
      
      if (prevTime !== null && currentTime < prevTime) {
        if (prevTime > threshold && currentTime < dayMs) {
          dayOffset += dayMs;
        }
      }
      
      const adjustedTime = currentTime + dayOffset;
      prevTime = currentTime;
      
      return {
        ...track,
        timestamp: adjustedTime,
        originalTimestamp: currentTime
      };
    });
  },

  getTimeRange(tracks) {
    if (!tracks || tracks.length === 0) {
      return { start: 0, end: 0 };
    }
    
    let minTime = Infinity;
    let maxTime = -Infinity;
    
    tracks.forEach(track => {
      const time = track.timestamp || track.time;
      if (time < minTime) minTime = time;
      if (time > maxTime) maxTime = time;
    });
    
    return { start: minTime, end: maxTime };
  }
};

export default TimeUtils;
