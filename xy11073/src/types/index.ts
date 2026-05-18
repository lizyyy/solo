export enum BookingStatus {
  PENDING = '待确认',
  CONFIRMED = '已确认',
  IN_PROGRESS = '进行中',
  COMPLETED = '已完成',
  CANCELLED = '已取消',
  NEEDS_REVIEW = '需人工审核'
}

export enum EquipmentIntensity {
  LOW = '低强度',
  MEDIUM = '中等强度',
  HIGH = '高强度'
}

export enum ContraindicationType {
  HEART_DISEASE = '心脏病',
  HIGH_BLOOD_PRESSURE = '高血压',
  JOINT_DAMAGE = '关节损伤',
  PREGNANCY = '妊娠期',
  RECENT_SURGERY = '近期手术',
  NONE = '无禁忌'
}

export interface EquipmentBooking {
  预约编号: string;
  门店名称: string;
  患者姓名: string;
  患者手机号: string;
  患者身份证号: string;
  患者禁忌情况: ContraindicationType;
  器械编号: string;
  器械名称: string;
  器械强度等级: EquipmentIntensity;
  预约日期: string;
  预约开始时间: string;
  预约结束时间: string;
  治疗师姓名: string;
  预约状态: BookingStatus;
  预约备注: string;
  创建时间: string;
  更新时间: string;
}

export interface BadRecord {
  原始数据: Partial<EquipmentBooking>;
  行号: number;
  错误原因: string;
  错误类型: BadRecordType;
  后续处理建议: string;
  人工备注: string;
  是否允许继续: boolean;
}

export enum BadRecordType {
  MISSING_REQUIRED_FIELD = '必填字段缺失',
  INVALID_FORMAT = '格式错误',
  DUPLICATE_BOOKING = '重复预约',
  STATUS_TRANSITION_ERROR = '状态越级',
  CONTRAINDICATION_CONFLICT = '禁忌患者与器械冲突',
  TIME_CONFLICT = '时间冲突',
  CONSISTENCY_ERROR = '预约表一致性错误'
}

export interface ImportResult {
  导入批次号: string;
  导入时间: string;
  总记录数: number;
  正常记录数: number;
  异常记录数: number;
  正常记录列表: EquipmentBooking[];
  异常记录列表: BadRecord[];
}

export interface ManualReviewRequest {
  批次号: string;
  行号: number;
  人工备注: string;
  是否通过审核: boolean;
}
