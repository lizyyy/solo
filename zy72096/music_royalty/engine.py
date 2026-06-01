from typing import Dict, List, Optional, Tuple
from .models import (
    RoyaltyRecord, RoyaltyResult, AuditEntry, RevenueType,
    PlayCountUnit, PerPlayUnit, ShareFormat, Currency
)
from .units import UnitConverter
from .audit import AuditLogger


BOUNDARY_RULES = {
    "play_count": {"min": 0, "max": 1e12, "label": "播放量"},
    "per_play_revenue": {"min": 0, "max": 100, "label": "单次播放收益(元/次)"},
    "decay_factor": {"min": 0.0, "max": 1.0, "label": "衰减系数"},
    "platform_share": {"min": 0.0, "max": 1.0, "label": "平台分成(小数)"},
    "rights_share": {"min": 0.0, "max": 1.0, "label": "版权方分成(小数)"},
    "months_since_release": {"min": 0, "max": 600, "label": "距发行月数"},
}

SUSPICIOUS_RANGES = {
    "platform_share": {"low_suspect": 0.10, "high_suspect": 0.90, "label": "平台分成(小数)"},
    "rights_share": {"low_suspect": 0.10, "high_suspect": 0.95, "label": "版权方分成(小数)"},
    "decay_factor": {"low_suspect": 0.80, "high_suspect": None, "label": "衰减系数"},
}

DEFAULT_DECAY_FACTOR = 0.90
DEFAULT_PLATFORM_SHARE = 0.60
DEFAULT_RIGHTS_SHARE = 0.70


