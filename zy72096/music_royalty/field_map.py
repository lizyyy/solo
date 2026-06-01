from typing import Dict, List, Optional, Tuple
from .models import (
    RoyaltyRecord, RevenueType, PlayCountUnit,
    PerPlayUnit, ShareFormat, Currency
)


FIELD_ALIASES: Dict[str, Dict[str, str]] = {
    "record_id": {
        "record_id", "编号", "ID", "id", "序号", "记录编号", "曲目编号"
    },
    "work_title": {
        "work_title", "作品名", "曲名", "歌曲名", "作品名称", "名称", "标题"
    },
    "revenue_type": {
        "revenue_type", "收益类型", "类型", "收入类型", "版权类型"
    },
    "play_count": {
        "play_count", "播放量", "播放次数", "播放数", "流量", "流媒体量"
    },
    "play_count_unit": {
        "play_count_unit", "播放量单位", "单位_播放", "播放单位"
    },
    "per_play_revenue": {
        "per_play_revenue", "单次收益", "每次收益", "单播收益", "千播收益",
        "每流收益", "单价", "单位收益"
    },
    "per_play_revenue_unit": {
        "per_play_revenue_unit", "收益单位", "单价单位", "单位_收益"
    },
    "decay_factor": {
        "decay_factor", "衰减系数", "衰减率", "衰减", "长尾系数"
    },
    "platform_share": {
        "platform_share", "平台分成", "平台比例", "平台抽成", "平台占比"
    },
    "rights_share": {
        "rights_share", "版权分成", "版权比例", "权利方分成", "权利方占比",
        "词曲分成", "版权方比例", "版权方分成"
    },
    "months_since_release": {
        "months_since_release", "距发行月数", "发行月数", "月数", "时长_月",
        "距发行", "上架月数"
    },
    "share_format": {
        "share_format", "分成格式", "格式_分成"
    },
    "currency": {
        "currency", "币种", "货币", "币"
    },
    "source": {
        "source", "来源", "数据来源", "原始来源"
    },
}

REVENUE_TYPE_ALIASES: Dict[str, RevenueType] = {
    "流媒体播放": RevenueType.STREAMING,
    "流媒体": RevenueType.STREAMING,
    "播放": RevenueType.STREAMING,
    "streaming": RevenueType.STREAMING,
    "同步授权": RevenueType.SYNC_LICENSE,
    "同步": RevenueType.SYNC_LICENSE,
    "sync": RevenueType.SYNC_LICENSE,
    "下载收益": RevenueType.DOWNLOAD,
    "下载": RevenueType.DOWNLOAD,
    "download": RevenueType.DOWNLOAD,
    "公播收益": RevenueType.PUBLIC_PERFORMANCE,
    "公播": RevenueType.PUBLIC_PERFORMANCE,
    "表演权": RevenueType.PUBLIC_PERFORMANCE,
    "performance": RevenueType.PUBLIC_PERFORMANCE,
}

PLAY_COUNT_UNIT_ALIASES: Dict[str, PlayCountUnit] = {
    "次": PlayCountUnit.TIMES,
    "万次": PlayCountUnit.TEN_THOUSAND,
    "百万次": PlayCountUnit.MILLION,
}

PER_PLAY_UNIT_ALIASES: Dict[str, PerPlayUnit] = {
    "元/次": PerPlayUnit.YUAN_PER_PLAY,
    "元/千次": PerPlayUnit.YUAN_PER_1K,
    "美元/流": PerPlayUnit.USD_PER_STREAM,
}

SHARE_FORMAT_ALIASES: Dict[str, ShareFormat] = {
    "小数": ShareFormat.DECIMAL,
    "百分比": ShareFormat.PERCENT,
    "百分数": ShareFormat.PERCENT,
}

CURRENCY_ALIASES: Dict[str, Currency] = {
    "CNY": Currency.CNY,
    "人民币": Currency.CNY,
    "元": Currency.CNY,
    "USD": Currency.USD,
    "美元": Currency.USD,
}

REVERSE_FIELD_MAP: Dict[str, str] = {}
for canonical, aliases in FIELD_ALIASES.items():
    for alias in aliases:
        REVERSE_FIELD_MAP[alias.lower()] = canonical


