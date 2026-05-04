const fs = require('fs');

class GCParser {
  constructor(filePath) {
    this.filePath = filePath;
    this.events = [];
    this.stats = {
      totalGCCount: 0,
      scavengeCount: 0,
      marksweepCount: 0,
      incrementalMarkingCount: 0,
      totalGCTime: 0,
      avgGCTime: 0,
      maxGCTime: 0,
      minGCTime: Infinity,
      youngSpaceGrowth: [],
      oldSpaceGrowth: [],
      heapUsedGrowth: [],
      scavengeSurvivalRate: [],
      promotionRate: []
    };
  }

  parse() {
    const content = fs.readFileSync(this.filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const event = this.parseLine(line);
      if (event) {
        this.events.push(event);
        this.updateStats(event);
      }
    }

    this.calculateDerivedStats();

    return {
      events: this.events,
      stats: this.stats,
      summary: this.generateSummary()
    };
  }

  parseLine(line) {
    let event = null;

    const gcStartMatch = line.match(/\[(\d+)\]\s+(\d+\.?\d*):\s+\[GC\s+\(([^)]+)\)\s+(\d+)[Kk]?->(\d+)[Kk]?\((\d+)[Kk]?\),\s+([\d.]+)\s+secs\]/);
    if (gcStartMatch) {
      event = {
        type: 'gc-start',
        gcType: gcStartMatch[3],
        beforeSize: parseInt(gcStartMatch[4]),
        afterSize: parseInt(gcStartMatch[5]),
        totalSize: parseInt(gcStartMatch[6]),
        duration: parseFloat(gcStartMatch[7]),
        rawLine: line
      };
    }

    const scavengeMatch = line.match(/\[(\d+)\]\s+(\d+\.?\d*):\s+\[GC\s+\(.*\)\s+(\d+)[Kk]?->(\d+)[Kk]?\((\d+)[Kk]?\),\s+([\d.]+)\s+secs\]/);
    if (scavengeMatch && line.includes('Scavenge')) {
      event = {
        type: 'scavenge',
        gcType: 'Scavenge',
        beforeSize: parseInt(scavengeMatch[3]),
        afterSize: parseInt(scavengeMatch[4]),
        totalSize: parseInt(scavengeMatch[5]),
        duration: parseFloat(scavengeMatch[6]),
        rawLine: line
      };
    }

    const marksweepMatch = line.match(/\[(\d+)\]\s+(\d+\.?\d*):\s+\[Full\s+GC\s+\(.*\)\s+(\d+)[Kk]?->(\d+)[Kk]?\((\d+)[Kk]?\),\s+([\d.]+)\s+secs\]/);
    if (marksweepMatch && (line.includes('Mark-Sweep') || line.includes('Full GC'))) {
      event = {
        type: 'marksweep',
        gcType: line.includes('Mark-Sweep') ? 'Mark-Sweep' : 'Full GC',
        beforeSize: parseInt(marksweepMatch[3]),
        afterSize: parseInt(marksweepMatch[4]),
        totalSize: parseInt(marksweepMatch[5]),
        duration: parseFloat(marksweepMatch[6]),
        rawLine: line
      };
    }

    const incrementalMatch = line.match(/\[(\d+)\]\s+(\d+\.?\d*):\s+\[Incremental\s+Marking.*\]/);
    if (incrementalMatch) {
      event = {
        type: 'incremental-marking',
        gcType: 'Incremental Marking',
        rawLine: line
      };
    }

    const youngSpaceMatch = line.match(/Young\s+generation:\s+(\d+)[Kk]->(\d+)[Kk]\((\d+)[Kk]\)/);
    if (youngSpaceMatch && event) {
      event.youngSpace = {
        beforeKB: parseInt(youngSpaceMatch[1]),
        afterKB: parseInt(youngSpaceMatch[2]),
        totalKB: parseInt(youngSpaceMatch[3])
      };
    }

    const oldSpaceMatch = line.match(/Old\s+generation:\s+(\d+)[Kk]->(\d+)[Kk]\((\d+)[Kk]\)/);
    if (oldSpaceMatch && event) {
      event.oldSpace = {
        beforeKB: parseInt(oldSpaceMatch[1]),
        afterKB: parseInt(oldSpaceMatch[2]),
        totalKB: parseInt(oldSpaceMatch[3])
      };
    }

    const survivalMatch = line.match(/Survival rate:\s+([\d.]+)%/);
    if (survivalMatch && event) {
      event.survivalRate = parseFloat(survivalMatch[1]);
    }

    const promotionMatch = line.match(/Promoted\s+(\d+)[Kk]/);
    if (promotionMatch && event) {
      event.promotedKB = parseInt(promotionMatch[1]);
    }

    if (event) {
      const timestampMatch = line.match(/\[(\d+)\]\s+(\d+\.?\d*):/);
      if (timestampMatch) {
        event.timestamp = parseFloat(timestampMatch[2]);
      }
    }

