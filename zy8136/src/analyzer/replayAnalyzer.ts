import { 
  TrafficSample, 
  HitChain, 
  AnalysisReport, 
  CLIConfig, 
  Issue,
  RouteMatchResult,
  CanaryEvaluationResult
} from '../types';
import { ConfigReader } from '../readers/configReader';
import { RouteMatcher } from '../matchers/routeMatcher';
import { CanaryEvaluator } from '../evaluators/canaryEvaluator';
import { HealthChecker } from '../evaluators/healthChecker';
import { IssueDetector } from '../detectors/issueDetector';
import { OutputGenerator } from '../generators/outputGenerator';
import { logger } from '../utils/logger';

export class ReplayAnalyzer {
  private config: CLIConfig;

  constructor(config: CLIConfig) {
    this.config = config;
    logger.setVerbose(config.verbose);
  }

  async run(): Promise<AnalysisReport> {
    logger.info('Starting canary replay analysis...');

    const [routesConfig, trafficSamples, canaryPolicy, healthData] = await Promise.all([
      ConfigReader.readRoutes(this.config.routesPath),
      ConfigReader.readTrafficSamples(this.config.trafficSamplesPath),
      ConfigReader.readCanaryPolicy(this.config.canaryPolicyPath),
      ConfigReader.readServiceHealth(this.config.serviceHealthPath)
    ]);

    const routeMatcher = new RouteMatcher(routesConfig.routes);
    const canaryEvaluator = new CanaryEvaluator(canaryPolicy);
    const healthChecker = new HealthChecker(healthData);
    const issueDetector = new IssueDetector();

    const hitChains: HitChain[] = [];
    const allIssues: Issue[] = [];

    logger.info(`Processing ${trafficSamples.length} traffic samples...`);

    for (const sample of trafficSamples) {
      const hitChain = this.processSample(
        sample,
        routeMatcher,
        canaryEvaluator,
        healthChecker,
        issueDetector
      );
      
      hitChains.push(hitChain);
      allIssues.push(...hitChain.issues);
    }

    const weightIssues = issueDetector.detectWeightIssues();
    allIssues.push(...weightIssues);

    const routeOverlaps = routeMatcher.detectOverlaps();
    const missingHealthData = healthChecker.getMissingHealthServices();

    const report = this.buildReport(
      hitChains,
      allIssues,
      issueDetector.getWeightAnalysis(),
      routeOverlaps,
      missingHealthData
    );

    const outputGenerator = new OutputGenerator(this.config.outputDir);
    await outputGenerator.generateAll(report);

    this.printSummary(report);

    return report;
  }

  private processSample(
    sample: TrafficSample,
    routeMatcher: RouteMatcher,
    canaryEvaluator: CanaryEvaluator,
    healthChecker: HealthChecker,
    issueDetector: IssueDetector
  ): HitChain {
    const routeMatch = routeMatcher.match(sample);
    
    if (!routeMatch) {
      const defaultRouteMatch: RouteMatchResult = {
        route: {
          path: sample.path,
          service: 'unknown'
        },
        matched: false,
        reason: 'No matching route found'
      };

      const defaultCanaryEval: CanaryEvaluationResult = {
        rule: null,
        shouldHitCanary: false,
        targetService: 'unknown',
        targetVersion: 'stable',
        weight: 0,
        matchedConditions: [],
        reasoning: 'No route matched, cannot evaluate canary policy'
      };

      const hitChain: HitChain = {
        requestId: sample.requestId,
        path: sample.path,
        method: sample.method,
        headers: sample.headers,
        userId: sample.userId,
        bucket: sample.bucket,
        routeMatch: defaultRouteMatch,
        canaryEvaluation: defaultCanaryEval,
        expectedService: sample.expectedService,
        actualService: 'unknown',
        actualVersion: 'stable',
        isHealthy: true,
        issues: []
      };

      return hitChain;
    }

    const targetService = routeMatch.route.service;
    const canaryEvaluation = canaryEvaluator.evaluate(sample, targetService);

    const actualService = targetService;
    const actualVersion = canaryEvaluation.shouldHitCanary 
      ? canaryEvaluation.targetVersion 
      : 'stable';

    const healthCheck = healthChecker.checkHealth(actualService, actualVersion);

    const hitChain: HitChain = {
      requestId: sample.requestId,
      path: sample.path,
      method: sample.method,
      headers: sample.headers,
      userId: sample.userId,
      bucket: sample.bucket,
      routeMatch,
      canaryEvaluation,
      expectedService: sample.expectedService,
      actualService,
      actualVersion,
      isHealthy: healthCheck.healthy,
      healthInfo: healthCheck.healthInfo,
      issues: []
    };

    const issues = issueDetector.detectIssues(hitChain);
    hitChain.issues = issues;

    return hitChain;
  }

