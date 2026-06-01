const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const config = require('./config');

class TracklistManager {
  constructor() {
    this.tracklists = new Map();
    this.notes = new Map();
  }

  async loadTracklist(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.csv') {
      return this.loadCsvTracklist(filePath);
    } else if (['.xlsx', '.xls'].includes(ext)) {
      return this.loadExcelTracklist(filePath);
    } else {
      throw new Error(`不支持的曲目表格式: ${ext}`);
    }
  }

  loadCsvTracklist(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(this.normalizeTrackRow(data)))
        .on('end', () => {
          const fileName = path.basename(filePath);
          this.tracklists.set(fileName, {
            source: fileName,
            sourcePath: filePath,
            loadedAt: new Date().toISOString(),
            tracks: results
          });
          resolve(this.tracklists.get(fileName));
        })
        .on('error', reject);
    });
  }

  loadExcelTracklist(filePath) {
    const workbook = XLSX.readFile(filePath);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet);
    
    const tracks = data.map(row => this.normalizeTrackRow(row));
    const fileName = path.basename(filePath);
    
    this.tracklists.set(fileName, {
      source: fileName,
      sourcePath: filePath,
      loadedAt: new Date().toISOString(),
      tracks
    });
    
    return this.tracklists.get(fileName);
  }

  normalizeTrackRow(row) {
    const getValue = (keys) => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          return String(row[key]).trim();
        }
      }
      return '';
    };

    return {
      trackId: getValue(['trackId', 'ID', 'id', '序号', '编号']),
      title: getValue(['title', 'Title', '曲目', '名称', '曲名', '歌曲名']),
      artist: getValue(['artist', 'Artist', '歌手', '表演者', 'artistName']),
      fileName: getValue(['fileName', 'file', '文件名', '文件', 'audioFile']),
      expectedLUFS: getValue(['expectedLUFS', '目标响度', '响度目标', 'lufs']),
      notes: getValue(['notes', '批注', '备注', '说明', 'comment']),
      status: getValue(['status', '状态', '审查状态']),
      source: row._source || null
    };
  }

  async loadNotes(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    let notesData;
    
    if (ext === '.json') {
      notesData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } else if (ext === '.csv') {
      notesData = await this.loadCsvNotes(filePath);
    } else {
      throw new Error(`不支持的批注格式: ${ext}`);
    }
    
    const fileName = path.basename(filePath);
    this.notes.set(fileName, {
      source: fileName,
      sourcePath: filePath,
      loadedAt: new Date().toISOString(),
      notes: notesData
    });
    
    return this.notes.get(fileName);
  }

  loadCsvNotes(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push({
          trackId: data.trackId || data.ID || '',
          note: data.note || data.批注 || data.备注 || '',
          author: data.author || data.添加人 || '',
          createdAt: data.createdAt || data.添加时间 || new Date().toISOString(),
          source: data.source || '群聊补充'
        }))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  mergeNotesToTracks(tracklistName, notesName) {
    const tracklist = this.tracklists.get(tracklistName);
    const notesData = this.notes.get(notesName);
    
    if (!tracklist || !notesData) {
      throw new Error('曲目表或批注未加载');
    }
    
    const notesMap = new Map();
    notesData.notes.forEach(note => {
      if (!notesMap.has(note.trackId)) {
        notesMap.set(note.trackId, []);
      }
      notesMap.get(note.trackId).push(note);
    });
    
    tracklist.tracks = tracklist.tracks.map(track => {
      const trackNotes = notesMap.get(track.trackId) || [];
      const mergedNotes = [
        track.notes ? { note: track.notes, source: tracklistName } : null,
        ...trackNotes
      ].filter(Boolean);
      
      return {
        ...track,
        notes: mergedNotes,
        notesSource: [tracklistName, notesName].filter(Boolean).join(', ')
      };
    });
    
    return tracklist;
  }

  getAllTracks() {
    const allTracks = [];
    this.tracklists.forEach((list) => {
      list.tracks.forEach(track => {
        allTracks.push({
          ...track,
          source: track.source || list.source,
          sourceLoadedAt: list.loadedAt
        });
      });
    });
    return allTracks;
  }

  findTrackByFileName(fileName) {
    for (const [, list] of this.tracklists) {
      const track = list.tracks.find(t => 
        t.fileName && (t.fileName === fileName || t.fileName === path.basename(fileName))
      );
      if (track) return { ...track, source: list.source };
    }
    return null;
  }

  addLegacyTrack(trackData, source = '舞台通道表') {
    const legacyList = this.tracklists.get('_legacy') || {
      source: source,
      sourcePath: null,
      loadedAt: new Date().toISOString(),
      tracks: []
    };
    
    legacyList.tracks.push({
      ...this.normalizeTrackRow(trackData),
      source: source,
      isLegacy: true
    });
    
    this.tracklists.set('_legacy', legacyList);
    return legacyList;
  }
}

module.exports = TracklistManager;
