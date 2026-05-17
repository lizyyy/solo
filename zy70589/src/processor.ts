import * as crypto from 'crypto';
import {
  GitleaksFinding,
  BaselineEntry,
  ProcessedLeak,
  SummaryStats,
  ReportData
} from './types.js';

export function processFindings(
  findings: GitleaksFinding[],
  baseline: BaselineEntry[] = [],
  parseErrors: any[] = [],
  scanReportPath: string,
  baselinePath?: string
): ReportData {
  const baselineMap = new Map<string, BaselineEntry>();
  baseline.forEach(entry => {
    baselineMap.set(entry.fingerprint, entry);
  });

  const processedLeaks: ProcessedLeak[] = findings.map(finding =>
    processSingleFinding(finding, baselineMap)
  );

  const anomalies = processedLeaks.filter(leak => leak.status === 'anomaly');
  const newLeaks = processedLeaks.filter(leak => leak.status === 'new');
  const baselineLeaks = processedLeaks.filter(leak => leak.status === 'baseline');
  const modifiedLeaks = processedLeaks.filter(leak => leak.status === 'modified');
  const filesAffected = new Set(processedLeaks.map(leak => leak.file)).size;

  const summary: SummaryStats = {
    totalFindings: findings.length,
    totalBaseline: baseline.length,
    newLeaks: newLeaks.length,
    baselineLeaks: baselineLeaks.length,
    fixedLeaks: 0,
    modifiedLeaks: modifiedLeaks.length,
    anomalies: anomalies.length,
    filesAffected
  };

  return {
    summary,
    leaks: processedLeaks,
    baseline,
    anomalies,
    parseErrors,
    generatedAt: new Date().toISOString(),
    scanReportPath,
    baselinePath
  };
}

function processSingleFinding(
  finding: GitleaksFinding,
  baselineMap: Map<string, BaselineEntry>
): ProcessedLeak {
  const id = generateId(finding);
  const fingerprint = finding.Fingerprint;

  const anomalyReason = detectAnomaly(finding);
  if (anomalyReason) {
    return {
      id,
      fingerprint,
      file: finding.File,
      line: finding.StartLine,
      endLine: finding.EndLine,
      match: finding.Match,
      secret: finding.Secret,
      ruleId: finding.RuleID,
      description: finding.Description,
      commit: finding.Commit || undefined,
      author: finding.Author || undefined,
      date: finding.Date || undefined,
      status: 'anomaly',
      anomalyReason,
      originalFinding: finding
    };
  }

  const baselineMatch = baselineMap.get(fingerprint);
  if (baselineMatch) {
    const isModified = checkIfModified(finding, baselineMatch);
    return {
      id,
      fingerprint,
      file: finding.File,
      line: finding.StartLine,
      endLine: finding.EndLine,
      match: finding.Match,
      secret: finding.Secret,
      ruleId: finding.RuleID,
      description: finding.Description,
      commit: finding.Commit || undefined,
      author: finding.Author || undefined,
      date: finding.Date || undefined,
      status: isModified ? 'modified' : 'baseline',
      baselineMatch: {
        fingerprint: baselineMatch.fingerprint,
        file: baselineMatch.file,
        line: baselineMatch.line
      },
      originalFinding: finding
    };
  }

  return {
    id,
    fingerprint,
    file: finding.File,
    line: finding.StartLine,
    endLine: finding.EndLine,
    match: finding.Match,
    secret: finding.Secret,
    ruleId: finding.RuleID,
    description: finding.Description,
    commit: finding.Commit || undefined,
    author: finding.Author || undefined,
    date: finding.Date || undefined,
    status: 'new',
    originalFinding: finding
  };
}

function detectAnomaly(finding: GitleaksFinding): string | undefined {
  const reasons: string[] = [];

  if (!finding.Fingerprint || finding.Fingerprint.length < 8) {
    reasons.push('指纹格式异常');
  }

  if (!finding.File || finding.File.length === 0) {
    reasons.push('文件路径为空');
  }

  if (!finding.Secret || finding.Secret.length === 0) {
    reasons.push('密钥内容为空');
  }

  if (finding.StartLine < 0) {
    reasons.push('行号为负数');
  }

  if (finding.Entropy < 0 || finding.Entropy > 8) {
    reasons.push('熵值超出正常范围');
  }

  if (!finding.RuleID || finding.RuleID.length === 0) {
    reasons.push('规则ID为空');
  }

  return reasons.length > 0 ? reasons.join('; ') : undefined;
}

function checkIfModified(finding: GitleaksFinding, baseline: BaselineEntry): boolean {
  if (finding.File !== baseline.file) {
    return true;
  }

  if (Math.abs(finding.StartLine - baseline.line) > 5) {
    return true;
  }

  return false;
}

function generateId(finding: GitleaksFinding): string {
  const data = `${finding.Fingerprint}:${finding.File}:${finding.StartLine}:${finding.Secret}`;
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

export function generateNewBaseline(reportData: ReportData): BaselineEntry[] {
  const existingFingerprints = new Set(
    reportData.baseline.map(b => b.fingerprint)
  );

  const newEntries: BaselineEntry[] = reportData.leaks
    .filter(leak =>
      (leak.status === 'new' || leak.status === 'modified') &&
      !existingFingerprints.has(leak.fingerprint)
    )
    .map(leak => ({
      fingerprint: leak.fingerprint,
      file: leak.file,
      line: leak.line,
      status: 'to_fix',
      addedAt: new Date().toISOString()
    }));

  return [...reportData.baseline, ...newEntries];
}
