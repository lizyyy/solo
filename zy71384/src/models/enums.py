from enum import Enum


class DiagnosisStatus(str, Enum):
    ENTRY = "entry"            # 录入
    PROCESSING = "processing"  # 处理
    REVIEW = "review"          # 复核
    EXPORTED = "exported"      # 导出


class BacklogCause(str, Enum):
    PRODUCTION_SURGE = "production_surge"    # 生产暴涨
    CONSUMPTION_SLOW = "consumption_slow"    # 消费变慢
    DEAD_LETTER_PILEUP = "dead_letter_pileup"  # 死信堆积
    CONSUMER_OFFLINE = "consumer_offline"    # 消费者掉线
    MIXED = "mixed"                          # 混合原因
    UNKNOWN = "unknown"                      # 未知


class AlertLevel(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    P0 = "p0"


class EdgeCaseType(str, Enum):
    TIME_WINDOW_MISALIGN = "time_window_misalign"      # 时间窗错位
    DUPLICATE_DEAD_LETTER = "duplicate_dead_letter"    # 死信重复计
    CONSUMER_DROPPED = "consumer_dropped"              # 消费者掉线未识别
