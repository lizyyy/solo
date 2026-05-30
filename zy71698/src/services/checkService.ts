import type {
  Material,
  Issue,
  TimelineAlignment,
  CheckSnapshot,
  CuePoint,
  IssueSeverity,
} from '@/types';
import { generateId } from '@/utils/helpers';
import { timecodeDiff, formatTimecode, formatTimecodeFromSeconds } from '@/utils/timecode';

const TOLERANCE_SECONDS = 0.5;

export interface CheckResult {
  snapshot: CheckSnapshot;
  issues: Issue[];
  alignments: TimelineAlignment[];
}

export function runCheck(projectId: string, materials: Material[], versionNumber: number): CheckResult {
  const issues: Issue[] = [];
  const alignments: TimelineAlignment[] = [];

  const timelineMaterial = materials.find(m => m.type === 'timeline' && m.parseStatus === 'success');
  const dialogMaterial = materials.find(m => m.type === 'dialog' && m.parseStatus === 'success');
  const musicMaterial = materials.find(m => m.type === 'music' && m.parseStatus === 'success');
  const cueMaterial = materials.find(m => m.type === 'cue' && m.parseStatus === 'success');

  const versionIssues = checkVersions(materials, projectId);
  issues.push(...versionIssues);

  const allCuePoints: { type: string; cue: CuePoint; materialId: string }[] = [];

  if (timelineMaterial?.parsedData?.cuePoints) {
    timelineMaterial.parsedData.cuePoints.forEach(cue =>
      allCuePoints.push({ type: 'timeline', cue, materialId: timelineMaterial.id })
    );
  }
  if (dialogMaterial?.parsedData?.cuePoints) {
    dialogMaterial.parsedData.cuePoints.forEach(cue =>
      allCuePoints.push({ type: 'dialog', cue, materialId: dialogMaterial.id })
    );
  }
  if (musicMaterial?.parsedData?.cuePoints) {
    musicMaterial.parsedData.cuePoints.forEach(cue =>
      allCuePoints.push({ type: 'music', cue, materialId: musicMaterial.id })
    );
  }
  if (cueMaterial?.parsedData?.cuePoints) {
    cueMaterial.parsedData.cuePoints.forEach(cue =>
      allCuePoints.push({ type: 'cue', cue, materialId: cueMaterial.id })
    );
  }

  const timecodeAlignmentIssues = checkTimecodeAlignment(allCuePoints, projectId);
  issues.push(...timecodeAlignmentIssues);

  const conflictIssues = checkConflicts(allCuePoints, projectId, dialogMaterial);
  issues.push(...conflictIssues);

  const alignmentResult = buildTimelineAlignment(allCuePoints, projectId);
  alignments.push(...alignmentResult.alignments);

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const alignedCount = alignments.filter(a => a.isAligned).length;
  const alignmentPassRate = alignments.length > 0 ? Math.round((alignedCount / alignments.length) * 100) : 100;

  const snapshotId = generateId();
  const snapshot: CheckSnapshot = {
    id: snapshotId,
    projectId,
    versionNumber,
    createdAt: new Date().toISOString(),
    summary: generateSummary(errorCount, warningCount, alignmentPassRate),
    errorCount,
    warningCount,
    alignmentPassRate,
    materials: materials
      .filter(m => m.fingerprint)
      .map(m => ({
        materialId: m.id,
        type: m.type,
        fingerprint: m.fingerprint!,
        fileName: m.fileName,
      })),
  };

  issues.forEach(issue => {
    issue.snapshotId = snapshotId;
  });
  alignments.forEach(alignment => {
    alignment.snapshotId = snapshotId;
  });

  return { snapshot, issues, alignments };
}

