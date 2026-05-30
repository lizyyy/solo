import uuid
from typing import List, Dict, Set, Tuple
from collections import defaultdict
import decimal

from .models import (
    ArtistContract, SponsorTerm, AnomalyItem,
)


VALID_SHARE_RANGES = {
    "headliner": (decimal.Decimal("0.05"), decimal.Decimal("0.50")),
    "support": (decimal.Decimal("0.02"), decimal.Decimal("0.30")),
    "opener": (decimal.Decimal("0.01"), decimal.Decimal("0.20")),
}


def detect_anomalies(
    contracts: List[ArtistContract],
    sponsors: List[SponsorTerm],
    artist_boxoffice: Dict[str, decimal.Decimal],
    artist_deductions: Dict[str, decimal.Decimal],
) -> List[AnomalyItem]:
    anomalies: List[AnomalyItem] = []
    anomalies.extend(_check_duplicate_guarantees(contracts))
    anomalies.extend(_check_share_ratios(contracts))
    anomalies.extend(_check_sponsor_deduction_coverage(contracts, sponsors, artist_deductions))
    return anomalies


def _check_duplicate_guarantees(contracts: List[ArtistContract]) -> List[AnomalyItem]:
    anomalies: List[AnomalyItem] = []
    artist_contracts: Dict[str, List[ArtistContract]] = defaultdict(list)
    for c in contracts:
        artist_contracts[c.artist_id].append(c)

    for artist_id, cts in artist_contracts.items():
        if len(cts) <= 1:
            continue
        guarantee_amounts: Dict[decimal.Decimal, List[ArtistContract]] = defaultdict(list)
        for c in cts:
            guarantee_amounts[c.guarantee_amount].append(c)

        for amount, dupes in guarantee_amounts.items():
            if len(dupes) > 1:
                contract_ids = ", ".join(c.contract_id for c in dupes)
                anomalies.append(AnomalyItem(
                    anomaly_id=_uid("dup_guar"),
                    anomaly_type="duplicate_guarantee",
                    entity_type="contract",
                    entity_id=artist_id,
                    description=(
                        f"艺人 {dupes[0].artist_name}({artist_id}) 存在保底金额重复: "
                        f"金额 {amount}, 涉及合同 {contract_ids}"
                    ),
                    severity="error",
                ))

    return anomalies


def _check_share_ratios(contracts: List[ArtistContract]) -> List[AnomalyItem]:
    anomalies: List[AnomalyItem] = []

    for c in contracts:
        ratio = c.revenue_share_ratio
        if ratio < 0 or ratio > 1:
            anomalies.append(AnomalyItem(
                anomaly_id=_uid("bad_ratio"),
                anomaly_type="invalid_share_ratio",
                entity_type="contract",
                entity_id=c.contract_id,
                description=(
                    f"艺人 {c.artist_name}({c.artist_id}) 分成比例异常: "
                    f"{ratio} (超出0~1范围), 合同 {c.contract_id}"
                ),
                severity="error",
            ))
            continue

        stage_type = c.stage.lower() if c.stage else "headliner"
        if "压轴" in c.stage or "headliner" in stage_type:
            stage_type = "headliner"
        elif "暖场" in c.stage or "opener" in stage_type:
            stage_type = "opener"
        else:
            stage_type = "support"

        lo, hi = VALID_SHARE_RANGES.get(stage_type, (decimal.Decimal("0.01"), decimal.Decimal("0.50")))
        if ratio < lo or ratio > hi:
            anomalies.append(AnomalyItem(
                anomaly_id=_uid("sus_ratio"),
                anomaly_type="suspicious_share_ratio",
                entity_type="contract",
                entity_id=c.contract_id,
                description=(
                    f"艺人 {c.artist_name}({c.artist_id}) 分成比例可能异常: "
                    f"{ratio}, 舞台类型'{c.stage}'合理范围[{lo}, {hi}], 合同 {c.contract_id}"
                ),
                severity="warning",
            ))

    return anomalies


def _check_sponsor_deduction_coverage(
    contracts: List[ArtistContract],
    sponsors: List[SponsorTerm],
    artist_deductions: Dict[str, decimal.Decimal],
) -> List[AnomalyItem]:
    anomalies: List[AnomalyItem] = []

    artists_with_sponsor: Set[str] = set()
    for sp in sponsors:
        if sp.deduction_ratio > 0:
            for aid in sp.artist_ids:
                artists_with_sponsor.add(aid)
            if not sp.artist_ids:
                for c in contracts:
                    artists_with_sponsor.add(c.artist_id)

    for c in contracts:
        has_sponsor = c.artist_id in artists_with_sponsor
        has_deduction = c.artist_id in artist_deductions and artist_deductions[c.artist_id] > 0
        if has_sponsor and not has_deduction:
            anomalies.append(AnomalyItem(
                anomaly_id=_uid("miss_ded"),
                anomaly_type="missing_sponsor_deduction",
                entity_type="contract",
                entity_id=c.contract_id,
                description=(
                    f"艺人 {c.artist_name}({c.artist_id}) 有赞助条款涉及但赞助扣款漏算, "
                    f"合同 {c.contract_id}"
                ),
                severity="error",
            ))

    return anomalies


_uid_counter = 0


def _uid(prefix: str) -> str:
    global _uid_counter
    _uid_counter += 1
    return f"{prefix}_{_uid_counter:06d}"
