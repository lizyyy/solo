import fs from 'fs';
import path from 'path';

import {
  parseSRT,
  parseClipsCSV,
  parseAdSchedule,
  parseWAVHeader,
  analyzeWAVLoudness
} from '../parsers/index.js';

import {
  createUnifiedTimeline,
  updateTimelineEvent,
  getTimelineStats,
  printTimeline
} from '../timeline/index.js';

import {
  runAllAudioDetectors,
  runAllRuleChecks
} from '../detectors/index.js';

import {
  createProject,
  saveProject,
  loadProject,
  updateProjectSources,
  updateProjectTimeline,
  updateProjectLoudness,
  updateProjectIssues,
  addCorrection,
  resolveIssue,
  getProjectStats
} from '../persistence/index.js';

import {
  exportMarkdownDelivery,
  exportChaptersJSON,
  exportIssuesCSV,
  exportFullProjectJSON
} from '../exporters/index.js';

import { msToReadable, Severity, IssueType } from '../types.js';

export class PodcastTimelineStitcher {
  constructor(options = {}) {
    this.options = {
      outputDir: process.cwd(),
      gapThreshold: 1000,
      overlapThreshold: 50,
      peakThreshold: -3,
      safetyMargin: 100,
      maxDrift: 500,
      ...options
    };
    
    this.project = null;
  }
  
  createNewProject(name, metadata = {}) {
    this.project = createProject(name, {
      outputDir: this.options.outputDir,
      metadata
    });
    return this.project;
  }
  
  loadProject(filePath) {
    this.project = loadProject(filePath);
    return this.project;
  }
  
  saveProject(filePath) {
    if (!this.project) {
      throw new Error('没有加载的项目');
    }
    return saveProject(this.project, filePath);
  }
  
  async importFiles(files = {}) {
    if (!this.project) {
      throw new Error('没有加载的项目');
    }
    
    const sources = {};
    const parsedData = {};
    
    if (files.wav && fs.existsSync(files.wav)) {
      sources.wav = files.wav;
      parsedData.wavHeader = parseWAVHeader(files.wav);
      
      try {
        parsedData.loudnessAnalysis = analyzeWAVLoudness(files.wav, {
          peakThreshold: this.options.peakThreshold
        });
      } catch (e) {
        console.warn('响度分析失败:', e.message);
      }
    }
    
    if (files.clipsCsv && fs.existsSync(files.clipsCsv)) {
      sources.clipsCsv = files.clipsCsv;
      const csvContent = fs.readFileSync(files.clipsCsv, 'utf8');
      parsedData.clips = parseClipsCSV(csvContent);
    }
    
    if (files.subtitlesSrt && fs.existsSync(files.subtitlesSrt)) {
      sources.subtitlesSrt = files.subtitlesSrt;
      const srtContent = fs.readFileSync(files.subtitlesSrt, 'utf8');
      parsedData.subtitles = parseSRT(srtContent);
    }
    
    if (files.adSchedule && fs.existsSync(files.adSchedule)) {
      sources.adSchedule = files.adSchedule;
      const adContent = fs.readFileSync(files.adSchedule, 'utf8');
      parsedData.ads = parseAdSchedule(adContent);
    }
    
    updateProjectSources(this.project, sources);
    
    return parsedData;
  }
  
  generateTimeline(parsedData = {}) {
    if (!this.project) {
      throw new Error('没有加载的项目');
    }
    
    const timeline = createUnifiedTimeline({
      clips: parsedData.clips || this.project.timeline?.clips || [],
      subtitles: parsedData.subtitles || this.project.timeline?.subtitles || [],
      ads: parsedData.ads || this.project.timeline?.ads || [],
      wavHeader: parsedData.wavHeader || this.project.timeline?.wavHeader
    });
    
    updateProjectTimeline(this.project, timeline);
    
    if (parsedData.loudnessAnalysis) {
      updateProjectLoudness(this.project, parsedData.loudnessAnalysis);
    }
    
    return timeline;
  }
  
  runAllChecks() {
    if (!this.project || !this.project.timeline) {
      throw new Error('没有加载的项目或时间轴');
    }
    
    const audioIssues = runAllAudioDetectors(
      this.project.timeline,
      this.project.loudnessAnalysis,
      {
        gapThreshold: this.options.gapThreshold,
        overlapThreshold: this.options.overlapThreshold,
        peakThreshold: this.options.peakThreshold
      }
    );
    
    const ruleIssues = runAllRuleChecks(
      this.project.timeline,
      {
        safetyMargin: this.options.safetyMargin,
        maxAllowedDrift: this.options.maxDrift
      }
    );
    
    updateProjectIssues(this.project, audioIssues, ruleIssues);
    
    return {
      audio: audioIssues,
      rules: ruleIssues,
      summary: {
        total: audioIssues.summary.total + ruleIssues.summary.total,
        critical: audioIssues.summary.critical + ruleIssues.summary.critical,
        high: audioIssues.summary.high + ruleIssues.summary.high,
        medium: audioIssues.summary.medium + ruleIssues.summary.medium,
        low: audioIssues.summary.low + ruleIssues.summary.low
      }
    };
  }
  
