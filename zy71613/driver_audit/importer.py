from __future__ import annotations

import csv
import io
import json
from datetime import datetime, date
from pathlib import Path
from typing import Optional

from .models import (
    DriverAccount, OrderIncome, RewardRule, FineRecord,
    FreezeRecord, ExceptionRecord, ExceptionSeverity,
)


DATE_FORMATS = [
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%Y年%m月%d日",
    "%Y.%m.%d",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%S.%f",
    "%Y-%m-%d %H:%M:%S",
    "%Y/%m/%d %H:%M:%S",
]


def parse_date(raw: str | None) -> Optional[date]:
    if not raw or not isinstance(raw, str):
        return None
    raw = raw.strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).date()
        except (ValueError, TypeError):
            continue
    try:
        ts = float(raw)
        return datetime.fromtimestamp(ts).date()
    except (ValueError, TypeError, OSError):
        pass
    return None


def parse_float(raw, default: float = 0.0) -> float:
    if raw is None:
        return default
    try:
        s = str(raw).strip().replace(",", "").replace("￥", "").replace("¥", "")
        return float(s)
    except (ValueError, TypeError):
        return default


class ImportWarning:
    def __init__(self, row_index: int, field: str, raw_value, message: str):
        self.row_index = row_index
        self.field = field
        self.raw_value = raw_value
        self.message = message

    def __str__(self):
        return f"第{self.row_index}行 字段'{self.field}'(值='{self.raw_value}'): {self.message}"


