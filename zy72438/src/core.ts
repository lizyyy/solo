import {
  TrackAlias,
  CheckinRecord,
  SplitDetail,
  ConflictItem,
  ImportResult,
  SelfCheckResult,
  WorkflowState,
  HistoryRecord,
} from './types';

const generateId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const humanErrors: Record<string, string> = {
  'duplicate-track': '这首曲目别名表已经导入过了，别重复导入哦',
  'track-not-found': '签到照片里的曲目在别名表里找不到，需要确认是不是别名没录全',
  'substitute-unverified': '群里说的临时替补还没经过票务同事复核，先放一放',
  'fee-mismatch': '曲目费用对不上，别名表里是{aliasFee}，算出来是{calcFee}',
  'empty-import': '导入的内容是空的，检查一下文件',
  'checkin-missing-track': '这张签到照片没有写曲目名称',
};

function getHumanError(code: string, params?: Record<string, any>): string {
  let msg = humanErrors[code] || code;
  if (params) {
    Object.keys(params).forEach((k) => {
      msg = msg.replace(`{${k}}`, params[k]);
    });
  }
  return msg;
}

export class MidiControllerBackup {
  private tracks: Map<string, TrackAlias> = new Map();
  private checkins: Map<string, CheckinRecord> = new Map();
  private splits: Map<string, SplitDetail> = new Map();
  private conflicts: Map<string, ConflictItem> = new Map();
  private history: HistoryRecord[] = [];
  private importFingerprints: Set<string> = new Set();

  constructor() {
    this.addHistory('system-init', '系统', '系统初始化完成');
  }

  private addHistory(action: string, operator: string, detail: string, before?: any, after?: any) {
    this.history.unshift({
      id: generateId(),
      action,
      operator,
      time: Date.now(),
      detail,
      before,
      after,
    });
  }

  getTracks(): TrackAlias[] {
    return Array.from(this.tracks.values());
  }

  getCheckins(): CheckinRecord[] {
    return Array.from(this.checkins.values());
  }

  getSplits(): SplitDetail[] {
    return Array.from(this.splits.values());
  }

  getConflicts(): ConflictItem[] {
    return Array.from(this.conflicts.values());
  }

  getHistory(): HistoryRecord[] {
    return this.history;
  }

  getWorkflowState(): WorkflowState {
    const pendingConflicts = Array.from(this.conflicts.values()).filter((c) => !c.resolved).length;
    const pendingSubstitutes = Array.from(this.checkins.values()).filter(
      (c) => c.isSubstitute && !c.verified
    ).length;

    let step: 1 | 2 | 3 = 1;
    let stepName = '第一步：导入曲目别名表';

    if (this.tracks.size > 0) {
      if (this.checkins.size > 0) {
        if (this.splits.size > 0) {
          step = 3;
          stepName = '第三步：生成分账明细';
        } else {
          step = 2;
          stepName = '第二步：核对课时签到照片';
        }
      }
    }

    return {
      step,
      stepName,
      aliasImported: this.tracks.size > 0,
      checkinReviewed: this.checkins.size > 0 && pendingSubstitutes === 0,
      splitCalculated: this.splits.size > 0,
      pendingConflicts,
      pendingSubstitutes,
    };
  }

  importTrackAliases(aliasData: any[]): ImportResult {
    const result: ImportResult = {
      success: true,
      imported: 0,
      duplicates: 0,
      conflicts: [],
      warnings: [],
    };

    for (const item of aliasData) {
      const fingerprint = `track:${item.trackName}:${item.artist || ''}`;

      if (this.importFingerprints.has(fingerprint)) {
        result.duplicates++;
        const conflict: ConflictItem = {
          id: generateId(),
          type: 'duplicate-import',
          severity: 'warning',
          message: getHumanError('duplicate-track'),
          evidence: { detail: `曲目「${item.trackName}」重复导入` },
          resolved: false,
        };
        this.conflicts.set(conflict.id, conflict);
        result.conflicts.push(conflict);
        continue;
      }

      const track: TrackAlias = {
        id: generateId(),
        trackName: item.trackName,
        aliasNames: item.aliasNames || [],
        artist: item.artist || '未知',
        duration: item.duration || 0,
        fee: item.fee || 0,
        importTime: Date.now(),
        source: 'alias-table',
      };

      this.tracks.set(track.id, track);
      this.importFingerprints.add(fingerprint);
      result.imported++;
    }

    this.addHistory('import-alias', '录音师小段', `导入曲目别名表 ${result.imported} 条，重复 ${result.duplicates} 条`);
    return result;
  }

