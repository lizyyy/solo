import { v4 as uuidv4 } from 'uuid';
import SetlistRepository from '../repositories/SetlistRepository';
import ReportRepository from '../repositories/ReportRepository';
import KeyValidationService from './KeyValidationService';
import DurationService from './DurationService';
import ConflictDetectionService from './ConflictDetectionService';
import VersionControlService from './VersionControlService';
import type { CheckReport, CheckReportSummary, KeyChecks, SetlistStatus, ValidationResult, Song } from '../../shared/types';
import { isValidKey } from '../utils/musicTheory';

export const ReportService = {
  generateReport: (setlistId: string, generatedBy: string): CheckReport | null => {
    const setlist = SetlistRepository.findByIdWithSongs(setlistId);
    if (!setlist) return null;

    const songs = setlist.songs || [];
    const totalDuration = DurationService.calculateTotalDuration(songs);
    const overDuration = Math.max(0, totalDuration - setlist.maxDuration);

    const validations: ValidationResult[] = [];
    let currentTotal = 0;

    for (const song of songs) {
      const validation = KeyValidationService.validateSong(song, setlist.maxDuration, currentTotal);
      validations.push(validation);
      currentTotal += song.duration;
    }

    const passed = validations.filter(v =>
      v.checks.keyFormat.passed &&
      v.checks.vocalRange.passed &&
      v.checks.instrumentTuning.passed &&
      v.checks.duration.passed
    ).length;

    const errors = validations.filter(v =>
      !v.checks.keyFormat.passed || !v.checks.duration.passed
    ).length;

    const warnings = validations.filter(v =>
      (v.checks.vocalRange.passed === false || v.checks.instrumentTuning.passed === false) &&
      v.checks.keyFormat.passed && v.checks.duration.passed
    ).length;

    const byType: Record<string, number> = {
      key_format: validations.filter(v => !v.checks.keyFormat.passed).length,
      vocal_range: validations.filter(v => !v.checks.vocalRange.passed).length,
      instrument: validations.filter(v => !v.checks.instrumentTuning.passed).length,
      duration: validations.filter(v => !v.checks.duration.passed).length,
    };

    const summary: CheckReportSummary = {
      total: validations.length,
      totalSongs: songs.length,
      passed,
      warnings,
      errors,
      totalDuration,
      maxDuration: setlist.maxDuration,
      overDuration,
      byType,
    };

    const keyChecks = ReportService.analyzeKeys(songs);
    const durationAnalysis = DurationService.analyze(songs, setlist.maxDuration);
    const conflicts = ConflictDetectionService.detectAllConflicts(setlist as typeof setlist & { songs: Song[] });

    const status: SetlistStatus = errors > 0 ? 'has_errors' : warnings > 0 ? 'has_warnings' : 'validated';
    SetlistRepository.updateStatus(setlistId, status, { passed, errors, warnings });

    VersionControlService.recordSetlistSnapshot(
      setlistId,
      setlist.currentVersion,
      { summary, keyChecks, durationAnalysis, conflicts },
      generatedBy,
      '生成检查报告'
    );

    const durationBreakdown = {
      total: totalDuration,
      limit: setlist.maxDuration,
      songDurations: songs.map(s => ({
        name: s.name,
        key: s.currentKey,
        duration: s.duration,
      })),
    };

    const reportId = `rpt-${uuidv4().slice(0, 8)}`;
    const report = ReportRepository.create(reportId, setlistId, {
      generatedBy,
      summary,
      keyChecks,
      durationAnalysis,
      durationBreakdown,
      conflicts,
      validations,
    });

    return report;
  },

  analyzeKeys: (songs: Song[]): KeyChecks => {
    let validKeys = 0;
    const invalidKeys: KeyChecks['invalidKeys'] = [];
    const oldVersionMixins: KeyChecks['oldVersionMixins'] = [];

    const maxVersions = new Map<string, number>();
    for (const song of songs) {
      const versions = VersionControlService.getSongChangeHistory(song.id);
      const maxVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version), song.version) : song.version;
      maxVersions.set(song.id, maxVersion);
    }

    for (const song of songs) {
      if (isValidKey(song.currentKey) && isValidKey(song.originalKey)) {
        validKeys++;
      } else {
        const invalidKey = !isValidKey(song.currentKey) ? song.currentKey : song.originalKey;
        invalidKeys.push({
          songId: song.id,
          songName: song.name,
          invalidKey,
          suggestion: suggestSimilarKey(invalidKey),
        });
      }

      const latestVersion = maxVersions.get(song.id) || song.version;
      if (song.version < latestVersion) {
        oldVersionMixins.push({
          songId: song.id,
          songName: song.name,
          currentVersion: song.version,
          latestVersion,
        });
      }
    }

    return {
      validKeys,
      invalidKeys,
      oldVersionMixins,
    };
  },

  getLatestReport: (setlistId: string): CheckReport | null => {
    return ReportRepository.findLatestBySetlistId(setlistId);
  },

  getReportHistory: (setlistId: string): CheckReport[] => {
    return ReportRepository.findBySetlistId(setlistId);
  },

  getReportById: (reportId: string): CheckReport | null => {
    return ReportRepository.findById(reportId);
  },

  exportReport: (report: CheckReport, format: 'json' | 'csv'): {
    content: string;
    contentType: string;
    filename: string;
  } => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `setlist-report-${report.setlistId}-${timestamp}`;

    if (format === 'json') {
      return {
        content: JSON.stringify(report, null, 2),
        contentType: 'application/json',
        filename: `${filename}.json`,
      };
    }

    const csvLines = [
      ['歌曲名称', '原调', '当前调', '时长(秒)', '调号检查', '音域检查', '调弦检查', '时长检查', '冲突说明'],
    ];

    for (const v of report.validations) {
      const song = report.conflicts.find(c => c.songId === v.songId);
      csvLines.push([
        v.songName,
        report.conflicts.find(c => c.songId === v.songId && c.type === 'key_conflict')?.message || '通过',
        v.checks.keyFormat.passed ? '通过' : v.checks.keyFormat.message,
        v.checks.vocalRange.passed ? '通过' : v.checks.vocalRange.message,
        v.checks.instrumentTuning.passed ? '通过' : v.checks.instrumentTuning.message,
        v.checks.duration.passed ? '通过' : v.checks.duration.message,
        song ? `${song.severity}: ${song.message}` : '-',
      ].map(s => `"${String(s).replace(/"/g, '""')}"`));
    }

    csvLines.push([]);
    csvLines.push(['汇总信息']);
    csvLines.push(['总歌曲数', String(report.summary.totalSongs ?? '')]);
    csvLines.push(['通过', String(report.summary.passed)]);
    csvLines.push(['警告', String(report.summary.warnings)]);
    csvLines.push(['错误', String(report.summary.errors)]);
    csvLines.push(['总时长(秒)', String(report.summary.totalDuration ?? '')]);
    csvLines.push(['最大时长(秒)', String(report.summary.maxDuration ?? '')]);
    csvLines.push(['超出时长(秒)', String(report.summary.overDuration ?? '')]);

    return {
      content: csvLines.map(line => line.join(',')).join('\n'),
      contentType: 'text/csv; charset=utf-8',
      filename: `${filename}.csv`,
    };
  },
};

export default ReportService;