class RoyaltyEngine:
    def __init__(self, param_store=None, audit_logger: Optional[AuditLogger] = None):
        self.param_store = param_store
        self.audit_logger = audit_logger or AuditLogger()
        self.converter = UnitConverter()

    def _is_manually_adjusted(self, record_id: str, field: str) -> bool:
        if not self.param_store:
            return False
        all_params = self.param_store.get_all(record_id)
        info = all_params.get(field)
        return isinstance(info, dict) and info.get("manually_adjusted", False)

    def _get_param(self, record: RoyaltyRecord, field: str, default: float) -> Tuple[float, str]:
        if self._is_manually_adjusted(record.record_id, field):
            stored = self.param_store.get(record.record_id, field)
            return stored, "参数表(人工调整,不可覆盖)"
        if self.param_store:
            stored = self.param_store.get(record.record_id, field)
            if stored is not None:
                return stored, "参数表(已持久化)"
        record_val = getattr(record, field, None)
        if record_val is not None:
            return record_val, "导入数据"
        return default, "默认值"

    def _check_boundaries(self, field: str, value: float) -> List[str]:
        warnings = []
        rule = BOUNDARY_RULES.get(field)
        if not rule:
            return warnings
        if value < rule["min"]:
            warnings.append(
                f"⚠ {rule['label']}={value} 低于下限 {rule['min']}"
            )
        if value > rule["max"]:
            warnings.append(
                f"⚠ {rule['label']}={value} 超过上限 {rule['max']}"
            )
        suspect = SUSPICIOUS_RANGES.get(field)
        if suspect and rule["min"] <= value <= rule["max"]:
            low = suspect.get("low_suspect")
            high = suspect.get("high_suspect")
            if low is not None and value < low:
                warnings.append(
                    f"⚠ {suspect['label']}={value} 虽在有效范围但偏低(常见>{low})，"
                    f"可能是百分比/小数格式搞错"
                )
            if high is not None and value > high:
                warnings.append(
                    f"⚠ {suspect['label']}={value} 虽在有效范围但偏高(常见<{high})"
                )
        return warnings

    def calculate(self, record: RoyaltyRecord) -> RoyaltyResult:
        norm = self.converter.normalize_record(record)
        play_count_times = norm["play_count_times"]
        per_play_yuan = norm["per_play_yuan"]
        platform_share_d = norm["platform_share_decimal"]
        rights_share_d = norm["rights_share_decimal"]

        decay_factor, decay_source = self._get_param(
            record, "decay_factor", DEFAULT_DECAY_FACTOR
        )

        platform_share, platform_source = self._get_param(
            record, "platform_share", DEFAULT_PLATFORM_SHARE
        )
        if record.platform_share is not None and platform_source.startswith("导入数据"):
            platform_share = platform_share_d if platform_share_d > 0 else platform_share

        rights_share, rights_source = self._get_param(
            record, "rights_share", DEFAULT_RIGHTS_SHARE
        )
        if record.rights_share is not None and rights_source.startswith("导入数据"):
            rights_share = rights_share_d if rights_share_d > 0 else rights_share

        months = record.months_since_release or 0
        years = months / 12.0

        boundary_warnings = []
        boundary_warnings.extend(self._check_boundaries("play_count", play_count_times))
        boundary_warnings.extend(self._check_boundaries("per_play_revenue", per_play_yuan))
        boundary_warnings.extend(self._check_boundaries("decay_factor", decay_factor))
        boundary_warnings.extend(self._check_boundaries("platform_share", platform_share))
        boundary_warnings.extend(self._check_boundaries("rights_share", rights_share))
        boundary_warnings.extend(self._check_boundaries("months_since_release", months))

        decay_multiplier = decay_factor ** years

        formula_steps = [
            f"1. 播放量标准化: {record.play_count} {record.play_count_unit.value} → {play_count_times:,.0f} 次",
            f"2. 单次收益标准化: {record.per_play_revenue} {record.per_play_revenue_unit.value} → {per_play_yuan:.6f} 元/次",
            f"3. 衰减计算: {decay_factor}^{years:.2f}年 = {decay_multiplier:.6f}",
            f"4. 毛收益 = 播放量 × 单次收益 × 衰减 = {play_count_times:,.0f} × {per_play_yuan:.6f} × {decay_multiplier:.6f}",
        ]

        gross_revenue = play_count_times * per_play_yuan * decay_multiplier

        formula_steps.append(
            f"   毛收益 = {gross_revenue:,.2f} 元"
        )

        formula_steps.append(
            f"5. 平台分成: 毛收益 × {platform_share:.4f} (来源: {platform_source})"
        )
        formula_steps.append(
            f"6. 版权方分成: (毛收益 - 平台分成) × {rights_share:.4f} (来源: {rights_source})"
        )

        platform_amount = gross_revenue * platform_share
        remaining = gross_revenue - platform_amount
        net_revenue = remaining * rights_share

        formula_steps.append(
            f"7. 净收益 = ({gross_revenue:,.2f} - {platform_amount:,.2f}) × {rights_share:.4f}"
        )
        formula_steps.append(
            f"   净收益 = {remaining:,.2f} × {rights_share:.4f} = {net_revenue:,.2f} 元"
        )

        if record.currency == Currency.USD:
            net_revenue_cny = self.converter.to_cny(net_revenue, Currency.USD)
            formula_steps.append(
                f"8. USD→CNY: {net_revenue:,.2f} 美元 × 7.25 = {net_revenue_cny:,.2f} 元"
            )
            net_revenue = net_revenue_cny

        audit_entry = self.audit_logger.log_calculation(
            record_id=record.record_id,
            source=record.source or "导入数据",
            params_used={
                "decay_factor": (decay_factor, decay_source),
                "platform_share": (platform_share, platform_source),
                "rights_share": (rights_share, rights_source),
            },
            result=net_revenue,
        )

        return RoyaltyResult(
            record_id=record.record_id,
            work_title=record.work_title,
            revenue_type=record.revenue_type.value,
            play_count_normalized=play_count_times,
            play_count_unit_used="次",
            per_play_revenue_normalized=per_play_yuan,
            per_play_revenue_unit_used="元/次",
            decay_factor_used=decay_factor,
            decay_source=decay_source,
            platform_share_used=platform_share,
            platform_share_source=platform_source,
            rights_share_used=rights_share,
            rights_share_source=rights_source,
            months_since_release=months,
            gross_revenue=round(gross_revenue, 2),
            net_revenue=round(net_revenue, 2),
            revenue_currency="CNY",
            formula_steps=formula_steps,
            boundary_warnings=boundary_warnings,
            is_exception=record.is_exception,
            exception_note=record.exception_note,
            audit_entries=[audit_entry],
        )

    def calculate_batch(self, records: List[RoyaltyRecord]) -> List[RoyaltyResult]:
        return [self.calculate(r) for r in records]
