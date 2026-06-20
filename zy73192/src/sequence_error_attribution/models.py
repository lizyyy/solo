from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

from .config import STABLE_MESSAGES


class QuestionRecord(BaseModel):
    """标准化的题目记录，确保字段名统一"""

    question_id: str = Field(default="", description="题目唯一标识")
    question_source: str = Field(default="", description="题目来源")
    question_content: str = Field(default="", description="题目内容")
    sequence_type: str = Field(default="", description="数列类型")
    given_terms: str = Field(default="", description="已知项原始字符串")
    recurrence_formula: str = Field(default="", description="递推公式")
    student_answer: str = Field(default="", description="学生答案")
    correct_answer: str = Field(default="", description="正确答案")
    error_type: str = Field(default="", description="原始错误类型")
    source_row: int = Field(default=-1, description="来源行号")
    source_file: str = Field(default="", description="来源文件名")

    processing_status: str = Field(
        default=STABLE_MESSAGES.STATUS_PENDING,
        description="处理状态"
    )
    attribution_result: str = Field(default="", description="归因结果")
    error_category: str = Field(default="", description="错误分类")
    needs_review: bool = Field(default=False, description="是否需要人工复核")
    review_reason: str = Field(default="", description="复核原因")
    jump_detected: bool = Field(default=False, description="是否检测到结果跳变")
    jump_reason: str = Field(default="", description="跳变原因")
    original_terms: List[float] = Field(default_factory=list, description="解析后的原始数列项")
    calculated_terms: List[float] = Field(default_factory=list, description="按递推公式计算的数列项")
    processing_log: List[str] = Field(default_factory=list, description="处理日志")

    @property
    def source_location(self) -> str:
        """来源位置：文件名:行号，便于数学老师定位"""
        if self.source_row >= 0 and self.source_file:
            return f"{self.source_file}:{self.source_row}"
        elif self.source_row >= 0:
            return f"第{self.source_row}行"
        elif self.source_file:
            return self.source_file
        return "未知来源"

    def add_log(self, message: str) -> None:
        """添加处理日志"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.processing_log.append(f"[{timestamp}] {message}")

    def mark_for_review(self, reason: str) -> None:
        """标记为待复核并记录原因"""
        self.needs_review = True
        self.review_reason = reason
        self.processing_status = STABLE_MESSAGES.STATUS_NEEDS_REVIEW
        self.add_log(f"标记待复核: {reason}")

    def mark_success(self, result: str, category: str = "") -> None:
        """标记处理完成"""
        self.attribution_result = result
        self.error_category = category
        self.processing_status = STABLE_MESSAGES.STATUS_SUCCESS
        self.add_log(f"处理完成: {result}")

    def mark_failed(self, error_msg: str) -> None:
        """标记处理失败"""
        self.processing_status = STABLE_MESSAGES.STATUS_FAILED
        self.add_log(f"处理失败: {error_msg}")

    def to_output_dict(self) -> Dict[str, Any]:
        """转换为输出字典，列表字段转为字符串便于CSV导出"""
        data = self.model_dump()
        data["source_location"] = self.source_location
        data["original_terms"] = "; ".join(map(str, self.original_terms)) if self.original_terms else ""
        data["calculated_terms"] = "; ".join(map(str, self.calculated_terms)) if self.calculated_terms else ""
        data["processing_log"] = "\n".join(self.processing_log) if self.processing_log else ""
        return data


class AttributionResult(BaseModel):
    """批处理归因结果汇总"""

    total_records: int = 0
    success_count: int = 0
    review_count: int = 0
    failed_count: int = 0
    jump_count: int = 0
    records: List[QuestionRecord] = Field(default_factory=list)
    summary_report: str = ""
    output_file: str = ""

    def generate_summary(self) -> str:
        """生成汇总报告"""
        report = [
            "=" * 60,
            "数列递推错题归因分析报告",
            "=" * 60,
            f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "一、处理概览",
            f"  总记录数: {self.total_records}",
            f"  处理完成: {self.success_count} ({self.success_count/self.total_records*100:.1f}%)" if self.total_records else "  处理完成: 0",
            f"  待复核: {self.review_count} ({self.review_count/self.total_records*100:.1f}%)" if self.total_records else "  待复核: 0",
            f"  处理失败: {self.failed_count} ({self.failed_count/self.total_records*100:.1f}%)" if self.total_records else "  处理失败: 0",
            f"  检测到跳变: {self.jump_count}",
            "",
        ]

        if self.review_count > 0:
            report.extend([
                "二、待复核明细",
                "  需要数学老师老叶人工复核的记录:",
            ])
            for i, rec in enumerate([r for r in self.records if r.needs_review], 1):
                report.append(f"  {i}. [{rec.source_location}] {rec.question_id} - {rec.review_reason}")
            report.append("")

        if self.jump_count > 0:
            report.extend([
                "三、结果跳变分析",
                "  检测到结果跳变的记录及原因:",
            ])
            for i, rec in enumerate([r for r in self.records if r.jump_detected], 1):
                report.append(f"  {i}. [{rec.source_location}] {rec.question_id} - {rec.jump_reason}")
            report.append("")

        report.extend([
            "四、交接说明",
            "  1. 详细数据请查看CSV明细文件",
            f"  2. CSV文件路径: {self.output_file}",
            "  3. 待复核记录已标记并给出复核原因",
            "  4. 每条记录均包含source_location字段，可直接定位原始题目位置",
            "  5. 处理日志字段记录了完整的处理过程",
            "",
            "=" * 60,
        ])

        self.summary_report = "\n".join(report)
        return self.summary_report
