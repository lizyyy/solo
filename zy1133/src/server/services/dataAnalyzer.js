const { 
  ERROR_TYPES, 
  ERROR_TYPE_NAMES,
  PITCH_CENTS_THRESHOLD, 
  BEAT_MS_THRESHOLD,
  DEFAULT_SECTIONS
} = require('../models');

class DataAnalyzer {
  constructor(data) {
    this.data = data;
    this.pitchBeatData = data.pitchBeat || [];
    this.sessions = data.sessions || [];
    this.setlist = data.setlist || [];
    this.takes = data.takes || [];
  }

  getFilteredData(filters = {}) {
    let filtered = [...this.pitchBeatData];

    if (filters.sessionIds && filters.sessionIds.length > 0) {
      filtered = filtered.filter(d => filters.sessionIds.includes(d.session_id));
    }
    if (filters.songIds && filters.songIds.length > 0) {
      filtered = filtered.filter(d => filters.songIds.includes(d.song_id));
    }
    if (filters.sections && filters.sections.length > 0) {
      filtered = filtered.filter(d => filters.sections.includes(d.section));
    }
    if (filters.musicians && filters.musicians.length > 0) {
      filtered = filtered.filter(d => filters.musicians.includes(d.musician));
    }
    if (filters.instruments && filters.instruments.length > 0) {
      filtered = filtered.filter(d => filters.instruments.includes(d.instrument));
    }
    if (filters.errorTypes && filters.errorTypes.length > 0) {
      filtered = filtered.filter(d => filters.errorTypes.includes(d.error_type));
    }

    return filtered;
  }

  getSummary(filters = {}) {
    const data = this.getFilteredData(filters);
    
    const totalErrors = data.length;
    const pitchErrors = data.filter(d => 
      d.error_type === ERROR_TYPES.PITCH_HIGH || d.error_type === ERROR_TYPES.PITCH_LOW
    ).length;
    const beatErrors = data.filter(d => 
      d.error_type === ERROR_TYPES.BEAT_EARLY || d.error_type === ERROR_TYPES.BEAT_LATE
    ).length;
    
    const avgPitchCents = data.length > 0 
      ? data.reduce((sum, d) => sum + Math.abs(d.pitch_cents || 0), 0) / data.length 
      : 0;
    const avgBeatMs = data.length > 0 
      ? data.reduce((sum, d) => sum + Math.abs(d.beat_ms || 0), 0) / data.length 
      : 0;

    const severePitchErrors = data.filter(d => 
      Math.abs(d.pitch_cents || 0) >= PITCH_CENTS_THRESHOLD.error
    ).length;
    const severeBeatErrors = data.filter(d => 
      Math.abs(d.beat_ms || 0) >= BEAT_MS_THRESHOLD.error
    ).length;

    return {
      totalErrors,
      pitchErrors,
      beatErrors,
      avgPitchCents: Math.round(avgPitchCents * 10) / 10,
      avgBeatMs: Math.round(avgBeatMs * 10) / 10,
      severePitchErrors,
      severeBeatErrors,
      severeTotal: severePitchErrors + severeBeatErrors
    };
  }

  getSectionHeatmap(filters = {}) {
    const data = this.getFilteredData(filters);
    
    const sectionCounts = {};
    DEFAULT_SECTIONS.forEach(section => {
      sectionCounts[section] = 0;
    });

    data.forEach(d => {
      if (d.section && sectionCounts.hasOwnProperty(d.section)) {
        sectionCounts[d.section]++;
      }
    });

    const maxCount = Math.max(...Object.values(sectionCounts), 1);
    
    return Object.entries(sectionCounts).map(([section, count]) => ({
      section,
      count,
      intensity: count / maxCount,
      percentage: Math.round((count / (data.length || 1)) * 100)
    }));
  }

