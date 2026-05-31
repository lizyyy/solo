import type { VersionDiff, DiffType, WorkLogVersion, AnalysisConclusion, PressureDataPoint } from '@/types';

interface DiffLine {
  type: DiffType;
  oldLine?: string;
  newLine?: string;
  oldLineNum?: number;
  newLineNum?: number;
}

export function diffVersions(oldVersion: WorkLogVersion, newVersion: WorkLogVersion): VersionDiff[] {
  const oldLines = oldVersion.content.split('\n');
  const newLines = newVersion.content.split('\n');

  const diffLines = computeDiff(oldLines, newLines);
  const diffs: VersionDiff[] = [];

  for (const line of diffLines) {
    const oldPressure = line.oldLine ? extractPressureFromLine(line.oldLine) : undefined;
    const newPressure = line.newLine ? extractPressureFromLine(line.newLine) : undefined;

    let pressureChange: number | undefined;
    if (oldPressure !== undefined && newPressure !== undefined) {
      pressureChange = newPressure - oldPressure;
    }

    diffs.push({
      line: line.newLineNum || line.oldLineNum || 0,
      type: line.type,
      oldValue: line.oldLine || '',
      newValue: line.newLine || '',
      pressureChange,
      affectsConclusionIds: [],
    });
  }

  return diffs;
}

function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = [];
    for (let j = 0; j <= n; j++) {
      if (i === 0 || j === 0) {
        dp[i][j] = 0;
      } else if (oldLines[i - 1].trim() === newLines[j - 1].trim()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const diffLines: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1].trim() === newLines[j - 1].trim()) {
      diffLines.unshift({
        type: 'modified',
        oldLine: oldLines[i - 1],
        newLine: newLines[j - 1],
        oldLineNum: i,
        newLineNum: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffLines.unshift({
        type: 'added',
        newLine: newLines[j - 1],
        newLineNum: j,
      });
      j--;
    } else {
      diffLines.unshift({
        type: 'removed',
        oldLine: oldLines[i - 1],
        oldLineNum: i,
      });
      i--;
    }
  }

  return diffLines.filter((line) => line.type !== 'modified' || line.oldLine !== line.newLine);
}

function extractPressureFromLine(line: string): number | undefined {
  const pressurePattern = /压力[\s:：]*([\d.]+)\s*(MPa|mpa|兆帕)?/;
  const match = line.match(pressurePattern);
  if (match) {
    const value = parseFloat(match[1]);
    if (!isNaN(value)) {
      return value;
    }
  }

  const numberPattern = /[\d.]+/g;
  const numbers = line.match(numberPattern);
  if (numbers) {
    for (const numStr of numbers) {
      const value = parseFloat(numStr);
      if (!isNaN(value) && value >= 0 && value <= 100) {
        return value;
      }
    }
  }

  return undefined;
}

export function analyzeDiffImpact(
  diffs: VersionDiff[],
  conclusions: AnalysisConclusion[],
  oldParsedData: PressureDataPoint[],
  newParsedData: PressureDataPoint[]
): VersionDiff[] {
  return diffs.map((diff) => {
    const affectedConclusions: string[] = [];

    if (diff.pressureChange !== undefined && Math.abs(diff.pressureChange) > 0.5) {
      for (const conclusion of conclusions) {
        if (conclusion.sourceLine === diff.line) {
          affectedConclusions.push(conclusion.id);
          continue;
        }

        const diffTime = findTimestampForLine(newParsedData, diff.line);
        if (diffTime && Math.abs(conclusion.timestamp - diffTime) < 60000) {
          affectedConclusions.push(conclusion.id);
        }
      }
    }

    return {
      ...diff,
      affectsConclusionIds: affectedConclusions,
    };
  });
}

function findTimestampForLine(data: PressureDataPoint[], lineNumber: number): number | null {
  if (lineNumber > 0 && lineNumber <= data.length) {
    return data[lineNumber - 1]?.timestamp || null;
  }
  return null;
}

export function hasSignificantChanges(diffs: VersionDiff[]): boolean {
  return diffs.some((diff) => {
    if (diff.affectsConclusionIds.length > 0) return true;
    if (diff.pressureChange !== undefined && Math.abs(diff.pressureChange) > 1.0) return true;
    return false;
  });
}

export function getChangeSummary(diffs: VersionDiff[]): string {
  const added = diffs.filter((d) => d.type === 'added').length;
  const removed = diffs.filter((d) => d.type === 'removed').length;
  const modified = diffs.filter((d) => d.type === 'modified').length;
  const affectedConclusions = new Set(diffs.flatMap((d) => d.affectsConclusionIds)).size;

  let summary = `检测到 ${added + removed + modified} 处变更：`;
  if (added > 0) summary += `新增 ${added} 行，`;
  if (removed > 0) summary += `删除 ${removed} 行，`;
  if (modified > 0) summary += `修改 ${modified} 行，`;
  if (affectedConclusions > 0) {
    summary += `其中 ${affectedConclusions} 处变更影响已有分析结论，`;
  }
  summary += '请工程师确认是否需要重新分析。';

  return summary;
}

export function parseWorkLogContent(content: string): PressureDataPoint[] {
  const lines = content.split('\n');
  const data: PressureDataPoint[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const timestamp = extractTimestampFromLine(line, i);
    const pressure = extractPressureFromLine(line);

    if (timestamp !== null && pressure !== undefined) {
      const temperature = extractValueFromLine(line, /温度[\s:：]*([\d.]+)/);
      const flowRate = extractValueFromLine(line, /流量[\s:：]*([\d.]+)/);

      data.push({
        timestamp,
        pressure,
        temperature,
        flowRate,
      });
    }
  }

  return data.sort((a, b) => a.timestamp - b.timestamp);
}

function extractTimestampFromLine(line: string, lineIndex: number): number | null {
  const datetimePattern = /(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})[日\s]*(\d{1,2})[:时](\d{1,2})[:分]?(\d{1,2})?/;
  const match = line.match(datetimePattern);

  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      second ? parseInt(second) : 0
    );
    return date.getTime();
  }

  const timePattern = /(\d{1,2})[:时](\d{1,2})/;
  const timeMatch = line.match(timePattern);
  if (timeMatch) {
    const today = new Date();
    today.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
    return today.getTime() - lineIndex * 60000;
  }

  return null;
}

function extractValueFromLine(line: string, pattern: RegExp): number | undefined {
  const match = line.match(pattern);
  if (match) {
    const value = parseFloat(match[1]);
    if (!isNaN(value)) {
      return value;
    }
  }
  return undefined;
}