  private buildReport(
    hitChains: HitChain[],
    issues: Issue[],
    weightAnalysis: {
      service: string;
      version: string;
      expectedWeight: number;
      actualHits: number;
      actualPercentage: number;
      isOverBudget: boolean;
    }[],
    routeOverlaps: { path1: string; path2: string; priorityConflict: boolean }[],
    missingHealthData: string[]
  ): AnalysisReport {
    const totalRequests = hitChains.length;
    const matchedRoutes = hitChains.filter(h => h.routeMatch.matched).length;
    const canaryHits = hitChains.filter(h => h.canaryEvaluation.shouldHitCanary).length;
    const stableHits = hitChains.filter(h => !h.canaryEvaluation.shouldHitCanary).length;

    const countBySeverity = (severity: string) => 
      issues.filter(i => i.severity === severity).length;

    const report: AnalysisReport = {
      summary: {
        totalRequests,
        matchedRoutes,
        canaryHits,
        stableHits,
        totalIssues: issues.length,
        criticalIssues: countBySeverity('critical'),
        highIssues: countBySeverity('high'),
        mediumIssues: countBySeverity('medium'),
        lowIssues: countBySeverity('low')
      },
      hitChains,
      issues,
      weightAnalysis,
      routeOverlaps,
      missingHealthData,
      generatedAt: new Date().toISOString()
    };

    return report;
  }

  private printSummary(report: AnalysisReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('CANARY REPLAY ANALYSIS SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n📊 Request Statistics:`);
    console.log(`  Total Requests: ${report.summary.totalRequests}`);
    console.log(`  Matched Routes: ${report.summary.matchedRoutes}`);
    console.log(`  Canary Hits: ${report.summary.canaryHits}`);
    console.log(`  Stable Hits: ${report.summary.stableHits}`);
    
    console.log(`\n⚠️  Issues:`);
    console.log(`  Total: ${report.summary.totalIssues}`);
    console.log(`  Critical: ${report.summary.criticalIssues}`);
    console.log(`  High: ${report.summary.highIssues}`);
    console.log(`  Medium: ${report.summary.mediumIssues}`);
    console.log(`  Low: ${report.summary.lowIssues}`);

    if (report.routeOverlaps.length > 0) {
      console.log(`\n🗺️  Route Overlaps: ${report.routeOverlaps.length}`);
      for (const overlap of report.routeOverlaps) {
        console.log(`  - ${overlap.path1} <-> ${overlap.path2} ${overlap.priorityConflict ? '(PRIORITY CONFLICT!)' : ''}`);
      }
    }

    if (report.missingHealthData.length > 0) {
      console.log(`\n📋 Missing Health Data: ${report.missingHealthData.length}`);
      for (const svc of report.missingHealthData) {
        console.log(`  - ${svc}`);
      }
    }

    console.log(`\n📁 Output files generated in: ${this.config.outputDir}`);
    console.log(`  - report.md`);
    console.log(`  - issues.csv`);
    console.log(`  - hit_matrix.html`);

    console.log('\n' + '='.repeat(60));
    
    if (report.summary.totalIssues > 0) {
      console.log('⚠️  ISSUES DETECTED - Please review the report before deployment.');
    } else {
      console.log('✅ No issues detected - Ready for deployment!');
    }
    
    console.log('='.repeat(60));
  }
}
