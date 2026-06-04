"""旧公式截图补录和反例列表自动更新机制"""

import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple

from .models import (
    OldFormulaScreenshot,
    CounterExample,
    SampleRecord,
    RecordStatus,
    DataSource,
    WeightTable,
)
from .calculator import (
    calculate_confidence_interval,
    calculate_weighted_score,
    generate_counter_example,
)


class OldFormulaHandler:
    """旧公式截图处理器"""

    def __init__(self):
        self.screenshots: Dict[str, OldFormulaScreenshot] = {}
        self.counter_examples: Dict[str, CounterExample] = {}
        self.old_formula_records: Dict[str, SampleRecord] = {}

    def upload_screenshot(
        self,
        record_id: str,
        course_name: str,
        image_path: str,
        old_pass_rate: float,
        old_threshold: float,
        old_formula_text: str,
        uploaded_by: str,
    ) -> OldFormulaScreenshot:
        """上传旧公式截图"""
        path = Path(image_path)
        if not path.exists():
            raise FileNotFoundError(f"截图文件不存在: {image_path}")

        screenshot = OldFormulaScreenshot(
            screenshot_id=f"SC-{uuid.uuid4().hex[:8]}",
            record_id=record_id,
            course_name=course_name,
            image_path=image_path,
            old_pass_rate=old_pass_rate,
            old_threshold=old_threshold,
            old_formula_text=old_formula_text,
            uploaded_by=uploaded_by,
        )
        self.screenshots[screenshot.screenshot_id] = screenshot
        return screenshot

    def process_screenshot(
        self,
        screenshot_id: str,
        original_record: SampleRecord,
        weight_table: WeightTable,
    ) -> Tuple[CounterExample, SampleRecord]:
        """
        处理旧公式截图，生成反例和旧口径记录

        关键逻辑：
        1. 根据旧公式重新计算
        2. 生成反例记录加入反例列表
        3. 创建旧口径数据来源的样本记录
        4. 反例列表自动更新
        """
        screenshot = self.screenshots.get(screenshot_id)
        if not screenshot:
            raise ValueError(f"截图记录不存在: {screenshot_id}")

        if screenshot.processed:
            raise ValueError(f"截图已处理: {screenshot_id}")

        # 用旧公式重新计算置信区间
        ci_lower_old, ci_upper_old, pass_rate_old = calculate_confidence_interval(
            original_record.sample_size,
            int(original_record.sample_size * screenshot.old_pass_rate),
        )

        # 检查旧口径下是否异常
        is_abnormal_old = ci_lower_old < screenshot.old_threshold

        if is_abnormal_old:
            issue_type = "old_formula_abnormal"
            description = (
                f"旧公式口径下置信区间下限 {ci_lower_old:.4f} < 旧阈值 {screenshot.old_threshold}，"
                f"与新口径处理结果不一致"
            )
            evidence = (
                f"旧公式: {screenshot.old_formula_text}, "
                f"旧通过率: {screenshot.old_pass_rate:.4f}, "
                f"截图路径: {screenshot.image_path}"
            )

            counter_example = generate_counter_example(
                original_record,
                issue_type,
                description,
                evidence,
            )
            counter_example.formula_version = "v1"
            self.counter_examples[counter_example.case_id] = counter_example
            screenshot.linked_counter_example_id = counter_example.case_id
        else:
            issue_type = "old_formula_verification"
            description = (
                f"旧公式口径下置信区间下限 {ci_lower_old:.4f} >= 旧阈值 {screenshot.old_threshold}，"
                f"验证通过"
            )
            evidence = f"旧公式: {screenshot.old_formula_text}, 截图路径: {screenshot.image_path}"

            counter_example = generate_counter_example(
                original_record,
                issue_type,
                description,
                evidence,
            )
            counter_example.formula_version = "v1"
            counter_example.resolved = True
            counter_example.resolved_note = "旧公式验证通过，无需修正"
            self.counter_examples[counter_example.case_id] = counter_example
            screenshot.linked_counter_example_id = counter_example.case_id

        # 创建旧口径数据来源的样本记录
        old_record = SampleRecord(
            record_id=f"{original_record.record_id}-old",
            course_name=original_record.course_name,
            teacher_name=original_record.teacher_name,
            sample_size=original_record.sample_size,
            pass_count=int(original_record.sample_size * screenshot.old_pass_rate),
            pass_rate=screenshot.old_pass_rate,
            score=original_record.score,
            ci_lower=ci_lower_old,
            ci_upper=ci_upper_old,
            weight=original_record.weight,
            status=RecordStatus.PENDING,
            data_source=DataSource.OLD_FORMULA,
            formula_version="v1",
            review_note=f"来自旧公式截图补录，原记录ID: {original_record.record_id}",
        )

        weight_rule = weight_table.find_rule(original_record.score)
        weight, _ = calculate_weighted_score(screenshot.old_pass_rate, weight_rule)
        old_record.weight = weight

        if is_abnormal_old:
            old_record.status = RecordStatus.ABNORMAL
        else:
            old_record.status = RecordStatus.NORMAL

        self.old_formula_records[old_record.record_id] = old_record
        screenshot.processed = True

        return counter_example, old_record

    def get_counter_examples_by_record(
        self, record_id: str
    ) -> List[CounterExample]:
        """根据记录ID获取相关反例"""
        return [
            ce
            for ce in self.counter_examples.values()
            if ce.record_id == record_id
        ]

    def list_counter_examples(
        self, unresolved_only: bool = False
    ) -> List[CounterExample]:
        """列出所有反例"""
        examples = list(self.counter_examples.values())
        if unresolved_only:
            examples = [ce for ce in examples if not ce.resolved]
        return examples

    def list_screenshots(
        self, unprocessed_only: bool = False
    ) -> List[OldFormulaScreenshot]:
        """列出所有截图记录"""
        screenshots = list(self.screenshots.values())
        if unprocessed_only:
            screenshots = [s for s in screenshots if not s.processed]
        return screenshots

    def resolve_counter_example(
        self, case_id: str, resolved_note: str
    ) -> Optional[CounterExample]:
        """标记反例已解决"""
        ce = self.counter_examples.get(case_id)
        if ce:
            ce.resolved = True
            ce.resolved_note = resolved_note
            return ce
        return None

    def create_screenshot_from_dict(
        self, data: Dict[str, Any]
    ) -> OldFormulaScreenshot:
        """从字典创建截图记录（用于演示数据）"""
        screenshot = OldFormulaScreenshot(
            screenshot_id=data.get("screenshot_id", f"SC-{uuid.uuid4().hex[:8]}"),
            record_id=data["record_id"],
            course_name=data["course_name"],
            image_path=data["image_path"],
            old_pass_rate=data["old_pass_rate"],
            old_threshold=data["old_threshold"],
            old_formula_text=data["old_formula_text"],
            uploaded_by=data.get("uploaded_by", "system"),
            uploaded_at=datetime.fromisoformat(data["uploaded_at"])
            if "uploaded_at" in data
            else datetime.now(),
            processed=data.get("processed", False),
            linked_counter_example_id=data.get("linked_counter_example_id"),
        )
        self.screenshots[screenshot.screenshot_id] = screenshot
        return screenshot
