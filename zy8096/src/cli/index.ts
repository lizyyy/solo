#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { parseSubtitle, writeSrt, writeVtt, TranscriptEntry, SceneMark, SyncRule } from '../parser';
import { alignSubtitles, AlignmentResult } from '../alignment';
import { validateAll, ValidationIssue } from '../validation';
import { generateDriftReport, generateTimelineHtml, ReportData } from '../report';

interface CliArgs {
  srtFile: string;
  transcriptFile: string;
  sceneMarksFile: string;
  rulesFile: string;
  outputDir: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    srtFile: '',
    transcriptFile: '',
    sceneMarksFile: '',
    rulesFile: '',
    outputDir: './output'
  };

  let startIndex = 2;
  if (argv[2] === 'sync') {
    startIndex = 3;
  }

  for (let i = startIndex; i < argv.length; i++) {
    if (argv[i] === '-o' || argv[i] === '--output') {
      args.outputDir = argv[i + 1];
      i++;
    }
  }

  const positionalArgs = argv.slice(startIndex).filter(a => !a.startsWith('-'));
  if (positionalArgs.length >= 4) {
    args.srtFile = positionalArgs[0];
    args.transcriptFile = positionalArgs[1];
    args.sceneMarksFile = positionalArgs[2];
    args.rulesFile = positionalArgs[3];
  }

  return args;
}

function loadTranscript(filePath: string): TranscriptEntry[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      return data;
    }

    if (data.entries && Array.isArray(data.entries)) {
      return data.entries;
    }

    if (data.transcript && Array.isArray(data.transcript)) {
      return data.transcript;
    }

    console.warn(`Warning: Unknown transcript format in ${filePath}`);
    return [];
  } catch (err) {
    console.error(`Error loading transcript from ${filePath}:`, err);
    return [];
  }
}

function loadSceneMarks(filePath: string): SceneMark[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const marks: SceneMark[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length >= 3) {
        marks.push({
          timestamp: parseInt(parts[0].trim(), 10),
          label: parts[1].trim().replace(/^"|"$/g, ''),
          type: parts[2].trim().replace(/^"|"$/g, '') as SceneMark['type']
        });
      }
    }

    return marks;
  } catch (err) {
    console.error(`Error loading scene marks from ${filePath}:`, err);
    return [];
  }
}

