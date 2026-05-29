import { z } from 'zod';

export const UserBucketSchema = z.object({
  userId: z.string().min(1, '用户ID不能为空'),
  experimentId: z.string().min(1, '实验ID不能为空'),
  groupId: z.string().min(1, '分组ID不能为空'),
  groupName: z.string().min(1, '分组名称不能为空'),
  bucketTime: z.union([
    z.number().int().positive('分桶时间必须为正整数时间戳'),
    z.string().transform((val) => {
      const parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error('分桶时间必须为有效时间戳');
      }
      return parsed;
    })
  ]),
  bucketVersion: z.string().min(1, '分桶版本不能为空')
});

export const ExposureLogSchema = z.object({
  exposureId: z.string().min(1, '曝光ID不能为空'),
  userId: z.string().min(1, '用户ID不能为空'),
  experimentId: z.string().min(1, '实验ID不能为空'),
  groupId: z.string().min(1, '分组ID不能为空'),
  exposureTime: z.union([
    z.number().int().positive('曝光时间必须为正整数时间戳'),
    z.string().transform((val) => {
      const parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error('曝光时间必须为有效时间戳');
      }
      return parsed;
    })
  ]),
  configVersion: z.string().min(1, '配置版本不能为空'),
  deviceId: z.string().optional(),
  pageUrl: z.string().optional()
});

export const OperationChangeSchema = z.object({
  changeId: z.string().min(1, '变更ID不能为空'),
  experimentId: z.string().min(1, '实验ID不能为空'),
  changeType: z.enum(['config', 'traffic', 'group'], {
    message: '变更类型必须是 config、traffic 或 group'
  }),
  changeTime: z.union([
    z.number().int().positive('变更时间必须为正整数时间戳'),
    z.string().transform((val) => {
      const parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error('变更时间必须为有效时间戳');
      }
      return parsed;
    })
  ]),
  operator: z.string().min(1, '操作人不能为空'),
  changeDescription: z.string().min(1, '变更描述不能为空'),
  oldValue: z.string().optional(),
  newValue: z.string().optional()
});

export const ConversionDataSchema = z.object({
  conversionId: z.string().min(1, '转化ID不能为空'),
  userId: z.string().min(1, '用户ID不能为空'),
  exposureId: z.string().min(1, '曝光ID不能为空'),
  conversionEvent: z.string().min(1, '转化事件不能为空'),
  conversionValue: z.union([
    z.number(),
    z.string().transform((val) => {
      const parsed = parseFloat(val);
      if (isNaN(parsed)) {
        throw new Error('转化值必须为有效数字');
      }
      return parsed;
    })
  ]),
  conversionTime: z.union([
    z.number().int().positive('转化时间必须为正整数时间戳'),
    z.string().transform((val) => {
      const parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error('转化时间必须为有效时间戳');
      }
      return parsed;
    })
  ])
});

export const ExperimentConfigSchema = z.object({
  experimentId: z.string().min(1, '实验ID不能为空'),
  experimentName: z.string().min(1, '实验名称不能为空'),
  version: z.string().min(1, '版本不能为空'),
  configData: z.record(z.any()).default({}),
  startTime: z.union([
    z.number().int().positive('开始时间必须为正整数时间戳'),
    z.string().transform((val) => {
      const parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error('开始时间必须为有效时间戳');
      }
      return parsed;
    })
  ]),
  endTime: z.union([
    z.number().int().positive(),
    z.string().transform((val) => {
      const parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error('结束时间必须为有效时间戳');
      }
      return parsed;
    })
  ]).optional(),
  createdAt: z.union([
    z.number().int().positive('创建时间必须为正整数时间戳'),
    z.string().transform((val) => {
      const parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error('创建时间必须为有效时间戳');
      }
      return parsed;
    })
  ])
});

export type UserBucketSchemaType = z.infer<typeof UserBucketSchema>;
export type ExposureLogSchemaType = z.infer<typeof ExposureLogSchema>;
export type OperationChangeSchemaType = z.infer<typeof OperationChangeSchema>;
export type ConversionDataSchemaType = z.infer<typeof ConversionDataSchema>;
export type ExperimentConfigSchemaType = z.infer<typeof ExperimentConfigSchema>;

export interface ParseResult<T> {
  success: boolean;
  data: T[];
  errors: ParseError[];
}

export interface ParseError {
  row: number;
  message: string;
  field?: string;
}

export function validateAndParseRows<T>(
  rows: any[],
  schema: z.ZodSchema<T>
): ParseResult<T> {
  const data: T[] = [];
  const errors: ParseError[] = [];

  rows.forEach((row, index) => {
    try {
      const result = schema.safeParse(row);
      if (result.success) {
        data.push(result.data);
      } else {
        const issue = result.error.issues[0];
        errors.push({
          row: index + 2,
          message: issue.message,
          field: issue.path.join('.')
        });
      }
    } catch (e) {
      errors.push({
        row: index + 2,
        message: e instanceof Error ? e.message : '未知错误'
      });
    }
  });

  return {
    success: errors.length === 0,
    data,
    errors
  };
}
