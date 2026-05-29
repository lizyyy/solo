from typing import List, Dict
from ..models import Track, PlatformFee, SettlementItem, SettlementResult, AuthorShare
from datetime import datetime


class RoyaltyCalculator:
    def __init__(self, total_box_office: float, performance_id: str,
                 performance_name: str, performance_date: str, operator: str):
        self.total_box_office = total_box_office
        self.performance_id = performance_id
        self.performance_name = performance_name
        self.performance_date = performance_date
        self.operator = operator

    def calculate(self, tracks: List[Track], fees: List[PlatformFee],
                  fee_breakdown: Dict[str, float]) -> SettlementResult:
        total_fees = sum(f.amount for f in fees)
        net_distributable = self.total_box_office - total_fees

        total_duration = sum(t.total_duration() for t in tracks)

        items: List[SettlementItem] = []
        author_summary: Dict[str, Dict[str, float]] = {}

        for track in tracks:
            if not track.authors:
                continue

            track_duration = track.total_duration()
            track_ratio = track_duration / total_duration if total_duration > 0 else 0
            track_gross = self.total_box_office * track_ratio

            fee_ratio = track_gross / self.total_box_office if self.total_box_office > 0 else 0
            track_fee = total_fees * fee_ratio
            track_net = track_gross - track_fee

            for author in track.authors:
                final_ratio = track_ratio * author.ratio
                author_gross = track_gross * author.ratio
                author_fee = track_fee * author.ratio
                author_net = track_net * author.ratio

                is_medley = "来自串烧" in (track.notes or "")
                medley_parent = None
                if is_medley and "来自串烧[" in (track.notes or ""):
                    start = track.notes.find("[") + 1
                    end = track.notes.find("]")
                    if start > 0 and end > start:
                        medley_parent = track.notes[start:end]

                item = SettlementItem(
                    track_id=track.id,
                    track_name=track.name,
                    author_id=author.author_id,
                    author_name=author.author_name,
                    author_role=author.role.value,
                    track_duration_seconds=track_duration,
                    track_ratio=track_ratio,
                    author_ratio=author.ratio,
                    final_ratio=final_ratio,
                    gross_amount=author_gross,
                    fee_deduction=author_fee,
                    net_amount=author_net,
                    is_medley=is_medley,
                    medley_parent=medley_parent,
                    notes=track.notes or "",
                )
                items.append(item)

                if author.author_name not in author_summary:
                    author_summary[author.author_name] = {
                        "gross_amount": 0.0,
                        "fee_deduction": 0.0,
                        "net_amount": 0.0,
                        "track_count": 0,
                    }
                author_summary[author.author_name]["gross_amount"] += author_gross
                author_summary[author.author_name]["fee_deduction"] += author_fee
                author_summary[author.author_name]["net_amount"] += author_net
                author_summary[author.author_name]["track_count"] += 1

        result = SettlementResult(
            performance_id=self.performance_id,
            performance_name=self.performance_name,
            performance_date=self.performance_date,
            total_box_office=self.total_box_office,
            total_fees=total_fees,
            net_distributable=net_distributable,
            total_duration_seconds=total_duration,
            items=items,
            fee_breakdown=fee_breakdown,
            author_summary=author_summary,
            operator=self.operator,
        )

        return result
