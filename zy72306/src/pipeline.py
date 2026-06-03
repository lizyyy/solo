from typing import List, Optional, Callable
import pandas as pd
from pathlib import Path

from .anomaly_decomposer import TimeSeriesAnomalyDecomposer
from .audit_trail import AuditTrail
from .data_models import (
    AnomalyResult,
    AnomalyType,
    ProcessStatus,
    UnifiedDataExporter
)


class DecompositionPipeline:
    def __init__(self):
        self.decomposer = TimeSeriesAnomalyDecomposer()
        self.audit_trail = AuditTrail()
        self._current_step = 0
        self._pipeline_steps = [
            "step1_import",
            "step2_add_comments",
            "step3_review_and_finalize"
        ]

    @property
    def current_step(self) -> int:
        return self._current_step

    @property
    def current_step_name(self) -> str:
        if 0 <= self._current_step < len(self._pipeline_steps):
            return self._pipeline_steps[self._current_step]
        return "completed"

    def step1_import_from_csv(
        self,
        filepath: str,
        actor: str = "数据分析师小祁",
        screenshot_ref_prefix: str = "screenshot_"
    ) -> List[AnomalyResult]:
        if not Path(filepath).exists():
            raise FileNotFoundError(f"文件不存在: {filepath}")

        df = pd.read_csv(filepath)
        results = self.decomposer.decompose_dataframe(df)

        for result in results:
            self.audit_trail.add_result(result)
            screenshot_ref = f"{screenshot_ref_prefix}{result.row_number:03d}"
            self.audit_trail.record_import(
                row_number=result.row_number,
                actor=actor,
                screenshot_ref=screenshot_ref
            )

        self._current_step = 1
        print(f"步骤1完成: 导入了 {len(results)} 条记录")
        self.print_pending_items()
        return results

    def step1_import_from_dataframe(
        self,
        df: pd.DataFrame,
        actor: str = "数据分析师小祁",
        screenshot_ref_prefix: str = "screenshot_"
    ) -> List[AnomalyResult]:
        results = self.decomposer.decompose_dataframe(df)

        for result in results:
            self.audit_trail.add_result(result)
            screenshot_ref = f"{screenshot_ref_prefix}{result.row_number:03d}"
            self.audit_trail.record_import(
                row_number=result.row_number,
                actor=actor,
                screenshot_ref=screenshot_ref
            )

        self._current_step = 1
        print(f"步骤1完成: 导入了 {len(results)} 条记录")
        self.print_pending_items()
        return results

    def step2_add_teacher_comments(
        self,
        comments: dict,
        actor: str = "数据分析师小祁"
    ) -> int:
        if self._current_step < 1:
            raise RuntimeError("请先执行步骤1: 导入数据")

        count = 0
        for row_number, comment in comments.items():
            row_num = int(row_number)
            self.audit_trail.record_teacher_comment_added(
                row_number=row_num,
                actor=actor,
                comment=comment
            )
            count += 1

        self._current_step = 2
        print(f"步骤2完成: 添加了 {count} 条老师批注")
        print(f"注意: 分母为0填空字符串的记录已标记为待复核，未自动归为正常")
        self.print_pending_review()
        return count

    def step2_add_comments_from_dataframe(
        self,
        df: pd.DataFrame,
        row_number_col: str = "row_number",
        comment_col: str = "teacher_comment",
        actor: str = "数据分析师小祁"
    ) -> int:
        if self._current_step < 1:
            raise RuntimeError("请先执行步骤1: 导入数据")

        comments = {}
        for _, row in df.iterrows():
            row_num = int(row[row_number_col])
            comment = str(row.get(comment_col, ""))
            if comment and comment.strip():
                comments[row_num] = comment

        return self.step2_add_teacher_comments(comments, actor)

    def step3_review_records(
        self,
        review_decisions: dict,
        actor: str = "数据复核人"
    ) -> int:
        if self._current_step < 2:
            raise RuntimeError("请先执行步骤2: 添加老师批注")

        count = 0
        for row_number, decision in review_decisions.items():
            row_num = int(row_number)
            review_note = decision.get("review_note", "")
            final_type = decision.get("final_anomaly_type", AnomalyType.NORMAL)

            if isinstance(final_type, str):
                final_type = AnomalyType(final_type)

            self.audit_trail.record_review_complete(
                row_number=row_num,
                actor=actor,
                review_note=review_note,
                final_anomaly_type=final_type
            )
            count += 1

        return count

    def step3_finalize_all(
        self,
        actor: str = "课堂演示"
    ) -> int:
        if self._current_step < 2:
            raise RuntimeError("请先执行步骤2: 添加老师批注")

        pending_review = self.audit_trail.get_pending_review_rows()
        for result in pending_review:
            if result.anomaly_type != AnomalyType.PENDING_VERIFICATION:
                self.audit_trail.record_review_complete(
                    row_number=result.row_number,
                    actor=actor,
                    review_note="自动确认",
                    final_anomaly_type=result.anomaly_type
                )

        all_results = self.audit_trail.get_all_results()
        finalized_count = 0
        for result in all_results:
            if result.process_status == ProcessStatus.REVIEWED:
                self.audit_trail.record_finalize(
                    row_number=result.row_number,
                    actor=actor
                )
                finalized_count += 1

        self._current_step = 3
        print(f"步骤3完成: 最终确认了 {finalized_count} 条记录")
        return finalized_count

    def manual_modify_record(
        self,
        row_number: int,
        field_name: str,
        new_value: any,
        reason: str,
        actor: str = "数据分析师小祁"
    ) -> None:
        result = self.audit_trail.get_result(row_number)
        if not result:
            raise ValueError(f"找不到行号为 {row_number} 的记录")

        old_value = getattr(result, field_name, None)
        self.audit_trail.record_manual_modification(
            row_number=row_number,
            actor=actor,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            reason=reason
        )

    def rollback_record(
        self,
        row_number: int,
        reason: str,
        actor: str = "系统管理员"
    ) -> None:
        self.audit_trail.record_rollback(row_number, actor, reason)

    def get_unified_exporter(self) -> UnifiedDataExporter:
        results = self.audit_trail.get_all_results()
        return UnifiedDataExporter(results)

    def export_results(
        self,
        output_dir: str,
        base_filename: str = "timeseries_anomaly"
    ) -> dict:
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        exporter = self.get_unified_exporter()

        csv_path = Path(output_dir) / f"{base_filename}.csv"
        excel_path = Path(output_dir) / f"{base_filename}.xlsx"
        audit_path = Path(output_dir) / f"{base_filename}_audit_trail.json"

        exporter.export_to_csv(str(csv_path))
        exporter.export_to_excel(str(excel_path))
        self.audit_trail.export_audit_trail_to_json(str(audit_path))

        return {
            "csv": str(csv_path),
            "excel": str(excel_path),
            "audit_trail": str(audit_path)
        }

    def print_pending_items(self) -> None:
        boundary_cases = self.audit_trail.get_boundary_case_rows()
        if boundary_cases:
            print(f"\n发现 {len(boundary_cases)} 条边界案例:")
            for case in boundary_cases[:5]:
                print(f"  - 行号 {case.row_number}: {case.metric_name} "
                      f"(原始分母: '{case.raw_denominator}')")
            if len(boundary_cases) > 5:
                print(f"  ... 还有 {len(boundary_cases) - 5} 条")

    def print_pending_review(self) -> None:
        pending = self.audit_trail.get_pending_review_rows()
        if pending:
            print(f"\n待复核记录 ({len(pending)} 条):")
            for item in pending[:5]:
                print(f"  - 行号 {item.row_number}: {item.metric_name} "
                      f"[异常类型: {item.anomaly_type.value}]")
            if len(pending) > 5:
                print(f"  ... 还有 {len(pending) - 5} 条")

    def print_summary(self) -> None:
        print(f"\n{'='*60}")
        print(f"流水线当前步骤: {self._current_step} - {self.current_step_name}")
        print('='*60)
        self.audit_trail.print_summary()
        print('='*60)

    def get_row_audit_history(self, row_number: int) -> list:
        return self.audit_trail.get_audit_trail_for_row(row_number)

    def run_full_pipeline(
        self,
        input_csv: str,
        comments: dict,
        output_dir: str,
        review_decisions: Optional[dict] = None
    ) -> dict:
        print("开始执行完整流水线...")

        self.step1_import_from_csv(input_csv)
        self.step2_add_teacher_comments(comments)

        if review_decisions:
            self.step3_review_records(review_decisions)

        self.step3_finalize_all()

        exported_files = self.export_results(output_dir)
        print(f"\n导出文件:")
        for name, path in exported_files.items():
            print(f"  {name}: {path}")

        return exported_files