function checkVersions(materials: Material[], projectId: string): Issue[] {
  const issues: Issue[] = [];
  const typeMap = new Map<string, Material>();

  for (const material of materials) {
    if (material.parseStatus !== 'success') continue;

    const existing = typeMap.get(material.type);
    if (existing) {
      issues.push({
        id: generateId(),
        snapshotId: '',
        projectId,
        type: 'version',
        severity: 'error',
        detectionStep: '第1步：版本校验',
        location: `${material.fileName} / ${existing.fileName}`,
        description: `检测到两份${material.type === 'timeline' ? '时间轴' : material.type === 'dialog' ? '对白轨' : material.type === 'music' ? '音乐文件' : 'Cue清单'}材料`,
        suggestion: '请确认哪一份是最新版本，删除旧版本后重新核对',
        relatedMaterialId: material.id,
        resolved: false,
      });
    }
    typeMap.set(material.type, material);

    if (material.fingerprint && material.parsedData?.metadata) {
      const metadata = material.parsedData.metadata as Record<string, unknown>;
      if (metadata.durationMismatch) {
        const mismatch = metadata.durationMismatch as { expected: number; actual: number; cueName: string };
        issues.push({
          id: generateId(),
          snapshotId: '',
          projectId,
          type: 'version',
          severity: 'warning',
          detectionStep: '第2步：音乐时长校验',
          location: material.fileName,
          description: `音乐「${mismatch.cueName}」文件名暗示时长${formatTimecodeFromSeconds(mismatch.expected)}，但Cue清单标注为${formatTimecodeFromSeconds(mismatch.actual)}，差异${Math.abs(mismatch.expected - mismatch.actual).toFixed(1)}秒`,
          suggestion: '请检查音乐文件是否为正确版本，或Cue清单标注是否准确',
          relatedMaterialId: material.id,
          resolved: false,
        });
      }
    }
  }

  return issues;
}

function checkTimecodeAlignment(
  cuePoints: Array<{ type: string; cue: CuePoint; materialId: string }>,
  projectId: string
): Issue[] {
  const issues: Issue[] = [];

  const groupedByTime = new Map<number, Array<{ type: string; cue: CuePoint; materialId: string }>>();

  for (const cp of cuePoints) {
    const key = Math.round(cp.cue.startTime.totalSeconds * 10) / 10;
    if (!groupedByTime.has(key)) {
      groupedByTime.set(key, []);
    }
    groupedByTime.get(key)!.push(cp);
  }

  for (const cp of cuePoints) {
    const targetTime = cp.cue.startTime.totalSeconds;
    let foundMatch = false;
    let minDiff = Infinity;
    let closestCue: typeof cp | null = null;

    for (const other of cuePoints) {
      if (other.type === cp.type) continue;
      const diff = timecodeDiff(cp.cue.startTime, other.cue.startTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestCue = other;
      }
      if (diff <= TOLERANCE_SECONDS) {
        foundMatch = true;
        break;
      }
    }

    if (!foundMatch && closestCue && minDiff > TOLERANCE_SECONDS && minDiff < 30) {
      const typeLabels: Record<string, string> = {
        timeline: '时间轴',
        dialog: '对白轨',
        music: '音乐文件',
        cue: 'Cue清单',
      };

      issues.push({
        id: generateId(),
        snapshotId: '',
        projectId,
        type: 'timecode',
        severity: minDiff > 5 ? 'error' : 'warning',
        detectionStep: '第3步：时间轴对齐',
        location: `${formatTimecode(cp.cue.startTime)} - ${cp.cue.name}`,
        description: `${typeLabels[cp.type]}的Cue「${cp.cue.name}」（${formatTimecode(cp.cue.startTime)}）与${typeLabels[closestCue.type]}的Cue「${closestCue.cue.name}」（${formatTimecode(closestCue.cue.startTime)}）时间码错位${minDiff.toFixed(1)}秒`,
        suggestion: `请确认${minDiff > 5 ? '是否为不同Cue点，还是' : ''}时间码标注有误`,
        relatedMaterialId: cp.materialId,
        timecode: cp.cue.startTime.totalSeconds,
        resolved: false,
      });
    }
  }

  const timelineCues = cuePoints.filter(cp => cp.type === 'timeline');
  for (let i = 1; i < timelineCues.length; i++) {
    const prev = timelineCues[i - 1].cue;
    const curr = timelineCues[i].cue;
    const gap = curr.startTime.totalSeconds - prev.endTime.totalSeconds;

    if (gap < -0.1) {
      issues.push({
        id: generateId(),
        snapshotId: '',
        projectId,
        type: 'timecode',
        severity: 'error',
        detectionStep: '第4步：检查时间轴连续性',
        location: `${formatTimecode(prev.endTime)} ~ ${formatTimecode(curr.startTime)}`,
        description: `时间轴上Cue「${prev.name}」和「${curr.name}」存在时间重叠，重叠时长${Math.abs(gap).toFixed(1)}秒`,
        suggestion: '请检查时间轴上的Cue起止时间是否正确',
        relatedMaterialId: timelineCues[i].materialId,
        timecode: curr.startTime.totalSeconds,
        resolved: false,
      });
    } else if (gap > 2) {
      issues.push({
        id: generateId(),
        snapshotId: '',
        projectId,
        type: 'timecode',
        severity: 'warning',
        detectionStep: '第4步：检查时间轴连续性',
        location: `${formatTimecode(prev.endTime)} ~ ${formatTimecode(curr.startTime)}`,
        description: `时间轴上Cue「${prev.name}」和「${curr.name}」之间存在${gap.toFixed(1)}秒的空白`,
        suggestion: '请确认这段空白是否为故意留白，还是遗漏了Cue点',
        relatedMaterialId: timelineCues[i].materialId,
        timecode: curr.startTime.totalSeconds,
        resolved: false,
      });
    }
  }

  return issues;
}

