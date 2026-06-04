"""工作流编排器 - 协调整个置信区间样本量试算流程"""

import uuid
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime

from .models import (
    SampleRecord,
    RecordStatus,
    WeightTable,
    CounterExample,
    OldFormulaScreenshot,
    DataSource,
)
from .calculator import process_records, rerun_record
from .weight_manager import WeightTableManager
from .old_formula_handler import OldFormulaHandler


class CISampleWorkflow:
    """置信区间样本量试算工作流"""

    def __init__(self):
        self.weight_manager = WeightTableManager()
        self.old_formula_handler = OldFormulaHandler()
        self.records: Dict[str, SampleRecord] = {}
        self.workflow_history: List[Dict[str, Any]] = []

    def step1_import_weight_table(
        self,
        weight_table_data: Dict[str, Any],
        source: str = "dict",
        file_path: Optional[str] = None,
    ) -> WeightTable:
        """
        第一步：导入评分权重表

        这是整个流程的起点，必须先导入评分权重表才能进行后续计算。
        """
        if source == "dict":
            table = self.weight_manager.create_from_dict(weight_table_data)
        elif source == "csv" and file_path:
            table = self.weight_manager.import_from_csv(
                file_path,
                weight_table_data.get("name", "评分权重表"),
                weight_table_data.get("version", "v1"),
            )
        elif source == "json" and file_path:
            table = self.weight_manager.import_from_json(file_path)
        else:
            raise ValueError(f"不支持的导入方式: {source}")

        self.weight_manager.activate_table(table.table_id)

        self._log_workflow(
            step="step1_import_weight_table",
            description=f"导入评分权重表: {table.name} (版本: {table.version})",
            data={"table_id": table.table_id, "rule_count": len(table.rules)},
        )
        return table

    def step2_import_sample_records(
        self, records_data: List[Dict[str, Any]]
    ) -> List[SampleRecord]:
        """第二步：导入样本记录数据"""
        weight_table = self.weight_manager.get_active_table()
        if not weight_table:
            raise RuntimeError("请先导入并激活评分权重表")

        records = []
        for data in records_data:
            record = SampleRecord(
                record_id=data.get("record_id", f"REC-{uuid.uuid4().hex[:8]}"),
                course_name=data["course_name"],
                teacher_name=data["teacher_name"],
                sample_size=data["sample_size"],
                pass_count=data["pass_count"],
                pass_rate=data.get("pass_rate", data["pass_count"] / data["sample_size"]),
                score=data["score"],
                data_source=DataSource.INITIAL_IMPORT,
                formula_version="v2",
            )
            records.append(record)
            self.records[record.record_id] = record

        processed_records = process_records(records, weight_table)

        self._log_workflow(
            step="step2_import_sample_records",
            description=f"导入并处理 {len(processed_records)} 条样本记录",
            data={
                "record_count": len(processed_records),
                "boundary_cases": [
                    r.record_id
                    for r in processed_records
                    if r.boundary_equal_to_threshold
                ],
            },
        )
        return processed_records

    def step3_process_old_formula_screenshot(
        self,
        screenshot_data: Dict[str, Any],
        target_record_id: str,
        uploaded_by: str = "运营规划阿岚",
    ) -> Tuple[CounterExample, SampleRecord]:
        """
        第三步：补录旧公式截图，反例列表自动更新

        运营规划阿岚补看旧公式截图后，系统自动：
        1. 生成反例记录
        2. 更新反例列表
        3. 创建旧口径记录
        """
        weight_table = self.weight_manager.get_active_table()
        if not weight_table:
            raise RuntimeError("请先导入并激活评分权重表")

        original_record = self.records.get(target_record_id)
        if not original_record:
            raise ValueError(f"目标记录不存在: {target_record_id}")

        screenshot_data["record_id"] = target_record_id
        screenshot_data["uploaded_by"] = uploaded_by

        screenshot = self.old_formula_handler.create_screenshot_from_dict(screenshot_data)
        counter_example, old_record = self.old_formula_handler.process_screenshot(
            screenshot.screenshot_id, original_record, weight_table
        )

        self.records[old_record.record_id] = old_record

        self._log_workflow(
            step="step3_process_old_formula_screenshot",
            description=f"处理旧公式截图，生成反例: {counter_example.case_id}",
            data={
                "screenshot_id": screenshot.screenshot_id,
                "counter_example_id": counter_example.case_id,
                "old_record_id": old_record.record_id,
                "issue_type": counter_example.issue_type,
            },
        )
        return counter_example, old_record

    def manual_fix_record(
        self,
        record_id: str,
        operator: str,
        new_status: RecordStatus,
        note: str,
    ) -> SampleRecord:
        """人工修正记录状态"""
        record = self.records.get(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        record.manual_fix(operator, new_status, note)

        self._log_workflow(
            step="manual_fix_record",
            description=f"人工修正记录 {record_id}: {record.status.value} -> {new_status.value}",
            data={
                "record_id": record_id,
                "operator": operator,
                "old_status": record.fix_history[-1]["before"],
                "new_status": new_status.value,
                "note": note,
            },
        )
        return record

    def rerun_single_record(
        self,
        record_id: str,
        operator: str,
        note: str = "",
    ) -> SampleRecord:
        """重跑单条记录"""
        weight_table = self.weight_manager.get_active_table()
        if not weight_table:
            raise RuntimeError("请先导入并激活评分权重表")

        record = self.records.get(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        rerun_record_obj = rerun_record(record, weight_table, operator, note)

        self._log_workflow(
            step="rerun_single_record",
            description=f"重跑记录 {record_id}",
            data={
                "record_id": record_id,
                "operator": operator,
                "note": note,
                "new_status": rerun_record_obj.status.value,
            },
        )
        return rerun_record_obj

    def get_boundary_cases(self) -> List[SampleRecord]:
        """获取所有边界值等于阈值、待任课老师复核的记录"""
        return [
            r
            for r in self.records.values()
            if r.boundary_equal_to_threshold and r.status == RecordStatus.NEED_REVIEW
        ]

    def get_abnormal_cases(self) -> List[SampleRecord]:
        """获取所有异常记录"""
        return [
            r
            for r in self.records.values()
            if r.status == RecordStatus.ABNORMAL
        ]

    def get_counter_examples(
        self, unresolved_only: bool = False
    ) -> List[CounterExample]:
        """获取反例列表"""
        return self.old_formula_handler.list_counter_examples(unresolved_only)

    def get_all_records(self) -> List[SampleRecord]:
        """获取所有记录"""
        return list(self.records.values())

    def get_record(self, record_id: str) -> Optional[SampleRecord]:
        """获取单条记录"""
        return self.records.get(record_id)

    def _log_workflow(self, step: str, description: str, data: Dict[str, Any]):
        """记录工作流历史"""
        self.workflow_history.append({
            "step": step,
            "description": description,
            "data": data,
            "timestamp": datetime.now().isoformat(),
        })

    def get_workflow_summary(self) -> Dict[str, Any]:
        """获取工作流执行摘要"""
        records = list(self.records.values())
        counter_examples = self.get_counter_examples()
        boundary_cases = self.get_boundary_cases()

        status_summary = {}
        for r in records:
            status = r.status.value
            status_summary[status] = status_summary.get(status, 0) + 1

        return {
            "total_records": len(records),
            "boundary_cases_count": len(boundary_cases),
            "counter_examples_count": len(counter_examples),
            "unresolved_counter_examples": len(
                self.get_counter_examples(unresolved_only=True)
            ),
            "status_summary": status_summary,
            "workflow_steps": len(self.workflow_history),
            "active_weight_table": (
                self.weight_manager.get_active_table().name
                if self.weight_manager.get_active_table()
                else None
            ),
        }
