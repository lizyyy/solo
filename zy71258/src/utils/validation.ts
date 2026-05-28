import { z } from 'zod';

export const point3DSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number()
});

export const wallSchema = z.object({
  id: z.string().min(1, '墙体ID不能为空'),
  start: point3DSchema,
  end: point3DSchema,
  height: z.number().positive('墙体高度必须大于0'),
  thickness: z.number().positive('墙体厚度必须大于0'),
  material: z.string().min(1, '墙体材质不能为空'),
  opacity: z.number().min(0).max(1)
});

export const gallerySchema = z.object({
  id: z.string().min(1, '展厅ID不能为空'),
  name: z.string().min(1, '展厅名称不能为空'),
  width: z.number().positive('展厅宽度必须大于0'),
  height: z.number().positive('展厅高度必须大于0'),
  depth: z.number().positive('展厅深度必须大于0'),
  walls: z.array(wallSchema),
  material: z.string().min(1, '展厅材质不能为空'),
  createdBy: z.string().min(1, '创建人不能为空'),
  createdAt: z.string().datetime(),
  lastModifiedBy: z.string().optional(),
  lastModifiedAt: z.string().datetime().optional()
});

export const lightSourceSchema = z.object({
  id: z.string().min(1, '光源ID不能为空'),
  galleryId: z.string().min(1, '所属展厅ID不能为空'),
  name: z.string().min(1, '光源名称不能为空'),
  type: z.enum(['spot', 'point', 'directional', 'area']),
  power: z.number().positive('光源功率必须大于0'),
  intensity: z.number().min(0, '光源强度不能为负'),
  posX: z.number(),
  posY: z.number(),
  posZ: z.number(),
  angleX: z.number(),
  angleY: z.number(),
  angleZ: z.number(),
  beamAngle: z.number().positive('光束角必须大于0'),
  colorTemperature: z.number().positive('色温必须大于0'),
  spectrumDistribution: z.record(z.number()).optional(),
  calibrationCertNo: z.string().optional(),
  calibrationDate: z.string().date().optional(),
  createdBy: z.string().min(1, '创建人不能为空'),
  createdAt: z.string().datetime()
});

export const artworkSchema = z.object({
  id: z.string().min(1, '作品ID不能为空'),
  galleryId: z.string().min(1, '所属展厅ID不能为空'),
  exhibitionId: z.string().optional(),
  registrationNo: z.string().min(1, '文物登记号不能为空'),
  name: z.string().min(1, '作品名称不能为空'),
  lightResistanceGrade: z.enum([
    'ISO 15426 Grade 1',
    'ISO 15426 Grade 2',
    'ISO 15426 Grade 3',
    'ISO 15426 Grade 4'
  ]),
  posX: z.number(),
  posY: z.number(),
  posZ: z.number(),
  width: z.number().positive('作品宽度必须大于0'),
  height: z.number().positive('作品高度必须大于0'),
  protectionLevel: z.string().min(1, '保护等级不能为空'),
  currentIllumination: z.number().min(0).optional(),
  cumulativeExposure: z.number().min(0).optional(),
  createdBy: z.string().min(1, '创建人不能为空'),
  createdAt: z.string().datetime(),
  lastModifiedBy: z.string().optional(),
  lastModifiedAt: z.string().datetime().optional()
});

export const samplingDataSchema = z.object({
  id: z.string().min(1, '采样数据ID不能为空'),
  samplingPointId: z.string().min(1, '采样点ID不能为空'),
  measuredValue: z.number().min(0, '测量值不能为负'),
  measuredAt: z.string().datetime(),
  instrumentId: z.string().min(1, '仪器ID不能为空'),
  instrumentCalibrationStatus: z.enum(['valid', 'expired', 'unknown']),
  measuredBy: z.string().min(1, '测量人不能为空')
});

export const exhibitionSchema = z.object({
  id: z.string().min(1, '展览ID不能为空'),
  name: z.string().min(1, '展览名称不能为空'),
  startDate: z.string().date('开始日期格式不正确'),
  endDate: z.string().date('结束日期格式不正确'),
  dailyOpenHours: z.number().min(0).max(24, '每日开放时长不能超过24小时'),
  approvalNo: z.string().optional(),
  responsiblePerson: z.string().min(1, '责任人不能为空'),
  status: z.enum(['planning', 'ongoing', 'ended']),
  createdBy: z.string().min(1, '创建人不能为空'),
  createdAt: z.string().datetime()
}).refine((data) => {
  return new Date(data.endDate) >= new Date(data.startDate);
}, {
  message: '结束日期不能早于开始日期',
  path: ['endDate']
});

export const riskSchema = z.object({
  id: z.string().min(1, '风险ID不能为空'),
  type: z.enum(['over_illumination', 'cumulative_leak', 'light_penetration']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['detected', 'acknowledged', 'resolved']),
  description: z.string().min(1, '风险描述不能为空'),
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
    notes: z.string().optional()
  }),
  detectedAt: z.string().datetime(),
  acknowledgedBy: z.string().optional(),
  acknowledgedAt: z.string().datetime().optional(),
  resolvedAt: z.string().datetime().optional(),
  resolution: z.string().optional()
});

export const protectionReportSchema = z.object({
  id: z.string().min(1, '报告ID不能为空'),
  exhibitionId: z.string().min(1, '关联展览ID不能为空'),
  reportNo: z.string().min(1, '报告编号不能为空'),
  generatedAt: z.string().datetime(),
  riskSummary: z.object({
    totalRisks: z.number().min(0),
    overIllumination: z.number().min(0),
    cumulativeLeak: z.number().min(0),
    lightPenetration: z.number().min(0),
    bySeverity: z.object({
      low: z.number().min(0),
      medium: z.number().min(0),
      high: z.number().min(0),
      critical: z.number().min(0)
    })
  }),
  recommendations: z.array(z.object({
    artworkId: z.string().optional(),
    artworkName: z.string().optional(),
    suggestion: z.string().min(1, '建议内容不能为空'),
    priority: z.enum(['high', 'medium', 'low'])
  })),
  screenshots: z.array(z.object({
    dataUrl: z.string(),
    caption: z.string(),
    timestamp: z.string().datetime()
  })),
  dataSources: z.array(z.object({
    type: z.string(),
    count: z.number().min(0),
    lastUpdated: z.string().datetime()
  })),
  generatedBy: z.string().min(1, '生成人不能为空'),
  digitalSignature: z.string().optional()
});

export const idempotencySchema = z.object({
  idempotencyKey: z.string().min(1, '幂等键不能为空')
});

export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  error?: z.ZodError;
} {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

export function formatValidationError(error: z.ZodError): Record<string, string> {
  const formatted: Record<string, string> = {};
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    formatted[path] = err.message;
  });
  return formatted;
}

export type GalleryInput = z.infer<typeof gallerySchema>;
export type LightSourceInput = z.infer<typeof lightSourceSchema>;
export type ArtworkInput = z.infer<typeof artworkSchema>;
export type SamplingDataInput = z.infer<typeof samplingDataSchema>;
export type ExhibitionInput = z.infer<typeof exhibitionSchema>;
export type RiskInput = z.infer<typeof riskSchema>;
export type ProtectionReportInput = z.infer<typeof protectionReportSchema>;
