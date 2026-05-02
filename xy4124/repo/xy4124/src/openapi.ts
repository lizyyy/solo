import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '影厅密钥排片卫士 API',
      version: '1.0.0',
      description: '为独立电影院排片经理提供的本地纯后端API，用于验证排片、KDM密钥、设备匹配等',
      contact: {
        name: '系统管理员',
      },
    },
    tags: [
      {
        name: '影片版本',
        description: '管理影片DCP版本信息',
      },
      {
        name: '影厅设备',
        description: '管理影厅设备状态和支持格式',
      },
      {
        name: 'KDM密钥',
        description: '管理KDM密钥有效期',
      },
      {
        name: '排片管理',
        description: '管理排片表和放映检查',
      },
      {
        name: '导入导出',
        description: 'CSV导入排片、导出风险清单和交接班报告',
      },
      {
        name: '审计日志',
        description: '查看操作审计日志',
      },
    ],
    servers: [
      {
        url: 'http://localhost:3000/api/v1',
        description: '本地开发服务器',
      },
    ],
    components: {
      schemas: {
        CheckStatus: {
          type: 'string',
          enum: ['pass', 'warn', 'block'],
          description: '检查状态',
        },
        TimestampRange: {
          type: 'object',
          properties: {
            start: { type: 'string', format: 'date-time' },
            end: { type: 'string', format: 'date-time' },
          },
          required: ['start', 'end'],
        },
        FilmVersion: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            filmId: { type: 'string', description: '影片ID' },
            filmTitle: { type: 'string', description: '影片名称' },
            versionId: { type: 'string', description: '版本ID' },
            versionName: { type: 'string', description: '版本名称' },
            audioLanguage: { type: 'string', description: '音频语言' },
            subtitleLanguage: { type: 'string', description: '字幕语言' },
            subtitleType: { type: 'string', enum: ['embedded', 'sideload', 'none'] },
            aspectRatio: { type: 'string', enum: ['1.85', '2.39', '16:9'] },
            soundFormat: { type: 'string', enum: ['dolby_5_1', 'dolby_7_1', 'dolby_atmos', 'dts', 'pcm'] },
            runtimeMinutes: { type: 'integer', description: '片长（分钟）' },
            dcpHash: { type: 'string', description: 'DCP哈希值' },
            notes: { type: 'string' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        AuditoriumDevice: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            auditoriumId: { type: 'string', description: '影厅ID' },
            auditoriumName: { type: 'string', description: '影厅名称' },
            seatCount: { type: 'integer', description: '座位数' },
            supportedFormats: {
              type: 'object',
              properties: {
                aspectRatios: { type: 'array', items: { type: 'string' } },
                soundFormats: { type: 'array', items: { type: 'string' } },
              },
            },
            status: { type: 'string', enum: ['operational', 'maintenance', 'offline'] },
            statusReason: { type: 'string' },
            lastMaintenance: { type: 'string', format: 'date-time' },
            nextMaintenance: { type: 'string', format: 'date-time' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        KDM: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            kdmId: { type: 'string', description: 'KDM ID' },
            filmId: { type: 'string', description: '影片ID' },
            versionId: { type: 'string', description: '版本ID' },
            auditoriumId: { type: 'string', description: '影厅ID' },
            validity: { $ref: '#/components/schemas/TimestampRange' },
            cplId: { type: 'string', description: 'CPL ID' },
            issuer: { type: 'string', description: '签发人' },
            issuerOrg: { type: 'string', description: '签发机构' },
            contentTitleText: { type: 'string', description: '内容标题' },
            notes: { type: 'string' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Schedule: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            scheduleId: { type: 'string', description: '排片ID' },
            filmId: { type: 'string', description: '影片ID' },
            versionId: { type: 'string', description: '版本ID' },
            auditoriumId: { type: 'string', description: '影厅ID' },
            showTime: { $ref: '#/components/schemas/TimestampRange' },
            preShowMinutes: { type: 'integer', description: '预告时长（分钟）' },
            bufferMinutesBefore: { type: 'integer', description: '前置缓冲（分钟）' },
            bufferMinutesAfter: { type: 'integer', description: '后置缓冲（分钟）' },
            actualEndTime: { type: 'string', format: 'date-time' },
            notes: { type: 'string' },
            isCancelled: { type: 'boolean' },
            cancelReason: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        RuleCheckResult: {
          type: 'object',
          properties: {
            ruleId: { type: 'string' },
            ruleName: { type: 'string' },
            status: { $ref: '#/components/schemas/CheckStatus' },
            message: { type: 'string' },
            details: { type: 'object' },
          },
        },
        OverallCheckResult: {
          type: 'object',
          properties: {
            scheduleId: { type: 'string' },
            overallStatus: { $ref: '#/components/schemas/CheckStatus' },
            checks: { type: 'array', items: { $ref: '#/components/schemas/RuleCheckResult' } },
            checkedAt: { type: 'string', format: 'date-time' },
          },
        },
        AuditLog: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            auditId: { type: 'string' },
            action: { type: 'string', enum: ['create', 'update', 'delete', 'import', 'export', 'check', 'read'] },
            entityType: { type: 'string', enum: ['film_version', 'auditorium_device', 'kdm', 'schedule', 'projection_check'] },
            entityId: { type: 'string' },
            actor: { type: 'string' },
            actorRole: { type: 'string' },
            changes: { type: 'object' },
            oldValues: { type: 'object' },
            newValues: { type: 'object' },
            details: { type: 'object' },
            ipAddress: { type: 'string' },
            userAgent: { type: 'string' },
            success: { type: 'boolean' },
            errorMessage: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/index.ts'],
};

export const openapiSpec = swaggerJsdoc(options);
