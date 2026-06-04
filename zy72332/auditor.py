from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import os

from models import (
    StoreGroupingRecord, GroupingResult, AuditTrail,
    RecordStatus, ProcessingType
)
from store import DataStore


class AuditExporter:
    """复盘记录导出器 - 生成可追溯的完整流程记录"""

    def __init__(self, store: DataStore):
        self.store = store

    def export_audit_trail(self, record_id: str, output_dir: str = "audit_reports") -> str:
        """导出单条记录的完整复盘记录"""
        os.makedirs(output_dir, exist_ok=True)

        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        audit = self.store.get_audit_trail_by_record(record_id)
        result = self.store.get_grouping_result(record_id)

        report = self._build_audit_report(record, audit, result)

        output_path = os.path.join(output_dir, f"audit_{record_id}_{datetime.now().strftime('%Y%m%d')}.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2, default=str)

        return output_path

    def export_all_audit_trails(self, output_dir: str = "audit_reports") -> List[str]:
        """导出所有记录的复盘记录"""
        records = self.store.get_all_records()
        exported = []
        for record in records:
            path = self.export_audit_trail(record.record_id, output_dir)
            exported.append(path)
        return exported

    def generate_summary_report(self, output_dir: str = "audit_reports") -> str:
        """生成所有记录的汇总对比报告 - 展示三种处理结果的差异"""
        os.makedirs(output_dir, exist_ok=True)

        records = self.store.get_all_records()
        results = self.store.get_all_results()

        summary = {
            "generated_at": datetime.now(),
            "total_records": len(records),
            "records_by_type": {},
            "results_comparison": [],
            "key_findings": []
        }

        type_counts = {}
        for record in records:
            ptype = record.processing_type.value
            if ptype not in type_counts:
                type_counts[ptype] = 0
            type_counts[ptype] += 1
        summary["records_by_type"] = type_counts

        for result in results:
            record = self.store.get_record(result.record_id)
            comparison = {
                "record_id": result.record_id,
                "store_name": record.store_name if record else "未知",
                "processing_type": result.processing_type.value,
                "final_group": result.final_group,
                "confidence": result.confidence,
                "status": result.status.value,
                "error_explanation": result.error_explanation,
                "re_run_count": record.re_run_count if record else 0,
                "has_annotations": len(record.annotations) > 0 if record else False,
                "has_duplicates": record.has_duplicate_answers() if record else False
            }
            summary["results_comparison"].append(comparison)

        summary["key_findings"] = self._generate_key_findings(records, results)

        output_path = os.path.join(output_dir, f"summary_report_{datetime.now().strftime('%Y%m%d')}.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2, default=str)

        return output_path

    def _build_audit_report(self, record: StoreGroupingRecord,
                            audit: Optional[AuditTrail],
                            result: Optional[GroupingResult]) -> Dict[str, Any]:
        """构建完整的复盘报告"""
        return {
            "report_generated_at": datetime.now(),
            "record_summary": {
                "record_id": record.record_id,
                "store_id": record.store_id,
                "store_name": record.store_name,
                "processing_type": record.processing_type.value,
                "current_status": record.status.value,
                "created_at": record.created_at,
                "updated_at": record.updated_at,
                "final_group": record.final_group,
                "re_run_count": record.re_run_count,
                "manual_correction_note": record.manual_correction_note
            },
            "error_explanation": {
                "current": record.error_explanation.current_text,
                "history": record.error_explanation.history,
                "last_updated_at": record.error_explanation.last_updated_at,
                "updated_by": record.error_explanation.updated_by
            },
            "screenshots": [
                {
                    "screenshot_id": s.screenshot_id,
                    "file_path": s.file_path,
                    "description": s.description,
                    "imported_at": s.imported_at,
                    "formula_text": s.formula_text
                } for s in record.screenshot_refs
            ],
            "student_answers": [
                {
                    "answer_id": a.answer_id,
                    "student_id": a.student_id,
                    "student_name": a.student_name,
                    "submission_time": a.submission_time,
                    "version": a.version,
                    "is_duplicate": a.is_duplicate,
                    "content": a.content
                } for a in record.student_answers
            ],
            "teacher_annotations": [
                {
                    "annotation_id": a.annotation_id,
                    "teacher_name": a.teacher_name,
                    "content": a.content,
                    "annotated_at": a.annotated_at,
                    "old_standard_reference": a.old_standard_reference,
                    "error_explanation_update": a.error_explanation_update
                } for a in record.annotations
            ],
            "operation_log": record.operation_log,
            "audit_trail_events": audit.events if audit else [],
            "grouping_result": {
                "final_group": result.final_group if result else None,
                "confidence": result.confidence if result else None,
                "generated_at": result.generated_at if result else None,
                "reviewed_by": result.reviewed_by if result else None
            } if result else None,
            "replay_commands": self._generate_replay_commands(record)
        }

    def _generate_replay_commands(self, record: StoreGroupingRecord) -> List[str]:
        """生成可重新跑的命令列表"""
        commands = [
            f"# 复盘记录: {record.store_name} ({record.record_id})",
            f"# 处理类型: {record.processing_type.value}",
            "",
            "# 1. 初始化数据并创建记录",
            f"python cli.py create --store-id {record.store_id} --store-name '{record.store_name}' --processing-type {record.processing_type.name}",
            "",
            "# 2. 导入旧公式截图",
        ]

        for s in record.screenshot_refs:
            commands.append(
                f"python cli.py import-screenshot --record-id {record.record_id} "
                f"--path '{s.file_path}' --formula '{s.formula_text}' --desc '{s.description}'"
            )

        commands.extend([
            "",
            "# 3. 导入学生答案",
            f"python cli.py import-answers --record-id {record.record_id} "
            f"--answers-json data/records/{record.record_id}.json",
        ])

        if record.has_duplicate_answers():
            commands.extend([
                "",
                "# 4. 标记待业务运营复核（检测到重复答案）",
                f"python cli.py mark-review --record-id {record.record_id}",
            ])

        if record.annotations:
            commands.extend([
                "",
                "# 5. 补录老师批注",
            ])
            for a in record.annotations:
                old_std = f"--old-standard '{a.old_standard_reference}'" if a.old_standard_reference else ""
                err_upd = f"--error-update '{a.error_explanation_update}'" if a.error_explanation_update else ""
                commands.append(
                    f"python cli.py add-annotation --record-id {record.record_id} "
                    f"--teacher '{a.teacher_name}' --content '{a.content}' {old_std} {err_upd}"
                )

        if record.manual_correction_note:
            commands.extend([
                "",
                "# 6. 人工修正",
                f"python cli.py manual-correct --record-id {record.record_id} "
                f"--note '{record.manual_correction_note}'",
            ])

        commands.extend([
            "",
            "# 7. 运行分群算法",
            f"python cli.py run-grouping --record-id {record.record_id}",
        ])

        if record.re_run_count > 1:
            for i in range(1, record.re_run_count):
                commands.append(
                    f"python cli.py re-run --record-id {record.record_id}"
                )

        commands.extend([
            "",
            "# 8. 导出复盘记录",
            f"python cli.py export-audit --record-id {record.record_id}",
            "",
            "# 9. 查看记录详情",
            f"python cli.py show --record-id {record.record_id}",
        ])

        return commands

    def _generate_key_findings(self, records: List[StoreGroupingRecord],
                               results: List[GroupingResult]) -> List[str]:
        """生成关键发现"""
        findings = []

        smooth_records = [r for r in records if r.processing_type == ProcessingType.SMOOTH]
        duplicate_records = [r for r in records if r.processing_type == ProcessingType.DUPLICATE]
        old_std_records = [r for r in records if r.processing_type == ProcessingType.OLD_STANDARD_SUPPLEMENT]

        findings.append(f"本次共处理 {len(records)} 条门店分群记录")
        findings.append(f"  - 顺利记录: {len(smooth_records)} 条")
        findings.append(f"  - 同一学生两版答案: {len(duplicate_records)} 条")
        findings.append(f"  - 老师批注补录旧口径: {len(old_std_records)} 条")

        pending_review = [r for r in records if r.status == RecordStatus.PENDING_REVIEW]
        if pending_review:
            findings.append(f"⚠️  {len(pending_review)} 条记录待业务运营复核")

        for result in results:
            record = self.store.get_record(result.record_id)
            if record:
                findings.append(
                    f"[{record.store_name}] {result.processing_type.value} → "
                    f"{result.final_group} (置信度: {result.confidence:.2%})"
                )

        if old_std_records:
            for r in old_std_records:
                if r.annotations:
                    for a in r.annotations:
                        if a.old_standard_reference:
                            findings.append(
                                f"📌 {r.store_name} 应用旧口径: {a.old_standard_reference}"
                            )

        return findings

    def print_audit_summary(self, record_id: Optional[str] = None) -> None:
        """打印复盘摘要到控制台"""
        if record_id:
            self._print_single_audit(record_id)
        else:
            self._print_all_audit_summary()

    def _print_single_audit(self, record_id: str) -> None:
        """打印单条记录的复盘摘要"""
        record = self.store.get_record(record_id)
        if not record:
            print(f"❌ 记录不存在: {record_id}")
            return

        audit = self.store.get_audit_trail_by_record(record_id)
        result = self.store.get_grouping_result(record_id)

        print("\n" + "=" * 70)
        print(f"📋 复盘记录: {record.store_name}")
        print("=" * 70)
        print(f"  记录ID: {record.record_id}")
        print(f"  处理类型: {record.processing_type.value}")
        print(f"  当前状态: {record.status.value}")
        print(f"  最终分群: {record.final_group or '未分群'}")
        print(f"  重跑次数: {record.re_run_count}")
        print(f"  误差说明: {record.error_explanation.current_text}")
        print()

        if record.screenshot_refs:
            print("📸 旧公式截图:")
            for s in record.screenshot_refs:
                print(f"  - [{s.screenshot_id}] {s.description}")
                print(f"    公式: {s.formula_text}")
            print()

        if record.student_answers:
            print("📝 学生答案:")
            for a in record.student_answers:
                dup_mark = " ⚠️ 重复" if a.is_duplicate else ""
                print(f"  - [{a.answer_id}] {a.student_name} (v{a.version}){dup_mark}")
                print(f"    提交时间: {a.submission_time.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"    人流: {a.content.get('foot_traffic')}, 销售额: {a.content.get('sales_amount')}, 复购: {a.content.get('customer_loyalty')}")
            print()

        if record.annotations:
            print("💬 老师批注:")
            for a in record.annotations:
                print(f"  - [{a.annotation_id}] {a.teacher_name}: {a.content}")
                if a.old_standard_reference:
                    print(f"    📌 旧口径参考: {a.old_standard_reference}")
            print()

        if audit:
            print("📜 关键事件时间线:")
            for event in audit.events:
                ts = event["timestamp"]
                if isinstance(ts, str):
                    ts = datetime.fromisoformat(ts)
                print(f"  [{ts.strftime('%H:%M:%S')}] {event['actor']}: {event['description']}")
            print()

        if result:
            print("🎯 分群结果:")
            print(f"  最终分群: {result.final_group}")
            print(f"  置信度: {result.confidence:.2%}")
            print(f"  生成时间: {result.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
            print()

        print("🔄 可重跑命令:")
        for cmd in self._generate_replay_commands(record)[:10]:
            if cmd.strip() and not cmd.startswith("#"):
                print(f"  {cmd}")
        print("=" * 70 + "\n")

    def _print_all_audit_summary(self) -> None:
        """打印所有记录的汇总摘要"""
        records = self.store.get_all_records()
        results = self.store.get_all_results()

        print("\n" + "=" * 70)
        print("📊 距离度量门店分群 - 复盘汇总")
        print("=" * 70)
        print(f"共 {len(records)} 条记录，{len(results)} 个分群结果\n")

        type_map = {}
        for record in records:
            ptype = record.processing_type.value
            if ptype not in type_map:
                type_map[ptype] = []
            type_map[ptype].append(record)

        for ptype, recs in type_map.items():
            print(f"【{ptype}】共 {len(recs)} 条")
            for r in recs:
                result = self.store.get_grouping_result(r.record_id)
                group = result.final_group if result else "未分群"
                conf = f" (置信度: {result.confidence:.2%})" if result else ""
                status = f"[{r.status.value}]"
                print(f"  {status} {r.store_name} → {group}{conf}")
            print()

        print("=" * 70)
        print("💡 三种处理结果差异说明:")
        print("  1. 顺利记录: 一次性导入成功，直接分群")
        print("  2. 两版答案: 检测到重复，标记待复核，不自动归正常")
        print("  3. 旧口径补录: 先分群，后补录批注修正，再重跑")
        print("=" * 70 + "\n")
