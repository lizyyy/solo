import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  runRules,
  RuleContext,
  timeConflictRule,
  runtimeBufferRule,
  kdmCoverageRule,
  deviceFormatMatchRule,
  deviceStatusRule,
  languageSubtitleMatchRule,
} from './engine';
import {
  CheckStatus,
  Schedule,
  FilmVersion,
  AuditoriumDevice,
  KDM,
  DeviceStatus,
  AspectRatio,
  SoundFormat,
  SubtitleType,
} from '../models';

function createSchedule(overrides?: Partial<Schedule>): Schedule {
  const now = new Date();
  const start = new Date(now.getTime() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 120 * 60 * 1000);
  
  return {
    id: 'schedule-1',
    scheduleId: 'SCH-001',
    filmId: 'film-001',
    versionId: 'ver-001',
    auditoriumId: 'aud-001',
    showTime: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
    preShowMinutes: 5,
    bufferMinutesBefore: 5,
    bufferMinutesAfter: 10,
    actualEndTime: end.toISOString(),
    isCancelled: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

function createFilmVersion(overrides?: Partial<FilmVersion>): FilmVersion {
  const now = new Date();
  return {
    id: 'film-ver-1',
    filmId: 'film-001',
    filmTitle: '测试影片',
    versionId: 'ver-001',
    versionName: '中文2D版',
    audioLanguage: 'zh-CN',
    subtitleLanguage: 'zh-CN',
    subtitleType: SubtitleType.EMBEDDED,
    aspectRatio: AspectRatio.RATIO_2_39,
    soundFormat: SoundFormat.DOLBY_5_1,
    runtimeMinutes: 120,
    dcpHash: 'hash-123',
    isActive: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

function createAuditorium(overrides?: Partial<AuditoriumDevice>): AuditoriumDevice {
  const now = new Date();
  return {
    id: 'aud-1',
    auditoriumId: 'aud-001',
    auditoriumName: '1号厅',
    seatCount: 150,
    supportedFormats: {
      aspectRatios: [AspectRatio.RATIO_1_85, AspectRatio.RATIO_2_39],
      soundFormats: [SoundFormat.DOLBY_5_1, SoundFormat.DOLBY_7_1],
    },
    status: DeviceStatus.OPERATIONAL,
    isActive: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

function createKDM(overrides?: Partial<KDM>, timeOffset?: number): KDM {
  const now = new Date();
  const offset = timeOffset || 0;
  const start = new Date(now.getTime() + offset - 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + offset + 7 * 24 * 60 * 60 * 1000);
  
  return {
    id: 'kdm-1',
    kdmId: 'KDM-001',
    filmId: 'film-001',
    versionId: 'ver-001',
    auditoriumId: 'aud-001',
    validity: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
    cplId: 'cpl-123',
    issuer: 'Test Issuer',
    issuerOrg: 'Test Org',
    contentTitleText: '测试影片',
    isActive: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  };
}

describe('规则引擎测试', () => {
  describe('时间冲突检查规则', () => {
    it('应该通过当没有时间冲突', () => {
      const schedule = createSchedule();
      const context: RuleContext = {
        schedule,
        filmVersion: createFilmVersion(),
        auditoriumDevice: createAuditorium(),
        kdms: [createKDM()],
        overlappingSchedules: [],
      };
      
      const result = timeConflictRule.check(context);
      
      expect(result.status).toBe(CheckStatus.PASS);
      expect(result.message).toBe('时间无冲突');
    });
    
    it('应该阻断当存在时间冲突', () => {
      const schedule = createSchedule();
      const overlappingSchedule = createSchedule({
        scheduleId: 'SCH-002',
      });
      
      const context: RuleContext = {
        schedule,
        filmVersion: createFilmVersion(),
        auditoriumDevice: createAuditorium(),
        kdms: [createKDM()],
        overlappingSchedules: [overlappingSchedule],
      };
      
      const result = timeConflictRule.check(context);
      
      expect(result.status).toBe(CheckStatus.BLOCK);
      expect(result.message).toContain('时间冲突');
    });
  });
  
  describe('片长缓冲检查规则', () => {
    it('应该通过当时长充足', () => {
      const schedule = createSchedule({
        preShowMinutes: 5,
        bufferMinutesBefore: 5,
        bufferMinutesAfter: 10,
      });
      const filmVersion = createFilmVersion({ runtimeMinutes: 100 });
      
      const context: RuleContext = {
        schedule,
        filmVersion,
        auditoriumDevice: createAuditorium(),
        kdms: [createKDM()],
        overlappingSchedules: [],
      };
      
      const result = runtimeBufferRule.check(context);
      
      expect(result.status).toBe(CheckStatus.PASS);
    });
    
    it('应该阻断当时长不足', () => {
      const schedule = createSchedule({
        preShowMinutes: 0,
        bufferMinutesBefore: 0,
        bufferMinutesAfter: 0,
      });
      const filmVersion = createFilmVersion({ runtimeMinutes: 150 });
      
      const context: RuleContext = {
        schedule,
        filmVersion,
        auditoriumDevice: createAuditorium(),
        kdms: [createKDM()],
        overlappingSchedules: [],
      };
      
      const result = runtimeBufferRule.check(context);
      
      expect(result.status).toBe(CheckStatus.BLOCK);
      expect(result.message).toContain('时长不足');
    });
    
    it('应该警告当找不到影片版本', () => {
      const schedule = createSchedule();
      
      const context: RuleContext = {
        schedule,
        filmVersion: null,
        auditoriumDevice: createAuditorium(),
        kdms: [createKDM()],
        overlappingSchedules: [],
      };
      
      const result = runtimeBufferRule.check(context);
      
      expect(result.status).toBe(CheckStatus.WARN);
    });
  });
  
  describe('KDM覆盖窗口检查规则', () => {
    it('应该通过当KDM覆盖排片时间', () => {
      const schedule = createSchedule();
      const kdm = createKDM();
      
      const context: RuleContext = {
        schedule,
        filmVersion: createFilmVersion(),
        auditoriumDevice: createAuditorium(),
        kdms: [kdm],
        overlappingSchedules: [],
      };
      
      const result = kdmCoverageRule.check(context);
      
      expect(result.status).toBe(CheckStatus.PASS);
      expect(result.message).toContain('KDM覆盖有效');
    });
    
    it('应该阻断当没有KDM', () => {
      const schedule = createSchedule();
      
      const context: RuleContext = {
        schedule,
        filmVersion: createFilmVersion(),
        auditoriumDevice: createAuditorium(),
        kdms: [],
        overlappingSchedules: [],
      };
      
      const result = kdmCoverageRule.check(context);
      
      expect(result.status).toBe(CheckStatus.BLOCK);
      expect(result.message).toBe('未找到有效的KDM密钥');
    });
    
    it('应该阻断当KDM已过期', () => {
      const schedule = createSchedule();
      const expiredKdm = createKDM({}, -10 * 24 * 60 * 60 * 1000);
      
      const context: RuleContext = {
        schedule,
        filmVersion: createFilmVersion(),
        auditoriumDevice: createAuditorium(),
        kdms: [expiredKdm],
        overlappingSchedules: [],
      };
      
      const result = kdmCoverageRule.check(context);
      
      expect(result.status).toBe(CheckStatus.BLOCK);
      expect(result.message).toContain('KDM已过期');
    });
  });
  
  describe('设备格式匹配检查规则', () => {
    it('应该通过当格式匹配', () => {
      const schedule = createSchedule();
      const filmVersion = createFilmVersion({
        aspectRatio: AspectRatio.RATIO_2_39,
        soundFormat: SoundFormat.DOLBY_5_1,
      });
      const auditorium = createAuditorium({
        supportedFormats: {
          aspectRatios: [AspectRatio.RATIO_1_85, AspectRatio.RATIO_2_39],
          soundFormats: [SoundFormat.DOLBY_5_1, SoundFormat.DOLBY_7_1],
        },
      });
      
      const context: RuleContext = {
        schedule,
        filmVersion,
        auditoriumDevice: auditorium,
        kdms: [createKDM()],
        overlappingSchedules: [],
      };
      
      const result = deviceFormatMatchRule.check(context);
      
      expect(result.status).toBe(CheckStatus.PASS);
      expect(result.message).toBe('设备格式匹配');
    });
    
    it('应该阻断当宽高比不匹配', () => {
      const schedule = createSchedule();
      const filmVersion = createFilmVersion({
        aspectRatio: AspectRatio.RATIO_16_9,
      });
      const auditorium = createAuditorium({
        supportedFormats: {
          aspectRatios: [AspectRatio.RATIO_1_85, AspectRatio.RATIO_2_39],
          soundFormats: [SoundFormat.DOLBY_5_1],
        },
      });
      
      const context: RuleContext = {
        schedule,
        filmVersion,
        auditoriumDevice: auditorium,
        kdms: [createKDM()],
        overlappingSchedules: [],
      };
      
      const result = deviceFormatMatchRule.check(context);
      
      expect(result.status).toBe(CheckStatus.BLOCK);
      expect(result.message).toContain('宽高比不支持');
    });
    
    it('应该警告当缺少影片或设备信息', () => {
      const schedule = createSchedule();
      
      const context: RuleContext = {
        schedule,
        filmVersion: null,
        auditoriumDevice: null,
        kdms: [createKDM()],
        overlappingSchedules: [],
      };
      
      const result = deviceFormatMatchRule.check(context);
      
      expect(result.status).toBe(CheckStatus.WARN);
    });
  });
  
  describe('设备状态检查规则', () => {
    it('应该通过当设备正常运营', () => {
      const schedule = createSchedule();
      const auditorium = createAuditorium({
        status: DeviceStatus.OPERATIONAL,
      });
      
      const context: RuleContext = {
        schedule,
        filmVersion: createFilmVersion(),
        auditoriumDevice: auditorium,
        kdms: [createKDM()],
        overlappingSchedules: [],
      };
      
      const result = deviceStatusRule.check(context);
      
      expect(result.status).toBe(CheckStatus.PASS);
    });
    
    it('应该警告当设备维护中', () => {
      const schedule = createSchedule();
      const auditorium = createAuditorium({
        status: DeviceStatus.MAINTENANCE,
        statusReason: '设备检修',
      });
      
      const context: RuleContext = {
        schedule,
        filmVersion: createFilmVersion(),
        auditoriumDevice: auditorium,
        kdms: [createKDM()],
        overlappingSchedules: [],
      };
      
      const result = deviceStatusRule.check(context);
      
      expect(result.status).toBe(CheckStatus.WARN);
      expect(result.message).toContain('设备维护中');
    });
    
    it('应该阻断当设备离线', () => {
      const schedule = createSchedule();
      const auditorium = createAuditorium({
        status: DeviceStatus.OFFLINE,
        statusReason: '服务器故障',
      });
      
      const context: RuleContext = {
        schedule,
        filmVersion: createFilmVersion(),
        auditoriumDevice: auditorium,
        kdms: [createKDM()],
        overlappingSchedules: [],
      };
      
      const result = deviceStatusRule.check(context);
      
      expect(result.status).toBe(CheckStatus.BLOCK);
      expect(result.message).toContain('设备离线');
    });
    
    it('应该阻断当影厅已停用', () => {
      const schedule = createSchedule();
      const auditorium = createAuditorium({
        isActive: false,
      });
      
      const context: RuleContext = {
        schedule,
        filmVersion: createFilmVersion(),
        auditoriumDevice: auditorium,
        kdms: [createKDM()],
        overlappingSchedules: [],
      };
      
      const result = deviceStatusRule.check(context);
      
      expect(result.status).toBe(CheckStatus.BLOCK);
      expect(result.message).toContain('影厅已停用');
    });
  });
  
  describe('语言字幕匹配检查规则', () => {
    it('应该通过当语言信息完整', () => {
      const schedule = createSchedule();
      const filmVersion = createFilmVersion({
        audioLanguage: 'zh-CN',
        subtitleLanguage: 'zh-CN',
      });
      
      const context: RuleContext = {
        schedule,
        filmVersion,
        auditoriumDevice: createAuditorium(),
        kdms: [createKDM()],
        overlappingSchedules: [],
      };
      
      const result = languageSubtitleMatchRule.check(context);
      
      expect(result.status).toBe(CheckStatus.PASS);
      expect(result.message).toBe('语言字幕信息完整');
    });
    
    it('应该警告当音频语言未设置', () => {
      const schedule = createSchedule();
      const filmVersion = createFilmVersion({
        audioLanguage: '',
      });
      
      const context: RuleContext = {
        schedule,
        filmVersion,
        auditoriumDevice: createAuditorium(),
        kdms: [createKDM()],
        overlappingSchedules: [],
      };
      
      const result = languageSubtitleMatchRule.check(context);
      
      expect(result.status).toBe(CheckStatus.WARN);
      expect(result.message).toContain('音频语言未设置');
    });
  });
  
  describe('runRules 集成测试', () => {
    it('应该运行所有规则并返回综合结果', () => {
      const schedule = createSchedule();
      const filmVersion = createFilmVersion({ runtimeMinutes: 100 });
      const auditorium = createAuditorium();
      const kdm = createKDM();
      
      const context: RuleContext = {
        schedule,
        filmVersion,
        auditoriumDevice: auditorium,
        kdms: [kdm],
        overlappingSchedules: [],
      };
      
      const result = runRules(context);
      
      expect(result.scheduleId).toBe(schedule.scheduleId);
      expect(result.overallStatus).toBe(CheckStatus.PASS);
      expect(result.checks.length).toBe(6);
      expect(result.checkedAt).toBeTruthy();
    });
    
    it('应该返回阻断当存在阻断规则', () => {
      const schedule = createSchedule();
      const filmVersion = createFilmVersion({ runtimeMinutes: 200 });
      const auditorium = createAuditorium();
      const kdm = createKDM();
      
      const context: RuleContext = {
        schedule,
        filmVersion,
        auditoriumDevice: auditorium,
        kdms: [kdm],
        overlappingSchedules: [],
      };
      
      const result = runRules(context);
      
      expect(result.overallStatus).toBe(CheckStatus.BLOCK);
    });
    
    it('应该返回警告当存在警告但无阻断', () => {
      const schedule = createSchedule();
      const auditorium = createAuditorium({
        status: DeviceStatus.MAINTENANCE,
      });
      const kdm = createKDM();
      
      const context: RuleContext = {
        schedule,
        filmVersion: null,
        auditoriumDevice: auditorium,
        kdms: [kdm],
        overlappingSchedules: [],
      };
      
      const result = runRules(context);
      
      expect(result.overallStatus).toBe(CheckStatus.WARN);
    });
  });
});
