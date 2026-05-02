import {
  CheckStatus,
  RuleCheckResult,
  OverallCheckResult,
  Schedule,
  FilmVersion,
  AuditoriumDevice,
  KDM,
  DeviceStatus,
  TimestampRange,
} from '../models';

export interface RuleContext {
  schedule: Schedule;
  filmVersion: FilmVersion | null;
  auditoriumDevice: AuditoriumDevice | null;
  kdms: KDM[];
  overlappingSchedules: Schedule[];
  currentTime?: string;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  check(context: RuleContext): RuleCheckResult;
}

function nowISO(): string {
  return new Date().toISOString();
}

function parseTime(timeStr: string): Date {
  return new Date(timeStr);
}

function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

function timeRangesOverlap(range1: TimestampRange, range2: TimestampRange): boolean {
  const start1 = parseTime(range1.start);
  const end1 = parseTime(range1.end);
  const start2 = parseTime(range2.start);
  const end2 = parseTime(range2.end);
  
  return start1 < end2 && start2 < end1;
}

function timeRangeContains(outer: TimestampRange, inner: TimestampRange): boolean {
  const outerStart = parseTime(outer.start);
  const outerEnd = parseTime(outer.end);
  const innerStart = parseTime(inner.start);
  const innerEnd = parseTime(inner.end);
  
  return innerStart >= outerStart && innerEnd <= outerEnd;
}

function formatTimeForDisplay(timeStr: string): string {
  return new Date(timeStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const timeConflictRule: Rule = {
  id: 'time_conflict',
  name: '时间冲突检查',
  description: '检查当前排片是否与同影厅其他排片时间冲突',
  
  check(context: RuleContext): RuleCheckResult {
    const { schedule, overlappingSchedules } = context;
    
    if (overlappingSchedules.length === 0) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        status: CheckStatus.PASS,
        message: '时间无冲突',
        details: {
          showTime: schedule.showTime,
          checkedSchedules: 0,
        },
      };
    }
    
    const conflicts = overlappingSchedules.map(s => ({
      scheduleId: s.scheduleId,
      showTime: s.showTime,
      filmTitle: `影厅 ${s.auditoriumId} 冲突`,
    }));
    
    return {
      ruleId: this.id,
      ruleName: this.name,
      status: CheckStatus.BLOCK,
      message: `存在 ${conflicts.length} 个时间冲突`,
      details: {
        currentScheduleTime: schedule.showTime,
        conflicts,
      },
    };
  },
};

export const runtimeBufferRule: Rule = {
  id: 'runtime_buffer',
  name: '片长缓冲检查',
  description: '检查排片时长是否匹配影片片长，并确保有足够的缓冲时间',
  
  check(context: RuleContext): RuleCheckResult {
    const { schedule, filmVersion } = context;
    
    if (!filmVersion) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        status: CheckStatus.WARN,
        message: '无法验证片长：未找到影片版本信息',
        details: {
          filmId: schedule.filmId,
          versionId: schedule.versionId,
        },
      };
    }
    
    const scheduledStart = parseTime(schedule.showTime.start);
    const scheduledEnd = parseTime(schedule.showTime.end);
    const scheduledMinutes = (scheduledEnd.getTime() - scheduledStart.getTime()) / (1000 * 60);
    
    const totalRequiredMinutes = 
      schedule.preShowMinutes + 
      schedule.bufferMinutesBefore + 
      filmVersion.runtimeMinutes + 
      schedule.bufferMinutesAfter;
    
    const bufferShortfall = totalRequiredMinutes - scheduledMinutes;
    
    if (bufferShortfall <= 0) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        status: CheckStatus.PASS,
        message: `时长充足：安排 ${Math.round(scheduledMinutes)} 分钟，需要 ${totalRequiredMinutes} 分钟`,
        details: {
          scheduledMinutes: Math.round(scheduledMinutes),
          requiredMinutes: totalRequiredMinutes,
          filmRuntime: filmVersion.runtimeMinutes,
          preShowMinutes: schedule.preShowMinutes,
          bufferBefore: schedule.bufferMinutesBefore,
          bufferAfter: schedule.bufferMinutesAfter,
        },
      };
    }
    
    return {
      ruleId: this.id,
      ruleName: this.name,
      status: CheckStatus.BLOCK,
      message: `时长不足：缺少 ${Math.ceil(bufferShortfall)} 分钟`,
      details: {
        scheduledMinutes: Math.round(scheduledMinutes),
        requiredMinutes: totalRequiredMinutes,
        shortfallMinutes: Math.ceil(bufferShortfall),
        filmRuntime: filmVersion.runtimeMinutes,
        breakdown: {
          preShow: schedule.preShowMinutes,
          bufferBefore: schedule.bufferMinutesBefore,
          film: filmVersion.runtimeMinutes,
          bufferAfter: schedule.bufferMinutesAfter,
        },
      },
    };
  },
};