  importCheckinPhotos(checkinData: any[]): ImportResult {
    const result: ImportResult = {
      success: true,
      imported: 0,
      duplicates: 0,
      conflicts: [],
      warnings: [],
    };

    for (const item of checkinData) {
      const fingerprint = `checkin:${item.photoId || item.studentName}:${item.classDate}`;

      if (this.importFingerprints.has(fingerprint)) {
        result.duplicates++;
        continue;
      }

      if (!item.trackName) {
        result.warnings.push(getHumanError('checkin-missing-track'));
      }

      const checkin: CheckinRecord = {
        id: generateId(),
        photoId: item.photoId || generateId(),
        trackName: item.trackName || '',
        studentName: item.studentName,
        teacherName: item.teacherName,
        checkinTime: item.checkinTime || Date.now(),
        classDate: item.classDate,
        isSubstitute: item.isSubstitute || false,
        substituteNote: item.substituteNote,
        source: item.source || 'official-system',
        verified: item.verified || false,
      };

      this.checkins.set(checkin.id, checkin);
      this.importFingerprints.add(fingerprint);
      result.imported++;

      if (checkin.isSubstitute && !checkin.verified) {
        const conflict: ConflictItem = {
          id: generateId(),
          type: 'substitute-unverified',
          severity: 'warning',
          message: getHumanError('substitute-unverified'),
          evidence: {
            checkinPhoto: {
              student: checkin.studentName,
              date: checkin.classDate,
              note: checkin.substituteNote || '群内口头通知',
            },
          },
          resolved: false,
        };
        this.conflicts.set(conflict.id, conflict);
        result.conflicts.push(conflict);
      }

      const matchedTrack = this.findTrackByName(checkin.trackName);
      if (!matchedTrack && checkin.trackName) {
        const conflict: ConflictItem = {
          id: generateId(),
          type: 'track-mismatch',
          severity: 'error',
          message: getHumanError('track-not-found'),
          evidence: {
            checkinPhoto: {
              trackName: checkin.trackName,
              student: checkin.studentName,
              date: checkin.classDate,
            },
          },
          resolved: false,
        };
        this.conflicts.set(conflict.id, conflict);
        result.conflicts.push(conflict);
      }
    }

    this.addHistory('import-checkin', '录音师小段', `导入签到照片 ${result.imported} 条，重复 ${result.duplicates} 条`);
    return result;
  }

  private findTrackByName(name: string): TrackAlias | undefined {
    for (const track of this.tracks.values()) {
      if (track.trackName === name) return track;
      if (track.aliasNames.includes(name)) return track;
    }
    return undefined;
  }

  resolveConflict(conflictId: string, resolution: 'confirm' | 'reject', operator: string): boolean {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return false;

    conflict.resolved = true;
    conflict.resolution = resolution;
    conflict.resolver = operator;
    conflict.resolveTime = Date.now();

    if (conflict.type === 'substitute-unverified' && resolution === 'confirm') {
      const checkin = Array.from(this.checkins.values()).find(
        (c) =>
          c.isSubstitute &&
          !c.verified &&
          c.studentName === conflict.evidence.checkinPhoto?.student &&
          c.classDate === conflict.evidence.checkinPhoto?.date
      );
      if (checkin) {
        checkin.verified = true;
        checkin.verifier = operator;
      }
    }

    this.addHistory(
      'resolve-conflict',
      operator,
      `${resolution === 'confirm' ? '确认' : '驳回'}冲突：${conflict.message}`
    );
    return true;
  }

  verifySubstitute(checkinId: string, operator: string): boolean {
    const checkin = this.checkins.get(checkinId);
    if (!checkin || !checkin.isSubstitute) return false;

    checkin.verified = true;
    checkin.verifier = operator;

    const conflict = Array.from(this.conflicts.values()).find(
      (c) =>
        c.type === 'substitute-unverified' &&
        !c.resolved &&
        c.evidence.checkinPhoto?.student === checkin.studentName &&
        c.evidence.checkinPhoto?.date === checkin.classDate
    );
    if (conflict) {
      conflict.resolved = true;
      conflict.resolution = 'confirm';
      conflict.resolver = operator;
      conflict.resolveTime = Date.now();
    }

    this.addHistory('verify-substitute', operator, `确认替补：${checkin.studentName} ${checkin.classDate}`);
    return true;
  }

  calculateSplit(operator: string): SplitDetail[] {
    this.splits.clear();

    for (const checkin of this.checkins.values()) {
      const track = this.findTrackByName(checkin.trackName);
      if (!track) continue;

      const baseFee = track.fee;
      const teacherShare = Math.round(baseFee * 0.6);
      const platformShare = Math.round(baseFee * 0.4);
      const substituteAdjustment = checkin.isSubstitute ? -Math.round(baseFee * 0.1) : 0;
      const totalFee = baseFee + substituteAdjustment;

      const split: SplitDetail = {
        id: generateId(),
        trackId: track.id,
        trackName: track.trackName,
        studentName: checkin.studentName,
        teacherName: checkin.teacherName,
        classDate: checkin.classDate,
        baseFee,
        teacherShare,
        platformShare,
        substituteAdjustment,
        totalFee,
        calcTime: Date.now(),
        version: 1,
        remark: checkin.isSubstitute ? '含替补调整' : undefined,
      };

      this.splits.set(split.id, split);
    }

    this.addHistory('calc-split', operator, `重新计算分账明细 ${this.splits.size} 条`);
    return Array.from(this.splits.values());
  }

