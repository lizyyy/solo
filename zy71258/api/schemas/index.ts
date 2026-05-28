import { z } from 'zod';
import type { LightResistanceGrade, LightSourceType, RiskType, RiskSeverity, RiskStatus } from '../../src/types/index.js';

const point3DSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

const wallSchema = z.object({
  id: z.string().optional(),
  start: point3DSchema,
  end: point3DSchema,
  height: z.number().positive(),
  thickness: z.number().positive(),
  material: z.string().min(1),
  opacity: z.number().min(0).max(1),
});

export const gallerySchema = z.object({
  name: z.string().min(1, '展厅名称不能为空'),
  width: z.number().positive('宽度必须为正数'),
  height: z.number().positive('高度必须为正数'),
  depth: z.number().positive('深度必须为正数'),
  walls: z.array(wallSchema),
  material: z.string().min(1, '材质不能为空'),
  createdBy: z.string().min(1, '创建人不能为空'),
});

export const galleryUpdateSchema = gallerySchema.partial();

const lightSourceTypeSchema = z.enum(['spot', 'point', 'directional', 'area'] as const satisfies readonly LightSourceType[]);

export const lightSourceSchema = z.object({
  galleryId: z.string().min(1, '展厅ID不能为空'),
  name: z.string().min(1, '光源名称不能为空'),
  type: lightSourceTypeSchema,
  power: z.number().min(0, '功率不能为负数'),
  intensity: z.number().min(0, '强度不能为负数'),
  posX: z.number(),
  posY: z.number(),
  posZ: z.number(),
  angleX: z.number(),
  angleY: z.number(),
  angleZ: z.number(),
  beamAngle: z.number().min(0).max(360),
  colorTemperature: z.number().positive('色温必须为正数'),
  spectrumDistribution: z.record(z.number()).optional(),
  calibrationCertNo: z.string().optional(),
  calibrationDate: z.string().optional(),
  createdBy: z.string().min(1, '创建人不能为空'),
});

export const lightSourceUpdateSchema = lightSourceSchema.partial();

const lightResistanceGradeSchema = z.enum([
  'ISO 15426 Grade 1',
  'ISO 15426 Grade 2',
  'ISO 15426 Grade 3',
  'ISO 15426 Grade 4',
] as const satisfies readonly LightResistanceGrade[]);

export const artworkSchema = z.object({
  galleryId: z.string().min(1, '展厅ID不能为空'),
  exhibitionId: z.string().optional(),
  registrationNo: z.string().min(1, '登记号不能为空'),
  name: z.string().min(1, '作品名称不能为空'),
  lightResistanceGrade: lightResistanceGradeSchema,
  posX: z.number(),
  posY: z.number(),
  posZ: z.number(),
  width: z.number().positive('宽度必须为正数'),
  height: z.number().positive('高度必须为正数'),
  protectionLevel: z.string().min(1, '保护等级不能为空'),
  currentIllumination: z.number().min(0).optional(),
  cumulativeExposure: z.number().min(0).optional(),
  createdBy: z.string().min(1, '创建人不能为空'),
});

export const artworkUpdateSchema = artworkSchema.partial();

export const samplingSchema = z.object({
  samplingPointId: z.string().min(1, '采样点ID不能为空'),
  measuredValue: z.number().min(0, '测量值不能为负数'),
  measuredAt: z.string().min(1, '测量时间不能为空'),
  instrumentId: z.string().min(1, '仪器ID不能为空'),
  instrumentCalibrationStatus: z.enum(['valid', 'expired', 'unknown']),
  measuredBy: z.string().min(1, '测量人不能为空'),
});

export const samplingUpdateSchema = samplingSchema.partial();

export const exhibitionSchema = z.object({
  name: z.string().min(1, '展期名称不能为空'),
  startDate: z.string().min(1, '开始日期不能为空'),
  endDate: z.string().min(1, '结束日期不能为空'),
  dailyOpenHours: z.number().min(0).max(24, '每日开放时长不能超过24小时'),
  approvalNo: z.string().optional(),
  responsiblePerson: z.string().min(1, '负责人不能为空'),
  status: z.enum(['planning', 'ongoing', 'ended']).default('planning'),
  createdBy: z.string().min(1, '创建人不能为空'),
});

export const exhibitionUpdateSchema = exhibitionSchema.partial().omit({ status: true }).extend({
  status: z.enum(['planning', 'ongoing', 'ended']).optional(),
});

const riskTypeSchema = z.enum(['over_illumination', 'cumulative_leak', 'light_penetration'] as const satisfies readonly RiskType[]);
const riskSeveritySchema = z.enum(['low', 'medium', 'high', 'critical'] as const satisfies readonly RiskSeverity[]);
const riskStatusSchema = z.enum(['detected', 'acknowledged', 'resolved'] as const satisfies readonly RiskStatus[]);

export const riskSchema = z.object({
  type: riskTypeSchema,
  severity: riskSeveritySchema,
  status: riskStatusSchema.default('detected'),
  description: z.string().min(1, '描述不能为空'),
  posX: z.number(),
  posY: z.number(),
  posZ: z.number(),
  artworkId: z.string().optional(),
  lightSourceId: z.string().optional(),
  measuredValue: z.number(),
  threshold: z.number(),
  exceedRatio: z.number(),
  evidence: z.object({
    screenshotRef: z.string().optional(),
    samplingDataRef: z.string().optional(),
    notes: z.string().optional(),
  }).default({}),
  detectedAt: z.string().min(1, '检测时间不能为空'),
  acknowledgedBy: z.string().optional(),
  acknowledgedAt: z.string().optional(),
  resolvedAt: z.string().optional(),
  resolution: z.string().optional(),
});

export const riskUpdateSchema = riskSchema.partial();

export const riskAcknowledgeSchema = z.object({
  acknowledgedBy: z.string().min(1, '确认人不能为空'),
});

export const riskResolveSchema = z.object({
  resolution: z.string().min(1, '解决方案不能为空'),
});

export const reportSchema = z.object({
  exhibitionId: z.string().min(1, '展期ID不能为空'),
  generatedBy: z.string().min(1, '生成人不能为空'),
  screenshots: z.array(
    z.object({
      dataUrl: z.string(),
      caption: z.string(),
      timestamp: z.string(),
    })
  ).default([]),
});

export const riskDetectionSchema = z.object({
  galleryId: z.string().min(1, '展厅ID不能为空'),
  exhibitionId: z.string().min(1, '展期ID不能为空'),
  includeRayTracing: z.boolean().default(false),
});