export const kdmCoverageRule: Rule = {
  id: 'kdm_coverage',
  name: 'KDM覆盖窗口检查',
  description: '检查排片时间是否在有效KDM密钥有效期内',
  
  check(context: RuleContext): RuleCheckResult {
    const { schedule, kdms, filmVersion } = context;
    
    if (kdms.length === 0) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        status: CheckStatus.BLOCK,
        message: '未找到有效的KDM密钥',
        details: {
          filmId: schedule.filmId,
          versionId: schedule.versionId,
          auditoriumId: schedule.auditoriumId,
          showTime: schedule.showTime,
        },
      };
    }
    
    const showTimeWithBuffer = {
      start: schedule.showTime.start,
      end: schedule.showTime.end,
    };
    
    const coveringKdms = kdms.filter(kdm => 
      timeRangeContains(kdm.validity, showTimeWithBuffer)
    );
    
    if (coveringKdms.length > 0) {
      const earliestStart = coveringKdms.reduce((earliest, kdm) => 
        parseTime(kdm.validity.start) < parseTime(earliest.validity.start) ? kdm : earliest
      );
      const latestEnd = coveringKdms.reduce((latest, kdm) => 
        parseTime(kdm.validity.end) > parseTime(latest.validity.end) ? kdm : latest
      );
      
      return {
        ruleId: this.id,
        ruleName: this.name,
        status: CheckStatus.PASS,
        message: `KDM覆盖有效：有效期 ${formatTimeForDisplay(earliestStart.validity.start)} - ${formatTimeForDisplay(latestEnd.validity.end)}`,
        details: {
          showTime: schedule.showTime,
          validKdms: coveringKdms.map(k => ({
            kdmId: k.kdmId,
            validity: k.validity,
            issuer: k.issuer,
          })),
        },
      };
    }
    
    const now = parseTime(nowISO());
    const showStart = parseTime(schedule.showTime.start);
    const isExpired = kdms.every(kdm => parseTime(kdm.validity.end) < showStart);
    const isNotActiveYet = kdms.every(kdm => parseTime(kdm.validity.start) > showStart);
    
    let message = '排片时间不在KDM有效期内';
    if (isExpired) {
      message = 'KDM已过期';
    } else if (isNotActiveYet) {
      message = 'KDM尚未生效';
    }
    
    return {
      ruleId: this.id,
      ruleName: this.name,
      status: CheckStatus.BLOCK,
      message,
      details: {
        showTime: schedule.showTime,
        availableKdms: kdms.map(k => ({
          kdmId: k.kdmId,
          validity: k.validity,
          issuer: k.issuer,
        })),
        isExpired,
        isNotActiveYet,
      },
    };
  },
};

export const deviceFormatMatchRule: Rule = {
  id: 'device_format_match',
  name: '设备格式匹配检查',
  description: '检查影厅设备是否支持影片的宽高比和音效格式',
  
  check(context: RuleContext): RuleCheckResult {
    const { schedule, filmVersion, auditoriumDevice } = context;
    
    if (!filmVersion || !auditoriumDevice) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        status: CheckStatus.WARN,
        message: '无法验证格式匹配：缺少影片或设备信息',
        details: {
          filmVersionExists: !!filmVersion,
          auditoriumDeviceExists: !!auditoriumDevice,
          filmId: schedule.filmId,
          auditoriumId: schedule.auditoriumId,
        },
      };
    }
    
    const issues: string[] = [];
    const details: Record<string, unknown> = {
      filmFormats: {
        aspectRatio: filmVersion.aspectRatio,
        soundFormat: filmVersion.soundFormat,
      },
      deviceFormats: {
        aspectRatios: auditoriumDevice.supportedFormats.aspectRatios,
        soundFormats: auditoriumDevice.supportedFormats.soundFormats,
      },
    };
    
    if (!auditoriumDevice.supportedFormats.aspectRatios.includes(filmVersion.aspectRatio)) {
      issues.push(`宽高比不支持：影片 ${filmVersion.aspectRatio}，设备仅支持 ${auditoriumDevice.supportedFormats.aspectRatios.join(', ')}`);
    }
    
    if (!auditoriumDevice.supportedFormats.soundFormats.includes(filmVersion.soundFormat)) {
      issues.push(`音效格式不支持：影片 ${filmVersion.soundFormat}，设备仅支持 ${auditoriumDevice.supportedFormats.soundFormats.join(', ')}`);
    }
    
    if (issues.length === 0) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        status: CheckStatus.PASS,
        message: '设备格式匹配',
        details,
      };
    }
    
    return {
      ruleId: this.id,
      ruleName: this.name,
      status: CheckStatus.BLOCK,
      message: issues.join('；'),
      details: {
        ...details,
        issues,
      },
    };
  },
};

