from typing import List, Optional, Dict, Any
from pathlib import Path
import pandas as pd

from .anomaly_decomposer import TimeSeriesAnomalyDecomposer
from .audit_trail import AuditTrail
from .data_models import (
    AnomalyResult,
    AnomalyType,
    ProcessStatus,
    UnifiedDataExporter,
    ReviewRecord,
    FieldMapping,
)
from .state_store import StateStore, AuditRecord


class DecompositionPipeline:
    """基于 StateStore 的三步流水线：
    step1 导入 -> step2 加批注 -> step3 复核并最终确认

    所有读写都从 StateStore 同一个入口，保证
    列表 / 详情 / 摘要 / 历史 / 导出 读同一份最新数据。
    """

    def __init__(self, workdir: str = "./output"):
        self.workdir = workdir
        self.decomposer = TimeSeriesAnomalyDecomposer()
        self.audit_trail = AuditTrail()
        self.store = StateStore(workdir=workdir)

    # ------------------------------------------------------------------
    # 步骤1：多源导入（CSV / Excel 任一种）
    # ------------------------------------------------------------------
    def step1_import_from_file(
        self,
        filepath: str,
        actor: str = "数据分析师小祁",
        screenshot_ref_prefix: str = "screenshot_",
        mapping: Optional[FieldMapping] = None,
    ) -> List[AnomalyResult]:
        if not Path(filepath).exists():
            raise FileNotFoundError(f"文件不存在: {filepath}")

        results = self.decomposer.decompose_file(filepath, mapping=mapping)

        for result in results:
            if result.source_screenshot_ref is None or result.source_screenshot_ref == "":
                result.source_screenshot_ref = f"{screenshot_ref_prefix}{result.row_number:03d}"
            self.audit_trail.add_result(result)

        # 写入 state store，并打 audit
        self.store.upsert_results(results, actor=actor, description=f"import from {Path(filepath).name}")
        self.store.add_import_source(str(Path(filepath).resolve()), actor=actor)

        for r in results:
            self.store.append_audit(
                AuditRecord(
                    row_number=r.row_number,
                    action="import",
                    old_status=None,
                    new_status=ProcessStatus.IMPORTED,
                    actor=actor,
                    details={"screenshot_ref": r.source_screenshot_ref, "source": r.import_source},
                    comment="从旧公式截图导入数据",
                )
            )

        self.store.set_pipeline_step(1, actor=actor)
        print(f"步骤1完成: 导入了 {len(results)} 条记录 (来源: {Path(filepath).name})")
        self._print_step1_notices(results)
        return self.store.get_results()

    def step1_import_from_csv(
        self,
        filepath: str,
        actor: str = "数据分析师小祁",
        screenshot_ref_prefix: str = "screenshot_",
    ) -> List[AnomalyResult]:
        return self.step1_import_from_file(filepath, actor, screenshot_ref_prefix)

    def step1_import_from_dataframe(
        self,
        df: pd.DataFrame,
        actor: str = "数据分析师小祁",
        screenshot_ref_prefix: str = "screenshot_",
    ) -> List[AnomalyResult]:
        results = self.decomposer.decompose_dataframe(df)

        for result in results:
            if result.source_screenshot_ref is None or result.source_screenshot_ref == "":
                result.source_screenshot_ref = f"{screenshot_ref_prefix}{result.row_number:03d}"
            self.audit_trail.add_result(result)

        self.store.upsert_results(results, actor=actor, description="import from dataframe")
        for r in results:
            self.store.append_audit(
                AuditRecord(
                    row_number=r.row_number,
                    action="import",
                    old_status=None,
                    new_status=ProcessStatus.IMPORTED,
                    actor=actor,
                    details={"screenshot_ref": r.source_screenshot_ref},
                    comment="从旧公式截图导入数据",
                )
            )
        self.store.set_pipeline_step(1, actor=actor)

        print(f"步骤1完成: 导入了 {len(results)} 条记录")
        self._print_step1_notices(results)
        return self.store.get_results()

    def _print_step1_notices(self, results: List[AnomalyResult]) -> None:
        pv = [r for r in results if r.anomaly_type == AnomalyType.PENDING_VERIFICATION]
        bc = [r for r in results if r.anomaly_type == AnomalyType.BOUNDARY_CASE]
        if pv:
            print(f"\n⚠️  发现 {len(pv)} 条 分母为0却被填成空字符串 的 PENDING_VERIFICATION 待复核记录:")
            for case in pv[:8]:
                print(f"   行号 {case.row_number}: {case.metric_name} (原始分母='{case.raw_denominator}')")
        if bc:
            print(f"\n发现 {len(bc)} 条其他边界案例")

    # ------------------------------------------------------------------
    # 步骤2：数据分析师小祁 补看老师批注
    # ------------------------------------------------------------------
    def step2_add_teacher_comments(
        self,
        comments: Dict[int, str],
        actor: str = "数据分析师小祁",
    ) -> int:
        if self.store.metadata.pipeline_step < 1:
            raise RuntimeError("请先执行步骤1: 导入数据")

        count = 0
        for row_number, comment in comments.items():
            row_num = int(row_number)

            def mutate(r: AnomalyResult, _c=comment) -> None:
                r.teacher_comment = _c
                r.process_status = ProcessStatus.PENDING_REVIEW

            updated = self.store.update_single(
                row_num,
                actor=actor,
                description=f"add teacher comment row={row_num}",
                mutator=mutate,
            )
            if updated is None:
                continue
            self.store.append_audit(
                AuditRecord(
                    row_number=row_num,
                    action="add_teacher_comment",
                    old_status=ProcessStatus.IMPORTED,
                    new_status=ProcessStatus.PENDING_REVIEW,
                    actor=actor,
                    details={"comment": comment},
                    comment="数据分析师小祁补充老师批注，进入待复核状态",
                )
            )
            # 同步到 audit_trail（向后兼容）
            existing = self.audit_trail.get_result(row_num)
            if existing is None:
                self.audit_trail.add_result(updated)
            self.audit_trail.record_teacher_comment_added(row_num, actor, comment)
            count += 1

        self.store.set_pipeline_step(2, actor=actor)
        print(f"步骤2完成: 添加了 {count} 条老师批注")
        print("注意: 分母为0填空字符串的记录保持 PENDING_VERIFICATION，不自动归正常，留给数据复核人")
        self._print_pending()
        return count

    def step2_add_comments_from_dataframe(
        self,
        df: pd.DataFrame,
        row_number_col: str = "row_number",
        comment_col: str = "teacher_comment",
        actor: str = "数据分析师小祁",
    ) -> int:
        if self.store.metadata.pipeline_step < 1:
            raise RuntimeError("请先执行步骤1: 导入数据")

        comments = {}
        for _, row in df.iterrows():
            row_num = int(row[row_number_col])
            comment = str(row.get(comment_col, ""))
            if comment and comment.strip() and comment.strip().lower() != "nan":
                comments[row_num] = comment

        return self.step2_add_teacher_comments(comments, actor)

    def _print_pending(self) -> None:
        all_r = self.store.get_results()
        pv = [r for r in all_r if r.anomaly_type == AnomalyType.PENDING_VERIFICATION]
        pr = [r for r in all_r if r.process_status == ProcessStatus.PENDING_REVIEW]
        if pv:
            print(f"  PENDING_VERIFICATION(分母0空字符串) {len(pv)} 条:")
            for r in pv[:5]:
                print(f"    行号 {r.row_number}: {r.metric_name}")
        if pr:
            print(f"  PENDING_REVIEW(待复核) {len(pr)} 条")

    # ------------------------------------------------------------------
    # 步骤3：复核 + 课堂演示结果更新
    # ------------------------------------------------------------------
    def step3_review_with_records(
        self,
        review_records: Dict[int, ReviewRecord],
        actor_prefix: str = "数据复核人",
    ) -> int:
        if self.store.metadata.pipeline_step < 2:
            raise RuntimeError("请先执行步骤2: 添加老师批注")
        count = 0
        for row_number, rev in review_records.items():
            applied = self.store.apply_review(int(row_number), rev)
            if applied is not None:
                # 同步到旧的 audit_trail
                self.audit_trail.add_result(applied)
                self.audit_trail.record_review_complete(
                    int(row_number),
                    rev.reviewed_by or actor_prefix,
                    rev.review_note or rev.review_reason,
                    rev.anomaly_type_after_review,
                )
                count += 1
        print(f"已完成人工复核记录: {count} 条")
        return count

    def step3_review_decisions_dict(
        self,
        review_decisions: Dict[int, Dict[str, Any]],
        default_reviewer: str = "数据复核人",
    ) -> int:
        records: Dict[int, ReviewRecord] = {}
        for row_number, d in review_decisions.items():
            at = d.get("final_anomaly_type", AnomalyType.NORMAL)
            if isinstance(at, str):
                at = AnomalyType(at)
            records[int(row_number)] = ReviewRecord(
                reviewed_by=d.get("reviewed_by") or default_reviewer,
                original_statement=d.get("original_statement", ""),
                corrected_value=d.get("corrected_value"),
                review_reason=d.get("review_reason", d.get("review_note", "")),
                next_owner=d.get("next_owner", ""),
                review_note=d.get("review_note", ""),
                anomaly_type_after_review=at,
            )
        return self.step3_review_with_records(records, default_reviewer)

    def step3_finalize_all(
        self,
        actor: str = "课堂演示",
    ) -> int:
        if self.store.metadata.pipeline_step < 2:
            raise RuntimeError("请先执行步骤2: 添加老师批注")

        all_r = self.store.get_results()
        finalized_count = 0
        skipped_pv = 0
        for r in all_r:
            if r.anomaly_type == AnomalyType.PENDING_VERIFICATION:
                skipped_pv += 1
                continue
            if r.process_status == ProcessStatus.PENDING_REVIEW:
                self.store.apply_review(
                    r.row_number,
                    ReviewRecord(
                        reviewed_by=actor,
                        original_statement="自动确认（非分母0空字符串边界）",
                        corrected_value=r.denominator,
                        review_reason="自动确认",
                        next_owner="-",
                        review_note="自动确认",
                        anomaly_type_after_review=r.anomaly_type,
                    ),
                )
            try:
                self.store.apply_finalize(r.row_number, actor=actor)
                finalized_count += 1
                self.audit_trail.record_finalize(r.row_number, actor)
            except ValueError:
                skipped_pv += 1

        self.store.set_pipeline_step(3, actor=actor)
        print(f"步骤3完成: 最终确认了 {finalized_count} 条记录")
        if skipped_pv:
            print(f"  跳过 {skipped_pv} 条 PENDING_VERIFICATION（分母为0填空字符串）：留待数据复核人复核，未提前归正常")
        return finalized_count

    # ------------------------------------------------------------------
    # 辅助动作：人工修改 / 回滚
    # ------------------------------------------------------------------
    def manual_modify_record(
        self,
        row_number: int,
        field_name: str,
        new_value: Any,
        reason: str,
        actor: str = "数据分析师小祁",
    ) -> Optional[AnomalyResult]:
        res = self.store.apply_manual_modification(
            row_number, actor, field_name, new_value, reason
        )
        if res is not None:
            self.audit_trail.add_result(res)
            self.audit_trail.record_manual_modification(
                row_number, actor, field_name, "", new_value, reason
            )
        return res

    def rollback_record(
        self,
        row_number: int,
        reason: str,
        actor: str = "系统管理员",
    ) -> Optional[AnomalyResult]:
        res = self.store.apply_rollback(row_number, actor, reason)
        if res:
            self.audit_trail.add_result(res)
            self.audit_trail.record_rollback(row_number, actor, reason)
        return res

    # ------------------------------------------------------------------
    # 统一出口：明细/详情/摘要/导出 全部走 store
    # ------------------------------------------------------------------
    def get_exporter(self) -> UnifiedDataExporter:
        return self.store.get_exporter()

    def export_results(
        self,
        output_dir: Optional[str] = None,
        base_filename: str = "timeseries_anomaly",
    ) -> Dict[str, str]:
        target_dir = Path(output_dir) if output_dir else Path(self.workdir)
        target_dir.mkdir(parents=True, exist_ok=True)

        exporter = self.get_exporter()
        csv_path = target_dir / f"{base_filename}.csv"
        flat_csv_path = target_dir / f"{base_filename}_flat.csv"
        excel_path = target_dir / f"{base_filename}.xlsx"
        audit_path = target_dir / f"{base_filename}_audit_trail.json"

        exporter.export_to_csv(str(csv_path), flat=False)
        exporter.export_to_csv(str(flat_csv_path), flat=True)
        exporter.export_to_excel(str(excel_path))

        # 完整审计 = state_store 审计（新）+ audit_trail（兼容）
        combined = [a.to_dict() for a in self.store.get_audit_trail()]
        if not combined:
            combined = [a.to_dict() for a in self.audit_trail.get_full_audit_trail()]
        import json
        with open(audit_path, "w", encoding="utf-8") as f:
            json.dump(combined, f, ensure_ascii=False, indent=2)

        return {
            "csv": str(csv_path),
            "flat_csv": str(flat_csv_path),
            "excel": str(excel_path),
            "audit_trail": str(audit_path),
        }

    def print_summary(self) -> None:
        from rich.console import Console
        from rich.table import Table

        console = Console()
        summary = self.store.get_summary()

        print(f"\n{'='*60}")
        print(f"流水线当前步骤: {self.store.metadata.pipeline_step}")
        print(f"State 版本: {self.store.metadata.current_version}  最近修改: {self.store.metadata.last_modified_at}")
        print('='*60)

        t1 = Table(title="处理状态汇总")
        t1.add_column("状态", style="cyan")
        t1.add_column("数量", justify="right", style="magenta")
        for status, cnt in sorted(summary.by_process_status.items()):
            t1.add_row(status, str(cnt))
        console.print(t1)

        t2 = Table(title="异常类型汇总")
        t2.add_column("异常类型", style="cyan")
        t2.add_column("数量", justify="right", style="magenta")
        for at, cnt in sorted(summary.by_anomaly_type.items()):
            t2.add_row(at, str(cnt))
        console.print(t2)

        print(f"\n待验证(分母0空字符串): {summary.pending_verification_count} | "
              f"待复核: {summary.pending_review_count} | 已确认: {summary.finalized_count} | "
              f"修改次数: {summary.manual_modifications_total} | 复核记录: {summary.review_records_total}")
        print('='*60)

    def consistency_report(self, row_number: Optional[int] = None) -> Dict[str, Any]:
        return self.store.consistency_check(row_number=row_number)

    # ------------------------------------------------------------------
    # 兼容：旧接口仍可用
    # ------------------------------------------------------------------
    def get_row_audit_history(self, row_number: int) -> list:
        primary = self.store.get_audit_trail(row_number=row_number)
        if primary:
            return [r.to_dict() for r in primary]
        return [r.to_dict() for r in self.audit_trail.get_audit_trail_for_row(row_number)]

    def run_full_pipeline(
        self,
        input_file: str,
        comments: Dict[int, str],
        output_dir: Optional[str] = None,
        review_decisions: Optional[Dict[int, Dict[str, Any]]] = None,
    ) -> Dict[str, str]:
        print("开始执行完整流水线（统一 StateStore 闭环）...")
        self.step1_import_from_file(input_file)
        self.step2_add_teacher_comments(comments)

        if review_decisions:
            self.step3_review_decisions_dict(review_decisions)

        self.step3_finalize_all()

        exported_files = self.export_results(output_dir=output_dir)
        print(f"\n导出文件(全部基于同一份 StateStore 最新快照):")
        for name, path in exported_files.items():
            print(f"  {name}: {path}")
        return exported_files