  getMusicianRanking(filters = {}) {
    const data = this.getFilteredData(filters);
    
    const musicianStats = {};
    
    data.forEach(d => {
      const musician = d.musician;
      if (!musician) return;
      
      if (!musicianStats[musician]) {
        musicianStats[musician] = {
          musician,
          totalErrors: 0,
          pitchErrors: 0,
          beatErrors: 0,
          earlyBeats: 0,
          lateBeats: 0,
          highPitch: 0,
          lowPitch: 0,
          instruments: new Set(),
          avgPitchCents: 0,
          avgBeatMs: 0,
          totalPitchCents: 0,
          totalBeatMs: 0
        };
      }
      
      const stat = musicianStats[musician];
      stat.totalErrors++;
      stat.instruments.add(d.instrument);
      stat.totalPitchCents += Math.abs(d.pitch_cents || 0);
      stat.totalBeatMs += Math.abs(d.beat_ms || 0);
      
      if (d.error_type === ERROR_TYPES.PITCH_HIGH) {
        stat.pitchErrors++;
        stat.highPitch++;
      } else if (d.error_type === ERROR_TYPES.PITCH_LOW) {
        stat.pitchErrors++;
        stat.lowPitch++;
      } else if (d.error_type === ERROR_TYPES.BEAT_EARLY) {
        stat.beatErrors++;
        stat.earlyBeats++;
      } else if (d.error_type === ERROR_TYPES.BEAT_LATE) {
        stat.beatErrors++;
        stat.lateBeats++;
      }
    });

    return Object.values(musicianStats).map(stat => ({
      ...stat,
      instruments: Array.from(stat.instruments),
      avgPitchCents: Math.round((stat.totalPitchCents / stat.totalErrors) * 10) / 10,
      avgBeatMs: Math.round((stat.totalBeatMs / stat.totalErrors) * 10) / 10
    })).sort((a, b) => b.totalErrors - a.totalErrors);
  }

  getTrendData(filters = {}) {
    const data = this.getFilteredData(filters);
    
    const sessions = [...new Set(data.map(d => d.session_id))].sort();
    
    const trend = sessions.map(sessionId => {
      const sessionData = data.filter(d => d.session_id === sessionId);
      const sessionInfo = this.sessions.find(s => s.session_id === sessionId);
      
      const pitchErrors = sessionData.filter(d => 
        d.error_type === ERROR_TYPES.PITCH_HIGH || d.error_type === ERROR_TYPES.PITCH_LOW
      );
      const beatErrors = sessionData.filter(d => 
        d.error_type === ERROR_TYPES.BEAT_EARLY || d.error_type === ERROR_TYPES.BEAT_LATE
      );
      
      const avgPitchCents = pitchErrors.length > 0 
        ? pitchErrors.reduce((sum, d) => sum + Math.abs(d.pitch_cents || 0), 0) / pitchErrors.length 
        : 0;
      const avgBeatMs = beatErrors.length > 0 
        ? beatErrors.reduce((sum, d) => sum + Math.abs(d.beat_ms || 0), 0) / beatErrors.length 
        : 0;

      return {
        sessionId,
        date: sessionInfo?.date || sessionId,
        totalErrors: sessionData.length,
        pitchErrors: pitchErrors.length,
        beatErrors: beatErrors.length,
        avgPitchCents: Math.round(avgPitchCents * 10) / 10,
        avgBeatMs: Math.round(avgBeatMs * 10) / 10
      };
    });

    return trend;
  }

  getSongAnalysis(filters = {}) {
    const data = this.getFilteredData(filters);
    
    const songStats = {};
    
    data.forEach(d => {
      const songId = d.song_id;
      if (!songStats[songId]) {
        const songInfo = this.setlist.find(s => s.song_id === songId);
        songStats[songId] = {
          songId,
          songName: songInfo?.song_name || songId,
          totalErrors: 0,
          sections: {},
          musicians: {},
          errorTypes: {}
        };
      }
      
      const stat = songStats[songId];
      stat.totalErrors++;
      
      if (d.section) {
        stat.sections[d.section] = (stat.sections[d.section] || 0) + 1;
      }
      
      if (d.musician) {
        stat.musicians[d.musician] = (stat.musicians[d.musician] || 0) + 1;
      }
      
      if (d.error_type) {
        stat.errorTypes[d.error_type] = (stat.errorTypes[d.error_type] || 0) + 1;
      }
    });

    return Object.values(songStats).sort((a, b) => b.totalErrors - a.totalErrors);
  }

  compareSessions(sessionId1, sessionId2) {
    const data1 = this.getFilteredData({ sessionIds: [sessionId1] });
    const data2 = this.getFilteredData({ sessionIds: [sessionId2] });
    
    const session1 = this.sessions.find(s => s.session_id === sessionId1);
    const session2 = this.sessions.find(s => s.session_id === sessionId2);

    const summary1 = this.getSummary({ sessionIds: [sessionId1] });
    const summary2 = this.getSummary({ sessionIds: [sessionId2] });

    const improvements = {
      totalErrors: summary2.totalErrors - summary1.totalErrors,
      pitchErrors: summary2.pitchErrors - summary1.pitchErrors,
      beatErrors: summary2.beatErrors - summary1.beatErrors,
      avgPitchCents: summary2.avgPitchCents - summary1.avgPitchCents,
      avgBeatMs: summary2.avgBeatMs - summary1.avgBeatMs
    };

    const sectionComparison = this.compareBySection(data1, data2);
    const musicianComparison = this.compareByMusician(data1, data2);
    const recurringIssues = this.findRecurringIssues(data1, data2);

    return {
      session1: { id: sessionId1, date: session1?.date, summary: summary1 },
      session2: { id: sessionId2, date: session2?.date, summary: summary2 },
      improvements,
      sectionComparison,
      musicianComparison,
      recurringIssues
    };
  }

