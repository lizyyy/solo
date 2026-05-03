from enum import Enum


class OrderStatus(str, Enum):
    PENDING_RECEIVE = "待接收"
    RECEIVED = "已接收"
    PROCESSING = "加工中"
    PENDING_INSPECTION = "待检验"
    PENDING_REWORK = "待返工"
    REWORKING = "返工中"
    COMPLETED = "已完成"


class PhotoType(str, Enum):
    OCCLUSION = "咬合关系"
    FRONT = "模型正面"
    SIDE = "模型侧面"
    OCCLUSAL_SURFACE = "模型咬合面"
    OTHER = "其他"


class IssueType(str, Enum):
    MISSING_FILE = "文件缺失"
    ID_MISMATCH = "编号不一致"
    PHOTO_TIME_ABNORMAL = "取模照片时间异常"
    REWORK_STATUS_ISSUE = "返工状态问题"
    OVERDUE_RISK = "超期风险"
    PHOTO_MISSING = "照片缺失"
    STL_MISSING = "STL文件缺失"


class IssueSeverity(str, Enum):
    CRITICAL = "严重"
    HIGH = "高"
    MEDIUM = "中"
    LOW = "低"


class ReviewStatus(str, Enum):
    UNREVIEWED = "未复核"
    UNDER_REVIEW = "复核中"
    REVIEWED = "已复核"
    RESOLVED = "已解决"