export const deviceStatusRule: Rule = {
  id: 'device_status',
  name: '设备状态检查',
  description: '检查影厅设备是否处于可运营状态',
  
  check(context: RuleContext): RuleCheckResult {
    const { schedule, auditoriumDevice } = context;
    
    if (!auditoriumDevice) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        status: CheckStatus.WARN,
        message: '无法验证设备状态：未找到影厅设备信息',
        details: {
          auditoriumId: schedule.auditoriumId,
        },
      };
    }
    
    if (!auditoriumDevice.isActive) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        status: CheckStatus.BLOCK,
        message: `影厅已停用：${auditoriumDevice.auditoriumName}`,
        details: {
          auditoriumId: auditoriumDevice.auditoriumId,
          auditoriumName: auditoriumDevice.auditoriumName,
          isActive: auditoriumDevice.isActive,
        },
      };
    }
    
    switch (auditoriumDevice.status) {
      case DeviceStatus.OPERATIONAL:
        return {
          ruleId: this.id,
          ruleName: this.name,
          status: CheckStatus.PASS,
          message: `设备状态正常：${auditoriumDevice.auditoriumName}`,
          details: {
            auditoriumId: auditoriumDevice.auditoriumId,
            auditoriumName: auditoriumDevice.auditoriumName,
            status: auditoriumDevice.status,
          },
        };
      
      case DeviceStatus.MAINTENANCE:
        return {
          ruleId: this.id,
          ruleName: this.name,
          status: CheckStatus.WARN,
          message: `设备维护中：${auditoriumDevice.statusReason || '原因未知'}`,
          details: {
            auditoriumId: auditoriumDevice.auditoriumId,
            auditoriumName: auditoriumDevice.auditoriumName,
            status: auditoriumDevice.status,
            statusReason: auditoriumDevice.statusReason,
            lastMaintenance: auditoriumDevice.lastMaintenance,
            nextMaintenance: auditoriumDevice.nextMaintenance,
          },
        };
      
      case DeviceStatus.OFFLINE:
        return {
          ruleId: this.id,
          ruleName: this.name,
          status: CheckStatus.BLOCK,
          message: `设备离线：${auditoriumDevice.statusReason || '原因未知'}`,
          details: {
            auditoriumId: auditoriumDevice.auditoriumId,
            auditoriumName: auditoriumDevice.auditoriumName,
            status: auditoriumDevice.status,
            statusReason: auditoriumDevice.statusReason,
          },
        };
      
      default:
        return {
          ruleId: this.id,
          ruleName: this.name,
          status: CheckStatus.WARN,
          message: `未知设备状态：${auditoriumDevice.status}`,
          details: {
            auditoriumId: auditoriumDevice.auditoriumId,
            status: auditoriumDevice.status,
          },
        };
    }
  },
};

export const languageSubtitleMatchRule: Rule = {
  id: 'language_subtitle_match',
  name: '语言字幕匹配检查',
  description: '验证影片的音频语言和字幕信息是否存在',
  
  check(context: RuleContext): RuleCheckResult {
    const { schedule, filmVersion } = context;
    
    if (!filmVersion) {
      return {
        ruleId: this.id,
        ruleName: this.name,
        status: CheckStatus.WARN,
        message: '无法验证语言字幕：未找到影片版本信息',
        details: {
          filmId: schedule.filmId,
          versionId: schedule.versionId,
        },
      };
    }
    
    const issues: string[] = [];
    const details: Record<string, unknown> = {
      filmId: filmVersion.filmId,
      versionId: filmVersion.versionId,
      audioLanguage: filmVersion.audioLanguage,
      subtitleLanguage: filmVersion.subtitleLanguage,
      subtitleType: filmVersion.subtitleType,
    };
    
    if (!filmVersion.audioLanguage || filmVersion.audioLanguage.trim() === '') {
      issues.push('音频语言未设置');
    }
    
    return {
      ruleId: this.id,
      ruleName: this.name,
      status: issues.length > 0 ? CheckStatus.WARN : CheckStatus.PASS,
      message: issues.length > 0 ? issues.join('；') : '语言字幕信息完整',
      details,
    };
  },
};

export const defaultRules: Rule[] = [
  timeConflictRule,
  runtimeBufferRule,
  kdmCoverageRule,
  deviceFormatMatchRule,
  deviceStatusRule,
  languageSubtitleMatchRule,
];

export function runRules(context: RuleContext, rules: Rule[] = defaultRules): OverallCheckResult {
  const checks = rules.map(rule => rule.check(context));
  
  let overallStatus = CheckStatus.PASS;
  for (const check of checks) {
    if (check.status === CheckStatus.BLOCK) {
      overallStatus = CheckStatus.BLOCK;
      break;
    }
    if (check.status === CheckStatus.WARN && overallStatus === CheckStatus.PASS) {
      overallStatus = CheckStatus.WARN;
    }
  }
  
  return {
    scheduleId: context.schedule.scheduleId,
    overallStatus,
    checks,
    checkedAt: nowISO(),
  };
}
