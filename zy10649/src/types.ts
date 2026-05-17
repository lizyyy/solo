export enum SegmentStatus {
  DRAFT = '草稿',
  PUBLISHED = '已发布',
  REVOKING = '撤销中',
  REVOKED = '已撤销'
}

export enum ChannelType {
  SMS = '短信',
  PUSH = '推送',
  EMAIL = '邮件',
  WECHAT = '微信公众号',
  DINGTALK = '钉钉',
  AD = '广告平台'
}

export enum RevokeReason {
  RULE_ERROR = '规则配置错误',
  AUDIENCE_MISMATCH = '人群匹配错误',
  COMPLIANCE_RISK = '合规风险',
  DUPLICATE_PUBLISH = '重复发布',
  BUSINESS_ADJUSTMENT = '业务调整',
  OTHER = '其他原因'
}

export enum OperationType {
  CREATE = '创建',
  UPDATE = '更新',
  PUBLISH = '发布',
  REVOKE_REQUEST = '申请撤销',
  REVOKE_PROCESS = '处理撤销',
  REVOKE_COMPLETE = '完成撤销',
  CHANNEL_UPDATE = '渠道状态更新',
  EXCEPTION_HANDLE = '异常处理',
  IMPORT = '导入'
}

export interface AudienceSegment {
  id: string;
  name: string;
  description: string;
  ruleVersion: string;
  status: SegmentStatus;
  audienceCount: number;
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
  publishedAt?: Date;
  revokedAt?: Date;
}

export interface PublishRecord {
  id: string;
  segmentId: string;
  segmentName: string;
  ruleVersion: string;
  channel: ChannelType;
  channelAccount: string;
  status: SegmentStatus;
  audienceCount: number;
  isRevoking: boolean;
  isRevoked: boolean;
  publishedBy: string;
  publishedAt: Date;
  revokeRequestedAt?: Date;
  revokeCompletedAt?: Date;
  revokeReason?: RevokeReason;
  revokeRemark?: string;
  revokeRequestedBy?: string;
}

export interface StatusHistory {
  id: string;
  segmentId: string;
  publishRecordId?: string;
  operation: OperationType;
  fromStatus?: SegmentStatus;
  toStatus: SegmentStatus;
  operator: string;
  operateAt: Date;
  remark?: string;
  channel?: ChannelType;
  exceptionInfo?: string;
  handlerInfo?: string;
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
}
