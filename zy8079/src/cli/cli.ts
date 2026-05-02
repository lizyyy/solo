import { TracesParser, ServiceMapParser, SamplingRulesParser } from '../parser';
import { TraceBuilder, Trace, TraceTree } from '../model';
import { SamplingEngine } from '../engine';
import { Reporter } from '../reporter';
import { SamplingResult } from '../model/types';

export interface CLIOptions {
  traces: string;
  services: string;
  rules: string;
  output: string;
}

export class ReplayCLI {
  private tracesParser = new TracesParser();
  private serviceMapParser = new ServiceMapParser();
  private samplingRulesParser = new SamplingRulesParser();
  private traceBuilder = new TraceBuilder();
  private reporter = new Reporter();

  async run(options: CLIOptions): Promise<void> {
    console.log('OTel Sampling Replay Tool');
    console.log('========================\n');

    console.log('Parsing input files...');
    const traces = await this.tracesParser.parseFile(options.traces);
    console.log(`  Loaded ${traces.length} traces`);

    const serviceMap = this.serviceMapParser.parseFile(options.services);
    console.log(`  Loaded ${serviceMap.services.length} services`);

    const samplingRules = this.samplingRulesParser.parseFile(options.rules);
    console.log(`  Loaded ${samplingRules.length} sampling rules\n`);

    console.log('Building trace trees...');
    const traceTrees = new Map<string, TraceTree>();
    const traceMap = new Map<string, Trace>();
    for (const trace of traces) {
      const tree = this.traceBuilder.buildTree(trace);
      traceTrees.set(trace.traceId, tree);
      traceMap.set(trace.traceId, trace);
    }
    console.log(`  Built ${traceTrees.size} trace trees\n`);

    console.log('Running sampling simulation...');
    const engine = new SamplingEngine(samplingRules);
    const results: SamplingResult[] = [];
    for (const tree of traceTrees.values()) {
      const result = engine.simulateFullSampling(tree);
      results.push(result);
    }
    console.log(`  Evaluated ${results.length} traces\n`);

    console.log('Generating reports...');
    const report = this.reporter.generateReport(results, traceTrees, traceMap);

    const reportPath = `${options.output}/replay_report.md`;
    const keptTracesPath = `${options.output}/kept_traces.json`;

    this.reporter.writeMarkdownReport(report, reportPath);
    console.log(`  Wrote: ${reportPath}`);

    this.reporter.writeKeptTraces(report.keptTraces, traceMap, keptTracesPath);
    console.log(`  Wrote: ${keptTracesPath}\n`);

    this.printSummary(report);
  }

  private printSummary(report: ReturnType<typeof this.reporter.generateReport>): void {
    console.log('Summary');
    console.log('-------');
    console.log(`  Total Traces: ${report.summary.totalTraces}`);
    console.log(`  Kept: ${report.summary.keptTraces}`);
    console.log(`  Dropped: ${report.summary.droppedTraces}`);
    console.log(`  Mixed Sampling: ${report.summary.mixedSamplingTraces}`);
    console.log(`  Orphan Spans: ${report.summary.orphanSpanTraces}`);
    console.log(`  Blind Paths: ${report.summary.tracesWithBlindPaths}`);
    console.log(`  Clock Skew Warnings: ${report.clockSkewWarnings.length}`);
    console.log('');
  }
}

export function parseArgs(argv: string[]): CLIOptions {
  const options: CLIOptions = {
    traces: '',
    services: '',
    rules: '',
    output: '.',
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--traces' && i + 1 < argv.length) {
      options.traces = argv[++i];
    } else if (arg === '--services' && i + 1 < argv.length) {
      options.services = argv[++i];
    } else if (arg === '--rules' && i + 1 < argv.length) {
      options.rules = argv[++i];
    } else if (arg === '--output' && i + 1 < argv.length) {
      options.output = argv[++i];
    }
  }

  if (!options.traces || !options.services || !options.rules) {
    throw new Error('Missing required arguments: --traces, --services, --rules');
  }

  return options;
}

if (require.main === module) {
  function main(): void {
    try {
      const options = parseArgs(process.argv);
      const cli = new ReplayCLI();
      cli.run(options).catch(err => {
        console.error('Error:', (err as Error).message);
        process.exit(1);
      });
    } catch (err) {
      console.error('Error:', (err as Error).message);
      console.error('\nUsage: otel-replay --traces <file> --services <file> --rules <file> [--output <dir>]');
      process.exit(1);
    }
  }
  main();
}