function loadSyncRules(filePath: string): SyncRule {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    if (filePath.endsWith('.json')) {
      return JSON.parse(content);
    }

    return yaml.load(content) as SyncRule;
  } catch (err) {
    console.error(`Error loading sync rules from ${filePath}:`, err);
    return {};
  }
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function runSync(
  srtFile: string,
  transcriptFile: string,
  sceneMarksFile: string,
  rulesFile: string,
  outputFile?: string
): { alignmentResult: AlignmentResult; validationIssues: ValidationIssue[] } {
  console.log('Loading files...');
  console.log(`  SRT/VTT: ${srtFile}`);
  console.log(`  Transcript: ${transcriptFile}`);
  console.log(`  Scene Marks: ${sceneMarksFile}`);
  console.log(`  Sync Rules: ${rulesFile}`);

  const srtContent = fs.readFileSync(srtFile, 'utf-8');
  const parsedSubtitle = parseSubtitle(srtContent);
  console.log(`\nParsed ${parsedSubtitle.cues.length} subtitle cues (${parsedSubtitle.format.toUpperCase()})`);

  const transcript = loadTranscript(transcriptFile);
  console.log(`Loaded ${transcript.length} transcript entries`);

  const sceneMarks = loadSceneMarks(sceneMarksFile);
  console.log(`Loaded ${sceneMarks.length} scene marks`);

  const rules = loadSyncRules(rulesFile);
  console.log('Loaded sync rules');

  console.log('\nAligning subtitles...');
  const alignmentResult = alignSubtitles(parsedSubtitle.cues, transcript, sceneMarks, rules);
  console.log(`Aligned ${alignmentResult.fixedCues.length} subtitles`);
  console.log(`  Overlaps fixed: ${alignmentResult.overlapsFixed}`);
  console.log(`  Anchor points used: ${alignmentResult.anchorPointsUsed}`);

  if (alignmentResult.warnings.length > 0) {
    console.log('\nAlignment warnings:');
    alignmentResult.warnings.forEach(w => console.log(`  - ${w}`));
  }

  console.log('\nValidating results...');
  const validationIssues = validateAll(
    alignmentResult.fixedCues,
    rules,
    alignmentResult.driftInfos,
    sceneMarks
  ).issues;

  const errors = validationIssues.filter(i => i.type === 'error');
  const warnings = validationIssues.filter(i => i.type === 'warning');

  console.log(`  Errors: ${errors.length}`);
  console.log(`  Warnings: ${warnings.length}`);

  if (errors.length > 0) {
    console.log('\nValidation errors:');
    errors.forEach(e => console.log(`  - [${e.code}] ${e.message}`));
  }

  const outputDir = outputFile ? path.dirname(outputFile) : './output';
  ensureDir(outputDir);

  const baseName = srtFile.replace(/\.(srt|vtt)$/i, '');
  const fixedSrtPath = outputFile || path.join(outputDir, `${path.basename(baseName)}_fixed.srt`);

  const outputFormat = parsedSubtitle.format;
  let fixedContent: string;
  if (outputFormat === 'vtt') {
    fixedContent = writeVtt(alignmentResult.fixedCues);
  } else {
    fixedContent = writeSrt(alignmentResult.fixedCues);
  }

  fs.writeFileSync(fixedSrtPath, fixedContent, 'utf-8');
  console.log(`\nFixed subtitle saved to: ${fixedSrtPath}`);

  const reportData: ReportData = {
    originalFile: srtFile,
    transcriptFile,
    sceneMarksFile,
    rulesFile,
    totalCues: parsedSubtitle.cues.length,
    fixedCues: alignmentResult.fixedCues.length,
    overlapsFixed: alignmentResult.overlapsFixed,
    anchorPointsUsed: alignmentResult.anchorPointsUsed,
    alignmentResult,
    validationIssues,
    sceneMarks
  };

  const driftReportPath = path.join(outputDir, 'drift_report.md');
  const driftReport = generateDriftReport(reportData);
  fs.writeFileSync(driftReportPath, driftReport, 'utf-8');
  console.log(`Drift report saved to: ${driftReportPath}`);

  const timelineHtmlPath = path.join(outputDir, 'timeline.html');
  const timelineHtml = generateTimelineHtml(
    alignmentResult.fixedCues,
    sceneMarks,
    alignmentResult.driftInfos
  );
  fs.writeFileSync(timelineHtmlPath, timelineHtml, 'utf-8');
  console.log(`Timeline HTML saved to: ${timelineHtmlPath}`);

  console.log('\nDone!');

  return { alignmentResult, validationIssues };
}

function main(): void {
  const args = parseArgs(process.argv);

  if (!args.srtFile || !args.transcriptFile || !args.sceneMarksFile || !args.rulesFile) {
    console.error('Usage: subtitle-sync <srtFile> <transcriptFile> <sceneMarksFile> <rulesFile> [-o <outputDir>]');
    console.error('');
    console.error('Example:');
    console.error('  subtitle-sync original.srt transcript.json scene_marks.csv sync_rules.yaml -o output/');
    process.exit(1);
  }

  if (!fs.existsSync(args.srtFile)) {
    console.error(`Error: SRT file not found: ${args.srtFile}`);
    process.exit(1);
  }

  if (!fs.existsSync(args.transcriptFile)) {
    console.error(`Error: Transcript file not found: ${args.transcriptFile}`);
    process.exit(1);
  }

  if (!fs.existsSync(args.sceneMarksFile)) {
    console.error(`Error: Scene marks file not found: ${args.sceneMarksFile}`);
    process.exit(1);
  }

  if (!fs.existsSync(args.rulesFile)) {
    console.error(`Error: Sync rules file not found: ${args.rulesFile}`);
    process.exit(1);
  }

  try {
    runSync(args.srtFile, args.transcriptFile, args.sceneMarksFile, args.rulesFile, args.outputDir);
  } catch (err) {
    console.error('Error during sync:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