function checkConflicts(
  cuePoints: Array<{ type: string; cue: CuePoint; materialId: string }>,
  projectId: string,
  dialogMaterial?: Material
): Issue[] {
  const issues: Issue[] = [];

  const musicCues = cuePoints.filter(cp => cp.type === 'music');
  const dialogCues = cuePoints.filter(cp => cp.type === 'dialog');

  for (const musicCp of musicCues) {
    for (const dialogCp of dialogCues) {
      const overlapStart = Math.max(musicCp.cue.startTime.totalSeconds, dialogCp.cue.startTime.totalSeconds);
      const overlapEnd = Math.min(musicCp.cue.endTime.totalSeconds, dialogCp.cue.endTime.totalSeconds);
      const overlapDuration = overlapEnd - overlapStart;

      if (overlapDuration > 3) {
        issues.push({
          id: generateId(),
          snapshotId: '',
          projectId,
          type: 'conflict',
          severity: 'warning',
          detectionStep: '第5步：检测对白音乐冲突',
          location: `${formatTimecodeFromSeconds(overlapStart)} ~ ${formatTimecodeFromSeconds(overlapEnd)}`,
          description: `音乐「${musicCp.cue.name}」与对白「${dialogCp.cue.name}」存在${overlapDuration.toFixed(1)}秒的重叠，可能导致对白被音乐盖住`,
          suggestion: '建议调整音乐音量或剪辑点，确保对白清晰可闻',
          relatedMaterialId: musicCp.materialId,
          timecode: overlapStart,
          resolved: false,
        });
      }
    }
  }

  if (dialogMaterial?.parsedData?.cuePoints) {
    const cues = dialogMaterial.parsedData.cuePoints;
    for (let i = 0; i < cues.length; i++) {
      const duration = cues[i].duration.totalSeconds;
      if (duration > 0 && duration < 0.5) {
        issues.push({
          id: generateId(),
          snapshotId: '',
          projectId,
          type: 'conflict',
          severity: 'warning',
          detectionStep: '第6步：检查对白时长',
          location: `${formatTimecode(cues[i].startTime)} - ${cues[i].name}`,
          description: `对白「${cues[i].name}」时长仅${duration.toFixed(2)}秒，可能过短`,
          suggestion: '请确认该对白是否完整，或时间码标注是否正确',
          relatedMaterialId: dialogMaterial.id,
          timecode: cues[i].startTime.totalSeconds,
          resolved: false,
        });
      }
    }
  }

  const cueListCues = cuePoints.filter(cp => cp.type === 'cue');
  const timelineCueCount = cuePoints.filter(cp => cp.type === 'timeline').length;
  if (cueListCues.length > 0 && timelineCueCount > 0 && Math.abs(cueListCues.length - timelineCueCount) > 2) {
    issues.push({
      id: generateId(),
      snapshotId: '',
      projectId,
      type: 'conflict',
      severity: 'error',
      detectionStep: '第7步：Cue数量比对',
      location: '全局',
      description: `Cue清单有${cueListCues.length}个Cue，但时间轴有${timelineCueCount}个Cue，数量差异较大`,
      suggestion: '请检查是否有遗漏的Cue点，或材料版本不匹配',
      resolved: false,
    });
  }

  return issues;
}

