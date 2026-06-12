#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
押金退款结果报告生成器
将补录来源、处理状态、结论放在同一份结果报告中
"""

from datetime import datetime
from models import DepositRefundOrder, RefundStatus, DataSource, TicketExportRecord


class RefundReportGenerator:

    def __init__(self, order: DepositRefundOrder):
        self.order = order
        self.report_lines = []
        self.report_time = datetime.now()

    def _w(self, line="", indent=0):
        self.report_lines.append("  " * indent + line)

    def _separator(self, char="─", length=74):
        self._w(char * length)

    def _section_title(self, title, icon=""):
        self._w("")
        self._separator("═")
        prefix = f"{icon} " if icon else ""
        self._w(f"{prefix}{title}")
        self._separator("═")

    def generate(self) -> str:
        self._build_header()
        self._build_basic_info()
        self._build_supplement_source_section()
        self._build_process_flow_section()
        self._build_conflict_section()
        self._build_verification_section()
        self._build_history_section()
        self._build_consistency_check_section()
        self._build_conclusion_section()
        return "\n".join(self.report_lines)

    def _build_header(self):
        self._w("╔══════════════════════════════════════════════════════════════════════════╗")
        self._w("║                     乐器租赁押金退款处理结果报告                           ║")
        self._w("╚══════════════════════════════════════════════════════════════════════════╝")
        self._w(f"  报告生成时间: {self.report_time.strftime('%Y-%m-%d %H:%M:%S')}")
        self._w(f"  报告编号    : RPT-{self.order.refund_id}")

    def _build_basic_info(self):
        self._section_title("一、退款单基本信息", "📋")
        self._w(f"  退款单号     : {self.order.refund_id}")
        self._w(f"  学员姓名     : {self.order.student_name}")
        self._w(f"  租赁乐器     : {self.order.instrument_type}")
        self._w(f"  押金金额     : {self.order.deposit_amount:.2f} 元")
        self._w(f"  授权城市列表 : {self.order.authorized_cities}")
        self._w(f"  签到照片数量 : {len(self.order.sign_in_photos)} 张")
        self._w(f"  票务记录数量 : {len(self.order.ticket_records)} 条")

        status_icon_map = {
            RefundStatus.NORMAL: "✅",
            RefundStatus.AREA_MISMATCH: "⚠️ ",
            RefundStatus.CALIBER_CONFLICT: "❌",
            RefundStatus.SUPPLEMENTED: "📎",
            RefundStatus.CONFIRMED: "✅",
            RefundStatus.REJECTED: "❌",
            RefundStatus.PENDING_REVIEW: "⏳",
        }
        icon = status_icon_map.get(self.order.status, "❓")
        self._w(f"  当前订单状态 : {icon} {self.order.status.value}")
        self._w(f"  当前流程步骤 : 第 {self.order.current_step} 步 / 共 3 步")

    def _build_supplement_source_section(self):
        """二、补录来源明细 - 重点：一条后来从票务导出的旧口径记录"""
        self._section_title("二、补录来源明细（后来从票务导出表补来的记录）", "📎")

        old_caliber_tickets = [t for t in self.order.ticket_records if t.is_old_caliber]
        new_caliber_tickets = [t for t in self.order.ticket_records if not t.is_old_caliber]

        self._w(f"  ▶ 新口径票务记录（v2.0）: {len(new_caliber_tickets)} 条")
        if new_caliber_tickets:
            self._w(f"    {'票号':<14}{'课时ID':<12}{'日期':<14}{'城市':<8}{'状态':<10}{'版本':<8}")
            self._w(f"    {'─'*14}{'─'*12}{'─'*14}{'─'*8}{'─'*10}{'─'*8}")
            for t in new_caliber_tickets:
                self._w(f"    {t.ticket_id:<14}{t.lesson_id:<12}"
                        f"{t.class_date.strftime('%Y-%m-%d'):<14}"
                        f"{t.city:<8}{t.ticket_status:<10}{t.export_version:<8}")

        self._w("")
        self._w(f"  ▶ 旧口径补录记录（后来从票务导出表补来）: {len(old_caliber_tickets)} 条")
        if old_caliber_tickets:
            self._w(f"    ╭{'─'*12}┬{'─'*12}┬{'─'*14}┬{'─'*8}┬{'─'*10}┬{'─'*8}┬{'─'*18}╮")
            self._w(f"    │ {'票号':<10}│ {'课时ID':<10}│ {'日期':<12}│ {'城市':<6}│ {'状态':<8}│ {'版本':<6}│ {'导出时间':<16}│")
            self._w(f"    ├{'─'*12}┼{'─'*12}┼{'─'*14}┼{'─'*8}┼{'─'*10}┼{'─'*8}┼{'─'*18}┤")
            for t in old_caliber_tickets:
                self._w(f"    │ {t.ticket_id:<10}│ {t.lesson_id:<10}│ "
                        f"{t.class_date.strftime('%Y-%m-%d'):<12}│ {t.city:<6}│ "
                        f"{t.ticket_status:<8}│ {t.export_version:<6}│ "
                        f"{t.export_time.strftime('%Y-%m-%d %H:%M'):<16}│")
            self._w(f"    ╰{'─'*12}┴{'─'*12}┴{'─'*14}┴{'─'*8}┴{'─'*10}┴{'─'*8}┴{'─'*18}╯")
            self._w("")
            self._w(f"    🔍 补录说明: 以上 {len(old_caliber_tickets)} 条为旧口径 (v1.0) 数据，")
            self._w(f"       来源: 从历史票务导出表回溯补录")
            self._w(f"       处理策略: 经店长确认后纳入核销范围，来源单独标记追溯")
        else:
            self._w("    （无补录记录）")

    def _build_process_flow_section(self):
        """三、三步流程处理状态"""
        self._section_title("三、三步流程处理状态", "🔄")
        steps = [
            (1, "课时签到照片第一次导入", self.order.current_step >= 1,
             [h for h in self.order.history_records if "第一步" in h.action]),
            (2, "琴行店长老周补看票务导出表", self.order.current_step >= 2,
             [h for h in self.order.history_records if "第二步" in h.action]),
            (3, "课时核销单更新", self.order.current_step >= 3,
             [h for h in self.order.history_records if "第三步" in h.action]),
        ]
        for step_num, step_name, done, related_hist in steps:
            mark = "✅ 已完成" if done else "⏳ 未完成"
            self._w(f"  [{mark}] 第{step_num}步: {step_name}")
            if related_hist:
                for h in related_hist:
                    self._w(f"       ↳ {h.detail}", indent=1)

    def _build_conflict_section(self):
        """四、冲突证据与处理"""
        self._section_title("四、冲突证据与处理结果", "⚖️")

        if self.order.conflicts:
            self._w(f"  ⚠  当前待处理冲突: {len(self.order.conflicts)} 处")
            for c in self.order.conflicts:
                self._w(f"")
                self._w(f"  ┌─ 冲突编号: {c.conflict_id} ─────────────────────────────────────┐")
                self._w(f"  │  字段名称     : {c.field_name}")
                self._w(f"  │  照片端({c.photo_source}): {c.photo_value}")
                self._w(f"  │  票务端({c.ticket_source}): {c.ticket_value}")
                self._w(f"  │  详细描述     : {c.description}")
                self._w(f"  │  处理建议     : 请店长老周选择 【确认(采纳照片)】 或 【驳回(采纳票务)】")
                self._w(f"  └─────────────────────────────────────────────────────────────┘")
        else:
            self._w("  ✅ 无待处理冲突")

        resolved_hist = [h for h in self.order.history_records if "冲突处理" in h.action]
        if resolved_hist:
            self._w("")
            self._w(f"  📝 已解决冲突记录: {len(resolved_hist)} 条")
            for h in resolved_hist:
                self._w(f"     • {h.detail}")

    def _build_verification_section(self):
        """五、课时核销单详情"""
        self._section_title("五、课时核销单详情", "🧾")

        if not self.order.lesson_verifications:
            self._w("  ⏳ 尚未生成核销单")
            return

        v = self.order.lesson_verifications[0]
        self._w(f"  核销单号      : {v.verification_id}")
        self._w(f"  学员          : {v.student_name}")
        self._w(f"  核销课时数    : {v.verified_count} 节")
        self._w(f"  总课时费      : {v.total_fee:.2f} 元")
        self._w(f"  应退押金金额  : {v.deposit_refund_amount:.2f} 元")

        status_color = "✅" if v.status == "已核销" else "⏳"
        self._w(f"  核销单状态    : {status_color} {v.status}")
        self._w(f"  核销生成时间  : {v.verification_time.strftime('%Y-%m-%d %H:%M:%S') if v.verification_time else 'N/A'}")

        if v.params:
            self._w("")
            self._w(f"  🔧 专业计算参数（版本: {v.params[0].param_version}）")
            self._w(f"    ╭{'─'*18}┬{'─'*12}┬{'─'*12}┬{'─'*40}╮")
            self._w(f"    │ {'参数名':<16}│ {'参数值':<10}│ {'版本':<10}│ {'取舍理由':<38}│")
            self._w(f"    ├{'─'*18}┼{'─'*12}┼{'─'*12}┼{'─'*40}┤")
            for p in v.params:
                val_str = str(p.param_value)
                reason = p.trade_off_reason
                if len(reason) > 36:
                    reason = reason[:34] + ".."
                self._w(f"    │ {p.param_name:<16}│ {val_str:<10}│ {p.param_version:<10}│ {reason:<38}│")
            self._w(f"    ╰{'─'*18}┴{'─'*12}┴{'─'*12}┴{'─'*40}╯")

    def _build_history_section(self):
        """六、完整历史记录追溯"""
        self._section_title("六、完整历史记录追溯", "📜")
        self._w(f"  共 {len(self.order.history_records)} 条记录")
        self._w("")
        self._w(f"    {'编号':<8}{'时间':<10}{'操作人':<12}{'来源':<14}  操作/详情")
        self._w(f"    {'─'*8}{'─'*10}{'─'*12}{'─'*14}{'─'*30}")
        for h in self.order.history_records:
            src = h.data_source.value if h.data_source else "系统内"
            t = h.timestamp.strftime("%H:%M:%S")
            self._w(f"    {h.record_id:<8}{t:<10}{h.operator:<12}{src:<14}  {h.action}")
            self._w(f"    {'':<8}{'':<10}{'':<12}{'':<14}  ↳ {h.detail}")

    def _build_consistency_check_section(self):
        """七、关键一致性自检"""
        self._section_title("七、关键一致性自检（重点核对）", "🔍")

        checks = []

        check1_pass = True
        check1_detail = f"订单状态='{self.order.status.value}'"
        if self.order.lesson_verifications:
            v = self.order.lesson_verifications[0]
            if v.status == "已核销":
                expected = [RefundStatus.NORMAL, RefundStatus.CONFIRMED, RefundStatus.SUPPLEMENTED]
                if self.order.status not in expected:
                    check1_pass = False
                    check1_detail += f" ❌ 但核销单='已核销'，订单状态应∈[正常通过/已确认/补录完成]"
                else:
                    check1_detail += f" ✅ 核销单='已核销'，一致"
            elif v.status == "待确认":
                expected = [RefundStatus.AREA_MISMATCH, RefundStatus.CALIBER_CONFLICT]
                if self.order.status not in expected:
                    check1_pass = False
                    check1_detail += f" ❌ 核销单='待确认'但订单='{self.order.status.value}'，矛盾"
                else:
                    check1_detail += f" ✅ 核销单='待确认'，一致"
        checks.append(("订单状态 ↔ 核销单状态", check1_pass, check1_detail))

        check2_pass = True
        check2_detail = ""
        last_hist = self.order.history_records[-1] if self.order.history_records else None
        if last_hist and "第三步" in last_hist.action:
            if "已完成核销" in last_hist.detail:
                if self.order.lesson_verifications and self.order.lesson_verifications[0].status == "已核销":
                    check2_detail = f"历史最后写'已完成核销' ✅ 核销单='已核销'，一致"
                else:
                    check2_pass = False
                    check2_detail = f"历史最后写'已完成核销' ❌ 但核销单≠'已核销'，不一致！"
            elif "待店长确认后核销" in last_hist.detail or "待解决冲突后核销" in last_hist.detail:
                if self.order.lesson_verifications and self.order.lesson_verifications[0].status == "待确认":
                    check2_detail = f"历史最后写'待确认核销' ✅ 核销单='待确认'，一致"
                else:
                    check2_pass = False
                    check2_detail = f"历史最后写'待确认核销' ❌ 但核销单≠'待确认'，不一致！"
        checks.append(("历史记录 ↔ 核销单状态", check2_pass, check2_detail))

        check3_pass = True
        check3_detail = ""
        old_caliber = [t for t in self.order.ticket_records if t.is_old_caliber]
        if old_caliber and self.order.lesson_verifications:
            v = self.order.lesson_verifications[0]
            normal_new = len([t for t in self.order.ticket_records
                              if not t.is_old_caliber and t.ticket_status == "已使用"])
            expected_total = normal_new + len(old_caliber)
            if v.verified_count >= expected_total:
                check3_detail = (f"补录{len(old_caliber)}条 → 核销课时{v.verified_count}节 "
                                 f"✅ 旧口径记录已纳入核销范围")
            else:
                check3_pass = False
                check3_detail = (f"补录{len(old_caliber)}条 → 核销仅{v.verified_count}节 "
                                 f"❌ 旧口径未纳入！")
        elif not old_caliber:
            check3_detail = "无补录记录，跳过补录一致性检查"
        checks.append(("补录来源 → 核销课时", check3_pass, check3_detail))

        all_pass = all(c[1] for c in checks)
        for name, passed, detail in checks:
            icon = "✅" if passed else "❌"
            self._w(f"  {icon}  {name}")
            self._w(f"      {detail}")
            self._w("")

        if all_pass:
            self._w("  🎉 全部一致性检查通过！")
        else:
            self._w("  ⚠  存在一致性问题，请关注以上 ❌ 项")

    def _build_conclusion_section(self):
        """八、最终结论（补录来源+处理状态+结论统一呈现）"""
        self._section_title("八、最终结论（统一呈现）", "🎯")

        old_caliber_count = len([t for t in self.order.ticket_records if t.is_old_caliber])

        self._w("  ┌─────────────────────────────────────────────────────────────────────┐")
        self._w(f"  │  📎 补录来源: 票务导出表旧口径 v1.0，共 {old_caliber_count} 条回溯记录         │")

        if self.order.status == RefundStatus.NORMAL:
            self._w("  │  📊 处理状态: 正常通过                                             │")
            self._w("  │  🧾 核销状态: 已完成核销                                           │")
        elif self.order.status == RefundStatus.SUPPLEMENTED:
            self._w("  │  📊 处理状态: 补录完成（含旧口径）                                  │")
            self._w("  │  🧾 核销状态: 已完成核销，补录来源已标记                            │")
        elif self.order.status == RefundStatus.AREA_MISMATCH:
            self._w("  │  📊 处理状态: 授权地区待确认（未自动归一化）                        │")
            self._w("  │  🧾 核销状态: 待店长确认后核销                                      │")
            self._w("  │  💡 下一步:  请店长老周在授权城市列表中补填缺漏城市后继续            │")
        elif self.order.status == RefundStatus.CALIBER_CONFLICT:
            self._w("  │  📊 处理状态: 口径冲突待确认                                        │")
            self._w("  │  🧾 核销状态: 待解决冲突后核销                                      │")
            self._w("  │  💡 下一步:  请店长老周在第四节冲突列表中选【确认】或【驳回】        │")
        elif self.order.status == RefundStatus.CONFIRMED:
            self._w("  │  📊 处理状态: 店长已确认                                            │")
            self._w("  │  🧾 核销状态: 已完成核销                                           │")

        if self.order.lesson_verifications:
            v = self.order.lesson_verifications[0]
            self._w(f"  │  💰 财务结论: 核销{v.verified_count}节, 课时费{v.total_fee:.2f}元, "
                    f"应退押金{v.deposit_refund_amount:.2f}元          │")

        hist_count = len(self.order.history_records)
        conflict_pending = len(self.order.conflicts)
        self._w(f"  │  📜 可追溯性: 历史记录{hist_count}条, 待处理冲突{conflict_pending}处"
                f"{' ' * (34 - len(str(hist_count)) - len(str(conflict_pending)))}│")
        self._w("  └─────────────────────────────────────────────────────────────────────┘")

        self._w("")
        if self.order.store_manager_note:
            self._w(f"  📝 店长备注: {self.order.store_manager_note}")
        self._w("  ✍  报告责任人: 琴行店长-老周")
        self._w(f"  📅 报告生效时间: {self.report_time.strftime('%Y-%m-%d %H:%M:%S')}")


def print_report_banner():
    print("\n" + "=" * 80)
    print("  📄 押金退款结果报告 - 补录来源 / 处理状态 / 结论 统一呈现")
    print("=" * 80 + "\n")
