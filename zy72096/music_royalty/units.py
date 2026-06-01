from .models import (
    PlayCountUnit, RevenueUnit, PerPlayUnit, TimePeriod,
    ShareFormat, Currency, RoyaltyRecord
)


PLAY_COUNT_TO_TIMES = {
    PlayCountUnit.TIMES: 1.0,
    PlayCountUnit.TEN_THOUSAND: 10000.0,
    PlayCountUnit.MILLION: 1000000.0,
}

PER_PLAY_TO_YUAN_PER_PLAY = {
    PerPlayUnit.YUAN_PER_PLAY: 1.0,
    PerPlayUnit.YUAN_PER_1K: 0.001,
    PerPlayUnit.USD_PER_STREAM: 0.0072,
}

CURRENCY_TO_CNY = {
    Currency.CNY: 1.0,
    Currency.USD: 7.25,
}

PERCENT_TO_DECIMAL = 100.0
MONTHS_PER_YEAR = 12


class UnitConverter:
    @staticmethod
    def play_count_to_times(count: float, unit: PlayCountUnit) -> float:
        factor = PLAY_COUNT_TO_TIMES.get(unit)
        if factor is None:
            raise ValueError(f"未知播放量单位: {unit}")
        return count * factor

    @staticmethod
    def per_play_to_yuan_per_play(revenue: float, unit: PerPlayUnit) -> float:
        factor = PER_PLAY_TO_YUAN_PER_PLAY.get(unit)
        if factor is None:
            raise ValueError(f"未知单次收益单位: {unit}")
        return revenue * factor

    @staticmethod
    def to_cny(amount: float, currency: Currency) -> float:
        rate = CURRENCY_TO_CNY.get(currency)
        if rate is None:
            raise ValueError(f"未知货币: {currency}")
        return amount * rate

    @staticmethod
    def share_to_decimal(value: float, fmt: ShareFormat) -> float:
        if fmt == ShareFormat.PERCENT:
            return value / PERCENT_TO_DECIMAL
        return value

    @staticmethod
    def decimal_to_percent(value: float) -> float:
        return value * PERCENT_TO_DECIMAL

    @staticmethod
    def months_to_years(months: int) -> float:
        return months / MONTHS_PER_YEAR

    @staticmethod
    def normalize_record(record: RoyaltyRecord) -> dict:
        return {
            "play_count_times": UnitConverter.play_count_to_times(
                record.play_count, record.play_count_unit
            ),
            "per_play_yuan": UnitConverter.per_play_to_yuan_per_play(
                record.per_play_revenue, record.per_play_revenue_unit
            ),
            "platform_share_decimal": UnitConverter.share_to_decimal(
                record.platform_share or 0.0, record.share_format
            ),
            "rights_share_decimal": UnitConverter.share_to_decimal(
                record.rights_share or 0.0, record.share_format
            ),
        }

    @staticmethod
    def detect_play_count_unit(value: float) -> PlayCountUnit:
        if value < 1000:
            return PlayCountUnit.TEN_THOUSAND
        if value < 100000:
            return PlayCountUnit.TIMES
        return PlayCountUnit.MILLION

    @staticmethod
    def unit_label(unit) -> str:
        return unit.value if hasattr(unit, "value") else str(unit)
