import json
import os
from typing import List, Dict
from collections import defaultdict
import decimal

from .models import SponsorTerm, RecordStatus


def load_sponsors(input_dir: str) -> List[SponsorTerm]:
    sp_dir = os.path.join(input_dir, "sponsors")
    if not os.path.isdir(sp_dir):
        return []
    results = []
    for fname in sorted(os.listdir(sp_dir)):
        fpath = os.path.join(sp_dir, fname)
        if not fname.endswith(".json"):
            continue
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            data = [data]
        for item in data:
            s = SponsorTerm(
                sponsor_id=item["sponsor_id"],
                sponsor_name=item["sponsor_name"],
                exposure_type=item["exposure_type"],
                amount=decimal.Decimal(str(item["amount"])),
                artist_ids=item.get("artist_ids", []),
                deduction_ratio=decimal.Decimal(str(item.get("deduction_ratio", "0"))),
                notes=item.get("notes", ""),
                status=RecordStatus(item.get("status", "pending")),
                source_file=os.path.basename(fpath),
            )
            results.append(s)
    return results


def calculate_deductions(
    sponsors: List[SponsorTerm],
    all_artist_ids: List[str],
) -> Dict[str, decimal.Decimal]:
    artist_deduction: Dict[str, decimal.Decimal] = defaultdict(decimal.Decimal)

    for sp in sponsors:
        if sp.deduction_ratio <= 0:
            continue
        target_artists = sp.artist_ids if sp.artist_ids else all_artist_ids
        if not target_artists:
            continue
        per_artist = (sp.amount * sp.deduction_ratio) / len(target_artists)
        for aid in target_artists:
            artist_deduction[aid] += per_artist

    return dict(artist_deduction)
