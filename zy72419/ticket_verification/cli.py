#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
演出票务赠票核销系统 - 三步流程CLI
流程: 1.票务导出表导入  2.补看音频文件备注  3.曲目核对表更新
"""
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src import (
    TicketImporter, AudioRemarkParser, ConflictDetector,
    ChecklistManager, SelfChecker, ReportGenerator,
    TicketStatus, LeaveStatus, ConflictType, AuditTrail,
    normalize_status, are_statuses_equivalent,
    STATUS_MAPPING, TICKET_STATUS_TO_AUDIO
)


class TicketVerificationCLI:
    def __init__(self):
        self.importer = TicketImporter()
        self.audio_parser = AudioRemarkParser()
        self.conflict_detector = ConflictDetector()
        self.checklist_mgr = ChecklistManager()
        self.self_checker = SelfChecker()
        self.report_gen = ReportGenerator()
        self.audit = AuditTrail()

        self.tickets = []
        self.audio_remarks = []
        self.conflicts = []
        self.checklist = None
        self.import_batches = []
        self._seen_ticket_keys = set()

    def _dedup_key(self, ticket):
        return (ticket.ticket_id, ticket.student_name, ticket.repertoire,
                ticket.performance_date, normalize_status(ticket.status))

    def print_header(self, title: str):
        print("\n" + "=" * 70)
        print(f"  {title}")
        print("=" * 70)

    def print_step(self, step: int, title: str):
        print(f"\n{'='*70}")
        print(f"  步骤 {step}: {title}")
        print(f"{'='*70}\n")

    def step1_import_tickets(self, ticket_file: str, batch_id: str = None):
        self.print_step(1, "票务导出表第一次导入")

        tickets, batch = self.importer.import_from_csv(ticket_file, batch_id)

        added = 0
        skipped = 0
        for ticket in tickets:
            key = self._dedup_key(ticket)
            if key in self._seen_ticket_keys:
                skipped += 1
                ticket.add_history(
                    "重复导入跳过", "系统",
                    details=f"与已有记录重复，跳过（映射口径: {normalize_status(ticket.status)}）",
                    before_value=None, after_value=None,
                    affected_field="dedup"
                )
                self.audit.add_entry(
                    action="重复导入跳过",
                    operator="系统",
                    details=f"票号{ticket.ticket_id}映射后重复",
                    before_value=None,
                    after_value="跳过",
                    affected_field="dedup",
                    affected_ticket_id=ticket.ticket_id
                )
            else:
                self._seen_ticket_keys.add(key)
                self.tickets.append(ticket)
                added += 1
                ticket.add_history(
                    "票务导入", "系统",
                    details=f"原始状态={ticket.status}, 映射状态={ticket.normalized_status}",
                    before_value=None,
                    after_value=ticket.normalized_status,
                    affected_field="status"
                )
                self.audit.add_entry(
                    action="票务导入",
                    operator="系统",
                    details=f"原始状态={ticket.status} → 映射={ticket.normalized_status}",
                    before_value=ticket.status,
                    after_value=ticket.normalized_status,
                    affected_field="status",
                    affected_ticket_id=ticket.ticket_id
                )

        self.import_batches.append(batch)

        print(f"✓ 成功导入文件: {batch.file_name}")
        print(f"  批次号: {batch.batch_id}")
        print(f"  文件记录数: {batch.record_count}")
        print(f"  实际新增: {added}（去重跳过: {skipped}）")

        if batch.is_duplicate:
            print(f"  ⚠️  警告: 该文件与批次 {batch.duplicate_of} 重复!")

        duplicates = self.importer.find_duplicate_records(self.tickets)
        if duplicates:
            print(f"\n⚠️  检测到 {len(duplicates)} 组映射口径重复记录:")
            for t1, t2 in duplicates[:3]:
                print(f"  - 票号 {t1.ticket_id} ({t1.student_name}) "
                      f"状态映射: {t1.status}→{normalize_status(t1.status)} / "
                      f"{t2.status}→{normalize_status(t2.status)}")

        print(f"\n📊 状态映射结果:")
        for ticket in self.tickets:
            print(f"  票号{ticket.ticket_id}: {ticket.status} → {ticket.normalized_status}")

        print(f"\n导入完成，当前有效票数: {len(self.tickets)}")
        return tickets, batch

    def step2_review_audio_remarks(self, audio_file: str, operator: str = "老周"):
        self.print_step(2, f"琴行店长{operator}补看音频文件备注")

        self.audio_remarks = self.audio_parser.parse_file(audio_file)
        print(f"✓ 成功解析音频备注文件: {Path(audio_file).name}")
        print(f"  备注记录数: {len(self.audio_remarks)}")

        print(f"\n📝 音频原始备注预览 (保留完整原始信息，不做清洗):")
        for i, remark in enumerate(self.audio_remarks[:3], 1):
            print(f"\n  备注 #{i}:")
            print(f"    票号: {remark.ticket_id}")
            print(f"    学员: {remark.student_name}")
            print(f"    音频文件: {remark.audio_file}")
            print(f"    原始备注: {remark.raw_remark}")
            if remark.parsed_status:
                print(f"    解析状态: {remark.parsed_status} → 映射: {normalize_status(remark.parsed_status)}")
        if len(self.audio_remarks) > 3:
            print(f"\n  ... 还有 {len(self.audio_remarks) - 3} 条备注")

        remarks_by_ticket = self.audio_parser.get_raw_remarks_by_ticket(self.audio_remarks)
        matched = 0
        for ticket in self.tickets:
            remarks = remarks_by_ticket.get(ticket.ticket_id, [])
            if remarks:
                matched += 1
                old_remarks = ticket.audio_remarks
                all_raw = "\n".join([r.raw_remark for r in remarks])
                ticket.audio_remarks = all_raw
                ticket.add_history(
                    "音频备注补充", operator,
                    details=f"补充 {len(remarks)} 条音频备注",
                    before_value=old_remarks,
                    after_value=all_raw,
                    affected_field="audio_remarks"
                )
                self.audit.add_entry(
                    action="音频备注补充",
                    operator=operator,
                    details=f"补充 {len(remarks)} 条音频备注",
                    before_value=old_remarks,
                    after_value=all_raw[:200] + ("..." if len(all_raw) > 200 else ""),
                    affected_field="audio_remarks",
                    affected_ticket_id=ticket.ticket_id
                )

        print(f"\n✓ 已为 {matched} 张票补充音频备注信息")

        self.conflicts = self.conflict_detector.detect_all_conflicts(self.tickets, self.audio_remarks)

        total_conflict_tickets = len(set(c.ticket_id for c in self.conflicts))

        if self.conflicts and total_conflict_tickets > 0:
            real_conflicts = [c for c in self.conflicts if c.conflict_type != ConflictType.LEAVE_COUNTED]
            leave_conflicts = [c for c in self.conflicts if c.conflict_type == ConflictType.LEAVE_COUNTED]

            print(f"\n⚠️  共检测到 {len(self.conflicts)} 条冲突，涉及 {total_conflict_tickets} 张票 "
                  f"（实质冲突 {len(real_conflicts)} + 请假课时异常 {len(leave_conflicts)}）:")

            conflicts_by_ticket: Dict[str, List] = {}
            for c in self.conflicts:
                if c.ticket_id not in conflicts_by_ticket:
                    conflicts_by_ticket[c.ticket_id] = []
                conflicts_by_ticket[c.ticket_id].append(c)

            for tid in sorted(conflicts_by_ticket.keys()):
                ticket = next((t for t in self.tickets if t.ticket_id == tid), None)
                ticket_conflicts = conflicts_by_ticket[tid]
                print(f"\n{'─'*60}")
                print(f"  票号: {tid}"
                      + (f" | 学员: {ticket.student_name}" if ticket else ""))
                if ticket:
                    print(f"  映射后状态: 票务={ticket.status}→{ticket.normalized_status} | "
                          f"核验状态={ticket.verification_status.value}")
                for j, c in enumerate(ticket_conflicts, 1):
                    print(f"\n    冲突 {j}: {c.description}")
                    print(f"      类型: {c.conflict_type.value}")
                    print(f"      票务表值: {c.ticket_value}")
                    print(f"      音频备注值: {c.audio_value}")
                    print(f"      当前判断: {c.current_verdict}")
                    print(f"      可处理状态: {c.handler_status}")
                    if c.evidence:
                        print(f"      证据:")
                        for k, v in c.evidence.items():
                            v_str = str(v)
                            if len(v_str) > 120:
                                v_str = v_str[:120] + "..."
                            print(f"        - {k}: {v_str}")
                if ticket and ticket.history:
                    print(f"    历史记录:")
                    for h in ticket.history[-3:]:
                        print(f"        [{h.timestamp.strftime('%H:%M:%S')}] {h.action} by {h.operator}"
                              + (f" | {h.affected_field}: {h.before_value} → {h.after_value}" if h.affected_field else ""))

            if leave_conflicts:
                print(f"\n🚨 特别注意: {len(leave_conflicts)} 条请假课时被算进已消耗")
                print(f"   已标记为【待巡演统筹复核】，不会自动归为正常")
                for c in leave_conflicts:
                    ticket = next((t for t in self.tickets if t.ticket_id == c.ticket_id), None)
                    if ticket and ticket.verification_status != TicketStatus.NEED_REVIEW:
                        ticket.verification_status = TicketStatus.NEED_REVIEW
                    self.audit.add_entry(
                        action="标记待巡演统筹复核",
                        operator="系统",
                        details="请假课时被算进已消耗",
                        before_value=(ticket.verification_status.value if ticket else ""),
                        after_value=TicketStatus.NEED_REVIEW.value,
                        affected_field="verification_status",
                        affected_ticket_id=c.ticket_id
                    )

            print(f"\n💡 请店长{operator}对以上 {total_conflict_tickets} 张票的每个冲突选择【确认】或【驳回】")
            print("   系统不会替业务同事自动拍板")
        else:
            print("\n✓ 状态映射后未检测到实质冲突")

        status_summary = {}
        for ticket in self.tickets:
            vs = ticket.verification_status.value
            status_summary[vs] = status_summary.get(vs, 0) + 1
        print(f"\n📊 核对状态分布:")
        for status, count in status_summary.items():
            print(f"  {status}: {count}")

        return self.audio_remarks, self.conflicts

    def step3_update_checklist(self, operator: str = "老周"):
        self.print_step(3, "曲目核对表更新")

        if not self.tickets:
            print("❌ 请先导入票务数据")
            return None

        self.checklist = self.checklist_mgr.create_checklist_from_tickets(self.tickets)
        print(f"✓ 创建曲目核对表")
        print(f"  核对表ID: {self.checklist.checklist_id}")
        print(f"  演出日期: {self.checklist.performance_date}")
        print(f"  曲目项数: {len(self.checklist.items)}")

        if self.audio_remarks:
            self.checklist = self.checklist_mgr.update_checklist_from_audio_remarks(
                self.checklist, self.audio_remarks, operator, self.audit
            )
            print(f"\n✓ 已将音频备注更新到核对表")

        for ticket in self.tickets:
            if ticket.verification_status == TicketStatus.CONFIRMED and not ticket.conflicts:
                self.checklist_mgr.mark_item_checked(self.checklist, ticket.ticket_id, operator)
                ticket.add_history("核对通过", operator,
                                   before_value="待核对",
                                   after_value="已确认",
                                   affected_field="verification_status")
                self.audit.add_entry(
                    action="核对通过",
                    operator=operator,
                    details="状态映射后自动核对通过",
                    before_value="待核对",
                    after_value="已确认",
                    affected_field="verification_status",
                    affected_ticket_id=ticket.ticket_id
                )

        summary = self.checklist_mgr.get_checklist_summary(self.checklist)
        print(f"\n📊 核对表状态:")
        print(f"  总项数: {summary['total_items']}")
        print(f"  已核对: {summary['checked_count']} ({summary['checked_percentage']:.1f}%)")
        print(f"  待处理: {summary['unchecked_count']}")
        print(f"  含备注: {summary['with_remarks_count']}")

        print(f"\n📋 逐条核对结果:")
        for item in self.checklist.items:
            ticket = next((t for t in self.tickets if t.ticket_id == item.ticket_id), None)
            if ticket:
                print(f"  票号{item.ticket_id} | {ticket.student_name} | "
                      f"票务状态={ticket.status}→映射={ticket.normalized_status} | "
                      f"核对={'✓' if item.is_checked else '✗'} | "
                      f"核验状态={ticket.verification_status.value}")

        return self.checklist

    def query_audit(self, ticket_id: str = None, operator: str = None, action: str = None):
        self.print_header("变更溯源查询")

        if ticket_id:
            entries = self.audit.query_by_ticket(ticket_id)
            print(f"票号 {ticket_id} 的变更历史:")
        elif operator:
            entries = self.audit.query_by_operator(operator)
            print(f"操作人 {operator} 的变更记录:")
        elif action:
            entries = self.audit.query_by_action(action)
            print(f"动作 {action} 的变更记录:")
        else:
            entries = self.audit.entries
            print("全部变更记录:")

        if not entries:
            print("  无变更记录")
            return entries

        for i, entry in enumerate(entries[:20], 1):
            print(f"\n  记录 #{i}:")
            print(f"    动作: {entry.action}")
            print(f"    操作人: {entry.operator}")
            print(f"    关联票号: {entry.affected_ticket_id}")
            print(f"    变更字段: {entry.affected_field}")
            print(f"    改前: {entry.before_value}")
            print(f"    改后: {entry.after_value}")
            print(f"    时间: {entry.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")

        if len(entries) > 20:
            print(f"\n  ... 还有 {len(entries) - 20} 条记录")

        return entries

    def run_self_check(self, exported_file: str = None):
        self.print_header("系统自检")

        check_results = self.self_checker.run_all_checks(
            self.tickets, self.import_batches,
            [self.checklist] if self.checklist else None
        )

        if exported_file and Path(exported_file).exists():
            export_check = self.self_checker.check_export_consistency(
                self.tickets, exported_file
            )
            check_results.append(export_check)

        passed = sum(1 for r in check_results if r.passed)
        total = len(check_results)
        print(f"\n自检结果: {passed}/{total} 通过")

        for result in check_results:
            status = "✓" if result.passed else "✗"
            print(f"\n  {status} {result.check_name}: {result.details}")
            if result.issues:
                for issue in result.issues[:3]:
                    print(f"    - {issue}")

        return check_results

    def generate_final_report(self, output_dir: str = "reports"):
        self.print_header("生成核销报告")

        os.makedirs(output_dir, exist_ok=True)
        timestamp = self.import_batches[0].import_time.strftime("%Y%m%d_%H%M%S") if self.import_batches else "latest"

        check_results = self.self_checker.run_all_checks(
            self.tickets, self.import_batches,
            [self.checklist] if self.checklist else None
        )

        status_mapping_log = []
        for ticket in self.tickets:
            status_mapping_log.append({
                "ticket_id": ticket.ticket_id,
                "student_name": ticket.student_name,
                "raw_status": ticket.status,
                "normalized_status": ticket.normalized_status,
                "mapped_status": ticket.mapped_status,
                "verification_status": ticket.verification_status.value
            })

        audit_entries = []
        for entry in self.audit.entries:
            audit_entries.append({
                "action": entry.action,
                "operator": entry.operator,
                "details": entry.details,
                "affected_field": entry.affected_field,
                "affected_ticket_id": entry.affected_ticket_id,
                "before": entry.before_value,
                "after": entry.after_value,
                "timestamp": entry.timestamp.isoformat()
            })

        report = self.report_gen.generate_report(
            self.tickets, self.conflicts,
            [self.checklist] if self.checklist else [],
            check_results
        )
        report.status_mapping_log = status_mapping_log
        report.audit_entries = audit_entries

        text_report_path = os.path.join(output_dir, f"verification_report_{timestamp}.txt")
        json_report_path = os.path.join(output_dir, f"verification_report_{timestamp}.json")

        self.report_gen.export_report_text(report, text_report_path)
        self.report_gen.export_report_json(report, json_report_path)

        print(f"\n✓ 报告已生成:")
        print(f"  文本报告: {text_report_path}")
        print(f"  JSON报告: {json_report_path}")

        print(f"\n📊 报告摘要:")
        print(f"  总票数: {report.total_tickets}")
        print(f"  已确认: {report.confirmed_count}")
        print(f"  已驳回: {report.rejected_count}")
        print(f"  存在冲突: {report.conflict_count}")
        print(f"  待巡演统筹复核: {report.need_review_count}")
        print(f"  请假课时被算进已消耗: {report.leave_counted_count}")

        return report, text_report_path, json_report_path

    def save_state(self, output_file: str):
        self.print_header("保存当前处理状态")
        import json
        from datetime import datetime

        state = {
            "saved_at": datetime.now().isoformat(),
            "tickets": [],
            "import_batches": [
                {"batch_id": b.batch_id, "file_name": b.file_name,
                 "import_time": b.import_time.isoformat(),
                 "record_count": b.record_count,
                 "is_duplicate": b.is_duplicate,
                 "duplicate_of": b.duplicate_of}
                for b in self.import_batches
            ],
            "audio_remarks": [
                {"audio_file": r.audio_file, "ticket_id": r.ticket_id,
                 "student_name": r.student_name, "raw_remark": r.raw_remark,
                 "parsed_repertoire": r.parsed_repertoire,
                 "parsed_date": r.parsed_date,
                 "parsed_status": r.parsed_status,
                 "parsed_is_leave": r.parsed_is_leave}
                for r in self.audio_remarks
            ],
            "conflicts": [
                {"conflict_id": c.conflict_id,
                 "conflict_type": c.conflict_type.value,
                 "ticket_id": c.ticket_id, "field_name": c.field_name,
                 "ticket_value": c.ticket_value,
                 "audio_value": c.audio_value,
                 "description": c.description,
                 "evidence": c.evidence,
                 "resolved": c.resolved,
                 "resolution": c.resolution,
                 "resolved_by": c.resolved_by,
                 "resolved_time": c.resolved_time.isoformat() if c.resolved_time else None,
                 "current_verdict": c.current_verdict,
                 "handler_status": c.handler_status,
                 "normalized_ticket_status": c.normalized_ticket_status,
                 "normalized_audio_status": c.normalized_audio_status}
                for c in self.conflicts
            ],
            "audit_entries": [
                {"action": e.action, "operator": e.operator,
                 "details": e.details, "affected_field": e.affected_field,
                 "affected_ticket_id": e.affected_ticket_id,
                 "before_value": e.before_value,
                 "after_value": e.after_value,
                 "timestamp": e.timestamp.isoformat()}
                for e in self.audit.entries
            ]
        }
        for ticket in self.tickets:
            state["tickets"].append({
                "ticket_id": ticket.ticket_id,
                "student_name": ticket.student_name,
                "repertoire": ticket.repertoire,
                "performance_date": ticket.performance_date,
                "status": ticket.status,
                "is_consumed": ticket.is_consumed,
                "leave_status": ticket.leave_status.value,
                "verification_status": ticket.verification_status.value,
                "audio_remarks": ticket.audio_remarks,
                "normalized_status": ticket.normalized_status,
                "mapped_status": ticket.mapped_status,
                "review_notes": ticket.review_notes,
                "history": [
                    {"action": h.action, "operator": h.operator,
                     "details": h.details,
                     "affected_field": h.affected_field,
                     "before_value": h.before_value,
                     "after_value": h.after_value,
                     "timestamp": h.timestamp.isoformat()}
                    for h in ticket.history
                ]
            })

        os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False, indent=2)

        print(f"✓ 状态已保存到: {output_file}")
        print(f"  票数: {len(self.tickets)}")
        print(f"  冲突数: {len(self.conflicts)}")
        print(f"  审计记录: {len(self.audit.entries)}")
        self.audit.add_entry(
            action="保存当前处理状态",
            operator="系统",
            details=f"持久化到文件: {output_file}",
            before_value=None,
            after_value=output_file,
            affected_field="state",
            affected_ticket_id="*"
        )
        return output_file

    def supplement_tickets(self, supplement_file: str, operator: str = "老周"):
        self.print_header("补录票券数据")

        print(f"补录文件: {supplement_file}")
        old_count = len(self.tickets)
        old_audit = len(self.audit.entries)

        sup_tickets, batch = self.importer.import_from_csv(supplement_file)
        self.import_batches.append(batch)

        for st in sup_tickets:
            key = self._dedup_key(st)
            if key in self._seen_ticket_keys:
                print(f"  跳过重复: 票号{st.ticket_id} ({st.student_name})")
                self.audit.add_entry(
                    action="补录跳过（重复）",
                    operator=operator,
                    details=f"映射后状态与已有记录一致，跳过补录",
                    before_value=None,
                    after_value=None,
                    affected_field="supplement_skip",
                    affected_ticket_id=st.ticket_id
                )
                continue

            existing = next((t for t in self.tickets if t.ticket_id == st.ticket_id), None)
            if existing:
                old_status = existing.status
                old_norm = existing.normalized_status
                old_consumed = existing.is_consumed
                old_leave = existing.leave_status.value
                old_vs = existing.verification_status.value

                existing.status = st.status
                existing.normalized_status = normalize_status(st.status)
                existing.mapped_status = TICKET_STATUS_TO_AUDIO.get(st.status, st.status)
                existing.is_consumed = st.is_consumed
                existing.leave_status = st.leave_status
                existing.verification_status = TicketStatus.PENDING
                existing.raw_data.update(st.raw_data)
                existing.import_batch = batch.batch_id

                existing.add_history(
                    "补录更新", operator,
                    details="补录数据覆盖原记录",
                    before_value=f"status={old_status},norm={old_norm},consumed={old_consumed},leave={old_leave},vs={old_vs}",
                    after_value=f"status={st.status},norm={existing.normalized_status},consumed={st.is_consumed},leave={st.leave_status.value},vs=PENDING",
                    affected_field="status/is_consumed/leave_status"
                )
                self.audit.add_entry(
                    action="补录更新",
                    operator=operator,
                    details="补录数据覆盖原记录",
                    before_value={"status": old_status, "norm": old_norm,
                                  "consumed": old_consumed, "leave": old_leave, "vs": old_vs},
                    after_value={"status": st.status, "norm": existing.normalized_status,
                                 "consumed": st.is_consumed, "leave": st.leave_status.value, "vs": "PENDING"},
                    affected_field="status/is_consumed/leave_status",
                    affected_ticket_id=st.ticket_id
                )
                print(f"  已更新: 票号{st.ticket_id} ({st.student_name}) "
                      f"{old_status}→{st.status}, 已消耗{old_consumed}→{st.is_consumed}")
            else:
                self._seen_ticket_keys.add(key)
                self.tickets.append(st)
                st.add_history(
                    "补录新增", operator,
                    details=f"原始状态={st.status}, 映射状态={st.normalized_status}",
                    before_value=None,
                    after_value=st.normalized_status,
                    affected_field="status"
                )
                self.audit.add_entry(
                    action="补录新增",
                    operator=operator,
                    details=f"新增票券，原始状态={st.status} → 映射={st.normalized_status}",
                    before_value=None,
                    after_value=st.normalized_status,
                    affected_field="status",
                    affected_ticket_id=st.ticket_id
                )
                print(f"  已新增: 票号{st.ticket_id} ({st.student_name})")

        new_count = len(self.tickets)
        print(f"\n✓ 补录完成: 原{old_count} → 新{new_count} (净增 {new_count - old_count})")
        print(f"  新增审计记录: {len(self.audit.entries) - old_audit} 条")
        return sup_tickets, batch

    def refresh_status(self, operator: str = "老周"):
        self.print_header("刷新：基于最新数据重新运行状态映射")

        mapping_changes = 0
        for ticket in self.tickets:
            old_norm = ticket.normalized_status
            new_norm = normalize_status(ticket.status)
            if old_norm != new_norm:
                ticket.normalized_status = new_norm
                ticket.add_history(
                    "刷新状态映射", operator,
                    before_value=old_norm,
                    after_value=new_norm,
                    affected_field="normalized_status"
                )
                self.audit.add_entry(
                    action="刷新状态映射",
                    operator=operator,
                    details=f"票号{ticket.ticket_id}归一化状态变更",
                    before_value=old_norm,
                    after_value=new_norm,
                    affected_field="normalized_status",
                    affected_ticket_id=ticket.ticket_id
                )
                mapping_changes += 1
            old_mapped = ticket.mapped_status
            new_mapped = TICKET_STATUS_TO_AUDIO.get(ticket.status, ticket.status)
            if old_mapped != new_mapped:
                ticket.mapped_status = new_mapped

        print(f"✓ 刷新完成: {mapping_changes} 条票的归一化状态发生变化")
        self.audit.add_entry(
            action="刷新状态映射",
            operator=operator,
            details=f"刷新状态映射：{mapping_changes} 条票有变化",
            before_value=None,
            after_value=f"{mapping_changes} 条票变更",
            affected_field="normalized_status",
            affected_ticket_id="*"
        )
        return mapping_changes

    def recalculate_conflicts(self, operator: str = "老周"):
        self.print_header("重算：重新计算所有冲突与核验状态")

        old_conflict_count = len(self.conflicts)
        old_conflict_ticket_ids = set(c.ticket_id for c in self.conflicts)

        self.conflicts = self.conflict_detector.detect_all_conflicts(self.tickets, self.audio_remarks)
        new_conflict_ticket_ids = set(c.ticket_id for c in self.conflicts)

        resolved = old_conflict_ticket_ids - new_conflict_ticket_ids
        new_conflicts = new_conflict_ticket_ids - old_conflict_ticket_ids

        self.audit.add_entry(
            action="重算冲突",
            operator=operator,
            details=f"重算冲突：原{old_conflict_count}条 → 新{len(self.conflicts)}条；"
                    f"新增{len(new_conflicts)}张票有冲突，解决{len(resolved)}张票的冲突",
            before_value={"conflict_count": old_conflict_count,
                          "tickets": sorted(list(old_conflict_ticket_ids))},
            after_value={"conflict_count": len(self.conflicts),
                         "tickets": sorted(list(new_conflict_ticket_ids))},
            affected_field="conflicts",
            affected_ticket_id="*"
        )

        if self.checklist:
            self.checklist = self.checklist_mgr.create_checklist_from_tickets(self.tickets)
            if self.audio_remarks:
                self.checklist = self.checklist_mgr.update_checklist_from_audio_remarks(
                    self.checklist, self.audio_remarks, operator, self.audit
                )
            for ticket in self.tickets:
                if ticket.verification_status == TicketStatus.CONFIRMED and not ticket.conflicts:
                    self.checklist_mgr.mark_item_checked(self.checklist, ticket.ticket_id, operator)

        print(f"✓ 重算完成:")
        print(f"  原冲突条数: {old_conflict_count}")
        print(f"  新冲突条数: {len(self.conflicts)}")
        print(f"  新出现冲突的票: {sorted(list(new_conflicts)) if new_conflicts else '(无)'}")
        print(f"  已解决冲突的票: {sorted(list(resolved)) if resolved else '(无)'}")

        return self.conflicts

    def run_wrong_caliber_full_flow(
        self,
        ticket_file: str = "data/samples/wrong_caliber_tickets.csv",
        audio_file: str = "data/samples/wrong_caliber_audio_remarks.csv",
        supplement_file: str = "data/samples/supplement_tickets.csv",
        supplement_audio_file: str = "data/samples/supplement_audio_remarks.csv",
        output_dir: str = "reports",
        operator: str = "老周"
    ):
        self.print_header("错口径样例完整闭环复现")
        print(f"\n操作人员: {operator}")
        print(f"状态映射口径:")
        for k, v in STATUS_MAPPING.items():
            print(f"  {k} → {v}")

        print("\n" + "=" * 70)
        print("  阶段 A: 导入票务导出表 + 上传音频备注")
        print("=" * 70)
        self.step1_import_tickets(ticket_file, batch_id="WRONG_CALIBER_A")
        self.step2_review_audio_remarks(audio_file, operator)
        self.step3_update_checklist(operator)
        self.run_self_check()

        print("\n" + "=" * 70)
        print("  阶段 B: 保存处理中间态")
        print("=" * 70)
        state_path = os.path.join(output_dir, "saved_state_before_supplement.json")
        self.save_state(state_path)

        print("\n" + "=" * 70)
        print("  阶段 C: 补录 + 刷新 + 重算")
        print("=" * 70)
        self.supplement_tickets(supplement_file, operator)
        sup_remarks = self.audio_parser.parse_file(supplement_audio_file)
        self.audio_remarks.extend(sup_remarks)
        self.refresh_status(operator)
        self.recalculate_conflicts(operator)

        print("\n" + "=" * 70)
        print("  阶段 D: 再次保存 + 导出核销报告")
        print("=" * 70)
        state_path2 = os.path.join(output_dir, "saved_state_after_supplement.json")
        self.save_state(state_path2)
        self.run_self_check()
        report, text_path, json_path = self.generate_final_report(output_dir)

        self.print_header("闭环复现完成")
        print(f"\n✓ 错口径样例全流程跑通")
        print(f"✓ 中间态保存: {state_path}")
        print(f"✓ 补录后保存: {state_path2}")
        print(f"✓ 文本报告: {text_path}")
        print(f"✓ JSON报告: {json_path}")

        print(f"\n" + "!" * 70)
        print("  关键指标核验:")
        print(f"  总票数: {report.total_tickets}")
        print(f"  已确认: {report.confirmed_count}")
        print(f"  已驳回: {report.rejected_count}")
        print(f"  存在冲突: {report.conflict_count}")
        print(f"  待巡演统筹复核: {report.need_review_count}")
        print(f"  请假课时被算进已消耗: {report.leave_counted_count}")
        print(f"  报告冲突详情条数: {len(report.conflicts)}")
        print(f"  统计冲突票 + 待复核票 = {report.conflict_count + report.need_review_count}")
        print(f"  (详情共涉及 {len(set(c.ticket_id for c in report.conflicts))} 张票)")
        print("!" * 70)

        return report



def main():
    import argparse

    parser = argparse.ArgumentParser(description="演出票务赠票核销系统")
    subparsers = parser.add_subparsers(dest="command", help="命令")

    full_parser = subparsers.add_parser("run", help="执行完整三步流程")
    full_parser.add_argument("--tickets", required=True, help="票务导出表CSV路径")
    full_parser.add_argument("--audio", required=True, help="音频备注文件路径")
    full_parser.add_argument("--output", default="reports", help="报告输出目录")
    full_parser.add_argument("--operator", default="老周", help="操作人员")
    full_parser.add_argument("--batch-id", help="批次号")

    verify_parser = subparsers.add_parser("verify-wrong-caliber",
                                          help="执行错口径样例闭环验证（导入→上传→补录→保存→刷新→重算→导出）")
    verify_parser.add_argument("--output", default="reports", help="报告输出目录")
    verify_parser.add_argument("--operator", default="老周", help="操作人员")

    args = parser.parse_args()

    if args.command == "run":
        cli = TicketVerificationCLI()
        cli.run_full_flow(
            ticket_file=args.tickets,
            audio_file=args.audio,
            output_dir=args.output,
            operator=args.operator,
            batch_id=args.batch_id
        )
    elif args.command == "verify-wrong-caliber":
        cli = TicketVerificationCLI()
        cli.run_wrong_caliber_full_flow(output_dir=args.output, operator=args.operator)
    else:
        parser.print_help()
        print("\n示例:")
        print("  python3 cli.py run --tickets data/samples/normal_tickets.csv --audio data/samples/normal_audio_remarks.csv")
        print("  python3 cli.py verify-wrong-caliber")


if __name__ == "__main__":
    main()
