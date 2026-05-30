from decimal import Decimal
from typing import List, Tuple, Dict
from collections import defaultdict
from .models import (
    Contract, BoxOfficeRecord, SponsorRecord, PaymentRecord,
    SettlementRecord, RecordStatus, PipelineStage
)


def detect_duplicate_guarantees(payments: List[PaymentRecord]) -> Dict[str, List[PaymentRecord]]:
    guarantee_payments = defaultdict(list)
    for p in payments:
        if "保底" in p.payment_type or "guarantee" in p.payment_type.lower():
            guarantee_payments[p.artist_name].append(p)
    duplicates = {}
    for artist, pays in guarantee_payments.items():
        if len(pays) > 1:
            duplicates[artist] = pays
    return duplicates


def detect_ratio_mismatch(
    contracts: List[Contract],
) -> List[Tuple[str, str]]:
    mismatches = []
    seen = {}
    for c in contracts:
        key = c.artist_name
        if key in seen:
            if seen[key].revenue_share_ratio != c.revenue_share_ratio:
                mismatches.append((
                    key,
                    f"艺人 {key} 存在多个分成比例: "
                    f"{seen[key].revenue_share_ratio} vs {c.revenue_share_ratio}"
                ))
        else:
            seen[key] = c
    return mismatches


def detect_missing_sponsor_deductions(
    sponsors: List[SponsorRecord],
) -> List[Tuple[str, str]]:
    issues = []
    for s in sponsors:
        if s.exposure_amount > Decimal("0") and s.deduction_amount == Decimal("0"):
            issues.append((
                s.artist_name,
                f"赞助商 {s.sponsor_name} 有露出金额 {s.exposure_amount} 但扣款为0"
            ))
    return issues


def aggregate_box_office(
    records: List[BoxOfficeRecord],
) -> Dict[str, Dict[str, Decimal]]:
    result = defaultdict(lambda: defaultdict(Decimal))
    for r in records:
        slot = r.performance_slot or "default"
        result[r.artist_name][slot] += r.ticket_revenue
    return result


def aggregate_sponsor_deductions(
    records: List[SponsorRecord],
) -> Dict[str, Decimal]:
    result = defaultdict(Decimal)
    for r in records:
        result[r.artist_name] += r.deduction_amount
    return result


def aggregate_payments(
    records: List[PaymentRecord],
) -> Dict[str, Decimal]:
    result = defaultdict(Decimal)
    for r in records:
        result[r.artist_name] += r.amount
    return result


def collect_remarks(*remark_sources: str) -> str:
    parts = [r.strip() for r in remark_sources if r and r.strip()]
    return "; ".join(parts) if parts else ""


def calculate_settlements(
    contracts: List[Contract],
    box_office_records: List[BoxOfficeRecord],
    sponsor_records: List[SponsorRecord],
    payment_records: List[PaymentRecord],
    now: str,
) -> Tuple[List[SettlementRecord], List[str]]:
    issues_log = []

    dup_guarantees = detect_duplicate_guarantees(payment_records)
    for artist, pays in dup_guarantees.items():
        amounts = ", ".join(str(p.amount) for p in pays)
        issues_log.append(f"[保底重复] 艺人 {artist} 有多笔保底付款: {amounts}")

    ratio_mismatches = detect_ratio_mismatch(contracts)
    for artist, msg in ratio_mismatches:
        issues_log.append(f"[分成比例错] {msg}")

    missing_deductions = detect_missing_sponsor_deductions(sponsor_records)
    for artist, msg in missing_deductions:
        issues_log.append(f"[赞助扣款漏算] {msg}")

    bo_agg = aggregate_box_office(box_office_records)
    sponsor_agg = aggregate_sponsor_deductions(sponsor_records)
    payment_agg = aggregate_payments(payment_records)

    artist_contracts = {}
    for c in contracts:
        key = (c.artist_name, c.performance_slot)
        if key not in artist_contracts:
            artist_contracts[key] = c

    settlements = []

    for (artist, slot), contract in sorted(artist_contracts.items()):
        guarantee = contract.guarantee_amount
        ratio = contract.revenue_share_ratio
        bo_revenue = bo_agg.get(artist, {}).get(slot, Decimal("0"))
        total_bo_revenue = sum(bo_agg.get(artist, {}).values(), Decimal("0"))

        share_amount = total_bo_revenue * ratio

        if share_amount > guarantee:
            entitlement = share_amount
            calc_method = "票房分成"
        else:
            entitlement = guarantee
            calc_method = "保底"

        sponsor_ded = sponsor_agg.get(artist, Decimal("0"))
        total_entitlement = entitlement - sponsor_ded
        if total_entitlement < Decimal("0"):
            issues_log.append(
                f"[超额扣款] 艺人 {artist} 赞助扣款({sponsor_ded})超过应得({entitlement})"
            )

        total_paid = payment_agg.get(artist, Decimal("0"))
        net_due = total_entitlement - total_paid

        artist_issues = []
        if artist in dup_guarantees:
            artist_issues.append("保底重复付款")
        for a, msg in ratio_mismatches:
            if a == artist:
                artist_issues.append("分成比例不一致")
        for a, msg in missing_deductions:
            if a == artist:
                artist_issues.append("赞助扣款未设置")

        variance_parts = []
        if net_due > Decimal("0"):
            variance_parts.append(f"应付{net_due}")
        elif net_due < Decimal("0"):
            variance_parts.append(f"多付{abs(net_due)}")
        else:
            variance_parts.append("已结清")

        if sponsor_ded > Decimal("0"):
            variance_parts.append(f"赞助抵扣{sponsor_ded}")

        contract_remarks = contract.remarks
        bo_remarks_list = [
            r.remarks for r in box_office_records
            if r.artist_name == artist and r.remarks
        ]
        sponsor_remarks_list = [
            r.remarks for r in sponsor_records
            if r.artist_name == artist and r.remarks
        ]
        payment_remarks_list = [
            r.remarks for r in payment_records
            if r.artist_name == artist and r.remarks
        ]
        all_remarks = collect_remarks(
            contract_remarks,
            "; ".join(bo_remarks_list),
            "; ".join(sponsor_remarks_list),
            "; ".join(payment_remarks_list),
        )

        settlements.append(SettlementRecord(
            artist_name=artist,
            performance_slot=slot,
            guarantee_amount=guarantee,
            box_office_revenue=total_bo_revenue,
            revenue_share_ratio=ratio,
            revenue_share_amount=share_amount,
            sponsor_deduction=sponsor_ded,
            total_entitlement=total_entitlement,
            total_paid=total_paid,
            net_due=net_due,
            issues="; ".join(artist_issues) if artist_issues else "",
            variance_explanation=f"({calc_method}) " + ", ".join(variance_parts),
            remarks=all_remarks,
            status=RecordStatus.PROVISIONAL,
            stage=PipelineStage.SETTLEMENT_CALCULATED,
            created_at=now,
            updated_at=now,
        ))

    return settlements, issues_log