class DataImporter:
    def __init__(self):
        self.warnings: list[ImportWarning] = []
        self.drivers: list[DriverAccount] = []
        self.orders: list[OrderIncome] = []
        self.rewards: list[RewardRule] = []
        self.fines: list[FineRecord] = []
        self.freezes: list[FreezeRecord] = []
        self._driver_name_index: dict[str, list[DriverAccount]] = {}
        self._loaded_sources: dict[str, datetime] = {}

    def _load_file(self, path: str) -> list[dict]:
        p = Path(path)
        if not p.exists():
            raise FileNotFoundError(f"数据文件不存在: {path}")
        self._loaded_sources[p.name] = datetime.now()

        if p.suffix.lower() == ".json":
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                return data
            if isinstance(data, dict):
                for key in ("data", "records", "items", "list", "results"):
                    if key in data and isinstance(data[key], list):
                        return data[key]
                return [data]
            return []

        if p.suffix.lower() == ".csv":
            with open(p, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                return [dict(row) for row in reader]

        raise ValueError(f"不支持的文件格式: {p.suffix}")

    def _normalize_keys(self, row: dict) -> dict:
        result = {}
        key_map = {
            "司机ID": "driver_id", "司机id": "driver_id", "driver_id": "driver_id",
            "姓名": "name", "name": "name", "司机姓名": "name",
            "手机号": "phone", "phone": "phone", "手机": "phone",
            "身份证": "id_card", "id_card": "id_card", "身份证号": "id_card",
            "银行卡": "bank_account", "bank_account": "bank_account",
            "注册日期": "registered_at", "registered_at": "registered_at",
            "订单ID": "order_id", "order_id": "order_id", "订单id": "order_id",
            "金额": "amount", "amount": "amount", "收入金额": "amount",
            "订单日期": "order_date", "order_date": "order_date",
            "平台服务费": "platform_fee", "platform_fee": "platform_fee",
            "乘客小费": "passenger_tip", "passenger_tip": "passenger_tip",
            "奖励ID": "reward_id", "reward_id": "reward_id", "奖励id": "reward_id",
            "奖励类型": "reward_type", "reward_type": "reward_type",
            "奖励日期": "reward_date", "reward_date": "reward_date",
            "原因": "reason", "reason": "reason", "奖励原因": "reason",
            "罚款ID": "fine_id", "fine_id": "fine_id", "罚款id": "fine_id",
            "罚款日期": "fine_date", "fine_date": "fine_date",
            "是否已扣": "is_deducted", "is_deducted": "is_deducted",
            "冻结ID": "freeze_id", "freeze_id": "freeze_id", "冻结id": "freeze_id",
            "冻结日期": "freeze_date", "freeze_date": "freeze_date",
            "冻结状态": "status", "status": "status",
            "解冻日期": "released_date", "released_date": "released_date",
            "解冻金额": "released_amount", "released_amount": "released_amount",
        }
        for k, v in row.items():
            nk = key_map.get(k.strip(), k.strip())
            result[nk] = v
        return result

    def import_drivers(self, path: str) -> list[DriverAccount]:
        rows = self._load_file(path)
        result = []
        for i, raw in enumerate(rows, 1):
            row = self._normalize_keys(raw)
            try:
                driver = DriverAccount(
                    driver_id=str(row.get("driver_id", "")).strip(),
                    name=str(row.get("name", "")).strip(),
                    phone=str(row.get("phone", "")).strip(),
                    id_card=str(row.get("id_card", "")).strip() or None,
                    bank_account=str(row.get("bank_account", "")).strip() or None,
                    registered_at=parse_date(row.get("registered_at")),
                    raw_data=raw,
                )
                if not driver.driver_id:
                    self.warnings.append(ImportWarning(i, "driver_id", row.get("driver_id"), "司机ID为空，跳过"))
                    continue
                if not driver.name:
                    self.warnings.append(ImportWarning(i, "name", row.get("name"), "司机姓名为空"))
                result.append(driver)
            except Exception as e:
                self.warnings.append(ImportWarning(i, "_all", raw, f"解析失败: {e}"))

        self._check_same_name_drivers(result)
        self.drivers.extend(result)
        return result

    def _check_same_name_drivers(self, new_drivers: list[DriverAccount]):
        all_drivers = self.drivers + new_drivers
        name_groups: dict[str, list[DriverAccount]] = {}
        for d in all_drivers:
            name_groups.setdefault(d.name, []).append(d)
        for name, group in name_groups.items():
            if len(group) > 1:
                ids = ", ".join(d.driver_id for d in group)
                self.warnings.append(ImportWarning(
                    0, "name", name,
                    f"发现同名司机({len(group)}人): {ids}，已按 driver_id 区分"
                ))
        self._driver_name_index = name_groups

    def import_orders(self, path: str) -> list[OrderIncome]:
        rows = self._load_file(path)
        result = []
        for i, raw in enumerate(rows, 1):
            row = self._normalize_keys(raw)
            d = parse_date(row.get("order_date"))
            if not d:
                self.warnings.append(ImportWarning(i, "order_date", row.get("order_date"), "订单日期无法解析，跳过"))
                continue
            order = OrderIncome(
                order_id=str(row.get("order_id", f"ORD_AUTO_{i}")).strip(),
                driver_id=str(row.get("driver_id", "")).strip(),
                amount=parse_float(row.get("amount")),
                order_date=d,
                platform_fee=parse_float(row.get("platform_fee")),
                passenger_tip=parse_float(row.get("passenger_tip")),
                raw_data=raw,
            )
            if not order.driver_id:
                self.warnings.append(ImportWarning(i, "driver_id", row.get("driver_id"), "订单缺少司机ID"))
                continue
            result.append(order)
        self.orders.extend(result)
        return result

    def import_rewards(self, path: str) -> list[RewardRule]:
        rows = self._load_file(path)
        result = []
        for i, raw in enumerate(rows, 1):
            row = self._normalize_keys(raw)
            d = parse_date(row.get("reward_date"))
            if not d:
                self.warnings.append(ImportWarning(i, "reward_date", row.get("reward_date"), "奖励日期无法解析，跳过"))
                continue
            reward = RewardRule(
                reward_id=str(row.get("reward_id", f"RWD_AUTO_{i}")).strip(),
                driver_id=str(row.get("driver_id", "")).strip(),
                reward_type=str(row.get("reward_type", "未分类")).strip(),
                amount=parse_float(row.get("amount")),
                reward_date=d,
                reason=str(row.get("reason", "")).strip(),
                order_id=str(row.get("order_id", "")).strip() or None,
                raw_data=raw,
            )
            if not reward.driver_id:
                self.warnings.append(ImportWarning(i, "driver_id", row.get("driver_id"), "奖励缺少司机ID"))
                continue
            result.append(reward)
        self.rewards.extend(result)
        return result

    def import_fines(self, path: str) -> list[FineRecord]:
        rows = self._load_file(path)
        result = []
        for i, raw in enumerate(rows, 1):
            row = self._normalize_keys(raw)
            d = parse_date(row.get("fine_date"))
            if not d:
                self.warnings.append(ImportWarning(i, "fine_date", row.get("fine_date"), "罚款日期无法解析，跳过"))
                continue
            deducted = row.get("is_deducted", False)
            if isinstance(deducted, str):
                deducted = deducted.strip().lower() in ("true", "1", "是", "已扣", "yes")
            fine = FineRecord(
                fine_id=str(row.get("fine_id", f"FNE_AUTO_{i}")).strip(),
                driver_id=str(row.get("driver_id", "")).strip(),
                amount=parse_float(row.get("amount")),
                fine_date=d,
                reason=str(row.get("reason", "")).strip(),
                order_id=str(row.get("order_id", "")).strip() or None,
                is_deducted=bool(deducted),
                raw_data=raw,
            )
            if not fine.driver_id:
                self.warnings.append(ImportWarning(i, "driver_id", row.get("driver_id"), "罚款缺少司机ID"))
                continue
            result.append(fine)
        self.fines.extend(result)
        return result

    def import_freezes(self, path: str) -> list[FreezeRecord]:
        rows = self._load_file(path)
        result = []
        for i, raw in enumerate(rows, 1):
            row = self._normalize_keys(raw)
            d = parse_date(row.get("freeze_date"))
            if not d:
                self.warnings.append(ImportWarning(i, "freeze_date", row.get("freeze_date"), "冻结日期无法解析，跳过"))
                continue
            status_str = str(row.get("status", "active")).strip().lower()
            status_map = {
                "active": "active", "生效中": "active", "冻结": "active",
                "released": "released", "已解冻": "released", "解冻": "released",
                "partial": "partial", "部分解冻": "partial",
            }
            status = status_map.get(status_str, "active")

            freeze = FreezeRecord(
                freeze_id=str(row.get("freeze_id", f"FRZ_AUTO_{i}")).strip(),
                driver_id=str(row.get("driver_id", "")).strip(),
                amount=parse_float(row.get("amount")),
                freeze_date=d,
                reason=str(row.get("reason", "")).strip(),
                status=status,
                released_date=parse_date(row.get("released_date")),
                released_amount=parse_float(row.get("released_amount")),
                raw_data=raw,
            )
            if not freeze.driver_id:
                self.warnings.append(ImportWarning(i, "driver_id", row.get("driver_id"), "冻结记录缺少司机ID"))
                continue
            result.append(freeze)
        self.freezes.extend(result)
        return result

    def check_late_arrivals(self, reference_time: Optional[datetime] = None) -> list[ExceptionRecord]:
        if not self._loaded_sources:
            return []
        exceptions = []
        if reference_time is None:
            reference_time = datetime.now()

        main_sources = [k for k in self._loaded_sources if "driver" in k.lower() or "order" in k.lower()]
        attach_sources = [k for k in self._loaded_sources if k not in main_sources]

        if main_sources and attach_sources:
            main_time = min(self._loaded_sources[k] for k in main_sources)
            for k in attach_sources:
                attach_time = self._loaded_sources[k]
                delay = (attach_time - main_time).total_seconds()
                if delay > 43200:
                    exceptions.append(ExceptionRecord(
                        driver_id="",
                        category="数据延迟",
                        severity=ExceptionSeverity.WARNING,
                        title=f"附件数据晚到: {k}",
                        detail=f"主表最晚到达 {main_time.strftime('%Y-%m-%d %H:%M')}，附件 {k} 到达 {attach_time.strftime('%Y-%m-%d %H:%M')}，延迟 {delay/3600:.1f} 小时",
                        suggestion="确认附件数据是否完整，必要时等待补充后重新审核",
                        related_ids=[k],
                        auto_fixable=False,
                    ))

        return exceptions

    def get_import_summary(self) -> str:
        lines = [
            "📋 数据导入汇总",
            "─" * 40,
            f"  司机账户: {len(self.drivers)} 条",
            f"  订单收入: {len(self.orders)} 条",
            f"  奖励规则: {len(self.rewards)} 条",
            f"  罚款单:   {len(self.fines)} 条",
            f"  冻结记录: {len(self.freezes)} 条",
        ]
        if self.warnings:
            lines.append(f"\n  ⚠️ 导入警告: {len(self.warnings)} 条")
            for w in self.warnings[:10]:
                lines.append(f"    · {w}")
            if len(self.warnings) > 10:
                lines.append(f"    · ... 还有 {len(self.warnings)-10} 条")
        return "\n".join(lines)
