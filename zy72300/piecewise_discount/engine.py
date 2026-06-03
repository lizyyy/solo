from __future__ import annotations

from typing import Optional

from .models import (
    PiecewiseFunction,
    ScoringWeightTable,
    CalculationRecord,
    RecordStatus,
    BoundaryNote,
)
from .gap_detector import GapDetector
from .version_manager import VersionManager


class CalculationEngine:
    """
    核算引擎：把分段函数、评分权重表、断档检测、版本管理串起来。
    
    核心流程（和小祁跟教研组交接的说法一致）：
      1. 第一次导入：边界值说明进来了，评分权重表可能还没到
      2. 小祁补看评分权重表：到了之后补录，版本号 +1
      3. 参数版本页更新：每版参数都留快照
      4. 碰到编号断档：不急着归正常，标「断档待复核」，等教研组确认
    """

    def __init__(self) -> None:
        self.gap_detector = GapDetector()
        self.version_manager = VersionManager()
        self.records: list[CalculationRecord] = []
        self.boundary_notes: list[BoundaryNote] = []
        self._functions: dict[str, PiecewiseFunction] = {}
        self._weight_tables: dict[str, ScoringWeightTable] = {}

    # ── 导入 ──────────────────────────────────────────

    def import_function(self, func: PiecewiseFunction) -> None:
        self._functions[func.name] = func

    def import_weight_table(
        self,
        table: ScoringWeightTable,
        remark: str = "",
    ) -> None:
        self._weight_tables[table.name] = table
        self.version_manager.register(table, remark=remark or "首次导入")

    def import_boundary_notes(self, notes: list[BoundaryNote]) -> None:
        self.boundary_notes.extend(notes)

    # ── 补录评分权重表 ────────────────────────────────

    def supplement_weight_table(
        self,
        table_name: str,
        new_entries: list,
        remark: str = "",
    ) -> Optional[CalculationRecord]:
        table = self._weight_tables.get(table_name)
        if table is None:
            return None
        self.version_manager.supplement(table, new_entries, remark=remark)
        return None

    # ── 单笔核算 ─────────────────────────────────────

    def calculate(
        self,
        record_id: str,
        original_price: float,
        function_name: str,
        weight_table_name: str,
        remark: str = "",
    ) -> CalculationRecord:
        func = self._functions.get(function_name)
        table = self._weight_tables.get(weight_table_name)

        if func is None:
            return CalculationRecord(
                record_id=record_id,
                original_price=original_price,
                score=0.0,
                function_name=function_name,
                weight_table_name=weight_table_name,
                weight_table_version=0,
                seg_no=None,
                discount_rate=None,
                final_price=original_price,
                status=RecordStatus.NORMAL,
                remark=remark or "未找到分段函数",
            )

        score = 0.0
        wt_version = 0
        if table is not None:
            score = table.total_weighted_score()
            wt_version = table.version

        seg, final_price = func.apply(score, original_price)

        status = RecordStatus.NORMAL
        gap_detail: Optional[str] = None

        gap_status, gap_msg = self.gap_detector.check_and_mark(
            func, seg.seg_no if seg else None
        )
        if gap_status != RecordStatus.NORMAL:
            status = gap_status
            gap_detail = gap_msg

        record = CalculationRecord(
            record_id=record_id,
            original_price=original_price,
            score=score,
            function_name=function_name,
            weight_table_name=weight_table_name,
            weight_table_version=wt_version,
            seg_no=seg.seg_no if seg else None,
            discount_rate=seg.discount_rate if seg else None,
            final_price=final_price,
            status=status,
            gap_detail=gap_detail,
            remark=remark,
        )
        self.records.append(record)
        return record

    # ── 重跑 ─────────────────────────────────────────

    def recalculate(
        self,
        record_id: str,
        mark_old_caliber: bool = False,
    ) -> Optional[CalculationRecord]:
        old = self._find_record(record_id)
        if old is None:
            return None

        new = self.calculate(
            record_id=f"{record_id}_重跑",
            original_price=old.original_price,
            function_name=old.function_name,
            weight_table_name=old.weight_table_name,
            remark=f"基于原记录 {record_id} 重跑",
        )

        if mark_old_caliber and new.weight_table_version != old.weight_table_version:
            old.status = RecordStatus.SUPPLEMENTED_OLD_CALIBER
            old.remark = (
                f"原口径：分段={old.seg_no}, 折扣={old.discount_rate}, "
                f"评分={old.score}, 实付={old.final_price}（参数版本v{old.weight_table_version}）"
            )

        return new

    def _find_record(self, record_id: str) -> Optional[CalculationRecord]:
        for r in reversed(self.records):
            if r.record_id == record_id:
                return r
        return None

    # ── 输出 ─────────────────────────────────────────

    def format_boundary_notes(self) -> str:
        if not self.boundary_notes:
            return "（暂无边界值说明）"
        lines = ["边界值说明", "-" * 40]
        for n in self.boundary_notes:
            lines.append(f"  {n.boundary}: {n.explanation}  [批次={n.import_batch}]")
        return "\n".join(lines)

    def format_records(self) -> str:
        if not self.records:
            return "（暂无核算记录）"
        lines = ["核算记录", "=" * 60]
        for r in self.records:
            lines.append(f"  {r.summary_line()}")
        return "\n".join(lines)

    def format_gap_report(self) -> str:
        lines = ["断档检查报告", "-" * 40]
        found = False
        for name, func in self._functions.items():
            result = self.gap_detector.detect(func)
            if result.has_gap:
                found = True
                lines.append(f"  函数「{name}」: {result.format_detail()}")
        if not found:
            lines.append("  所有分段函数编号连续，无断档。")
        return "\n".join(lines)
