import decimal
from typing import List, Dict, Tuple
from collections import defaultdict
from datetime import datetime

from .models import (
    ArtistContract, PaymentRecord, SettlementLine, AnomalyItem, RecordStatus,
)
from .db import Database


def calculate_settlement(
    contracts: List[ArtistContract],
    artist_boxoffice: Dict[str, decimal.Decimal],
    artist_deductions: Dict[str, decimal.Decimal],
    payments: List[PaymentRecord],
    db: Database,
) -> List[SettlementLine]:
    existing_settlements = {s.artist_id: s for s in db.get_settlements()}

    artist_payments: Dict[str, decimal.Decimal] = defaultdict(decimal.Decimal)
    for p in payments:
        artist_payments[p.artist_id] += p.amount

    artist_names: Dict[str, str] = {}
    for c in contracts:
        if c.artist_id not in artist_names:
            artist_names[c.artist_id] = c.artist_name

    all_artist_ids = set()
    for c in contracts:
        all_artist_ids.add(c.artist_id)
    all_artist_ids.update(artist_boxoffice.keys())
    all_artist_ids.update(artist_deductions.keys())

    guarantees: Dict[str, decimal.Decimal] = defaultdict(decimal.Decimal)
    share_ratios: Dict[str, decimal.Decimal] = defaultdict(decimal.Decimal)
    for c in contracts:
        guarantees[c.artist_id] += c.guarantee_amount
        if c.revenue_share_ratio > share_ratios[c.artist_id]:
            share_ratios[c.artist_id] = c.revenue_share_ratio

    results: List[SettlementLine] = []
    for aid in sorted(all_artist_ids):
        guarantee = guarantees.get(aid, decimal.Decimal("0"))
        gross_box = artist_boxoffice.get(aid, decimal.Decimal("0"))
        ratio = share_ratios.get(aid, decimal.Decimal("0"))
        box_share = gross_box * ratio
        deduction = artist_deductions.get(aid, decimal.Decimal("0"))
        total_due = guarantee + box_share - deduction
        total_paid = artist_payments.get(aid, decimal.Decimal("0"))
        variance = total_paid - total_due

        existing = existing_settlements.get(aid)
        sid = existing.settlement_id if existing else f"STL_{aid}"
        status = existing.status if existing else RecordStatus.PENDING
        existing_notes = existing.notes if existing else ""

        notes_parts = []
        if existing_notes:
            notes_parts.append(existing_notes)
        if box_share > decimal.Decimal("0") and ratio == decimal.Decimal("0"):
            notes_parts.append("有票房收入但无分成比例,票房分成按0计")
        if guarantee > decimal.Decimal("0") and gross_box == decimal.Decimal("0"):
            notes_parts.append("有保底但无票房记录")

        sl = SettlementLine(
            settlement_id=sid,
            artist_id=aid,
            artist_name=artist_names.get(aid, aid),
            guarantee_amount=guarantee,
            box_office_share=box_share.quantize(decimal.Decimal("0.01")),
            sponsor_deduction=deduction.quantize(decimal.Decimal("0.01")),
            total_due=total_due.quantize(decimal.Decimal("0.01")),
            total_paid=total_paid.quantize(decimal.Decimal("0.01")),
            variance=variance.quantize(decimal.Decimal("0.01")),
            notes="; ".join(notes_parts) if notes_parts else "",
            status=status,
        )
        results.append(sl)

    return results


def explain_variance(settlement: SettlementLine) -> str:
    v = settlement.variance
    if v == decimal.Decimal("0"):
        return "完全匹配"
    elif v > decimal.Decimal("0"):
        return f"多付 {v}"
    else:
        return f"少付 {abs(v)}"
