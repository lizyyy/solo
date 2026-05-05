"""核心引擎模块 - 整合所有功能。"""

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .checker import IssueChecker
from .exporter import Exporter
from .loader import DataLoader
from .models import AnswerSheet, CheckResult, GradingBatch
from .recognizer import SheetRecognizer


class CheckEngine:
    """核查引擎。"""

    def __init__(self, work_dir: str = "."):
        self.work_dir = Path(work_dir)
        self.remarks_path = self.work_dir / ".remarks.json"

    def run_check(
        self,
        seat_table_path: str,
        sheets_folder: str,
        absent_list_path: str,
        grading_batch_path: str,
        preserve_remarks: bool = True,
    ) -> CheckResult:
        """
        执行完整的核查流程。

        Args:
            seat_table_path: 座位表 CSV 路径
            sheets_folder: 答题卡文件夹路径
            absent_list_path: 缺考签名单 CSV 路径
            grading_batch_path: 阅卷批次 JSON 路径
            preserve_remarks: 是否保留之前的备注

        Returns:
            检查结果
        """
        print("=" * 50)
        print("答题卡回收核查系统启动...")
        print("=" * 50)
        print()

        existing_remarks = {}
        if preserve_remarks and self.remarks_path.exists():
            existing_remarks = DataLoader.load_remarks(str(self.remarks_path))
            print(f"[加载] 读取到 {len(existing_remarks)} 条备注记录")

        print("[加载] 读取座位表...")
        student_roster = DataLoader.load_seat_table(seat_table_path)
        print(f"[加载] 共 {len(student_roster)} 名学生")

        print("[加载] 读取缺考名单...")
        absent_records = DataLoader.load_absent_list(absent_list_path)
        print(f"[加载] 共 {len(absent_records)} 名缺考学生")

        print("[加载] 读取阅卷批次信息...")
        grading_batch = DataLoader.load_grading_batch(grading_batch_path)
        print(f"[加载] 批次: {grading_batch.batch_id}")

        print("[扫描] 遍历答题卡文件夹...")
        file_paths = DataLoader.scan_sheets_folder(sheets_folder)
        print(f"[扫描] 共发现 {len(file_paths)} 个文件")

        print("[识别] 解析答题卡文件...")
        scanned_sheets = SheetRecognizer.recognize_all(file_paths)
        print(f"[识别] 成功识别 {len(scanned_sheets)} 个条码")

        print("[核查] 执行问题检测...")
        result = IssueChecker.check_all(
            scanned_sheets=scanned_sheets,
            student_roster=student_roster,
            absent_records=absent_records,
            grading_batch=grading_batch,
            remark_store=existing_remarks,
        )

        DataLoader.save_remarks(result.remark_store, str(self.remarks_path))

        self._print_summary(result)

        return result

    def _print_summary(self, result: CheckResult) -> None:
        """打印统计摘要。"""
        from .models import IssueSeverity

        print()
        print("=" * 50)
        print("核查完成！")
        print("=" * 50)
        print()

        total_issues = len(result.all_issues)
        critical = sum(1 for i in result.all_issues if i.severity == IssueSeverity.CRITICAL)
        major = sum(1 for i in result.all_issues if i.severity == IssueSeverity.MAJOR)
        minor = sum(1 for i in result.all_issues if i.severity == IssueSeverity.MINOR)

        print("问题汇总:")
        print(f"  - 严重问题 (🔴): {critical} 处")
        print(f"  - 重要问题 (🟠): {major} 处")
        print(f"  - 轻微问题 (🟡): {minor} 处")
        print(f"  - 合计: {total_issues} 处")
        print()

        print("按考场统计:")
        for room, stats in result.statistics.items():
            print(f"  [考场 {room}] 总人数: {stats.total_students}, "
                  f"实考: {stats.present_students}, "
                  f"缺考: {stats.absent_students}, "
                  f"已扫描: {stats.scanned_sheets}, "
                  f"漏扫: {stats.missing_sheets}")
        print()

    def save_remarks(self, remarks: Dict[str, str]) -> None:
        """保存备注。"""
        DataLoader.save_remarks(remarks, str(self.remarks_path))

    def load_remarks(self) -> Dict[str, str]:
        """加载备注。"""
        return DataLoader.load_remarks(str(self.remarks_path))

    def export_result(
        self,
        result: CheckResult,
        output_dir: Optional[str] = None,
        base_name: Optional[str] = None,
    ) -> tuple[str, str]:
        """
        导出结果。

        Args:
            result: 检查结果
            output_dir: 输出目录（默认工作目录下的 output）
            base_name: 基础文件名

        Returns:
            (markdown_path, json_path)
        """
        if output_dir is None:
            output_dir = self.work_dir / "output"
        else:
            output_dir = Path(output_dir)

        output_dir.mkdir(parents=True, exist_ok=True)

        md_path, json_path = Exporter.export_result(
            result=result,
            output_dir=str(output_dir),
            base_name=base_name,
        )

        print(f"[导出] Markdown 移交单: {md_path}")
        print(f"[导出] JSON 审计明细: {json_path}")

        return md_path, json_path

    @staticmethod
    def load_check_result(json_path: str) -> Dict:
        """
        从 JSON 加载检查结果。

        Args:
            json_path: JSON 文件路径

        Returns:
            结果字典
        """
        path = Path(json_path)
        if not path.exists():
            raise FileNotFoundError(f"检查结果文件不存在: {json_path}")

        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
