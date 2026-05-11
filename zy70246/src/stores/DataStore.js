const fs = require('fs');
const path = require('path');
const { Toilet } = require('../models/Toilet');
const { Complaint } = require('../models/Complaint');

class DataStore {
  constructor(baseDir = './data') {
    this.baseDir = baseDir;
    this.toiletsFile = path.join(baseDir, 'toilets.json');
    this.complaintsFile = path.join(baseDir, 'complaints.json');
    this.importHistoryFile = path.join(baseDir, 'import_history.json');
    this.duplicatesFile = path.join(baseDir, 'duplicates.json');
    
    this.toilets = new Map();
    this.complaints = [];
    this.importHistory = [];
    this.duplicates = [];
    
    this.init();
  }

  init() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }

    if (fs.existsSync(this.toiletsFile)) {
      const data = JSON.parse(fs.readFileSync(this.toiletsFile, 'utf8'));
      data.forEach(t => this.toilets.set(t.id, t));
    }

    if (fs.existsSync(this.complaintsFile)) {
      this.complaints = JSON.parse(fs.readFileSync(this.complaintsFile, 'utf8'));
    }

    if (fs.existsSync(this.importHistoryFile)) {
      this.importHistory = JSON.parse(fs.readFileSync(this.importHistoryFile, 'utf8'));
    }

    if (fs.existsSync(this.duplicatesFile)) {
      this.duplicates = JSON.parse(fs.readFileSync(this.duplicatesFile, 'utf8'));
    }
  }

  save() {
    const toiletsArray = Array.from(this.toilets.values());
    fs.writeFileSync(this.toiletsFile, JSON.stringify(toiletsArray, null, 2), 'utf8');
    fs.writeFileSync(this.complaintsFile, JSON.stringify(this.complaints, null, 2), 'utf8');
    fs.writeFileSync(this.importHistoryFile, JSON.stringify(this.importHistory, null, 2), 'utf8');
    fs.writeFileSync(this.duplicatesFile, JSON.stringify(this.duplicates, null, 2), 'utf8');
  }

  importToilets(rawData, sourceName) {
    const results = {
      total: 0,
      added: 0,
      updated: 0,
      duplicates: [],
      invalid: [],
      warnings: []
    };

    if (!Array.isArray(rawData)) {
      rawData = [rawData];
    }

    results.total = rawData.length;
    const timestamp = new Date().toISOString();

    for (const item of rawData) {
      const toilet = new Toilet(item, sourceName);
      const isValid = toilet.validate();
      const summary = toilet.getSummary();

      if (!isValid) {
        results.invalid.push({
          data: item,
          errors: summary.errors,
          source: sourceName,
          timestamp
        });
        continue;
      }

      const id = item.id;
      if (this.toilets.has(id)) {
        const existing = this.toilets.get(id);
        const isDuplicate = this.deepEqual(item, existing.rawData);
        
        if (isDuplicate) {
          results.duplicates.push({
            id,
            name: item.name,
            existingSource: existing.source,
            newSource: sourceName,
            timestamp
          });
          this.duplicates.push({
            type: 'toilet',
            id,
            existingSource: existing.source,
            newSource: sourceName,
            existingData: existing.rawData,
            newData: item,
            timestamp
          });
        } else {
          this.toilets.set(id, {
            ...summary,
            rawData: item,
            source: sourceName,
            updatedAt: timestamp
          });
          results.updated++;
        }
      } else {
        this.toilets.set(id, {
          ...summary,
          rawData: item,
          source: sourceName,
          createdAt: timestamp
        });
        results.added++;
      }

      if (summary.warnings.length > 0) {
        results.warnings.push({
          id,
          name: item.name,
          warnings: summary.warnings,
          source: sourceName
        });
      }
    }

    this.importHistory.push({
      type: 'toilets',
      source: sourceName,
      timestamp,
      ...results
    });

    this.save();
    return results;
  }

  importComplaints(rawData, sourceName) {
    const results = {
      total: 0,
      added: 0,
      duplicates: [],
      invalid: [],
      updatedComplaintCount: [],
      unlinkedToilets: []
    };

    if (!Array.isArray(rawData)) {
      rawData = [rawData];
    }

    results.total = rawData.length;
    const timestamp = new Date().toISOString();

    for (const item of rawData) {
      const complaint = new Complaint(item, sourceName);
      const isValid = complaint.validate();
      const summary = complaint.getSummary();

      if (!isValid) {
        results.invalid.push({
          data: item,
          errors: summary.errors,
          source: sourceName,
          timestamp
        });
        continue;
      }

      const exists = this.complaints.find(c => c.id === item.id);
      if (exists) {
        results.duplicates.push({
          id: item.id,
          toiletId: item.toiletId,
          existingSource: exists.source,
          newSource: sourceName,
          timestamp
        });
        continue;
      }

      this.complaints.push({
        ...summary,
        rawData: item,
        source: sourceName,
        createdAt: timestamp
      });
      results.added++;

      const toiletId = item.toiletId;
      if (this.toilets.has(toiletId)) {
        const toilet = this.toilets.get(toiletId);
        if (item.status === '待处理' || item.status === '处理中') {
          const activeComplaints = this.complaints.filter(
            c => c.toiletId === toiletId && (c.status === '待处理' || c.status === '处理中')
          ).length;
          
          const updatedToilet = new Toilet({
            ...toilet.rawData,
            complaintCount: activeComplaints
          }, toilet.source);
          updatedToilet.validate();
          const updatedSummary = updatedToilet.getSummary();
          
          this.toilets.set(toiletId, {
            ...updatedSummary,
            rawData: { ...toilet.rawData, complaintCount: activeComplaints },
            source: toilet.source,
            updatedAt: timestamp
          });
          
          results.updatedComplaintCount.push({
            toiletId,
            toiletName: toilet.name,
            newCount: activeComplaints
          });
        }
      } else {
        results.unlinkedToilets.push({
          complaintId: item.id,
          toiletId: item.toiletId,
          description: item.description
        });
      }
    }

    this.importHistory.push({
      type: 'complaints',
      source: sourceName,
      timestamp,
      ...results
    });

    this.save();
    return results;
  }

  getAllToilets() {
    return Array.from(this.toilets.values());
  }

  getToiletById(id) {
    return this.toilets.get(id);
  }

  getToiletsByPriority(level) {
    return this.getAllToilets().filter(t => t.priorityLevel === level);
  }

  getToiletsWithErrors() {
    return this.getAllToilets().filter(t => !t.isValid);
  }

  getToiletsWithWarnings() {
    return this.getAllToilets().filter(t => t.warnings && t.warnings.length > 0);
  }

  getAllComplaints() {
    return this.complaints;
  }

  getComplaintsByToiletId(toiletId) {
    return this.complaints.filter(c => c.toiletId === toiletId);
  }

  getActiveComplaints(toiletId) {
    return this.complaints.filter(
      c => c.toiletId === toiletId && (c.status === '待处理' || c.status === '处理中')
    );
  }

  getDuplicates() {
    return this.duplicates;
  }

  getImportHistory() {
    return this.importHistory;
  }

  generateCleaningRoute() {
    const validToilets = this.getAllToilets().filter(t => t.isValid);
    
    const critical = validToilets.filter(t => t.priorityLevel === 'critical')
      .sort((a, b) => b.priorityScore - a.priorityScore);
    
    const high = validToilets.filter(t => t.priorityLevel === 'high')
      .sort((a, b) => b.priorityScore - a.priorityScore);
    
    const normal = validToilets.filter(t => t.priorityLevel === 'normal')
      .sort((a, b) => b.priorityScore - a.priorityScore);

    const districts = [...new Set(validToilets.map(t => t.district))];
    const routeByDistrict = {};

    for (const district of districts) {
      routeByDistrict[district] = {
        critical: critical.filter(t => t.district === district),
        high: high.filter(t => t.district === district),
        normal: normal.filter(t => t.district === district)
      };
    }

    return {
      critical,
      high,
      normal,
      all: [...critical, ...high, ...normal],
      byDistrict: routeByDistrict,
      statistics: {
        total: validToilets.length,
        critical: critical.length,
        high: high.length,
        normal: normal.length,
        districts: districts.length
      }
    };
  }

  deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    if (typeof obj1 !== typeof obj2) return false;
    if (typeof obj1 !== 'object' || obj1 === null) return false;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!this.deepEqual(obj1[key], obj2[key])) return false;
    }
    
    return true;
  }

  clearAll() {
    this.toilets.clear();
    this.complaints = [];
    this.importHistory = [];
    this.duplicates = [];
    this.save();
  }
}

module.exports = DataStore;