    return event;
  }

  updateStats(event) {
    if (!event || !event.type) return;

    this.stats.totalGCCount++;
    if (event.duration) {
      this.stats.totalGCTime += event.duration;
      this.stats.maxGCTime = Math.max(this.stats.maxGCTime, event.duration);
      this.stats.minGCTime = Math.min(this.stats.minGCTime, event.duration);
    }

    switch (event.type) {
      case 'scavenge':
        this.stats.scavengeCount++;
        if (event.survivalRate !== undefined) {
          this.stats.scavengeSurvivalRate.push(event.survivalRate);
        }
        if (event.youngSpace) {
          this.stats.youngSpaceGrowth.push(event.youngSpace);
        }
        if (event.promotedKB !== undefined) {
          this.stats.promotionRate.push(event.promotedKB);
        }
        break;
      case 'marksweep':
        this.stats.marksweepCount++;
        if (event.oldSpace) {
          this.stats.oldSpaceGrowth.push(event.oldSpace);
        }
        break;
      case 'incremental-marking':
        this.stats.incrementalMarkingCount++;
        break;
    }

    if (event.beforeSize !== undefined && event.afterSize !== undefined) {
      this.stats.heapUsedGrowth.push({
        before: event.beforeSize,
        after: event.afterSize,
        reclaimed: event.beforeSize - event.afterSize
      });
    }
  }

  calculateDerivedStats() {
    if (this.stats.totalGCCount > 0) {
      this.stats.avgGCTime = this.stats.totalGCTime / this.stats.totalGCCount;
    }

    if (this.stats.scavengeSurvivalRate.length > 0) {
      this.stats.avgSurvivalRate = this.stats.scavengeSurvivalRate.reduce((a, b) => a + b, 0) / this.stats.scavengeSurvivalRate.length;
    }

    if (this.stats.promotionRate.length > 0) {
      this.stats.avgPromotionKB = this.stats.promotionRate.reduce((a, b) => a + b, 0) / this.stats.promotionRate.length;
      this.stats.totalPromotedKB = this.stats.promotionRate.reduce((a, b) => a + b, 0);
    }

    if (this.stats.oldSpaceGrowth.length > 0) {
      const firstOld = this.stats.oldSpaceGrowth[0];
      const lastOld = this.stats.oldSpaceGrowth[this.stats.oldSpaceGrowth.length - 1];
      this.stats.oldSpaceGrowthKB = lastOld.afterKB - firstOld.beforeKB;
    }

    if (this.stats.heapUsedGrowth.length > 0) {
      const totalReclaimed = this.stats.heapUsedGrowth.reduce((sum, g) => sum + g.reclaimed, 0);
      this.stats.totalReclaimedKB = totalReclaimed;
      
      const majorGCs = this.events.filter(e => e.type === 'marksweep');
      if (majorGCs.length > 0) {
        const lastMajorGC = majorGCs[majorGCs.length - 1];
        const beforeMajor = lastMajorGC.beforeSize;
        const afterMajor = lastMajorGC.afterSize;
        const reclaimed = beforeMajor - afterMajor;
        const reclamationRate = beforeMajor > 0 ? (reclaimed / beforeMajor) * 100 : 0;
        this.stats.lastMajorGCReclamationRate = reclamationRate;
        this.stats.lastMajorGCReclaimedKB = reclaimed;
      }
    }

    if (this.stats.minGCTime === Infinity) {
      this.stats.minGCTime = 0;
    }
  }

  generateSummary() {
    return {
      totalGCEvents: this.stats.totalGCCount,
      scavengeEvents: this.stats.scavengeCount,
      marksweepEvents: this.stats.marksweepCount,
      incrementalMarkingEvents: this.stats.incrementalMarkingCount,
      totalGCTime: this.stats.totalGCTime.toFixed(3) + ' secs',
      avgGCTime: this.stats.avgGCTime.toFixed(4) + ' secs',
      maxGCTime: this.stats.maxGCTime.toFixed(4) + ' secs',
      minGCTime: this.stats.minGCTime.toFixed(4) + ' secs',
      avgSurvivalRate: this.stats.avgSurvivalRate ? this.stats.avgSurvivalRate.toFixed(2) + '%' : 'N/A',
      totalPromoted: this.stats.totalPromotedKB ? (this.stats.totalPromotedKB / 1024).toFixed(2) + ' MB' : 'N/A',
      oldSpaceGrowth: this.stats.oldSpaceGrowthKB ? (this.stats.oldSpaceGrowthKB / 1024).toFixed(2) + ' MB' : 'N/A',
      totalReclaimed: this.stats.totalReclaimedKB ? (this.stats.totalReclaimedKB / 1024).toFixed(2) + ' MB' : 'N/A',
      lastMajorGCReclamationRate: this.stats.lastMajorGCReclamationRate ? this.stats.lastMajorGCReclamationRate.toFixed(2) + '%' : 'N/A'
    };
  }
}

module.exports = GCParser;
