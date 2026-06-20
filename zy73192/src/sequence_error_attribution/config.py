from typing import List, Dict, Optional
from pydantic import BaseModel, Field


class StableMessages:
    """稳定的错误提示和状态消息，确保不同版本一致性"""

    ERROR_FILE_NOT_FOUND = "输入文件不存在: {file_path}"
    ERROR_INVALID_FILE_FORMAT = "文件格式无效，仅支持CSV和Excel格式: {file_path}"
    ERROR_EMPTY_DATA = "题目清单为空，无法进行归因分析"
    ERROR_MISSING_REQUIRED_FIELDS = "缺少必填字段映射，请配置: {fields}"
    ERROR_DIVISION_BY_ZERO = "除零边界检测: 递推公式分母为零，需人工复核"
    ERROR_NEGATIVE_TERM_COUNT = "项数为负值，数据异常需复核"
    ERROR_INVALID_SEQUENCE = "数列递推关系不成立，需人工复核"

    STATUS_PENDING = "待处理"
    STATUS_PROCESSING = "处理中"
    STATUS_SUCCESS = "处理完成"
    STATUS_NEEDS_REVIEW = "待复核"
    STATUS_FAILED = "处理失败"

    JUMP_REASON_THRESHOLD = "阈值触发: 结果超出预设阈值范围"
    JUMP_REASON_UNIT = "单位异常: 数值单位或数量级突变"
    JUMP_REASON_NORMAL = "正常记录: 数据本身特征导致的合理波动"

    REVIEW_REASON_DIVISION_BY_ZERO = "除零边界: 递推公式a(n+1)=f(a(n))/g(a(n))中g(a(n))=0"
    REVIEW_REASON_NEGATIVE_INDEX = "索引异常: 出现负项数或零项数"
    REVIEW_REASON_SMALL_SAMPLE = "样本不足: 边界样本量<3，统计结论可靠性低"


class FieldMapping(BaseModel):
    """字段映射配置，支持题目清单字段名不一致的情况"""

    question_id: List[str] = Field(
        default=["题目ID", "id", "题号", "question_id", "题目标识"],
        description="题目ID字段可能的名称"
    )
    question_source: List[str] = Field(
        default=["来源", "source", "题目来源", "出处", "试卷来源"],
        description="题目来源字段可能的名称"
    )
    question_content: List[str] = Field(
        default=["题目内容", "content", "题干", "题目", "question"],
        description="题目内容字段可能的名称"
    )
    sequence_type: List[str] = Field(
        default=["数列类型", "type", "递推类型", "sequence_type"],
        description="数列类型字段可能的名称"
    )
    given_terms: List[str] = Field(
        default=["已知项", "given_terms", "首项", "初始项", "initial_terms"],
        description="已知项字段可能的名称"
    )
    recurrence_formula: List[str] = Field(
        default=["递推公式", "formula", "recurrence", "递推关系"],
        description="递推公式字段可能的名称"
    )
    student_answer: List[str] = Field(
        default=["学生答案", "student_answer", "答案", "作答"],
        description="学生答案字段可能的名称"
    )
    correct_answer: List[str] = Field(
        default=["正确答案", "correct_answer", "标准答案", "参考答案"],
        description="正确答案字段可能的名称"
    )
    error_type: List[str] = Field(
        default=["错误类型", "error_type", "错因", "错误原因"],
        description="错误类型字段可能的名称"
    )
    source_row: List[str] = Field(
        default=["source_row", "行号", "row", "原始行号"],
        description="来源行号字段（内部使用）"
    )
    source_file: List[str] = Field(
        default=["source_file", "文件名", "file", "原始文件"],
        description="来源文件名字段（内部使用）"
    )


class AttributionConfig(BaseModel):
    """归因分析核心配置，参数名保持稳定"""

    min_sample_size: int = Field(
        default=3,
        ge=1,
        description="边界样本最小量，低于此值需人工复核"
    )
    jump_threshold_ratio: float = Field(
        default=2.0,
        gt=0,
        description="跳变检测阈值倍数，结果偏离均值超过此倍数标记为跳变"
    )
    unit_magnitude_threshold: int = Field(
        default=3,
        gt=0,
        description="单位异常数量级阈值，相差此数量级以上标记为单位异常"
    )
    zero_tolerance: float = Field(
        default=1e-10,
        ge=0,
        description="零值容差，绝对值小于此值视为零"
    )
    output_columns: List[str] = Field(
        default=[
            "question_id",
            "question_source",
            "source_location",
            "processing_status",
            "attribution_result",
            "error_category",
            "needs_review",
            "review_reason",
            "jump_detected",
            "jump_reason",
            "original_terms",
            "calculated_terms",
            "processing_log"
        ],
        description="输出CSV的固定列顺序"
    )
    field_mapping: FieldMapping = Field(
        default_factory=FieldMapping,
        description="字段映射配置"
    )


DEFAULT_CONFIG = AttributionConfig()
STABLE_MESSAGES = StableMessages()