function buildTimelineAlignment(
  cuePoints: Array<{ type: string; cue: CuePoint; materialId: string }>,
  _projectId: string
): { alignments: TimelineAlignment[] } {
  const alignments: TimelineAlignment[] = [];

  const allTimes = new Set<number>();
  cuePoints.forEach(cp => {
    allTimes.add(Math.round(cp.cue.startTime.totalSeconds * 10) / 10);
    allTimes.add(Math.round(cp.cue.endTime.totalSeconds * 10) / 10);
  });

  const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);

  for (const time of sortedTimes) {
    const alignment: TimelineAlignment = {
      id: generateId(),
      snapshotId: '',
      timecode: time,
      isAligned: true,
      issues: [],
    };

    const nearCues = cuePoints.filter(cp =>
      Math.abs(cp.cue.startTime.totalSeconds - time) <= TOLERANCE_SECONDS ||
      Math.abs(cp.cue.endTime.totalSeconds - time) <= TOLERANCE_SECONDS
    );

    const typeSet = new Set(nearCues.map(c => c.type));
    const expectedTypes = ['timeline', 'dialog', 'music', 'cue'];
    const missingTypes = expectedTypes.filter(t => !typeSet.has(t));

    if (missingTypes.length > 0) {
      alignment.isAligned = false;
      const typeLabels: Record<string, string> = {
        timeline: '时间轴',
        dialog: '对白轨',
        music: '音乐',
        cue: 'Cue清单',
      };
      alignment.issues.push(`缺少${missingTypes.map(t => typeLabels[t]).join('、')}的Cue点`);
    }

    for (const nc of nearCues) {
      if (nc.type === 'timeline') alignment.timelineCueId = nc.cue.id;
      if (nc.type === 'dialog') alignment.dialogCueId = nc.cue.id;
      if (nc.type === 'music') alignment.musicCueId = nc.cue.id;
      if (nc.type === 'cue') alignment.cueListCueId = nc.cue.id;
    }

    alignments.push(alignment);
  }

  return { alignments };
}

function generateSummary(errorCount: number, warningCount: number, passRate: number): string {
  if (errorCount === 0 && warningCount === 0) {
    return `所有检查通过，对齐率${passRate}%`;
  }
  if (errorCount === 0) {
    return `有${warningCount}个警告需要关注，对齐率${passRate}%`;
  }
  return `发现${errorCount}个错误和${warningCount}个警告，对齐率${passRate}%`;
}

export function getIssueSeverityColor(severity: IssueSeverity): string {
  return severity === 'error' ? 'text-accent-error' : 'text-accent-warning';
}

export function getIssueSeverityBg(severity: IssueSeverity): string {
  return severity === 'error' ? 'bg-accent-error/20' : 'bg-accent-warning/20';
}
