import { ParserManager, ParserType } from '../parsers';
import { TimelineNormalizer, TimeAlignment } from '../timeline';
import { RuleEngine, RuleEngineOptions } from '../rules';
import { SessionStorage, StorageOptions } from '../storage';
import { ReportExporter } from '../reporter';
import { 
  Session, 
  AnomalyType, 
  ReportOptions,
  NormalizedTimeline,
  LogSource
} from '../types';
import { generateId, calculatePercentage } from '../utils';

export interface AnalyzeOptions {
  sessionName?: string;
  ruleOptions?: RuleEngineOptions;
  alignments?: TimeAlignment[];
  autoAlign?: boolean;
  referenceTime?: number;
}

export interface AnalyzeResult {
  session: Session;
  saved: boolean;
}

export class DiagnosticService {
  private parserManager: ParserManager;
  private timelineNormalizer: TimelineNormalizer;
  private ruleEngine: RuleEngine;
  private storage: SessionStorage;
  private reporter: ReportExporter;

  constructor(options: {
    storageOptions?: StorageOptions;
    ruleOptions?: RuleEngineOptions;
  } = {}) {
    this.parserManager = new ParserManager();
    this.timelineNormalizer = new TimelineNormalizer();
    this.ruleEngine = new RuleEngine(options.ruleOptions);
    this.storage = new SessionStorage(options.storageOptions);
    this.reporter = new ReportExporter();
  }

  async analyzeFiles(
    files: Array<{ 
      filePath: string; 
      type?: ParserType 
    }>,
    options: AnalyzeOptions = {}
  ): Promise<AnalyzeResult> {
    const parseResults = await this.parserManager.parseFilesWithTypes(files);
    
    if (parseResults.length === 0) {
      throw new Error('无法解析任何日志文件');
    }

    const sourcesWithEvents = parseResults.map(r => ({
      source: r.source,
      events: r.events
    }));

    const timeline = this.timelineNormalizer.normalize(sourcesWithEvents, {
      alignments: options.alignments,
      autoAlign: options.autoAlign,
      referenceTime: options.referenceTime
    });

    return this.analyzeTimeline(timeline, parseResults.map(r => r.source), options);
  }

  async analyzeContent(
    contents: Array<{ 
      content: string; 
      type?: ParserType;
      name?: string;
    }>,
    options: AnalyzeOptions = {}
  ): Promise<AnalyzeResult> {
    const parseResults = [];
    
    for (const item of contents) {
      const result = await this.parserManager.parse(item.content, {
        type: item.type,
        sourceName: item.name
      });
      parseResults.push(result);
    }

    if (parseResults.length === 0) {
      throw new Error('无法解析任何日志内容');
    }

    const sourcesWithEvents = parseResults.map(r => ({
      source: r.source,
      events: r.events
    }));

    const timeline = this.timelineNormalizer.normalize(sourcesWithEvents, {
      alignments: options.alignments,
      autoAlign: options.autoAlign,
      referenceTime: options.referenceTime
    });

    return this.analyzeTimeline(timeline, parseResults.map(r => r.source), options);
  }

  private analyzeTimeline(
    timeline: NormalizedTimeline,
    sources: LogSource[],
    options: AnalyzeOptions = {}
  ): AnalyzeResult {
    const { anomalies, stutters } = this.ruleEngine.analyze(timeline);

    const totalDuration = timeline.endTime - timeline.startTime;
    const stutterDuration = stutters.reduce((sum, s) => sum + s.duration, 0);
    const stutterPercentage = calculatePercentage(stutterDuration, totalDuration);

    const anomalyCount = this.countAnomalies(anomalies);
    const callQualityScore = this.calculateQualityScore(
      anomalies, 
      stutterPercentage, 
      totalDuration
    );

    const session: Session = {
      id: generateId(),
      name: options.sessionName || `Session_${new Date().toISOString().slice(0, 10)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sources,
      timeline,
      anomalies,
      stutters,
      metadata: {
        totalDuration,
        stutterDuration,
        stutterPercentage,
        anomalyCount,
        callQualityScore
      }
    };

    return {
      session,
      saved: false
    };
  }

  private countAnomalies(anomalies: Array<{ type: AnomalyType }>): Record<AnomalyType, number> {
    const counts: Record<AnomalyType, number> = {
      ice_reconnect: 0,
      bitrate_drop: 0,
      packet_loss_high: 0,
      jitter_high: 0,
      track_mute: 0,
      device_switch: 0,
      signaling_break: 0,
      audiovideo_desync: 0,
      quality_limitation: 0,
      frames_dropped: 0,
      rtt_spike: 0
    };

    for (const anomaly of anomalies) {
      counts[anomaly.type]++;
    }

    return counts;
  }

  private calculateQualityScore(
    anomalies: Array<{ severity: 'low' | 'medium' | 'high' | 'critical' }>,
    stutterPercentage: number,
    _totalDuration: number
  ): number {
    let score = 100;

    score -= stutterPercentage * 0.5;

    const severityWeights: Record<string, number> = {
      critical: 15,
      high: 8,
      medium: 4,
      low: 1
    };

    for (const anomaly of anomalies) {
      score -= severityWeights[anomaly.severity] || 0;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  async saveSession(session: Session): Promise<Session> {
    return this.storage.saveSession(session);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return this.storage.getSession(sessionId);
  }

  async listSessions() {
    return this.storage.listSessions();
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.storage.deleteSession(sessionId);
  }

  async exportJsonReport(session: Session, filePath: string, options: ReportOptions): Promise<void> {
    return this.reporter.saveJsonReport(session, filePath, options);
  }

  async exportMarkdownReport(session: Session, filePath: string, options: ReportOptions): Promise<void> {
    return this.reporter.saveMarkdownReport(session, filePath, options);
  }

  exportJsonReportToString(session: Session, options: ReportOptions): string {
    const report = this.reporter.exportToJson(session, options);
    return JSON.stringify(report, null, 2);
  }

  exportMarkdownReportToString(session: Session, options: ReportOptions): string {
    return this.reporter.exportToMarkdown(session, options);
  }

  getParserManager(): ParserManager {
    return this.parserManager;
  }

  getTimelineNormalizer(): TimelineNormalizer {
    return this.timelineNormalizer;
  }

  getRuleEngine(): RuleEngine {
    return this.ruleEngine;
  }

  getStorage(): SessionStorage {
    return this.storage;
  }

  getReporter(): ReportExporter {
    return this.reporter;
  }
}

export { DiagnosticService as default };