  getIssues() {
    if (!this.project) {
      return { audio: [], rules: [], resolved: [] };
    }
    
    return {
      audio: this.project.issues?.audio || [],
      rules: this.project.issues?.rules || [],
      resolved: this.project.issues?.resolved || [],
      all: [
        ...(this.project.issues?.audio || []),
        ...(this.project.issues?.rules || [])
      ]
    };
  }
  
  correctEvent(eventId, updates) {
    if (!this.project || !this.project.timeline) {
      throw new Error('没有加载的项目或时间轴');
    }
    
    const event = updateTimelineEvent(this.project.timeline, eventId, updates);
    
    addCorrection(this.project, {
      type: 'event_update',
      eventId,
      updates,
      description: `更新事件: ${event.name}`
    });
    
    return event;
  }
  
  markIssueResolved(issueId, resolution = {}) {
    if (!this.project) {
      throw new Error('没有加载的项目');
    }
    
    return resolveIssue(this.project, issueId, resolution);
  }
  
  exportDeliveryNote(options = {}) {
    if (!this.project) {
      throw new Error('没有加载的项目');
    }
    
    return exportMarkdownDelivery(this.project, options);
  }
  
  exportChapters(options = {}) {
    if (!this.project || !this.project.timeline) {
      throw new Error('没有加载的项目或时间轴');
    }
    
    return exportChaptersJSON(this.project.timeline, options);
  }
  
  exportIssuesCSV(options = {}) {
    if (!this.project) {
      throw new Error('没有加载的项目');
    }
    
    return exportIssuesCSV(this.project, options);
  }
  
  exportAll(outputDir) {
    if (!this.project) {
      throw new Error('没有加载的项目');
    }
    
    const baseName = this.project.name.replace(/\s+/g, '_');
    const outputs = [];
    
    const mdPath = path.join(outputDir, `${baseName}_交付单.md`);
    fs.writeFileSync(mdPath, this.exportDeliveryNote(), 'utf8');
    outputs.push({ type: 'markdown', path: mdPath });
    
    const chaptersPath = path.join(outputDir, `${baseName}_章节.json`);
    fs.writeFileSync(chaptersPath, this.exportChapters(), 'utf8');
    outputs.push({ type: 'chapters', path: chaptersPath });
    
    const issuesPath = path.join(outputDir, `${baseName}_问题清单.csv`);
    fs.writeFileSync(issuesPath, this.exportIssuesCSV(), 'utf8');
    outputs.push({ type: 'issues', path: issuesPath });
    
    const projectPath = path.join(outputDir, `${baseName}.pts.json`);
    fs.writeFileSync(projectPath, exportFullProjectJSON(this.project), 'utf8');
    outputs.push({ type: 'project', path: projectPath });
    
    return outputs;
  }
  
  getStats() {
    if (!this.project) {
      return null;
    }
    return getProjectStats(this.project);
  }
  
  printReport() {
    const lines = [];
    
    lines.push('='.repeat(80));
    lines.push('口播时间轴缝合台 - 检测报告');
    lines.push('='.repeat(80));
    lines.push('');
    
    const stats = this.getStats();
    if (stats) {
      lines.push(`项目: ${stats.projectName}`);
      lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
      lines.push('');
      
      if (stats.timeline) {
        lines.push('--- 时间轴概览 ---');
        lines.push(`总时长: ${msToReadable(stats.timeline.totalDuration)}`);
        lines.push(`片段: ${stats.timeline.totalClips} | 字幕: ${stats.timeline.totalSubtitles} | 广告: ${stats.timeline.totalAds} | 章节: ${stats.timeline.totalChapters}`);
        lines.push('');
      }
      
      lines.push('--- 问题概览 ---');
      lines.push(`总计: ${stats.issues.total} 个问题`);
      lines.push(`🔴 致命: ${stats.issues.total - stats.issues.audio - stats.issues.rules + (stats.issues.audio || 0) + (stats.issues.rules || 0)} 其实这个统计需要重新算...`);
      lines.push(`音频问题: ${stats.issues.audio} | 规则问题: ${stats.issues.rules} | 已解决: ${stats.issues.resolved}`);
      lines.push('');
    }
    
    const issues = this.getIssues();
    if (issues.all.length > 0) {
      lines.push('--- 问题详情 ---');
      lines.push('');
      
      for (const issue of issues.all) {
        const severityIcon = issue.severity === Severity.CRITICAL ? '🔴' :
                             issue.severity === Severity.HIGH ? '🟠' :
                             issue.severity === Severity.MEDIUM ? '🟡' : '🟢';
        
        lines.push(`${severityIcon} [${msToReadable(issue.startTime)}] ${issue.message}`);
      }
      lines.push('');
    }
    
    if (this.project?.timeline) {
      lines.push('--- 时间轴 ---');
      lines.push(printTimeline(this.project.timeline));
    }
    
    return lines.join('\n');
  }
}

export default PodcastTimelineStitcher;