  compareBySection(data1, data2) {
    const sections1 = this.aggregateBySection(data1);
    const sections2 = this.aggregateBySection(data2);
    
    const allSections = new Set([...Object.keys(sections1), ...Object.keys(sections2)]);
    
    return Array.from(allSections).map(section => ({
      section,
      count1: sections1[section] || 0,
      count2: sections2[section] || 0,
      change: (sections2[section] || 0) - (sections1[section] || 0)
    })).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }

  compareByMusician(data1, data2) {
    const musicians1 = this.aggregateByMusician(data1);
    const musicians2 = this.aggregateByMusician(data2);
    
    const allMusicians = new Set([...Object.keys(musicians1), ...Object.keys(musicians2)]);
    
    return Array.from(allMusicians).map(musician => ({
      musician,
      count1: musicians1[musician] || 0,
      count2: musicians2[musician] || 0,
      change: (musicians2[musician] || 0) - (musicians1[musician] || 0)
    })).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }

  aggregateBySection(data) {
    return data.reduce((acc, d) => {
      if (d.section) {
        acc[d.section] = (acc[d.section] || 0) + 1;
      }
      return acc;
    }, {});
  }

  aggregateByMusician(data) {
    return data.reduce((acc, d) => {
      if (d.musician) {
        acc[d.musician] = (acc[d.musician] || 0) + 1;
      }
      return acc;
    }, {});
  }

  findRecurringIssues(data1, data2) {
    const issues1 = this.extractIssues(data1);
    const issues2 = this.extractIssues(data2);
    
    const recurring = [];
    
    issues1.forEach(issue1 => {
      const matchingIssue = issues2.find(issue2 => 
        issue2.songId === issue1.songId &&
        issue2.section === issue1.section &&
        issue2.musician === issue1.musician &&
        issue2.errorType === issue1.errorType
      );
      
      if (matchingIssue) {
        recurring.push({
          songId: issue1.songId,
          songName: this.setlist.find(s => s.song_id === issue1.songId)?.song_name || issue1.songId,
          section: issue1.section,
          musician: issue1.musician,
          instrument: issue1.instrument,
          errorType: issue1.errorType,
          errorTypeName: ERROR_TYPE_NAMES[issue1.errorType] || issue1.errorType,
          count1: issue1.count,
          count2: matchingIssue.count
        });
      }
    });

    return recurring.sort((a, b) => (b.count1 + b.count2) - (a.count1 + a.count2));
  }

  extractIssues(data) {
    const issues = {};
    
    data.forEach(d => {
      const key = `${d.song_id}|${d.section}|${d.musician}|${d.error_type}`;
      if (!issues[key]) {
        issues[key] = {
          songId: d.song_id,
          section: d.section,
          musician: d.musician,
          instrument: d.instrument,
          errorType: d.error_type,
          count: 0
        };
      }
      issues[key].count++;
    });

    return Object.values(issues);
  }

