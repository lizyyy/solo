from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Optional

from .models import (
    DriverAccount, OrderIncome, RewardRule, FineRecord,
    FreezeRecord, FreezeStatus, AuditItem, AuditReport,
    ExceptionRecord, ExceptionSeverity,
)
from .importer import DataImporter


class AuditEngine:
    def __init__(self, importer: DataImporter):
        self.importer = importer
        self.report: Optional[AuditReport] = None
        self._exceptions: list[ExceptionRecord] = []
        self._driver_map: dict[str, DriverAccount] = {}
        self._orders_by_driver: dict[str, list[OrderIncome]] = defaultdict(list)
        self._rewards_by_driver: dict[str, list[RewardRule]] = defaultdict(list)
        self._fines_by_driver: dict[str, list[FineRecord]] = defaultdict(list)
        self._freezes_by_driver: dict[str, list[FreezeRecord]] = defaultdict(list)

    def _index_data(self):
        for d in self.importer.drivers:
            self._driver_map[d.driver_id] = d
        for o in self.importer.orders:
            self._orders_by_driver[o.driver_id].append(o)
        for r in self.importer.rewards:
            self._rewards_by_driver[r.driver_id].append(r)
        for f in self.importer.fines:
            self._fines_by_driver[f.driver_id].append(f)
        for fz in self.importer.freezes:
            self._freezes_by_driver[fz.driver_id].append(fz)

    def run_audit(self, audit_date: Optional[date] = None) -> AuditReport:
        self._index_data()
        self._exceptions = []
        self._detect_all_exceptions()

        late_exceptions = self.importer.check_late_arrivals()
        self._exceptions.extend(late_exceptions)

        report = AuditReport(
            audit_date=audit_date or date.today(),
            items=[],
            global_exceptions=late_exceptions,
        )

        all_driver_ids = set(self._driver_map.keys())
        for did in all_driver_ids:
            driver = self._driver_map[did]
            item = self._build_audit_item(driver)
            report.items.append(item)

        for did in set(self._orders_by_driver.keys()) - all_driver_ids:
            item = self._build_audit_item(DriverAccount(driver_id=did, name=f"未知司机({did})", phone=""))
            report.items.append(item)

        driver_exceptions = [e for e in self._exceptions if e.driver_id]
        for exc in driver_exceptions:
            matched = False
            for item in report.items:
                if item.driver_id == exc.driver_id:
                    item.exceptions.append(exc)
                    matched = True
                    break
            if not matched:
                report.global_exceptions.append(exc)

        total_income = sum(it.total_income for it in report.items)
        total_rewards = sum(it.total_rewards for it in report.items)
        total_fines = sum(it.total_fines for it in report.items)
        total_frozen = sum(it.total_frozen for it in report.items)
        total_withdrawable = sum(it.withdrawable for it in report.items)
        total_exceptions = sum(len(it.exceptions) for it in report.items) + len(report.global_exceptions)

        report.summary = {
            "driver_count": len(report.items),
            "total_income": round(total_income, 2),
            "total_rewards": round(total_rewards, 2),
            "total_fines": round(total_fines, 2),
            "total_frozen": round(total_frozen, 2),
            "total_withdrawable": round(total_withdrawable, 2),
            "total_exceptions": total_exceptions,
            "critical_count": sum(1 for e in self._exceptions if e.severity == ExceptionSeverity.CRITICAL),
            "warning_count": sum(1 for e in self._exceptions if e.severity == ExceptionSeverity.WARNING),
        }

        self.report = report
        return report

    def _build_audit_item(self, driver: DriverAccount) -> AuditItem:
        did = driver.driver_id
        orders = self._orders_by_driver.get(did, [])
        rewards = self._rewards_by_driver.get(did, [])
        fines = self._fines_by_driver.get(did, [])
        freezes = self._freezes_by_driver.get(did, [])

        total_income = round(sum(o.net_income for o in orders), 2)
        total_rewards = round(sum(r.amount for r in rewards), 2)
        total_fines_deducted = round(sum(f.amount for f in fines if f.is_deducted), 2)
        total_fines_undeducted = round(sum(f.amount for f in fines if not f.is_deducted), 2)
        total_frozen = round(sum(fz.frozen_amount for fz in freezes), 2)

        gross = total_income + total_rewards - total_fines_deducted
        withdrawable = max(0.0, round(gross - total_frozen, 2))

        item = AuditItem(
            driver_id=did,
            driver_name=driver.name,
            total_income=total_income,
            total_rewards=total_rewards,
            total_fines=total_fines_deducted + total_fines_undeducted,
            total_frozen=total_frozen,
            withdrawable=withdrawable,
            orders=orders,
            rewards=rewards,
            fines=fines,
            freezes=freezes,
        )
        return item

    def _detect_all_exceptions(self):
        self._detect_duplicate_rewards()
        self._detect_undeducted_fines()
        self._detect_late_freeze_releases()
        self._detect_orphan_records()
        self._detect_negative_balance()

    def _detect_duplicate_rewards(self):
        for did, rewards in self._rewards_by_driver.items():
            seen: dict[str, list[RewardRule]] = defaultdict(list)
            for r in rewards:
                key = f"{did}|{r.reward_type}|{r.amount}|{r.reward_date}|{r.order_id or ''}"
                seen[key].append(r)
            for key, group in seen.items():
                if len(group) > 1:
                    ids = [r.reward_id for r in group]
                    self._exceptions.append(ExceptionRecord(
                        driver_id=did,
                        category="奖励重复入账",
                        severity=ExceptionSeverity.ERROR,
                        title="发现重复奖励记录",
                        detail=f"司机 {did} 有 {len(group)} 条相同奖励(类型={group[0].reward_type}, 金额={group[0].amount}, 日期={group[0].reward_date})",
                        suggestion="请核实是否重复发放，若重复应退回多入账部分，或人工确认保留",
                        related_ids=ids,
                        auto_fixable=False,
                    ))

    def _detect_undeducted_fines(self):
        for did, fines in self._fines_by_driver.items():
            undeducted = [f for f in fines if not f.is_deducted]
            if undeducted:
                total_und = round(sum(f.amount for f in undeducted), 2)
                ids = [f.fine_id for f in undeducted]
                self._exceptions.append(ExceptionRecord(
                    driver_id=did,
                    category="罚款未扣",
                    severity=ExceptionSeverity.WARNING,
                    title=f"存在 {len(undeducted)} 笔未扣除罚款",
                    detail=f"司机 {did} 有 {len(undeducted)} 笔罚款合计 ¥{total_und:.2f} 尚未从余额中扣除",
                    suggestion="请确认是否需要补扣，或补充相关处罚材料后人工确认",
                    related_ids=ids,
                    auto_fixable=False,
                ))

    def _detect_late_freeze_releases(self):
        today = date.today()
        for did, freezes in self._freezes_by_driver.items():
            for fz in freezes:
                if fz.status == FreezeStatus.ACTIVE and fz.reason and "解冻" in fz.reason:
                    self._exceptions.append(ExceptionRecord(
                        driver_id=did,
                        category="冻结解除晚到",
                        severity=ExceptionSeverity.WARNING,
                        title="冻结记录标记为生效但原因含'解冻'",
                        detail=f"冻结单 {fz.freeze_id} 状态为生效中，但原因包含'解冻'字样，可能解冻操作延迟",
                        suggestion="确认解冻状态，如确已解除请更新冻结记录，或人工确认后手动释放",
                        related_ids=[fz.freeze_id],
                        auto_fixable=False,
                    ))
                if fz.status == FreezeStatus.ACTIVE:
                    days_active = (today - fz.freeze_date).days
                    if days_active > 30:
                        self._exceptions.append(ExceptionRecord(
                            driver_id=did,
                            category="长期冻结",
                            severity=ExceptionSeverity.INFO,
                            title=f"冻结已持续 {days_active} 天",
                            detail=f"冻结单 {fz.freeze_id} 自 {fz.freeze_date} 起生效，已持续 {days_active} 天",
                            suggestion="如冻结原因已消除，建议及时解除冻结",
                            related_ids=[fz.freeze_id],
                            auto_fixable=False,
                        ))

    def _detect_orphan_records(self):
        known_drivers = set(d.driver_id for d in self.importer.drivers)
        for source_name, records in [
            ("订单收入", self.importer.orders),
            ("奖励规则", self.importer.rewards),
            ("罚款单", self.importer.fines),
            ("冻结记录", self.importer.freezes),
        ]:
            orphan_ids = set()
            for r in records:
                if r.driver_id not in known_drivers:
                    orphan_ids.add(r.driver_id)
            if orphan_ids:
                self._exceptions.append(ExceptionRecord(
                    driver_id="",
                    category="孤立记录",
                    severity=ExceptionSeverity.WARNING,
                    title=f"{source_name}中发现未注册司机",
                    detail=f"有 {len(orphan_ids)} 个司机ID不在司机账户表中: {', '.join(list(orphan_ids)[:5])}",
                    suggestion="核实这些司机是否为新注册但账户数据未同步，或补充司机账户数据",
                    related_ids=list(orphan_ids)[:10],
                    auto_fixable=False,
                ))

    def _detect_negative_balance(self):
        for did, orders in self._orders_by_driver.items():
            rewards = self._rewards_by_driver.get(did, [])
            fines = self._fines_by_driver.get(did, [])
            freezes = self._freezes_by_driver.get(did, [])

            income = sum(o.net_income for o in orders)
            reward_total = sum(r.amount for r in rewards)
            fine_total = sum(f.amount for f in fines)
            frozen = sum(fz.frozen_amount for fz in freezes)

            net = income + reward_total - fine_total - frozen
            if net < 0:
                self._exceptions.append(ExceptionRecord(
                    driver_id=did,
                    category="余额为负",
                    severity=ExceptionSeverity.CRITICAL,
                    title="司机净余额为负数",
                    detail=f"司机 {did} 计算净余额为 ¥{net:.2f}，存在超扣风险",
                    suggestion="检查是否有罚款重复扣除或冻结金额异常，冻结释放后余额应恢复正常",
                    related_ids=[],
                    auto_fixable=False,
                ))

    def get_audit_summary_text(self) -> str:
        if not self.report:
            return "尚未执行审核，请先调用 run_audit()"

        r = self.report
        s = r.summary
        lines = [
            "🔍 网约车司机提现审核报告",
            "═" * 50,
            f"  审核日期: {r.audit_date}",
            f"  涉及司机: {s.get('driver_count', 0)} 人",
            "",
            "💰 金额汇总",
            "─" * 50,
            f"  订单总收入:   ¥{s.get('total_income', 0):>12,.2f}",
            f"  奖励总额:     ¥{s.get('total_rewards', 0):>12,.2f}",
            f"  罚款总额:     ¥{s.get('total_fines', 0):>12,.2f}",
            f"  冻结总额:     ¥{s.get('total_frozen', 0):>12,.2f}",
            f"  可提现总额:   ¥{s.get('total_withdrawable', 0):>12,.2f}",
            "",
            "🚨 异常汇总",
            "─" * 50,
            f"  异常总数: {s.get('total_exceptions', 0)}",
            f"  严重(CRITICAL): {s.get('critical_count', 0)}",
            f"  警告(WARNING):  {s.get('warning_count', 0)}",
        ]

        if r.global_exceptions:
            lines.append("")
            lines.append("📌 全局异常")
            lines.append("─" * 50)
            for exc in r.global_exceptions:
                lines.append(exc.human_readable())

        lines.append("")
        lines.append("👤 各司机审核明细")
        lines.append("─" * 50)
        for item in r.items:
            lines.append(f"\n  {item.driver_name} (ID: {item.driver_id})")
            lines.append(f"    收入: ¥{item.total_income:,.2f} | 奖励: ¥{item.total_rewards:,.2f}")
            lines.append(f"    罚款: ¥{item.total_fines:,.2f} | 冻结: ¥{item.total_frozen:,.2f}")
            lines.append(f"    ✅ 可提现: ¥{item.withdrawable:,.2f}")
            if item.exceptions:
                for exc in item.exceptions:
                    for line in exc.human_readable().split("\n"):
                        lines.append(f"    {line}")

        return "\n".join(lines)