  recalculateSplit(splitId: string, newFee: number, operator: string): SplitDetail | null {
    const split = this.splits.get(splitId);
    if (!split) return null;

    const before = { ...split };
    const baseFee = newFee;
    split.baseFee = baseFee;
    split.teacherShare = Math.round(baseFee * 0.6);
    split.platformShare = Math.round(baseFee * 0.4);
    split.totalFee = baseFee + split.substituteAdjustment;
    split.version++;
    split.calcTime = Date.now();

    this.addHistory('recalc-split', operator, `补录后重算分账：${split.studentName} ${split.classDate}`, before, split);
    return split;
  }

  selfCheck(): SelfCheckResult[] {
    const results: SelfCheckResult[] = [];

    results.push(this.checkDuplicateImport());
    results.push(this.checkUnverifiedSubstitutes());
    results.push(this.checkRecalculateConsistency());
    results.push(this.checkExportConsistency());

    return results;
  }

  private checkDuplicateImport(): SelfCheckResult {
    const seen = new Set<string>();
    let hasDuplicate = false;

    for (const track of this.tracks.values()) {
      const key = `${track.trackName}:${track.artist}`;
      if (seen.has(key)) {
        hasDuplicate = true;
        break;
      }
      seen.add(key);
    }

    return {
      name: '重复导入检测',
      passed: !hasDuplicate,
      message: hasDuplicate ? '发现重复导入的曲目' : '没有重复导入的曲目',
    };
  }

  private checkUnverifiedSubstitutes(): SelfCheckResult {
    const unverified = Array.from(this.checkins.values()).filter(
      (c) => c.isSubstitute && !c.verified
    );

    return {
      name: '临时替补复核检查',
      passed: unverified.length === 0,
      message:
        unverified.length > 0
          ? `有 ${unverified.length} 条临时替补等待票务同事复核`
          : '所有替补记录都已复核',
      detail: unverified.map((c) => `${c.studentName} ${c.classDate}`),
    };
  }

  private checkRecalculateConsistency(): SelfCheckResult {
    let passed = true;
    const issues: string[] = [];

    for (const split of this.splits.values()) {
      const expectedTeacher = Math.round(split.baseFee * 0.6);
      const expectedPlatform = Math.round(split.baseFee * 0.4);
      const expectedTotal = split.baseFee + split.substituteAdjustment;

      if (split.teacherShare !== expectedTeacher) {
        passed = false;
        issues.push(`${split.studentName} 教师分成计算不一致`);
      }
      if (split.platformShare !== expectedPlatform) {
        passed = false;
        issues.push(`${split.studentName} 平台分成计算不一致`);
      }
      if (split.totalFee !== expectedTotal) {
        passed = false;
        issues.push(`${split.studentName} 总费用计算不一致`);
      }
    }

    return {
      name: '补录重算一致性检查',
      passed,
      message: passed ? '分账计算全部一致' : `发现 ${issues.length} 处计算不一致`,
      detail: issues,
    };
  }

  private checkExportConsistency(): SelfCheckResult {
    const splitArr = Array.from(this.splits.values());
    const totalFromSplits = splitArr.reduce((sum, s) => sum + s.totalFee, 0);
    const teacherTotal = splitArr.reduce((sum, s) => sum + s.teacherShare, 0);
    const platformTotal = splitArr.reduce((sum, s) => sum + s.platformShare, 0);
    const expectedTotal = teacherTotal + platformTotal;

    const diff = Math.abs(totalFromSplits - (teacherTotal + platformTotal));

    return {
      name: '导出数据一致性检查',
      passed: diff === 0,
      message:
        diff === 0
          ? '导出数据一致'
          : `导出数据不一致：分账总和 ${totalFromSplits}，教师+平台 ${expectedTotal}`,
      detail: { totalFromSplits, teacherTotal, platformTotal, diff },
    };
  }

  exportData(): {
    tracks: TrackAlias[];
    checkins: CheckinRecord[];
    splits: SplitDetail[];
    conflicts: ConflictItem[];
    exportTime: number;
  } {
    return {
      tracks: this.getTracks(),
      checkins: this.getCheckins(),
      splits: this.getSplits(),
      conflicts: this.getConflicts(),
      exportTime: Date.now(),
    };
  }

  clearAll() {
    this.tracks.clear();
    this.checkins.clear();
    this.splits.clear();
    this.conflicts.clear();
    this.importFingerprints.clear();
    this.history = [];
    this.addHistory('clear-all', '系统', '清空所有数据');
  }
}