  generatePracticeList(filters = {}) {
    const data = this.getFilteredData(filters);
    
    const practiceItems = [];
    
    const songIssues = this.getSongAnalysis(filters);
    
    songIssues.forEach(song => {
      const songData = data.filter(d => d.song_id === song.songId);
      
      Object.entries(song.sections).forEach(([section, count]) => {
        const sectionData = songData.filter(d => d.section === section);
        
        const primaryMusician = this.getTopMusician(sectionData);
        const primaryError = this.getTopErrorType(sectionData);
        const severity = this.calculateSeverity(sectionData);
        
        const suggestions = this.generateSuggestions(sectionData, primaryError, primaryMusician);
        
        practiceItems.push({
          songId: song.songId,
          songName: song.songName,
          section,
          count,
          primaryMusician,
          primaryError: {
            type: primaryError,
            name: ERROR_TYPE_NAMES[primaryError] || primaryError
          },
          severity,
          suggestions,
          musicians: Object.entries(song.musicians)
            .filter(([m]) => sectionData.some(d => d.musician === m))
            .map(([musician, count]) => ({ musician, count }))
            .sort((a, b) => b.count - a.count)
        });
      });
    });

    return practiceItems.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return b.count - a.count;
    });
  }

  getTopMusician(data) {
    const musicianCounts = {};
    data.forEach(d => {
      if (d.musician) {
        musicianCounts[d.musician] = (musicianCounts[d.musician] || 0) + 1;
      }
    });
    
    const sorted = Object.entries(musicianCounts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : null;
  }

  getTopErrorType(data) {
    const errorCounts = {};
    data.forEach(d => {
      if (d.error_type) {
        errorCounts[d.error_type] = (errorCounts[d.error_type] || 0) + 1;
      }
    });
    
    const sorted = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : null;
  }

  calculateSeverity(data) {
    if (data.length === 0) return 'low';
    
    const severeCount = data.filter(d => 
      Math.abs(d.pitch_cents || 0) >= PITCH_CENTS_THRESHOLD.error ||
      Math.abs(d.beat_ms || 0) >= BEAT_MS_THRESHOLD.error
    ).length;
    
    const severeRatio = severeCount / data.length;
    
    if (severeRatio >= 0.5 || data.length >= 10) return 'critical';
    if (severeRatio >= 0.3 || data.length >= 5) return 'high';
    if (data.length >= 3) return 'medium';
    return 'low';
  }

  generateSuggestions(data, primaryError, primaryMusician) {
    const suggestions = [];
    
    if (primaryError === ERROR_TYPES.PITCH_HIGH || primaryError === ERROR_TYPES.PITCH_LOW) {
      const avgCents = data.reduce((sum, d) => sum + Math.abs(d.pitch_cents || 0), 0) / data.length;
      
      suggestions.push({
        type: 'technique',
        text: `建议使用调音器辅助练习，当前平均偏差 ${Math.round(avgCents)} cents`
      });
      
      if (primaryError === ERROR_TYPES.PITCH_HIGH) {
        suggestions.push({
          type: 'focus',
          text: `${primaryMusician || '相关成员'} 需要注意不要唱/弹得太高，尝试从较低的音高开始`
        });
      } else {
        suggestions.push({
          type: 'focus',
          text: `${primaryMusician || '相关成员'} 需要注意不要唱/弹得太低，注意气息支撑`
        });
      }
      
      suggestions.push({
        type: 'practice',
        text: '建议慢练，每一个音都用调音器确认音准'
      });
    }
    
    if (primaryError === ERROR_TYPES.BEAT_EARLY || primaryError === ERROR_TYPES.BEAT_LATE) {
      const avgMs = data.reduce((sum, d) => sum + Math.abs(d.beat_ms || 0), 0) / data.length;
      
      suggestions.push({
        type: 'technique',
        text: `建议使用节拍器练习，当前平均偏差 ${Math.round(avgMs)} ms`
      });
      
      if (primaryError === ERROR_TYPES.BEAT_EARLY) {
        suggestions.push({
          type: 'focus',
          text: `${primaryMusician || '相关成员'} 有抢拍问题，建议在心里数拍子，等拍子完全落下再进`
        });
      } else {
        suggestions.push({
          type: 'focus',
          text: `${primaryMusician || '相关成员'} 有拖拍问题，建议提前预判拍子，更果断地进入`
        });
      }
      
      suggestions.push({
        type: 'practice',
        text: '建议先用较慢的速度练习，确保每个音都对准节拍，再逐渐提速'
      });
    }
    
    suggestions.push({
      type: 'coordination',
      text: '建议乐队一起录制该段落，回放时仔细听每个乐器的入口'
    });
    
    return suggestions;
  }

  getAvailableFilters() {
    return {
      sessions: [...new Set(this.pitchBeatData.map(d => d.session_id))].sort(),
      songs: this.setlist.map(s => ({ 
        id: s.song_id, 
        name: s.song_name 
      })),
      sections: [...new Set(this.pitchBeatData.map(d => d.section).filter(Boolean))].sort(),
      musicians: [...new Set(this.pitchBeatData.map(d => d.musician).filter(Boolean))].sort(),
      instruments: [...new Set(this.pitchBeatData.map(d => d.instrument).filter(Boolean))].sort(),
      errorTypes: Object.entries(ERROR_TYPE_NAMES).map(([key, name]) => ({
        type: key,
        name
      }))
    };
  }
}

module.exports = DataAnalyzer;
