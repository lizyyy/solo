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
                "processing_type": record.processing_type.value if record else result.processing_type.value,
                "final_group": record.final_group if record and record.final_group else result.final_group,
                "confidence": result.confidence,
                "status": record.status.value if record else result.status.value,
                "error_explanation": (record.error_explanation.current_text
                                      if record else result.error_explanation),
                "re_run_count": record.re_run_count if record else 0,
                "has_annotations": len(record.annotations) > 0 if record else False,
                "has_duplicates": record.has_duplicate_answers() if record else False,
                "is_pending_review": (record.status in [RecordStatus.PENDING_REVIEW, RecordStatus.DUPLICATE_DETECTED]
                                      if record else False),
                "reviewed_by": result.reviewed_by
            }
            summary["results_comparison"].append(comparison)

        pending_ids = {r.record_id for r in records if r.status in [RecordStatus.PENDING_REVIEW, RecordStatus.DUPLICATE_DETECTED]}
        result_record_ids = {r.record_id for r in results}
        for record in records:
            if record.record_id not in result_record_ids:
                comparison = {
                    "record_id": record.record_id,
                    "store_name": record.store_name,
                    "processing_type": record.processing_type.value,
                    "final_group": record.final_group or "未分群",
                    "confidence": None,
                    "status": record.status.value,
                    "error_explanation": record.error_explanation.current_text,
                    "re_run_count": record.re_run_count,
                    "has_annotations": len(record.annotations) > 0,
                    "has_duplicates": record.has_duplicate_answers(),
                    "is_pending_review": record.status in [RecordStatus.PENDING_REVIEW, RecordStatus.DUPLICATE_DETECTED],
                    "reviewed_by": None,
                    "pending_reason": "待业务运营复核后再分群" if record.status in [RecordStatus.PENDING_REVIEW, RecordStatus.DUPLICATE_DETECTED] else None
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
        """构建完整的复盘报告 - 与 record 最新状态完全一致"""
        is_pending = record.status in [RecordStatus.PENDING_REVIEW, RecordStatus.DUPLICATE_DETECTED]
        approved_answer_id = self._find_approved_answer(record)
        reviewer = self._find_reviewer_name(record)

        pending_info = None
        if is_pending:
            students = {}
            for a in record.student_answers:
                if a.student_id not in students:
                    students[a.student_id] = []
                students[a.student_id].append(a)
            pending_info = {
                "原始说法": f"检测到同一学生交了{len(record.student_answers)}版答案",
                "改后的值": None,
                "处理原因": "需要业务运营确认哪一版答案数据正确，不自动归正常",
                "下一步找谁": "业务运营同学执行 review-duplicate 命令指定采纳版本",
                "可用命令": [
                    {
                        "answer_id": a.answer_id,
                        "student_name": a.student_name,
                        "version": a.version,
                        "command": (
                            f"python cli.py review-duplicate --record-id {record.record_id} "
                            f"--approved-answer-id {a.answer_id} --reviewer <运营姓名>  "
                            f"# 采纳{a.student_name}v{a.version}"
                        )
                    } for a in record.student_answers
                ],
                "提交版本对比": [
                    {
                        "student_id": sid,
                        "student_name": ans_list[0].student_name,
                        "versions": [
                            {
                                "version": a.version,
                                "answer_id": a.answer_id,
                                "foot_traffic": a.content.get("foot_traffic"),
                                "sales_amount": a.content.get("sales_amount"),
                                "customer_loyalty": a.content.get("customer_loyalty"),
                                "notes": a.content.get("notes")
                            } for a in ans_list
                        ]
                    } for sid, ans_list in students.items() if len(ans_list) > 1
                ]
            }

        review_info = None
        if approved_answer_id:
            approved = next((a for a in record.student_answers if a.answer_id == approved_answer_id), None)
            rejected = [a for a in record.student_answers if a.answer_id != approved_answer_id]
            review_info = {
                "原始说法": "检测到同一学生交了多版答案",
                "改后的值": f"采纳{approved.student_name if approved else '学生'}的第{approved.version if approved else '?'}版答案",
                "处理原因": record.error_explanation.current_text,
                "下一步找谁": "分群已可运行，如需调整请联系数据分析师小祁",
                "运营复核人": reviewer,
                "采纳的答案": {
                    "answer_id": approved_answer_id,
                    "student_name": approved.student_name if approved else None,
                    "version": approved.version if approved else None
                },
                "驳回的答案": [
                    {"answer_id": a.answer_id, "student_name": a.student_name, "version": a.version}
                    for a in rejected
                ]
            }

        return {
            "report_generated_at": datetime.now(),
            "record_summary": {
                "record_id": record.record_id,
                "store_id": record.store_id,
                "store_name": record.store_name,
                "processing_type": record.processing_type.value,
                "current_status": record.status.value,
                "is_pending_review": is_pending,
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
            "pending_review_info": pending_info,
            "review_completed_info": review_info,
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
                    "status": "已采纳" if (a.answer_id == approved_answer_id) else ("驳回" if approved_answer_id and a.is_duplicate else "待复核"),
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
                "final_group": (record.final_group if record.final_group else result.final_group) if not is_pending else None,
                "confidence": result.confidence if result else None,
                "generated_at": result.generated_at if result else None,
                "reviewed_by": reviewer or (result.reviewed_by if result else None),
                "note": ("待运营复核后执行分群" if is_pending else None)
            } if (result or is_pending or record.final_group) else None,
            "replay_commands": self._generate_replay_commands(record)
        }

    def _find_approved_answer(self, record: StoreGroupingRecord):
        """从操作日志中找到被运营采纳的答案ID"""
        for log in reversed(record.operation_log):
            if log.get("operation") == "复核完成":
                return log.get("details", {}).get("approved_answer_id")
        return None

    def _find_reviewer_name(self, record: StoreGroupingRecord) -> Optional[str]:
        """从操作日志中找到运营复核人"""
        for log in reversed(record.operation_log):
            if log.get("operation") == "复核完成":
                return log.get("operator")
        return None

    def _generate_replay_commands(self, record: StoreGroupingRecord) -> List[str]:
        """生成可重新跑的命令列表 - 与 record 最新状态完全一致"""
        is_duplicate_type = record.processing_type == ProcessingType.DUPLICATE
        total_student_answers = len(record.student_answers)
        distinct_students = len(set(a.student_id for a in record.student_answers))
        has_multi_submission = is_duplicate_type or (total_student_answers > 0 and total_student_answers > distinct_students)

        approved_answer_id = self._find_approved_answer(record)
        reviewer = self._find_reviewer_name(record) or "业务运营"
        is_pending = record.status in [RecordStatus.PENDING_REVIEW, RecordStatus.DUPLICATE_DETECTED]

        step_no = 1
        commands = [
            f"# 复盘记录: {record.store_name} ({record.record_id})",
            f"# 处理类型: {record.processing_type.value}",
            f"# 当前最新状态: {record.status.value}" + (f" | 最终分群: {record.final_group}" if record.final_group else " | 分群: 待运营复核后分群"),
            "",
            f"# {step_no}. 初始化数据并创建记录",
            f"python cli.py create --store-id {record.store_id} --store-name '{record.store_name}' --processing-type {record.processing_type.name}",
        ]
        step_no += 1

        commands.append("")
        commands.append(f"# {step_no}. 导入旧公式截图")
        step_no += 1
        for s in record.screenshot_refs:
            commands.append(
                f"python cli.py import-screenshot --record-id {record.record_id} "
                f"--path '{s.file_path}' --formula '{s.formula_text}' --desc '{s.description}'"
            )

        commands.append("")
        commands.append(f"# {step_no}. 导入学生答案（共{total_student_answers}条）")
        step_no += 1
        commands.append(
            f"python cli.py import-answers --record-id {record.record_id} "
            f"--answers-json data/records/{record.record_id}.json"
        )

        if has_multi_submission:
            commands.append("")
            commands.append(f"# {step_no}. 同一学生交了多版答案 → 标记待业务运营复核，不自动归正常")
            step_no += 1
            commands.append(f"python cli.py mark-review --record-id {record.record_id}")

            if is_pending:
                commands.append("")
                commands.append(f"# ⚠️  当前状态：待业务运营复核")
                commands.append(f"#    · 原始说法：检测到同一学生交了{total_student_answers}版答案")
                commands.append(f"#    · 处理原因：需要人工确认哪个版本正确")
                commands.append(f"#    · 下一步找谁：联系业务运营使用 review-duplicate 命令指定采纳版本")
                commands.append(f"#    · 待运营执行后，再继续下面的步骤")
                commands.append(f"# python cli.py review-duplicate --record-id {record.record_id} --approved-answer-id <答案ID> --reviewer <运营姓名>")
            else:
                commands.append("")
                commands.append(f"# {step_no}. 业务运营复核，指定采纳版本")
                step_no += 1
                commands.append(
                    f"python cli.py review-duplicate --record-id {record.record_id} "
                    f"--approved-answer-id {approved_answer_id or '<答案ID>'} --reviewer {reviewer}"
                )

        if record.annotations:
            commands.append("")
            commands.append(f"# {step_no}. 补录老师批注（误差说明会跟着变）")
            step_no += 1
            for a in record.annotations:
                old_std = f"--old-standard '{a.old_standard_reference}'" if a.old_standard_reference else ""
                err_upd = f"--error-update '{a.error_explanation_update}'" if a.error_explanation_update else ""
                commands.append(
                    f"python cli.py add-annotation --record-id {record.record_id} "
                    f"--teacher '{a.teacher_name}' --content '{a.content}' {old_std} {err_upd}"
                )

        if record.manual_correction_note:
            commands.append("")
            commands.append(f"# {step_no}. 人工修正")
            step_no += 1
            commands.append(
                f"python cli.py manual-correct --record-id {record.record_id} "
                f"--note '{record.manual_correction_note}'"
            )

        if not is_pending:
            commands.append("")
            commands.append(f"# {step_no}. 运行分群算法")
            step_no += 1
            commands.append(f"python cli.py run-grouping --record-id {record.record_id}")

            if record.re_run_count > 1:
                commands.append("")
                commands.append(f"# {step_no}. 重跑分群（共{record.re_run_count}次运行）")
                step_no += 1
                for i in range(1, record.re_run_count):
                    commands.append(
                        f"python cli.py re-run --record-id {record.record_id}"
                    )

        commands.append("")
        commands.append(f"# {step_no}. 导出复盘记录")
        step_no += 1
        commands.append(f"python cli.py export-audit --record-id {record.record_id}")

        commands.append("")
        commands.append(f"# {step_no}. 查看记录详情（含最新状态、误差说明、分群结果）")
        step_no += 1
        commands.append(f"python cli.py show --record-id {record.record_id}")

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
        is_pending = record.status in [RecordStatus.PENDING_REVIEW, RecordStatus.DUPLICATE_DETECTED]

        print("\n" + "=" * 70)
        print(f"📋 复盘记录: {record.store_name}")
        print("=" * 70)
        print(f"  记录ID: {record.record_id}")
        print(f"  处理类型: {record.processing_type.value}")
        print(f"  当前状态: {record.status.value}" + ("  ⚠️  待人工复核，不自动归正常" if is_pending else ""))
        print(f"  最终分群: {record.final_group or ('未分群（' + record.status.value + '）')}")
        print(f"  重跑次数: {record.re_run_count}")
        print(f"  误差说明: {record.error_explanation.current_text}")
        if result and result.reviewed_by:
            print(f"  运营复核人: {result.reviewed_by}")
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
                dup_mark = " ⚠️ 重复（未采纳）" if a.is_duplicate else (" ✅ 已采纳" if record.status in [RecordStatus.NORMAL, RecordStatus.RE_RUN] and record.processing_type == ProcessingType.DUPLICATE else "")
                print(f"  - [{a.answer_id}] {a.student_name} (v{a.version}){dup_mark}")
                print(f"    提交时间: {a.submission_time.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"    人流: {a.content.get('foot_traffic')}, 销售额: {a.content.get('sales_amount')}, 复购: {a.content.get('customer_loyalty')}")
                if a.content.get("notes"):
                    print(f"    备注: {a.content.get('notes')}")
            print()

        if is_pending:
            print("⚠️  待业务运营复核（关键信息）:")
            print(f"  · 原始说法：检测到同一学生交了{len(record.student_answers)}版答案")
            students = {}
            for a in record.student_answers:
                if a.student_id not in students:
                    students[a.student_id] = []
                students[a.student_id].append(a)
            for sid, answers in students.items():
                if len(answers) > 1:
                    print(f"  · 学生: {answers[0].student_name} (ID: {sid}) 共 {len(answers)} 版")
                    for a in answers:
                        print(f"      版本{a.version}: 人流{a.content.get('foot_traffic')} 销售额{a.content.get('sales_amount')} 复购{a.content.get('customer_loyalty')}")
            print(f"  · 处理原因：需要业务运营确认哪一版答案数据正确")
            print(f"  · 下一步找谁：业务运营同学执行 review-duplicate 命令")
            print(f"  · 可用命令:")
            for a in record.student_answers:
                print(f"      python cli.py review-duplicate --record-id {record.record_id} --approved-answer-id {a.answer_id} --reviewer <您的姓名>  # 采纳v{a.version}")
            print()

        if record.error_explanation.history:
            print("📄 误差说明变更历史:")
            for i, hist in enumerate(record.error_explanation.history, 1):
                ts = hist.get("updated_at")
                if isinstance(ts, str):
                    ts = datetime.fromisoformat(ts).strftime("%H:%M:%S")
                print(f"  [{i}] {ts} - {hist.get('updated_by')}")
                print(f"      旧值: {hist.get('old_text')}")
                print(f"      新值: {hist.get('new_text')}")
                if hist.get("annotation_ref"):
                    print(f"      来源批注: {hist['annotation_ref']}")
            print()

        if record.annotations:
            print("💬 老师批注:")
            for a in record.annotations:
                print(f"  - [{a.annotation_id}] {a.teacher_name}: {a.content}")
                if a.old_standard_reference:
                    print(f"    📌 旧口径参考: {a.old_standard_reference}")
                if a.error_explanation_update:
                    print(f"    🔄 误差说明更新: {a.error_explanation_update}")
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
            if result.reviewed_by:
                print(f"  运营复核人: {result.reviewed_by}")
            print()
        elif is_pending:
            print("🎯 分群结果:")
            print(f"  ⏸️  暂停，待运营复核后再分群")
            print(f"  执行 review-duplicate 后再运行 run-grouping 即可")
            print()

        print("🔄 可直接复制粘贴的重跑命令列表:")
        full_commands = self._generate_replay_commands(record)
        for idx, cmd in enumerate(full_commands):
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
