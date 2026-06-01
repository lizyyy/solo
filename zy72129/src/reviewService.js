const path = require('path');
const config = require('./config');
const AudioAnalyzer = require('./audioAnalyzer');
const TracklistManager = require('./tracklistManager');
const BatchProcessor = require('./batchProcessor');
const ReportExporter = require('./reportExporter');

class ReviewService {
  constructor() {
    this.audioAnalyzer = new AudioAnalyzer();
    this.tracklistManager = new TracklistManager();
    this.batchProcessor = new BatchProcessor();
    this.reportExporter = new ReportExporter();
    this.reviewResults = [];
  }

  async loadTracklist(filePath) {
    return this.tracklistManager.loadTracklist(filePath);
  }

  async loadNotes(filePath) {
    return this.tracklistManager.loadNotes(filePath);
  }

  mergeNotes(tracklistName, notesName) {
    return this.tracklistManager.mergeNotesToTracks(tracklistName, notesName);
  }

  addLegacyRecord(trackData, source = '舞台通道表') {
    return this.tracklistManager.addLegacyTrack(trackData, source);
  }

  async scanAudioDirectory(audioDir = config.paths.audio) {
    const filePaths = this.batchProcessor.scanDirectory(audioDir);
    const { validFiles, invalidFiles } = this.batchProcessor.validateAndFilterFiles(filePaths);
    
    const invalidResults = invalidFiles.map(file => ({
      trackId: '',
      title: '',
      artist: '',
      fileName: file.fileName,
      status: config.review.statuses.FAILED,
      loudness: null,
      metadata: null,
      reviewReasons: [file.reason],
      notes: [],
      source: '文件验证',
      processedAt: new Date().toISOString(),
      isInvalid: true
    }));
    
    const batchResult = await this.batchProcessor.processFiles(
      validFiles,
      async (filePath) => this.processSingleAudio(filePath)
    );
    
    const processedResults = batchResult.results.map(result => {
      if (result.status === 'error') {
        return {
          trackId: '',
          title: '',
          artist: '',
          fileName: result.fileName,
          filePath: result.filePath,
          status: config.review.statuses.FAILED,
          loudness: null,
          metadata: null,
          reviewReasons: [result.error],
          notes: [],
          source: '音频分析',
          processedAt: result.processedAt
        };
      }
      
      const trackInfo = this.tracklistManager.findTrackByFileName(result.fileName);
      const analysis = result.data;
      
      return {
        trackId: trackInfo?.trackId || '',
        title: trackInfo?.title || '',
        artist: trackInfo?.artist || '',
        fileName: result.fileName,
        filePath: result.filePath,
        status: analysis.assessment.status,
        loudness: analysis.loudness,
        metadata: analysis.metadata,
        reviewReasons: analysis.assessment.reasons,
        notes: trackInfo?.notes || [],
        source: trackInfo?.source || '音频目录',
        processedAt: result.processedAt
      };
    });
    
    this.reviewResults = [...invalidResults, ...processedResults];
    return {
      summary: {
        total: this.reviewResults.length,
        invalid: invalidResults.length,
        ...batchResult.summary
      },
      results: this.reviewResults
    };
  }

  async processSingleAudio(filePath) {
    return this.audioAnalyzer.analyzeFile(filePath);
  }

  generateReviewRecord(fileName, loudnessData, trackInfo = null) {
    const assessment = this.audioAnalyzer.assessLoudness(loudnessData);
    
    return {
      trackId: trackInfo?.trackId || '',
      title: trackInfo?.title || '',
      artist: trackInfo?.artist || '',
      fileName: fileName,
      status: assessment.status,
      loudness: loudnessData,
      reviewReasons: assessment.reasons,
      notes: trackInfo?.notes || [],
      source: trackInfo?.source || '手动录入',
      processedAt: new Date().toISOString()
    };
  }

  async exportReports(format = 'all', prefix = '播客广告口播响度审查') {
    if (format === 'all') {
      return this.reportExporter.exportAll(this.reviewResults, prefix);
    } else if (format === 'csv') {
      return this.reportExporter.exportToCsv(this.reviewResults, prefix);
    } else if (format === 'json') {
      return this.reportExporter.exportToJson(this.reviewResults, prefix);
    } else if (format === 'excel') {
      return this.reportExporter.exportToExcel(this.reviewResults, prefix);
    }
  }

  getResultsByStatus(status) {
    return this.reviewResults.filter(r => r.status === status);
  }

  getSummary() {
    const counts = {};
    Object.values(config.review.statuses).forEach(status => {
      counts[status] = 0;
    });
    
    this.reviewResults.forEach(r => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    
    return {
      total: this.reviewResults.length,
      byStatus: counts,
      needsAttention: this.getResultsByStatus(config.review.statuses.NEEDS_REVIEW).length,
      failed: this.getResultsByStatus(config.review.statuses.FAILED).length
    };
  }

  addManualReviewRecord(recordData) {
    const record = {
      ...recordData,
      processedAt: new Date().toISOString()
    };
    this.reviewResults.push(record);
    return record;
  }

  updateRecordStatus(index, updates) {
    if (index >= 0 && index < this.reviewResults.length) {
      this.reviewResults[index] = {
        ...this.reviewResults[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      return this.reviewResults[index];
    }
    return null;
  }

  getAllTracks() {
    return this.tracklistManager.getAllTracks();
  }

  clearResults() {
    this.reviewResults = [];
  }
}

module.exports = ReviewService;