class FieldMapper:
    def __init__(self, custom_map: Optional[Dict[str, str]] = None):
        self.field_map = dict(REVERSE_FIELD_MAP)
        if custom_map:
            for alias, canonical in custom_map.items():
                self.field_map[alias.lower()] = canonical

    def map_header(self, header: str) -> Optional[str]:
        return self.field_map.get(header.strip().lower())

    def map_headers(self, headers: List[str]) -> Dict[str, str]:
        result = {}
        unmapped = []
        for h in headers:
            canonical = self.map_header(h)
            if canonical:
                result[h] = canonical
            else:
                unmapped.append(h)
        return result, unmapped

    def resolve_revenue_type(self, value: str) -> Optional[RevenueType]:
        return REVENUE_TYPE_ALIASES.get(value.strip())

    def resolve_play_count_unit(self, value: str) -> Optional[PlayCountUnit]:
        return PLAY_COUNT_UNIT_ALIASES.get(value.strip())

    def resolve_per_play_unit(self, value: str) -> Optional[PerPlayUnit]:
        return PER_PLAY_UNIT_ALIASES.get(value.strip())

    def resolve_share_format(self, value: str) -> Optional[ShareFormat]:
        return SHARE_FORMAT_ALIASES.get(value.strip())

    def resolve_currency(self, value: str) -> Optional[Currency]:
        return CURRENCY_ALIASES.get(value.strip())

    def row_to_record(self, row: Dict[str, str], source: str = "") -> Tuple[RoyaltyRecord, List[str]]:
        warnings = []
        mapped: Dict[str, str] = {}
        for k, v in row.items():
            canonical = self.map_header(k)
            if canonical:
                mapped[canonical] = v

        record_id = mapped.get("record_id", "UNKNOWN")
        work_title = mapped.get("work_title", "未知作品")

        rev_type_str = mapped.get("revenue_type", "流媒体播放")
        revenue_type = self.resolve_revenue_type(rev_type_str)
        if revenue_type is None:
            warnings.append(f"无法识别收益类型 '{rev_type_str}'，默认为流媒体播放")
            revenue_type = RevenueType.STREAMING

        play_count = float(mapped.get("play_count", "0"))

        pcu_str = mapped.get("play_count_unit", "万次")
        play_count_unit = self.resolve_play_count_unit(pcu_str)
        if play_count_unit is None:
            warnings.append(f"无法识别播放量单位 '{pcu_str}'，默认为万次")
            play_count_unit = PlayCountUnit.TEN_THOUSAND

        per_play = float(mapped.get("per_play_revenue", "0"))

        ppu_str = mapped.get("per_play_revenue_unit", "元/千次")
        per_play_unit = self.resolve_per_play_unit(ppu_str)
        if per_play_unit is None:
            warnings.append(f"无法识别收益单位 '{ppu_str}'，默认为元/千次")
            per_play_unit = PerPlayUnit.YUAN_PER_1K

        decay = None
        if "decay_factor" in mapped and mapped["decay_factor"]:
            try:
                decay = float(mapped["decay_factor"])
            except ValueError:
                warnings.append(f"衰减系数 '{mapped['decay_factor']}' 非数字，忽略")

        plat_share = None
        if "platform_share" in mapped and mapped["platform_share"]:
            try:
                plat_share = float(mapped["platform_share"])
            except ValueError:
                warnings.append(f"平台分成 '{mapped['platform_share']}' 非数字，忽略")

        rights_share = None
        if "rights_share" in mapped and mapped["rights_share"]:
            try:
                rights_share = float(mapped["rights_share"])
            except ValueError:
                warnings.append(f"版权分成 '{mapped['rights_share']}' 非数字，忽略")

        months = None
        if "months_since_release" in mapped and mapped["months_since_release"]:
            try:
                months = int(float(mapped["months_since_release"]))
            except ValueError:
                warnings.append(f"月数 '{mapped['months_since_release']}' 非数字，忽略")

        sf_str = mapped.get("share_format", "小数")
        share_format = self.resolve_share_format(sf_str) or ShareFormat.DECIMAL

        if share_format == ShareFormat.PERCENT:
            for fname, fval in [("platform_share", plat_share), ("rights_share", rights_share)]:
                if fval is not None and 0 < fval <= 1.0:
                    warnings.append(
                        f"⚠ {fname}={fval} 但分成格式为'百分比'，该值 ≤1.0 "
                        f"可能已是小数格式，请确认。若已为小数请将分成格式改为'小数'"
                    )

        cur_str = mapped.get("currency", "CNY")
        currency = self.resolve_currency(cur_str) or Currency.CNY

        src = mapped.get("source", source)

        record = RoyaltyRecord(
            record_id=record_id,
            work_title=work_title,
            revenue_type=revenue_type,
            play_count=play_count,
            play_count_unit=play_count_unit,
            per_play_revenue=per_play,
            per_play_revenue_unit=per_play_unit,
            decay_factor=decay,
            platform_share=plat_share,
            rights_share=rights_share,
            months_since_release=months,
            share_format=share_format,
            currency=currency,
            source=src,
            raw_fields=row,
        )

        return record, warnings
